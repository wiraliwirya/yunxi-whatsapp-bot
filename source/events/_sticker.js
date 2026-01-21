import "../../settings/config.js";
import axios from 'axios';
import sharp from 'sharp';
import pkg from 'file-type'; 
import {
    imageToWebp,
    videoToWebp,
    writeExifImg,
    writeExifVid
} from './exif.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024; 

export async function makeSticker(data, sock, m, options = {}) {
    try {
        let buffer;
        let mime = '';

        if (Buffer.isBuffer(data)) {
            buffer = data;
        } else if (typeof data === 'string' && (data.startsWith('http') || data.startsWith('https'))) {
            const url = new URL(data);
            if (!['http:', 'https:'].includes(url.protocol)) {
                throw new Error('Forbidden protocol: Only HTTP/HTTPS allowed');
            }

            const response = await axios.get(data, { 
                responseType: 'arraybuffer',
                maxContentLength: MAX_FILE_SIZE,
                maxBodyLength: MAX_FILE_SIZE,
                timeout: 10000 
            });
            buffer = Buffer.from(response.data, "binary");
        } else if (typeof data === 'string' && data.startsWith('data:')) {
            const base64Data = data.split(',')[1];
            if (!base64Data) throw new Error('Invalid Base64 Data');
            buffer = Buffer.from(base64Data, 'base64');
        } else {
            throw new Error('Invalid input data type');
        }

        if (buffer.length > MAX_FILE_SIZE) {
            throw new Error(`File too large. Max: ${MAX_FILE_SIZE} bytes`);
        }

        const detectType = pkg.fileTypeFromBuffer || pkg.fromBuffer || (typeof pkg === 'function' ? pkg : null);

        if (!detectType) {
             throw new Error('Fungsi deteksi file-type tidak ditemukan pada library ini.');
        }

        const type = await detectType(buffer);
        mime = type ? type.mime : 'image/jpeg'; 
        
        let stickerBuffer;
        const packname = options.packname || global.namebotz || 'Bot Sticker';
        const author = options.author || global.nameown || 'Liwirya';

        if (mime.includes('video') || mime.includes('gif')) {
            let webpVid = await videoToWebp(buffer);
            stickerBuffer = await writeExifVid(webpVid, { packname, author });
        } else {
            let webpImg = await sharp(buffer)
                .resize(512, 512, { 
                    fit: 'contain', 
                    background: { r: 0, g: 0, b: 0, alpha: 0 } 
                })
                .webp({ quality: 85 }) 
                .toBuffer();
            
            stickerBuffer = await writeExifImg(webpImg, { packname, author });
        }

        await sock.sendMessage(m.chat, {
            sticker: stickerBuffer,
            contextInfo: {
                externalAdReply: {
                    title: global.namebotz || "Sticker Bot",
                    body: "© Shiina Hiyori",
                    mediaType: 1,
                    renderLargerThumbnail: true, 
                    thumbnailUrl: options.thumbnail || "https://files.catbox.moe/prewfa.jpg", 
                    sourceUrl: global.YouTube || "https://pornhuh.com"
                }
            }
        }, { quoted: m });

    } catch (error) {
        console.error("[STICKER SECURITY LOG]:", error);
        m.reply(`⚠️ Gagal membuat stiker: ${error.message}`);
    }
}

export async function makeStickerFromUrl(mediaUrl, sock, m, reply) {
    return makeSticker(mediaUrl, sock, m);
}