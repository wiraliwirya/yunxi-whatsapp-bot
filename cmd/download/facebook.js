import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ui = {
    info: '[ INFO ]',
    err: '[ ERR! ]',
    succ: '[ OKAY ]',
    wait: '[ WAIT ]',
    sep: '========================='
};

class FacebookDownloader {
  constructor() {
    this.baseUrl = 'https://getvidfb.com'; 
    this.headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://getvidfb.com/',
        'Origin': 'https://getvidfb.com',
        'Content-Type': 'application/x-www-form-urlencoded'
    };
  }

  async scrape(url) {
    try {
      const formData = new URLSearchParams();
      formData.append('url', url);
      formData.append('lang', 'en');
      formData.append('type', 'redirect'); 

      const response = await axios.post(this.baseUrl, formData, {
        headers: this.headers,
        timeout: 30000 
      });

      const $ = cheerio.load(response.data);
      const videoContainer = $('#snaptik-video');

      if (!videoContainer.length) {
        throw new Error('Video container not found. Kemungkinan Private atau Link Reels/Story invalid.');
      }

      const thumb = videoContainer.find('.snaptik-left img').attr('src') || '';
      const title = videoContainer.find('.snaptik-middle h3').text().trim() || 'Facebook Video';
      
      const results = [];
      
      videoContainer.find('.abuttons a').each((_, el) => {
        const link = $(el).attr('href');
        const text = $(el).text().trim().toUpperCase();
        
        if (link && link.startsWith('http')) {
          let quality = 'SD';
          if (text.includes('HD')) quality = 'HD';
          if (text.includes('RENDER')) return;
          results.push({ 
            url: link, 
            quality: quality,
            is_hd: quality === 'HD'
          });
        }
      });

      if (results.length === 0) throw new Error('Link download kosong. Video mungkin dihapus.');

      results.sort((a, b) => (b.is_hd ? 1 : 0) - (a.is_hd ? 1 : 0));

      return {
        title: title,
        thumbnail: thumb,
        downloads: results
      };

    } catch (err) {
      const msg = err.response ? `HTTP ${err.response.status}` : err.message;
      throw new Error(`Scrape Failed: ${msg}`);
    }
  }

  async downloadVideo(url, outputPath) {
    try {
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 60000 
        });

        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(outputPath));
            writer.on('error', (err) => {
                fs.unlink(outputPath, () => {});
                reject(err);
            });
        });
    } catch (error) {
        throw new Error(`Download Stream Error: ${error.message}`);
    }
  }
}

let handler = async (m, { conn, args, q, command, reply }) => {
  const inputUrl = q || (args && args.length > 0 ? args.join(' ') : '');

  const fbRegex = /^(https?:\/\/)?(www\.|web\.|m\.|business\.)?(facebook|fb)\.(com|watch)\/.+$/i;

  if (!inputUrl) return reply(`${ui.info} URL DIBUTUHKAN.\nCMD: ${command} <url_facebook>`);
  if (!fbRegex.test(inputUrl)) return reply(`${ui.err} Invalid Facebook URL.`);

  reply(`${ui.wait} Fetching data from Facebook...`);

  const downloader = new FacebookDownloader();
  
  const tmpDir = path.resolve('./tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const filename = `fb_${Date.now()}_${Math.floor(Math.random() * 1000)}.mp4`;
  const filePath = path.join(tmpDir, filename);

  try {
    const data = await downloader.scrape(inputUrl);

    const selectedVideo = data.downloads[0]; 

    if (!selectedVideo) throw new Error("Video source invalid.");

    let caption = `┌ ${ui.info} FACEBOOK DATA\n`;
    caption += `│ Title   : ${data.title}\n`;
    caption += `│ Quality : ${selectedVideo.quality}\n`;
    caption += `└ ${ui.sep}`;

    await downloader.downloadVideo(selectedVideo.url, filePath);

    const stats = fs.statSync(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);

    if (fileSizeMB > 100) {
        throw new Error(`File oversize (${fileSizeMB.toFixed(2)} MB). Max limit 100MB.`);
    }

    await conn.sendMessage(m.chat, { 
      video: fs.readFileSync(filePath), 
      caption: caption,
      mimetype: 'video/mp4'
    }, { quoted: m });

  } catch (e) {
    console.error('[FB Handler Error]', e);
    if (e.message.includes('Scrape Failed')) {
        reply(`${ui.err} Gagal mengambil metadata. Pastikan video PUBLIC, bukan link Group Private.`);
    } else {
        reply(`${ui.err} System Error: ${e.message}`);
    }
  } finally {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
  }
};

handler.help = ['facebook', 'fb', 'fbdl'];
handler.tags = ['downloader'];
handler.command = /^(facebook|fb|fbdl)$/i;

export default handler;