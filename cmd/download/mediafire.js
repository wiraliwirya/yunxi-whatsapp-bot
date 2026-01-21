import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MediaFireDownloader {
  constructor() {
    this.client = axios.create({
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 30000
    });
  }

  async extractDownloadUrl(mediafireUrl) {
    try {
      const response = await this.client.get(mediafireUrl);
      const $ = cheerio.load(response.data);
      
      let downloadUrl = $('#downloadButton').attr('href') || 
                       $('a.input.popsok').attr('href') || 
                       $('.download_link a.input').attr('href');

      if (!downloadUrl) return null;

      if (downloadUrl.startsWith('//')) {
        downloadUrl = 'https:' + downloadUrl;
      }

      const fileName = this._extractFilename($, downloadUrl);
      const fileSizeRaw = this._extractFilesize($('#downloadButton') || $('a.input'));
      
      return {
        filename: fileName || 'mediafire_file',
        url: downloadUrl,
        mimetype: this._getMimetype(fileName),
        size: fileSizeRaw,
        size_bytes: this._parseSizeToBytes(fileSizeRaw)
      };
    } catch (error) {
      console.error('[MediaFire Scrape Error]:', error.message);
      return null;
    }
  }

  _extractFilename($, downloadUrl) {
    try {
      let name = $('meta[property="og:title"]').attr('content');
      if (name) return name;

      const title = $('title').text();
      if (title) return title.split(' - ')[0].trim();

      if (downloadUrl) {
        const parts = new URL(downloadUrl).pathname.split('/');
        return decodeURIComponent(parts[parts.length - 1]);
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  _extractFilesize(element) {
    try {
      const text = element.text();
      const match = text.match(/(([0-9.]+s*[KMGT]?B))/i);
      return match ? match[1] : 'Unknown';
    } catch (e) {
      return 'Unknown';
    }
  }

  _parseSizeToBytes(sizeStr) {
    if (!sizeStr || sizeStr === 'Unknown') return 0;
    
    const units = { 
      'B': 1, 
      'KB': 1024, 
      'MB': 1024 * 1024, 
      'GB': 1024 * 1024 * 1024 
    };
    
    const regex = /([0-9.]+)s*([KMGT]?B)/i;
    const match = sizeStr.match(regex);
    
    if (match) {
      const val = parseFloat(match[1]);
      const unit = match[2].toUpperCase();
      return val * (units[unit] || 1);
    }
    return 0;
  }

  _getMimetype(filename) {
    if (!filename) return 'application/octet-stream';
    
    const ext = filename.split('.').pop().toLowerCase();
    const mimetypes = {
      'zip': 'application/zip',
      'rar': 'application/x-rar-compressed',
      '7z': 'application/x-7z-compressed',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'txt': 'text/plain',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'mp4': 'video/mp4',
      'mp3': 'audio/mpeg',
      'apk': 'application/vnd.android.package-archive',
      'exe': 'application/x-msdownload',
      'json': 'application/json'
    };
    
    return mimetypes[ext] || 'application/octet-stream';
  }

  async downloadFile(url, outputPath) {
    const writer = fs.createWriteStream(outputPath);
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      headers: this.client.defaults.headers
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }
}

let handler = async (m, { conn, args, q, command, reply }) => {
  const inputUrl = q || (args && args.length > 0 ? args.join(' ') : '');

  if (!inputUrl) {
    return reply(`Harap sertakan link MediaFire.
Contoh: ${command} https://www.mediafire.com/file/xxxx/file.zip/file`);
  }

  if (!/mediafire.com/.test(inputUrl)) {
    return reply('Link tidak valid. Pastikan domainnya mediafire.com.');
  }

  reply('Sedang proses download file...');

  const mf = new MediaFireDownloader();
  const tmpDir = path.resolve('./tmp');
  
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const tmpFile = path.join(tmpDir, `mf_${Date.now()}_${Math.floor(Math.random() * 1000)}.tmp`);

  try {
    const data = await mf.extractDownloadUrl(inputUrl);

    if (!data) {
      throw new Error('Gagal mengambil metadata. File mungkin terhapus atau diprivate.');
    }

    const MAX_SIZE_MB = 150;
    const sizeMB = data.size_bytes / (1024 * 1024);
    
    if (sizeMB > MAX_SIZE_MB) {
      throw new Error(`File terlalu besar (${data.size}). Batas maksimal bot adalah ${MAX_SIZE_MB}MB.`);
    }

    await mf.downloadFile(data.url, tmpFile);

    const safeFilename = data.filename.replace(/[^a-zA-Z0-9.-_]/g, '_');
    const finalPath = path.join(tmpDir, safeFilename);
    
    fs.renameSync(tmpFile, finalPath);

    const caption = `*MediaFire Downloader*
` +
                    `──────────────────
` +
                    `📄 *Nama:* ${data.filename}
` +
                    `📦 *Ukuran:* ${data.size}
` +
                    `🧩 *Tipe:* ${data.mimetype}
` +
                    `──────────────────`;

    await conn.sendMessage(m.chat, {
      document: fs.readFileSync(finalPath),
      fileName: data.filename,
      mimetype: data.mimetype,
      caption: caption
    }, { quoted: m });

    if (fs.existsSync(finalPath)) {
      fs.unlinkSync(finalPath);
    }

  } catch (e) {
    console.error('[MediaFire Handler]', e);
    reply(`Gagal: ${e.message}`);
  } finally {
    if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
  }
};

handler.help = ['mediafire'];
handler.tags = ['downloader'];
handler.command = /^(mediafire|mf|mfdl)$/i;

export default handler;