import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getRandomUA = () => {
  const os = [
    'Windows NT 10.0; Win64; x64',
    'Macintosh; Intel Mac OS X 10_15_7',
    'X11; Linux x86_64'
  ];
  const chrome = `Chrome/${Math.floor(Math.random() * 30) + 100}.0.0.0`;
  return `Mozilla/5.0 (${os[Math.floor(Math.random() * os.length)]}) AppleWebKit/537.36 (KHTML, like Gecko) ${chrome} Safari/537.36`;
};

const formatSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

class DouyinScraper {
  constructor() {
    this.apiUrl = "https://lovetik.app/api/ajaxSearch";
    this.baseHeaders = {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Accept": "*/*",
      "Origin": "https://lovetik.app",
      "Referer": "https://lovetik.app/en",
      "X-Requested-With": "XMLHttpRequest",
      "Connection": "keep-alive"
    };
  }

  async fetchMetadata(url) {
    try {
      const currentUA = getRandomUA();
      console.log(`[LOG] Fetching metadata dengan UA: ${currentUA}`);

      const payload = new URLSearchParams({ q: url, lang: "en" });
      
      const { data } = await axios.post(this.apiUrl, payload, {
        headers: {
          ...this.baseHeaders,
          "User-Agent": currentUA
        },
        timeout: 20000 
      });

      if (!data || !data.data) {
        throw new Error("[ERR] API Lovetik return kosong atau kena rate limit.");
      }

      const $ = cheerio.load(data.data);
      
      let title = $('h3').text().trim() || 
                  $('.main-info .desc').text().trim() || 
                  "No Title / Caption";
      
      let thumbnail = $('img').attr('src');
      
      let videoUrl = $('a[download]').first().attr('href') || 
                     $('a:contains("NO WATERMARK")').attr('href') ||
                     $('a:contains("Download Video")').attr('href');

      let audioUrl = $('a:contains("Download MP3")').attr('href') || 
                     $('a[href*=".mp3"]').attr('href');

      if (!videoUrl) {
        console.log("[WARN] Selector gagal, mencoba Regex search...");
        const match = data.data.match(/https:\/\/(dl\.snapcdn\.app|v\d+-cold\.douyinvod\.com|tikwm\.com)[^"]+/);
        if (match) videoUrl = match[0];
      }

      if (!videoUrl) throw new Error("[404] Link video tidak ditemukan dalam response.");

      if (videoUrl.startsWith('//')) {
        videoUrl = 'https:' + videoUrl;
      }

      new URL(videoUrl);

      return {
        title: title.replace(/\n/g, ' '),
        thumbnail,
        videoUrl,
        audioUrl,
        source: url.includes('douyin') ? 'Douyin' : 'TikTok',
        author: $('p').first().text().trim() || 'Unknown' 
      };

    } catch (error) {
      console.error("[ERR] Scraper Error:", error.message);
      throw error;
    }
  }

  async downloadFile(url, outputPath) {
    try {
      const writer = fs.createWriteStream(outputPath);
      
      const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
        maxRedirects: 5,
        headers: {
          'User-Agent': getRandomUA(),
          'Referer': 'https://lovetik.app/'
        },
        timeout: 60000
      });

      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
            const stats = fs.statSync(outputPath);
            if (stats.size < 1000) { 
                reject(new Error("File corrupt (size terlalu kecil)."));
            }
            resolve(outputPath);
        });
        writer.on('error', (err) => {
          writer.close();
          fs.unlink(outputPath, () => {}); 
          reject(err);
        });
      });
    } catch (e) {
      if (e.response?.status === 403) {
        throw new Error("[403] Forbidden. IP Server mungkin di-blacklist source.");
      }
      throw new Error(`[DL_FAIL] Gagal download: ${e.message}`);
    }
  }
}

let handler = async (m, { conn, args, q, command, reply }) => {
  const inputUrl = q || args.join(' ');

  if (!inputUrl) {
    return reply(`
[ ! ] PERINTAH SALAH

Gunakan format:
>>> ${command} <URL_Douyin_atau_TikTok>

Contoh:
>>> ${command} https://www.douyin.com/video/7256984651137289483
`);
  }

  const regexCheck = /(douyin\.com|tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)/i;
  if (!regexCheck.test(inputUrl)) {
    return reply('[ ! ] URL Invalid. Pastikan link dari Douyin atau TikTok.');
  }

  reply(`[ ... ] Memproses request dari ${inputUrl.includes('douyin') ? 'Douyin' : 'TikTok'}...`);

  const scraper = new DouyinScraper();
  
  const tmpDir = path.resolve('./tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const uniqueId = Date.now();
  const videoPath = path.join(tmpDir, `vid_${uniqueId}.mp4`);
  const audioPath = path.join(tmpDir, `aud_${uniqueId}.mp3`);

  try {
    const data = await scraper.fetchMetadata(inputUrl);

    await scraper.downloadFile(data.videoUrl, videoPath);

    const stats = fs.statSync(videoPath);
    const sizeFormatted = formatSize(stats.size);
    const sizeMB = stats.size / (1024 * 1024);

    if (sizeMB > 150) {
      throw new Error(`[LIMIT] File terlalu besar: ${sizeFormatted}. Batas max 150MB.`);
    }

    const caption = 
`[ MEDIA DOWNLOADER ]
====================
[>] Source : ${data.source}
[>] Author : ${data.author}
[>] Title  : ${data.title}
[>] Size   : ${sizeFormatted}
====================
[<] Credit By Yunxi Assistant `;

    await conn.sendMessage(m.chat, { 
      video: fs.readFileSync(videoPath), // Note: Kalau bisa pakai buffer stream lebih bagus, tapi readFileSync aman buat < 100MB
      caption,
      mimetype: 'video/mp4'
    }, { quoted: m });

    if (data.audioUrl) {
        // Kasih feedback kecil kalau lagi narik audio
        // await conn.sendMessage(m.chat, { text: '[...] Mengambil audio...' }, { quoted: m }); 
        
        try {
            await scraper.downloadFile(data.audioUrl, audioPath);
            await conn.sendMessage(m.chat, {
                audio: fs.readFileSync(audioPath),
                mimetype: 'audio/mpeg',
                ptt: false 
            }, { quoted: m });
        } catch (err) {
            console.log("[LOG] Audio skip:", err.message);
        }
    }

  } catch (e) {
    console.error('[ERR] Handler Error:', e);
    
    let errorMessage = '[ x ] Terjadi kesalahan sistem.';
    
    if (e.message.includes('403')) {
      errorMessage = '[ x ] Akses ditolak oleh server (403). Coba lagi nanti.';
    } else if (e.message.includes('[404]')) {
      errorMessage = '[ x ] Video tidak ditemukan atau Private.';
    } else if (e.message.includes('[LIMIT]')) {
      errorMessage = e.message;
    } else {
      errorMessage = `[ x ] Error: ${e.message}`;
    }

    reply(errorMessage);

  } finally {
    [videoPath, audioPath].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlink(file, (err) => {
            if (err) console.error(`[WARN] Gagal hapus temp: ${file}`);
        });
      }
    });
  }
};

handler.help = ['douyin', 'tiktok'];
handler.tags = ['downloader'];
handler.command = /^(douyin|dy|tiktok|tt|ttdl)$/i;

export default handler;