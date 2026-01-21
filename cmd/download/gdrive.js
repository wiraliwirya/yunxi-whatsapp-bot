import axios from 'axios';
import * as cheerio from 'cheerio';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function driveScrape(url) {
  try {
    const regex = /drive.google.com\/file\/d\/([a-zA-Z0-9_-]+)/;
    const match = url.match(regex);
    
    if (!match) {
      throw new Error("Format URL Google Drive tidak valid. Pastikan link file publik.");
    }
    
    const fileId = match[1];
    
    const res = await axios.get(url, { 
      timeout: 15000,
      headers: { 
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    
    const $ = cheerio.load(res.data);
    
    let title = $("meta[property='og:title']").attr("content") || 
                $("title").text().replace(" - Google Drive", "").trim();
    
    if (!title) title = `GDrive_${fileId}`;

    const downloadUrl = `https://drive.usercontent.google.com/uc?id=${fileId}&export=download`;

    return {
      fileName: title,
      fileId: fileId,
      downloadUrl: downloadUrl,
      originalUrl: url
    };
    
  } catch (e) {
    console.error("[GDrive Scraper Error]:", e.message);
    throw new Error("Gagal mengambil data. Pastikan file bersifat PUBLIK (Anyone with the link).");
  }
}

let handler = async (m, { conn, args, q, command, reply }) => {
  const inputUrl = q || (args && args.length > 0 ? args.join(' ') : '');

  if (!inputUrl) {
    return reply(`Harap sertakan link Google Drive.
Contoh: *${command} https://drive.google.com/file/d/xxxx/view*`);
  }

  if (!/drive.google.com/.test(inputUrl)) {
    return reply('❌ URL tidak valid. Pastikan domain google.com');
  }

  reply('Memproses file Google Drive...');

  try {
    const data = await driveScrape(inputUrl);

    const caption = `*Google Drive Downloader*
` +
                    `──────────────────
` +
                    `*Name:* ${data.fileName}
` +
                    `*ID:* ${data.fileId}
` +
                    `──────────────────
` +
                    `_Mengirim file..._`;

    await conn.sendMessage(m.chat, { 
      document: { url: data.downloadUrl }, 
      fileName: data.fileName,
      mimetype: 'application/octet-stream',
      caption: caption
    }, { quoted: m });

  } catch (e) {
    console.error('[GDrive Handler Error]', e);
    reply(`❌ Gagal: ${e.message}`);
  }
};

handler.help = ['gdrive', 'gd'];
handler.tags = ['downloader'];
handler.command = /^(gdrive|gd|googledrive)$/i;

export default handler;