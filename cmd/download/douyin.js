import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DouyinScraper {
  constructor() {
    this.apiUrl = "https://lovetik.app/api/ajaxSearch";
    this.headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Accept": "*/*",
      "Origin": "https://lovetik.app",
      "Referer": "https://lovetik.app/en",
      "X-Requested-With": "XMLHttpRequest"
    };
  }

  async fetchMetadata(url) {
    try {
      const payload = new URLSearchParams({ q: url, lang: "en" });
      
      console.log(`📡 Scraping metadata: ${url}`);
      
      const { data } = await axios.post(this.apiUrl, payload, {
        headers: this.headers,
        timeout: 15000
      });

      if (!data?.data) {
        throw new Error("API response kosong. IP lu kena block Cloudflare?");
      }

      const $ = cheerio.load(data.data);
      
      let title = $('h3').text().trim() || "Douyin Video";
      let thumbnail = $('img').attr('src');
      let videoUrl = $('a[download]').attr('href') || 
                     $('a:contains("Download Video")').attr('href') ||
                     $('a:contains("NO WATERMARK")').attr('href');
      let audioUrl = $('a:contains("Download MP3")').attr('href');

      if (!videoUrl) {
        const match = data.data.match(/https:\/\/(dl\.snapcdn\.app|v\d+-cold\.douyinvod\.com)[^"]+/);
        if (match) videoUrl = match[0];
      }

      if (!videoUrl) throw new Error("Link download ga ketemu anjir!");

      if (videoUrl.startsWith('//')) {
        videoUrl = 'https:' + videoUrl;
      }

      new URL(videoUrl);

      return {
        title,
        thumbnail,
        videoUrl,
        audioUrl,
        source: url.includes('douyin') ? 'Douyin' : 'TikTok'
      };

    } catch (error) {
      console.error("❌ Douyin Scraper Error:", error.message);
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
          'User-Agent': this.headers['User-Agent'],
          'Referer': 'https://lovetik.app/'
        },
        timeout: 60000
      });

      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', (err) => {
          writer.close();
          fs.unlink(outputPath, () => {});
          reject(err);
        });
      });
    } catch (e) {
      if (e.response?.status === 403) {
        throw new Error("403 Forbidden. Douyin blokir IP server lu!");
      }
      throw new Error(`Download gagal: ${e.message}`);
    }
  }
}

let handler = async (m, { conn, args, q, command, reply }) => {
  const inputUrl = q || args.join(' ');

  // Validasi input
  if (!inputUrl) {
    return reply(`Kirim URL Douyin/TikTok dong!

*Contoh:* ${command} https://www.douyin.com/video/7256984651137289483`);
  }

  if (!/(douyin.com|tiktok.com)/i.test(inputUrl)) {
    return reply('URL ga valid! Harus dari douyin.com atau tiktok.com');
  }

  reply(`⏳ Proses ${inputUrl.includes('douyin') ? 'Douyin' : 'TikTok'}...`);

  const scraper = new DouyinScraper();
  
  const tmpDir = path.resolve('./tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const uniqueId = Date.now();
  const videoPath = path.join(tmpDir, `dy_${uniqueId}.mp4`);
  const audioPath = path.join(tmpDir, `dy_${uniqueId}.mp3`);

  try {
    const data = await scraper.fetchMetadata(inputUrl);

    await scraper.downloadFile(data.videoUrl, videoPath);

    const stats = fs.statSync(videoPath);
    const sizeMB = stats.size / (1024 * 1024);
    
    if (sizeMB < 0.1) throw new Error("File kosong! Corrupt nih.");
    if (sizeMB > 150) throw new Error(`File kegedean (${sizeMB.toFixed(2)} MB). Max 150MB!`);

    const caption = `🎥 *${data.source} Downloader*
` +
                    `──────────────────
` +
                    `📝 *Judul:* ${data.title}
` +
                    `💾 *Ukuran:* ${sizeMB.toFixed(2)} MB
` +
                    `──────────────────
` +
                    `_Lovetik Engine_`;

    await conn.sendMessage(m.chat, { 
      video: fs.readFileSync(videoPath), 
      caption,
      mimetype: 'video/mp4'
    }, { quoted: m });

    if (data.audioUrl) {
      try {
        await scraper.downloadFile(data.audioUrl, audioPath);
        await conn.sendMessage(m.chat, {
          audio: fs.readFileSync(audioPath),
          mimetype: 'audio/mpeg',
          ptt: false
        }, { quoted: m });
      } catch (err) {
        console.log("Audio gagal:", err.message);
      }
    }

  } catch (e) {
    console.error('❌ Handler Error:', e);
    
    if (e.message.includes('403')) {
      reply('❌ IP server diblokir Douyin. Coba lagi besok.');
    } else if (e.message.includes('tidak ditemukan') || e.message.includes('ga ketemu')) {
      reply('❌ Video private atau udah dihapus.');
    } else {
      reply(`❌ Error: ${e.message}`);
    }
  } finally {
    [videoPath, audioPath].forEach(file => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });
  }
};

handler.help = ['douyin', 'tiktok'];
handler.tags = ['downloader'];
handler.command = /^(douyin|dy|tiktok|tt|ttdl)$/i;

export default handler;