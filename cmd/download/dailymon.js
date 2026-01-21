/*──────────────────────────────────────
  GitHub   : https://github.com/AlifatahFauzi
  Fix by   : Cybersecurity Analyst
  Patch    : 403 Forbidden Bypass (Buffer Proxy)
──────────────────────────────────────*/

import https from 'https';
import http from 'http';
import { URL } from 'url';

// ----------------------------------------------------------------
// NETWORK HELPERS (SPOOFING ENGINE)
// ----------------------------------------------------------------

// Headers konsisten untuk mengelabui CDN Dailymotion
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.dailymotion.com/',
  'Origin': 'https://www.dailymotion.com',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cookie': 'v1st=1;' // Cookie dummy minimal
};

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol === 'https:' ? https : http;

      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: HEADERS
      };

      const req = protocol.request(options, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true, data });
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

// FUNGSI BARU: Download Buffer (Bypass 403 Baileys)
function getBuffer(url) {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: HEADERS // Inject Headers Penting Disini!
      };

      const req = protocol.get(options, (res) => {
        if (res.statusCode !== 200) {
          // Jika terjadi redirect (302), ikuti redirectnya
          if (res.statusCode === 302 || res.statusCode === 301) {
            return getBuffer(res.headers.location).then(resolve).catch(reject);
          }
          return reject(new Error(`Buffer Download Failed: ${res.statusCode}`));
        }

        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      });
      
      req.on('error', reject);
    } catch (e) {
      reject(e);
    }
  });
}

// ----------------------------------------------------------------
// CORE LOGIC (MODIFIED FOR STABILITY)
// ----------------------------------------------------------------

async function dailymotion(videoUrl) {
  function extractVideoId(url) {
    const patterns = [
      /dailymotion\.com\/video\/([a-zA-Z0-9]+)/,
      /dai\.ly\/([a-zA-Z0-9]+)/
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return m[1];
    }
    return null;
  }

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function viewId() {
    const c = '0123456789abcdefghijklmnopqrstuvwxyz';
    return Array.from({ length: 18 }, () => c[Math.floor(Math.random() * c.length)]).join('');
  }

  function apiUrl(videoId) {
    const p = new URLSearchParams({
      legacy: 'true',
      geo: '1',
      locale: 'en-US',
      dmV1st: uuid(),
      dmTs: Date.now().toString().slice(0, 6),
      dmViewId: viewId(),
      enableAds: '0'
    });
    return `https://geo.dailymotion.com/video/${videoId}.json?${p}`;
  }

  const videoId = extractVideoId(videoUrl);
  if (!videoId) return { success: false, error: 'Video ID tidak ditemukan' };

  try {
    const res = await fetchUrl(apiUrl(videoId));
    let data;
    try {
        data = JSON.parse(res.data);
    } catch {
        return { success: false, error: 'IP Panel terkena Rate Limit/Captcha Dailymotion.' };
    }

    // LOGIKA CERDAS: Prioritaskan MP4 daripada HLS (Auto) agar playable di WA
    let selectedUrl = null;
    let qualityInfo = 'Stream';

    // 1. Coba cari MP4 murni di qualities
    if (data.qualities) {
        const qualities = ['1080', '720', '480', '380', '240'];
        for (let q of qualities) {
            if (data.qualities[q]) {
                // Cari yang type video/mp4
                const mp4 = data.qualities[q].find(x => x.type === 'video/mp4');
                if (mp4) {
                    selectedUrl = mp4.url;
                    qualityInfo = `${q}p (MP4)`;
                    break;
                }
            }
        }
    }

    // 2. Fallback ke Auto (HLS/m3u8) jika MP4 tidak ada
    // Ini yang menyebabkan file jadi dokumen/tidak bisa diputar jika tanpa FFmpeg,
    // tapi setidaknya kita kirim sesuatu daripada error.
    if (!selectedUrl && data.qualities?.auto) {
        selectedUrl = data.qualities.auto[0].url;
        qualityInfo = 'Auto (HLS)';
    }

    if (!selectedUrl) return { success: false, error: 'URL Video tidak tersedia (Geo-Block/Private).' };

    return {
      success: true,
      data: {
        id: data.id,
        title: data.title,
        duration: data.duration,
        url: data.url,
        video_url: selectedUrl, // URL terpilih
        quality_label: qualityInfo,
        thumbnails: data.thumbnails,
        owner: data.owner
      }
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ----------------------------------------------------------------
// BOT HANDLER (BUFFER PROXY)
// ----------------------------------------------------------------

let handler = async (m, { conn, q, args, usedPrefix, command, reply }) => {
  const inputUrl = q || (args && args.length > 0 ? args.join(' ') : '');
  
  if (!inputUrl) return reply(`Harap sertakan URL Dailymotion.`);
  if (!inputUrl.match(/(dailymotion\.com|dai\.ly)/i)) return reply('URL tidak valid.');

  reply('⏳ Sedang memproses bypass proteksi server...');

  try {
    // 1. Ambil Metadata
    const result = await dailymotion(inputUrl);

    if (!result.success) {
      return reply(`Gagal: ${result.error}`);
    }

    const { title, duration, owner, video_url, quality_label, id } = result.data;

    const uploadDate = owner?.created_time 
      ? new Date(owner.created_time * 1000).toLocaleDateString('id-ID') 
      : 'Unknown';

    // 2. DOWNLOAD BUFFER MANUAL (Kunci Fix Error 403)
    // Kita download sendiri pakai header kita, jangan suruh Baileys download
    const videoBuffer = await getBuffer(video_url);

    const caption = `*Dailymotion Player*\n\n` +
      `📺 *Judul:* ${title}\n` +
      `👤 *Channel:* ${owner?.screenname || 'Unknown'}\n` +
      `⏱️ *Durasi:* ${duration}s\n` +
      `🎞️ *Tipe:* ${quality_label}\n` +
      `📅 *Upload:* ${uploadDate}`;

    // 3. Kirim Buffer
    await conn.sendMessage(m.chat, { 
      video: videoBuffer, 
      caption: caption,
      mimetype: 'video/mp4' // Force mimetype
    }, { quoted: m });

  } catch (e) {
    console.error('[Dailymotion Fatal]', e);
    
    // Error Handling Manusiawi
    if (e.message.includes('403')) {
        reply('❌ Gagal: Akses ditolak oleh Dailymotion (403). Server memblokir request bot.');
    } else {
        reply(`❌ Terjadi kesalahan: ${e.message}`);
    }
  }
};

handler.help = ['dailymotion'];
handler.tags = ['downloader'];
handler.command = /^(dailymotion|dm|dmotion)$/i;

export default handler;
