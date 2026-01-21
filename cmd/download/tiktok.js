import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TikTokDownloader {
  constructor() {
    this.apiUrl = 'https://myapi.app/api';
    this.sitename = 'tikmate.cc';
    this.headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://tikmate.cc/'
    };
  }

  formatQuality(quality) {
    const qualityMap = {
      'hd_no_watermark': '1080p (HD)',
      'no_watermark': '720p (SD)',
      'watermark': 'Watermarked',
      'audio': 'Audio Only'
    };
    return qualityMap[quality] || quality;
  }

  async analyzeVideo(tiktokUrl) {
    try {
      const response = await axios.post(`${this.apiUrl}/analyze`, 
        new URLSearchParams({
          url: tiktokUrl,
          sitename: this.sitename
        }), {
          headers: {
            ...this.headers,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const data = response.data;

      if (data.error === true) {
        throw new Error('API nolak request lu. Video private atau link busuk.');
      }

      let medias = data.medias.filter(media => media.quality !== 'watermark');

      medias = medias.map(media => ({
        url: media.url,
        extension: media.extension?.toUpperCase() || 'MP4',
        quality: this.formatQuality(media.quality),
        is_audio: media.extension === 'mp3'
      }));

      medias.reverse();

      return {
        id: data.id,
        title: data.title,
        author: {
            name: data.author.name || data.author.unique_id,
            avatar: data.author.avatar
        },
        thumbnail: data.thumbnail,
        duration: data.duration, 
        filename: data.filename,
        medias: medias
      };

    } catch (error) {
      console.error('[TikTok Analyze Error]:', error.message);
      throw error;
    }
  }

  getDownloadUrl(mediaUrl) {
    return `${this.apiUrl}/download?url=${encodeURIComponent(mediaUrl)}&sitename=${this.sitename}`;
  }

  async downloadVideo(mediaUrl, outputPath) {
    const downloadUrl = this.getDownloadUrl(mediaUrl);

    try {
      const response = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'stream',
        headers: this.headers
      });

      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', (err) => {
            fs.unlink(outputPath, () => {}); 
            reject(err);
        });
      });

    } catch (error) {
      console.error('[Download Failed]:', error.message);
      throw new Error('Gagal download file. Koneksi putus atau IP diblokir.');
    }
  }
}

let handler = async (m, { conn, args, q, command, reply }) => {
  const inputUrl = q || (args && args.length > 0 ? args.join(' ') : '');

  if (!inputUrl) return reply(`Mana link-nya?\nFormat: ${command} https://vt.tiktok.com/xxxx/`);
  if (!/tiktok\.com/i.test(inputUrl)) return reply('Mata dipake, itu bukan link TikTok.');

  reply('Tunggu bentar, lagi diproses...');

  const downloader = new TikTokDownloader();
  const tmpDir = path.resolve('./tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const filename = `tt_${Date.now()}_${Math.floor(Math.random() * 1000)}.mp4`;
  const filePath = path.join(tmpDir, filename);

  try {
    const data = await downloader.analyzeVideo(inputUrl);
    
    const videoMedia = data.medias.find(m => !m.is_audio) || data.medias[0];
    
    if (!videoMedia) {
        throw new Error('Video gak ketemu, isinya cuma gambar atau audio doang.');
    }

    await downloader.downloadVideo(videoMedia.url, filePath);

    const stats = fs.statSync(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    if (fileSizeMB > 100) {
        throw new Error(`File kegedean (${fileSizeMB.toFixed(2)} MB), males upload.`);
    }

    let caption = `*TikTok Downloader*\n\n`;
    caption += `*Desc:* ${data.title}\n`;
    caption += `*Author:* ${data.author.name}\n`;
    caption += `*Durasi:* ${data.duration}\n`;
    caption += `*Kualitas:* ${videoMedia.quality}\n`;

    await conn.sendMessage(m.chat, { 
        video: fs.readFileSync(filePath), 
        caption: caption,
        mimetype: 'video/mp4'
    }, { quoted: m });


    const audioMedia = data.medias.find(m => m.is_audio);
    if (audioMedia) {
        await conn.sendMessage(m.chat, { 
            audio: { url: downloader.getDownloadUrl(audioMedia.url) }, 
            mimetype: 'audio/mpeg' 
        }, { quoted: m });
    }
   
  } catch (e) {
    console.error('[Handler Error]:', e);
    if (e.message.includes('404')) {
        reply('Video gak ada. Udah dihapus atau akunnya di-private.');
    } else {
        reply(`Gagal bos: ${e.message}`);
    }
  } finally {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
  }
};

handler.help = ['tiktokv2', 'tt2', 'ttdl2'];
handler.tags = ['downloader'];
handler.command = /^(tiktokv2|tt2|ttdl2|tikdl2)$/i;

export default handler;
