import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class YouTubeDownloader {
  constructor() {
    this.baseUrl = 'https://p.savenow.to';
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:146.0) Gecko/20100101 Firefox/146.0',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': 'https://y2down.cc/',
      'Origin': 'https://y2down.cc',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
      'Priority': 'u=4',
      'Pragma': 'no-cache',
      'Cache-Control': 'no-cache'
    };
    
    this.audioFormats = ['mp3', 'm4a', 'webm', 'aac', 'flac', 'opus', 'ogg', 'wav'];
    this.videoFormats = ['4k', '1440', '1080', '720', '480', '320', '240', '144'];
    this.supportedFormats = [...this.audioFormats, ...this.videoFormats];
  }

  validateFormat(formatQuality) {
    if (!this.supportedFormats.includes(formatQuality)) {
      console.log(`Format '${formatQuality}' mungkin ga support`);
      return false;
    }
    return true;
  }

  async requestDownload(youtubeUrl, formatQuality = '720') {
    this.validateFormat(formatQuality);
    
    const params = {
      copyright: '0',
      format: formatQuality,
      url: youtubeUrl,
      api: 'dfcb6d76f2f6a9894gjkege8a4ab232222'
    };

    try {
      const response = await axios.get(`${this.baseUrl}/ajax/download.php`, {
        params,
        headers: this.headers,
        timeout: 30000
      });

      if (response.data.progress_url) {
        return {
          progress_url: response.data.progress_url,
          title: response.data.info?.title || null,
          image: response.data.info?.image || null
        };
      }
      return null;

    } catch (error) {
      return null;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async checkProgress(progressUrl, maxAttempts = 60, delay = 2000) {
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await axios.get(progressUrl, {
          headers: this.headers,
          timeout: 30000
        });

        const data = response.data;
        const downloadUrl = data.download_url || '';

        if (downloadUrl && downloadUrl.trim() !== '') {
          return { download_url: downloadUrl };
        }

        if (data.error || (data.success === 0 && (data.text || '').toLowerCase().includes('error'))) {
          console.log('Error:', data.message || 'Unknown error');
          return null;
        }

        attempts++;
        await this.sleep(delay);

      } catch (error) {
        attempts++;
        await this.sleep(delay);
      }
    }

    return null;
  }

  async download(youtubeUrl, formatQuality = '720') {
    const progressData = await this.requestDownload(youtubeUrl, formatQuality);
    
    if (!progressData) {
      throw new Error('Gagal mulai konversi.');
    }
    
    const downloadData = await this.checkProgress(progressData.progress_url);
    
    if (!downloadData) {
      throw new Error('Timeout nunggu konversi.');
    }
    
    return {
      download_url: downloadData.download_url,
      title: progressData.title,
      image: progressData.image,
      type: this.audioFormats.includes(formatQuality) ? 'audio' : 'video',
      quality: formatQuality
    };
  }
}

async function downloadFileStream(url, outputPath) {
  const writer = fs.createWriteStream(outputPath);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
  });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

let handler = async (m, { conn, args, q, prefix, command, reply }) => {
  const inputUrl = q || args.join(' ');

  if (!inputUrl) {
    return reply(
      `Link YouTube mana bro?\n` +
      `Video: *${prefix}${command}ytmp4 https://youtu.be/xxxx*\n` +
      `Audio: *${prefix}${command}ytmp3 https://youtu.be/xxxx*`
    );
  }

  if (!/(youtube\.com|youtu\.be)/.test(inputUrl)) {
    return reply('Linknya YouTube dong, bukan TikTok!');
  }

  let quality = '720';
  if (/mp3|song|audio|play/i.test(command)) {
    quality = 'mp3';
  }

  reply(`Proses ${quality === 'mp3' ? 'lagu' : 'video'}...`);

  const downloader = new YouTubeDownloader();
  const tmpDir = path.resolve('./tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  try {
    const data = await downloader.download(inputUrl, quality);
    
    const ext = quality === 'mp3' ? 'mp3' : 'mp4';
    const filename = `yt_${Date.now()}.${ext}`;
    const filePath = path.join(tmpDir, filename);

    await downloadFileStream(data.download_url, filePath);

    const stats = fs.statSync(filePath);
    const sizeMB = stats.size / (1024 * 1024);
    
    if (sizeMB > 100) {
      throw new Error(`File kegedean (${sizeMB.toFixed(2)} MB). WA max 100MB.`);
    }

    const caption = `*YouTube Downloader*\n` +
      `──────────────────\n` +
      `📝 *Judul:* ${data.title}\n` +
      `🎞️ *Tipe:* ${data.type.toUpperCase()}\n` +
      `💾 *Ukuran:* ${sizeMB.toFixed(2)} MB\n` +
      `──────────────────`;

    if (data.type === 'audio') {
      await conn.sendMessage(m.chat, { 
        audio: fs.readFileSync(filePath), 
        mimetype: 'audio/mpeg', 
        fileName: `${data.title}.mp3`,
        ptt: false 
      }, { quoted: m });
    } else {
      await conn.sendMessage(m.chat, { 
        video: fs.readFileSync(filePath), 
        caption,
        mimetype: 'video/mp4' 
      }, { quoted: m });
    }

  } catch (e) {
    console.error('[YT Error]', e);
    reply(`Gagal: ${e.message}`);
  } finally {
    const files = fs.readdirSync(tmpDir);
    for (const file of files) {
      if (file.startsWith('yt_')) {
        fs.unlinkSync(path.join(tmpDir, file));
      }
    }
  }
};

handler.help = ['ytmp3', 'ytmp4', 'play', 'video'];
handler.tags = ['downloader'];
handler.command = /^(ytmp3|ytmp4|play)$/i;
handler.prefix = ".";

export default handler;
