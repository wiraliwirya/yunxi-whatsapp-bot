import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const formatDurasi = (durasi) => {
    if (!durasi) return 'Unknown';
    const match = durasi.match(/^PT(?:(\d+)M)?(\d+)S$/);
    if (match) {
        const m = match[1] || '0';
        const s = match[2] || '0';
        return `${m}m ${s}s`;
    }
    return durasi;
};

async function ambilDataSnackVideo(url) {
    try {
        const { data: html } = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Referer": "https://www.snackvideo.com/"
            },
            timeout: 15000,
        });

        const $ = cheerio.load(html);
        const scriptVideo = $("#VideoObject").html();

        if (!scriptVideo) throw new Error("Video metadata not found! Link mungkin mati.");

        const data = JSON.parse(scriptVideo);
        const stats = data.interactionStatistic || [];

        return {
            judul: data.name || "Snack Video Content",
            deskripsi: data.description || "-",
            thumbnail: data.thumbnailUrl?.[0] || "",
            tglUpload: data.uploadDate ? new Date(data.uploadDate).toDateString() : "-",
            linkVideo: data.contentUrl || "",
            durasi: formatDurasi(data.duration),
            stats: {
                views: stats.find(s => s.interactionType["@type"].includes("WatchAction"))?.userInteractionCount || 0,
                likes: stats.find(s => s.interactionType["@type"].includes("LikeAction"))?.userInteractionCount || 0,
            },
            author: {
                nama: data.creator?.mainEntity?.name || "User",
                url: data.creator?.mainEntity?.url || "#"
            }
        };
    } catch (e) {
        throw e;
    }
}

let handler = async (m, { conn, q, usedPrefix, command }) => {
    const inputUrl = q ? q.trim() : (m.quoted?.text || "");

    if (!inputUrl) return m.reply(`[ ! ] Mana linknya? \nContoh: *${usedPrefix}${command} https://s.snackvideo.com/p/xxx*`);
    if (!/snackvideo\.com/.test(inputUrl)) return m.reply('[ ! ] Linknya salah, harus dari Snack Video!');

    await m.reply('Tunggu bentar, lagi di proses...');

    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
    const filePath = path.join(tmpDir, `snack_${Date.now()}.mp4`);

    try {
        const res = await ambilDataSnackVideo(inputUrl);
        if (!res.linkVideo) throw new Error("Gak dapet direct link videonya.");

        const response = await axios({
            method: 'get',
            url: res.linkVideo,
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        const sizeMB = (fs.statSync(filePath).size / 1024 / 1024).toFixed(2);
        
        if (sizeMB > 50) {
            return m.reply(`[ ! ] Videonya kegedean (${sizeMB}MB), males downloadnya.`);
        }

        const caption = `
『 *SNACK VIDEO DOWNLOADER* 』

 *Judul:* ${res.judul}
 *Author:* ${res.author.nama}
 *Durasi:* ${res.durasi}
 *Stats:* ${res.stats.views} views, ${res.stats.likes} likes
 *Size:* ${sizeMB} MB

> Credit By Yunxi Assistant`.trim();

        await conn.sendMessage(m.chat, { 
            video: { url: filePath }, 
            caption: caption,
            mimetype: 'video/mp4'
        }, { quoted: m });

    } catch (e) {
        console.error(e);
        m.reply(`[ ! ] Error: ${e.message}`);
    } finally {
        setTimeout(() => {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }, 5000);
    }
};

handler.help = ['snack'];
handler.tags = ['downloader'];
handler.command = /^(snackvideo|snack|snackdl)$/i;

export default handler;