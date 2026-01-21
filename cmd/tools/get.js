import axios from 'axios';
import { format } from 'util';
import path from 'path';

function getFilename(headers, url) {
    let filename = '';
    
    const disposition = headers['content-disposition'];
    if (disposition && disposition.includes('filename=')) {
        filename = disposition.split('filename=')[1].split(';')[0].replace(/['"]/g, '');
    }
    
    if (!filename) {
        try {
            const urlPath = new URL(url).pathname;
            filename = path.basename(urlPath);
        } catch (e) {}
    }

    if (!filename) filename = 'file_downloaded';
    
    return decodeURIComponent(filename);
}

let handler = async (m, { conn, command, q, args }) => {
    const url = q || (args && args.length > 0 ? args.join(' ') : '');

    if (!url) {
       return m.reply(`Mana URL-nya?\nContoh: *${command}* https://example.com/data.json`);
    }

    if (!/^https?:\/\//.test(url)) {
        return m.reply('URL harus diawali dengan http:// atau https://');
    }

    m.reply('Sedang memproses, harap tunggu sebentar...');

    try {
        const res = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://www.google.com/",
                "Upgrade-Insecure-Requests": "1"
            },
            responseType: 'arraybuffer', 
            maxContentLength: 100 * 1024 * 1024
        });

        const contentType = res.headers['content-type'] || '';
        const contentLength = res.headers['content-length'] ? parseInt(res.headers['content-length']) : Buffer.byteLength(res.data);
        const sizeMB = (contentLength / (1024 * 1024)).toFixed(2);
        
        console.log(`[GET] Type: ${contentType} | Size: ${sizeMB} MB`);

        if (/json/i.test(contentType)) {
            try {
                const jsonStr = Buffer.from(res.data).toString('utf-8');
                const jsonObj = JSON.parse(jsonStr);
                return m.reply(JSON.stringify(jsonObj, null, 2));
            } catch (e) {
                return m.reply(Buffer.from(res.data).toString('utf-8').slice(0, 10000));
            }
        } 
        
        else if (/text\/(html|plain|xml)/i.test(contentType)) {
            const textData = Buffer.from(res.data).toString('utf-8');
            if (textData.length > 4000) {
                return m.reply(textData.slice(0, 4000) + '\n\n... (Dipotong karena terlalu panjang)');
            }
            return m.reply(textData);
        }

        else if (/image/i.test(contentType)) {
            if (/webp/i.test(contentType) || url.endsWith('.webp')) {
                return conn.sendMessage(m.chat, { sticker: res.data }, { quoted: m });
            }
            return conn.sendMessage(m.chat, { 
                image: res.data, 
                caption: `📷 *Image Fetched*\nSize: ${sizeMB} MB` 
            }, { quoted: m });
        }

        else if (/video/i.test(contentType)) {
            return conn.sendMessage(m.chat, { 
                video: res.data, 
                caption: `🎥 *Video Fetched*\nSize: ${sizeMB} MB`,
                mimetype: contentType 
            }, { quoted: m });
        }

        else if (/audio/i.test(contentType)) {
            return conn.sendMessage(m.chat, { 
                audio: res.data, 
                mimetype: contentType,
                ptt: false 
            }, { quoted: m });
        }

        else {
            const fileName = getFilename(res.headers, url);
            
            return conn.sendMessage(m.chat, { 
                document: res.data, 
                fileName: fileName,
                mimetype: contentType,
                caption: `📄 *File Fetched*\n\nName: ${fileName}\nType: ${contentType}\nSize: ${sizeMB} MB`
            }, { quoted: m });
        }

    } catch (error) {
        if (error.response) {
            return m.reply(`❌ Server Error: ${error.response.status} ${error.response.statusText}`);
        } else if (error.code === 'ERR_FR_TOO_MANY_REDIRECTS') {
            return m.reply('❌ Terlalu banyak redirect (Looping).');
        } else if (error.message.includes('maxContentLength')) {
            return m.reply(`❌ File terlalu besar! Batas maksimal adalah 100MB untuk keamanan server.`);
        } else {
            console.error(error);
            return m.reply(`❌ Gagal mengakses URL: ${error.message}`);
        }
    }
};

handler.help = ['get'];
handler.tags = ['tools'];
handler.command = /^(get)$/i;

export default handler;
