import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_SIZE_MB = 150; 

const getUserAgent = () => {
    const os = ['Windows NT 10.0; Win64; x64', 'Macintosh; Intel Mac OS X 10_15_7', 'X11; Linux x86_64'];
    return `Mozilla/5.0 (${os[Math.floor(Math.random() * os.length)]}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`;
};

const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

class MediaFireEngine {
    constructor() {
        this.headers = {
            'User-Agent': getUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Upgrade-Insecure-Requests': '1',
            'Connection': 'keep-alive'
        };
    }

    async getMetadata(url) {
        try {
            console.log(`[LOG] Fetching page: ${url}`);
            const { data, status } = await axios.get(url, { headers: this.headers });

            if (status !== 200) throw new Error('[HTTP] Gagal akses halaman MediaFire.');

            const $ = cheerio.load(data);
            
            let link = $('#downloadButton').attr('href') || 
                       $('a[aria-label="Download file"]').attr('href') ||
                       $('a.input').attr('href');

            if (!link) {
                const script = $('body').html();
                const match = script.match(/kNO\s*=\s*"([^"]+)"/);
                if (match) link = match[1];
            }

            if (!link) throw new Error('[PARSE] Link download tidak ditemukan (Mungkin folder atau proteksi password).');

            if (link.startsWith('//')) link = 'https:' + link;

            let name = $('div.filename').text().trim() || 
                       $('div.dl-btn-label').attr('title') || 
                       link.split('/').pop();
            
            name = decodeURIComponent(name).replace(/\+/g, ' ');

            let size = $('a#downloadButton').text().match(/\((.*?)\)/)?.[1] || 
                       $('.details li:contains("File size") span').text() || 
                       'Unknown';

            let type = $('.details li:contains("File type") span').text() || 
                       path.extname(name).replace('.', '').toUpperCase();

            return { name, size, type, link };

        } catch (e) {
            throw new Error(e.message);
        }
    }

    async download(url, savePath) {
        const writer = fs.createWriteStream(savePath);

        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            headers: this.headers,
            timeout: 60000 
        });

        const totalSize = response.headers['content-length'];
        
        if (totalSize) {
            const sizeMB = parseInt(totalSize) / (1024 * 1024);
            if (sizeMB > MAX_SIZE_MB) {
                writer.close();
                fs.unlinkSync(savePath);
                throw new Error(`[LIMIT] File terlalu besar (${sizeMB.toFixed(2)} MB). Max ${MAX_SIZE_MB}MB.`);
            }
        }

        const mime = response.headers['content-type'] || 'application/octet-stream';

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve({ size: totalSize, mime }));
            writer.on('error', (err) => {
                writer.close();
                if(fs.existsSync(savePath)) fs.unlinkSync(savePath);
                reject(err);
            });
        });
    }
}

let handler = async (m, { conn, args, q, command, reply }) => {
    const inputUrl = q || (args && args.length > 0 ? args.join(' ') : '');

    if (!inputUrl) {
        return reply(`
[ ! ] PARAMETER KOSONG
Gunakan format:
>>> ${command} <link_mediafire>

Contoh:
>>> ${command} https://www.mediafire.com/file/xxxx/file.zip/file
`);
    }

    const regex = /mediafire\.com\/file\//i;
    if (!regex.test(inputUrl)) {
        return reply('[ ! ] URL Invalid. Pastikan link file (bukan folder).');
    }

    reply('[ ... ] Sedang Memproses, Harap Tunggu...');

    const engine = new MediaFireEngine();
    const tmpDir = path.resolve('./tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const uniqueId = `mf_${Date.now()}`;
    const tempPath = path.join(tmpDir, `${uniqueId}.tmp`);

    try {
        const meta = await engine.getMetadata(inputUrl);

        // reply(`[ ... ] Downloading: ${meta.name} (${meta.size})...`);

        const fileInfo = await engine.download(meta.link, tempPath);

        const finalSize = fileInfo.size ? formatSize(fileInfo.size) : meta.size;

        const caption = 
`[ MEDIAFIRE DOWNLOADER ]
========================
[>] Name : ${meta.name}
[>] Size : ${finalSize}
[>] Type : ${meta.type}
========================
[<] Credit By Yunxi Assistant`;

        await conn.sendMessage(m.chat, {
            document: fs.readFileSync(tempPath),
            fileName: meta.name, 
            mimetype: fileInfo.mime,
            caption: caption
        }, { quoted: m });

    } catch (e) {
        console.error('[ERR] MediaFire Handler:', e);
        
        let msg = '[ x ] System Error.';
        if (e.message.includes('[LIMIT]')) msg = e.message;
        if (e.message.includes('[PARSE]')) msg = '[ x ] Link rusak atau file diproteksi password.';
        if (e.message.includes('404')) msg = '[ x ] File sudah dihapus dari MediaFire.';

        reply(msg);

    } finally {
        if (fs.existsSync(tempPath)) {
            fs.unlink(tempPath, (err) => {
                if (err) console.error(`[WARN] Gagal hapus temp: ${tempPath}`);
            });
        }
    }
};

handler.help = ['mediafire'];
handler.tags = ['downloader'];
handler.command = /^(mediafire|mf|mfdl)$/i;

export default handler;