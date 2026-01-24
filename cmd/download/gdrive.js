import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

class GDriveScraper {
    constructor() {
        this.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    }

    extractId(url) {
        const match = url.match(/(?:id=|\/d\/|drivesdk\/)([\w-]+)/);
        return match ? match[1] : null;
    }

    async getDownloadLink(fileId) {
        const url = `https://docs.google.com/uc?export=download&id=${fileId}`;
        
        try {
            // [Step 1] Initial Request
            const response = await axios.get(url, {
                headers: { "User-Agent": this.userAgent },
                validateStatus: (status) => status < 500 
            });

            const isConfirmPage = /download_warning/i.test(response.data) || 
                                  response.headers['content-type'].includes('text/html');

            if (isConfirmPage) {
                console.log(`[LOG] Terdeteksi Virus Scan Warning. Mencoba bypass...`);
                
                const cookies = response.headers['set-cookie'] || [];
                const confirmCookie = cookies.find(c => c.includes('download_warning'));
                
                let confirmToken = '';
                
                if (confirmCookie) {
                    confirmToken = confirmCookie.split(';')[0].split('=')[1];
                } 
                
                if (!confirmToken) {
                    const $ = cheerio.load(response.data);
                    const link = $('#uc-download-link').attr('href');
                    const match = link ? link.match(/confirm=([\w-]+)/) : null;
                    if (match) confirmToken = match[1];
                }

                if (confirmToken) {
                    return `${url}&confirm=${confirmToken}`;
                } else {
                    throw new Error("Gagal bypass konfirmasi virus. Token tidak ditemukan.");
                }
            }

            return url; 
        } catch (error) {
            console.error("[ERR] Get Link:", error.message);
            throw error;
        }
    }

    async getMetadata(fileId) {
        const url = `https://docs.google.com/file/d/${fileId}/view`;
        try {
            const { data } = await axios.get(url, {
                headers: { "User-Agent": this.userAgent }
            });
            const $ = cheerio.load(data);
            
            let title = $("meta[property='og:title']").attr("content") || 
                        $("title").text().replace(" - Google Drive", "").trim() ||
                        `GDrive_File_${fileId}`;
            
            return { title, originalUrl: url };
        } catch (e) {
            return { title: `GDrive_${fileId}`, originalUrl: url };
        }
    }

    async downloadFile(fileId, outputPath) {
        const downloadUrl = await this.getDownloadLink(fileId);
        
        console.log(`[LOG] Downloading stream from: ${downloadUrl}`);
        
        const writer = fs.createWriteStream(outputPath);
        
        const response = await axios({
            url: downloadUrl,
            method: 'GET',
            responseType: 'stream',
            headers: { "User-Agent": this.userAgent }
        });

        const totalLength = response.headers['content-length'];
        if (totalLength && parseInt(totalLength) > 150 * 1024 * 1024) { // Max 150MB
            writer.close();
            fs.unlinkSync(outputPath);
            throw new Error(`[LIMIT] File terlalu besar (${formatSize(totalLength)}). Batas max 150MB.`);
        }

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                const stats = fs.statSync(outputPath);
                if (stats.size < 2000) { 
                    const content = fs.readFileSync(outputPath, 'utf8');
                    if (content.includes('<!DOCTYPE html>')) {
                        reject(new Error("Gagal download: Response berupa HTML, bukan file binary."));
                        return;
                    }
                }
                resolve({ 
                    path: outputPath, 
                    size: stats.size,
                    url: downloadUrl 
                });
            });
            writer.on('error', (err) => {
                fs.unlink(outputPath, () => {});
                reject(err);
            });
        });
    }
}

let handler = async (m, { conn, args, q, command, reply }) => {
    const inputUrl = q || (args && args.length > 0 ? args.join(' ') : '');

    if (!inputUrl) {
        return reply(`
[ ! ] LINK KOSONG
Format: ${command} <url-gdrive>

Contoh:
>>> ${command} https://drive.google.com/file/d/1aB2cD3eF4gH/view
`);
    }

    const scraper = new GDriveScraper();
    const fileId = scraper.extractId(inputUrl);

    if (!fileId) {
        return reply('[ ! ] URL tidak valid. Pastikan link Google Drive benar.');
    }

    reply(`[ ... ] Memproses ID: ${fileId}`);

    const tmpDir = path.resolve('./tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    
    const tempFilePath = path.join(tmpDir, `gd_${fileId}_${Date.now()}.bin`);

    try {
        const metadata = await scraper.getMetadata(fileId);
        
        const fileData = await scraper.downloadFile(fileId, tempFilePath);
        
        
        const caption = 
`[ GOOGLE DRIVE DOWNLOADER ]
===========================
[>] Name : ${metadata.title}
[>] Size : ${formatSize(fileData.size)}
[>] ID   : ${fileId}
===========================
[<] Credit By Yunxi Assitant`;

        await conn.sendMessage(m.chat, { 
            document: fs.readFileSync(fileData.path), 
            mimetype: 'application/octet-stream', 
            fileName: metadata.title,
            caption: caption
        }, { quoted: m });

    } catch (e) {
        console.error('[ERR] GDrive Handler:', e);
        
        let msg = '[ x ] Terjadi kesalahan.';
        if (e.message.includes('[LIMIT]')) msg = e.message;
        if (e.message.includes('HTML')) msg = '[ x ] File diproteksi atau Private.';
        
        reply(msg);
    } finally {
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
    }
};

handler.help = ['gdrive', 'gd'];
handler.tags = ['downloader'];
handler.command = /^(gdrive|gd|googledrive)$/i;

export default handler;