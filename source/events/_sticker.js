import "../../settings/config.js";
import axios from 'axios';
import sharp from 'sharp';
import { createRequire } from 'module'; 
import {
    imageToWebp,
    videoToWebp,
    writeExifImg,
    writeExifVid
} from './exif.js';

const require = createRequire(import.meta.url);
const fileTypePkg = require('file-type'); 

const detectFileType = async (buffer) => {
    if (fileTypePkg.fileTypeFromBuffer) return await fileTypePkg.fileTypeFromBuffer(buffer);
    if (fileTypePkg.fromBuffer) return await fileTypePkg.fromBuffer(buffer);
    throw new Error('Versi file-type di server lu aneh, update dulu gih!');
};

const log = {
    sys: (msg) => console.log(`[SYSTEM] ${msg}`),
    err: (msg) => console.error(`[ERROR] ${msg}`)
};

const MAX_FILE_SIZE = 15 * 1024 * 1024; 

export async function makeSticker(data, sock, m, options = {}) {
    try {
        let buffer;
        let mime = '';

        if (Buffer.isBuffer(data)) {
            buffer = data;
        } else if (typeof data === 'string' && data.startsWith('http')) {
            const response = await axios.get(data, { 
                responseType: 'arraybuffer',
                maxContentLength: MAX_FILE_SIZE,
                timeout: 15000 
            });
            buffer = Buffer.from(response.data);
        } else if (typeof data === 'string' && data.startsWith('data:')) {
            buffer = Buffer.from(data.split(',')[1], 'base64');
        } else {
            buffer = data;
        }

        if (!buffer || buffer.length > MAX_FILE_SIZE) {
            throw new Error(`File kegedean atau kosong! Max: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
        }

        const type = await detectFileType(buffer);
        
        mime = type ? type.mime : 'image/jpeg'; 
        
        let stickerBuffer;
        const packname = options.packname || global.namebotz || 'Sticker';
        const author = options.author || global.nameown || 'Yunxi Assistant';

        log.sys(`Sedang proses buat stiker untuk ${m.sender} (${mime})`);

        if (mime.includes('video') || mime.includes('gif')) {
            let webpVid = await videoToWebp(buffer);
            stickerBuffer = await writeExifVid(webpVid, { packname, author });
        } else {
            let webpImg = await sharp(buffer)
                .resize(512, 512, { 
                    fit: 'contain', 
                    background: { r: 0, g: 0, b: 0, alpha: 0 } 
                })
                .webp({ quality: 70 }) 
                .toBuffer();
            
            stickerBuffer = await writeExifImg(webpImg, { packname, author });
        }

        await sock.sendMessage(m.chat, {
            sticker: stickerBuffer,
            contextInfo: {
                externalAdReply: {
                    title: packname,
                    body: author,
                    mediaType: 1,
                    renderLargerThumbnail: false,
                    thumbnailUrl: options.thumbnail || "https://files.catbox.moe/prewfa.jpg", 
                    sourceUrl: global.YouTube || "https://google.com"
                }
            }
        }, { quoted: m });

    } catch (error) {
        log.err(`Sticker Error: ${error.message}`);
        m.reply(`⚠️ Gagal convert stiker: ${error.message}`);
    }
}

export async function makeStickerFromUrl(url, sock, m, options = {}) {
    return makeSticker(url, sock, m, options);
}