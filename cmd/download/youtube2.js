/*──────────────────────────────────────
  Script : YouTube Downloader V2
  Source : ytmp3.tax / SaveTube API
  Refactor : Bot Plugin Handler (ESM)
  Features : AES Decryption, Multi-Quality
  By       : Cybersecurity Analyst
──────────────────────────────────────*/

import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ----------------------------------------------------------------
// CORE ENGINE: SaveTube Scraper
// ----------------------------------------------------------------

class SaveTube {
    constructor() {
        this.cdnBaseUrl = 'https://media.savetube.me/api/random-cdn';
        // Key AES Hardcoded dari logic obfuscated sebelumnya
        this.encryptionKey = 'C5D58EF67A6C35BBC4EB7584E4A29F12'; 
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'Origin': 'https://ytmp3.tax',
            'Referer': 'https://ytmp3.tax/'
        };
    }

    // Helper: Konversi Hex String ke Buffer
    formatSeed(hexString) {
        const matches = hexString.match(/[\dA-F]{2}/gi);
        const bytes = matches.map((h) => parseInt(h, 16));
        return Buffer.from(bytes);
    }

    // Helper: Format Input Base64
    formatInput(input) {
        return Buffer.from(input.replace(/\s/g, ""), 'base64');
    }

    // Core: Decrypt Response
    decryptData(encryptedData) {
        try {
            const inputBuffer = this.formatInput(encryptedData);
            const iv = inputBuffer.slice(0, 16); // 16 bytes pertama adalah IV
            const content = inputBuffer.slice(16); // Sisanya adalah konten terenkripsi
            const keyBuffer = this.formatSeed(this.encryptionKey);

            const decipher = crypto.createDecipheriv('aes-128-cbc', keyBuffer, iv);
            const decrypted = Buffer.concat([decipher.update(content), decipher.final()]);

            return JSON.parse(decrypted.toString('utf8'));
        } catch (error) {
            throw new Error('Decryption Failed: ' + error.message);
        }
    }

    async getRandomCDN() {
        const { data } = await axios.get(this.cdnBaseUrl, { headers: this.headers });
        return data.cdn.startsWith('http') ? data.cdn : `https://${data.cdn}`;
    }

    async getVideoInfo(youtubeUrl) {
        try {
            const cdnUrl = await this.getRandomCDN();
            const infoUrl = `${cdnUrl}/v2/info`;
            
            const { data } = await axios.post(infoUrl, { url: youtubeUrl }, { headers: this.headers });

            if (!data.status) throw new Error(data.message || 'Gagal mengambil info video.');

            const result = this.decryptData(data.data);
            return { cdnUrl, ...result };
        } catch (error) {
            throw new Error(error.message);
        }
    }

    async getDownloadLink(cdnUrl, key, type = 'audio', quality = '128') {
        try {
            const dlUrl = `${cdnUrl}/download`;
            const payload = {
                downloadType: type,
                quality: quality,
                key: key
            };

            const { data } = await axios.post(dlUrl, payload, { headers: this.headers });

            if (!data.status) throw new Error(data.message || 'Gagal mendapatkan link download.');
            
            return data.data.downloadUrl;
        } catch (error) {
            throw new Error(error.message);
        }
    }
}

// ----------------------------------------------------------------
// HELPER: Download Stream Proxy
// ----------------------------------------------------------------
// Kita download ke server bot dulu untuk menghindari IP ban dari YouTube/CDN ke WA
async function downloadFile(url, outputPath) {
    const writer = fs.createWriteStream(outputPath);
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

// ----------------------------------------------------------------
// BOT HANDLER INTERFACE
// ----------------------------------------------------------------

let handler = async (m, { conn, args, q, prefix, command, reply }) => {
    const inputUrl = q || (args && args.length > 0 ? args.join(' ') : '');

    // 1. Validasi Input
    if (!inputUrl) {
        return reply(
            `Harap sertakan link YouTube.\n` +
            `Contoh Video: *${prefix}ytv2 https://youtu.be/xxxx*\n` +
            `Contoh Audio: *${prefix}yta2 https://youtu.be/xxxx*`
        );
    }

    if (!/(youtube\.com|youtu\.be)/.test(inputUrl)) {
        return reply('❌ URL tidak valid. Pastikan link dari YouTube.');
    }

    // 2. Tentukan Tipe (Audio/Video) berdasarkan Command
    const isVideo = /video|ytv|mp4/i.test(command);
    const type = isVideo ? 'video' : 'audio';
    const quality = isVideo ? '720' : '128'; // Default quality

    reply(`⏳ Memproses YouTube V2 (${type.toUpperCase()})...`);

    const scraper = new SaveTube();
    const tmpDir = path.resolve('./tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    try {
        // 3. Fetch Metadata & Decrypt
        const info = await scraper.getVideoInfo(inputUrl);
        
        // 4. Request Download Link
        const downloadUrl = await scraper.getDownloadLink(info.cdnUrl, info.key, type, quality);
        
        if (!downloadUrl) throw new Error("Link download tidak ditemukan.");

        // 5. Download ke Server Bot
        const ext = isVideo ? 'mp4' : 'mp3';
        const filename = `ytv2_${Date.now()}.${ext}`;
        const filePath = path.join(tmpDir, filename);

        // reply('⬇️ Sedang mengunduh file ke server...');
        await downloadFile(downloadUrl, filePath);

        // Cek Ukuran File (Limit 100MB agar aman di WA)
        const stats = fs.statSync(filePath);
        const sizeMB = stats.size / (1024 * 1024);
        if (sizeMB > 150) {
            throw new Error(`File terlalu besar (${sizeMB.toFixed(2)} MB). Max 150MB.`);
        }

        const caption = `*YouTube Downloader V2*\n` +
                        `──────────────────\n` +
                        `📝 *Title:* ${info.title || 'YouTube Video'}\n` +
                        `⏱️ *Duration:* ${info.durationLabel || '-'}\n` +
                        `💾 *Size:* ${sizeMB.toFixed(2)} MB\n` +
                        `🎞️ *Type:* ${type.toUpperCase()}\n` +
                        `──────────────────`;

        // 6. Kirim ke User
        if (type === 'audio') {
            await conn.sendMessage(m.chat, { 
                audio: fs.readFileSync(filePath), 
                mimetype: 'audio/mpeg', 
                fileName: `${info.title}.mp3`,
                ptt: false 
            }, { quoted: m });
        } else {
            await conn.sendMessage(m.chat, { 
                video: fs.readFileSync(filePath), 
                caption: caption,
                mimetype: 'video/mp4' 
            }, { quoted: m });
        }

    } catch (e) {
        console.error('[YouTube V2 Error]', e);
        reply(`❌ Gagal: ${e.message}`);
    } finally {
        // 7. Cleanup File Sampah
        const files = fs.readdirSync(tmpDir);
        for (const file of files) {
            if (file.startsWith('ytv2_')) {
                try { fs.unlinkSync(path.join(tmpDir, file)); } catch {}
            }
        }
    }
};

handler.help = ['ytv2', 'yta2'];
handler.tags = ['downloader'];
handler.command = /^(ytv2|yta2|ytmp3v2|ytmp4v2)$/i;
handler.prefix = ".";
export default handler;