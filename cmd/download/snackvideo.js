import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function formatDurasi(durasi) {
  if (!durasi) return 'Gak tau';
  const match = durasi.match(/^PT(d+)M(d+)S$/);
  if (match) return `${match[1]}m ${match[2]}s`;
  
  const matchSec = durasi.match(/^PT(d+)S$/);
  if (matchSec) return `0m ${matchSec[1]}s`;
  
  return durasi;
}

async function ambilDataSnackVideo(url) {
  try {
    const { data: html } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 30000,
    });

    const $ = cheerio.load(html);
    const scriptVideo = $("#VideoObject").html();

    if (!scriptVideo) {
      throw new Error("Data video ilang, link salah atau video dihapus!");
    }

    const dataVideo = JSON.parse(scriptVideo);

    const hasil = {
      judul: dataVideo.name || "Snack Video",
      deskripsi: dataVideo.description || "-",
      thumbnail: dataVideo.thumbnailUrl ? dataVideo.thumbnailUrl[0] : "",
      tglUpload: dataVideo.uploadDate ? new Date(dataVideo.uploadDate).toLocaleDateString() : "-",
      linkVideo: dataVideo.contentUrl || "",
      durasi: formatDurasi(dataVideo.duration),
      stats: {
        views: dataVideo.interactionStatistic?.find(s => s.interactionType["@type"].includes("WatchAction"))?.userInteractionCount || 0,
        likes: dataVideo.interactionStatistic?.find(s => s.interactionType["@type"].includes("LikeAction"))?.userInteractionCount || 0,
        shares: dataVideo.interactionStatistic?.find(s => s.interactionType["@type"].includes("ShareAction"))?.userInteractionCount || 0,
      },
      author: {
        nama: dataVideo.creator?.mainEntity?.name || "Gak tau",
        url: dataVideo.creator?.mainEntity?.url || "",
        bio: dataVideo.creator?.mainEntity?.description || ""
      }
    };

    return hasil;

  } catch (error) {
    console.error("[SnackVideo Scraper Goblok]:", error.message);
    throw new Error("Gagal ambil data Snack Video, sialan!");
  }
}

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

let handler = async (m, { conn, args, q, usedPrefix, command, reply }) => {
  const inputUrl = q || (args && args.length > 0 ? args.join(' ') : '');

  if (!inputUrl) {
    return reply(`Kasih link Snack Video dulu, bangsat!
Contoh: *${usedPrefix}${command} https://s.snackvideo.com/p/dwlMd51U*`);
  }

  if (!/snackvideo.com/.test(inputUrl)) {
    return reply('Link goblok! Pastiin dari snackvideo.com');
  }

  reply('⏳ Lagi proses Snack Video lu...');

  const tmpDir = path.resolve('./tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const uniqueId = Date.now();
  const filePath = path.join(tmpDir, `snack_${uniqueId}.mp4`);

  try {
    const data = await ambilDataSnackVideo(inputUrl);

    await downloadFile(data.linkVideo, filePath);

    const stats = fs.statSync(filePath);
    const sizeMB = stats.size / (1024 * 1024);
    
    if (sizeMB > 100) {
      throw new Error(`File gede banget (${sizeMB.toFixed(2)} MB), bot gak kuat!`);
    }

    const caption = `*Snack Video Siap*
` +
                    `──────────────────
` +
                    `📝 *Judul:* ${data.judul}
` +
                    `👤 *Pembuat:* ${data.author.nama}
` +
                    `👁️ *Views:* ${data.stats.views}
` +
                    `❤️ *Like:* ${data.stats.likes}
` +
                    `💾 *Ukuran:* ${sizeMB.toFixed(2)} MB
` +
                    `──────────────────`;

    await conn.sendMessage(m.chat, { 
      video: fs.readFileSync(filePath), 
      caption: caption,
      mimetype: 'video/mp4'
    }, { quoted: m });

  } catch (e) {
    console.error('[SnackVideo Handler Goblok]', e);
    
    if (e.message.includes('404') || e.message.includes('ilang')) {
      reply('Video ilang atau link kadaluarsa, cari lagi!');
    } else {
      reply(`Gagal total: ${e.message}`);
    }

  } finally {
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }
  }
};

handler.help = ['snackvideo', 'snackdl'];
handler.tags = ['downloader'];
handler.command = /^(snackvideo|snack|snackdl)$/i;

export default handler;