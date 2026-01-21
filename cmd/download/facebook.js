import axios from 'axios';
import * as cheerio from 'cheerio';

const proxy = () => null;

async function fbScrape(url) {
  try {
    const validUrl = /(?:https?:\/\/(web\.|www\.|m\.)?(facebook|fb)\.(com|watch)\S+)?$/;
    if (!validUrl.test(url)) throw new Error("URL Facebook tidak valid.");

    const formData = `url=${encodeURIComponent(url)}&lang=en&type=redirect`;

    const response = await axios.post("https://getvidfb.com/", formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://getvidfb.com/',
        'Origin': 'https://getvidfb.com'
      },
      timeout: 30000,
    });

    const $ = cheerio.load(response.data);
    const videoContainer = $('#snaptik-video');

    if (!videoContainer.length) {
      throw new Error("Video tidak ditemukan (Mungkin Private/Reels).");
    }

    const thumb = videoContainer.find('.snaptik-left img').attr('src');
    const title = videoContainer.find('.snaptik-middle h3').text().trim();
    const results = [];

    videoContainer.find('.abuttons a').each((_, el) => {
      const link = $(el).attr('href');
      const text = $(el).text().trim();
      
      if (link && link.startsWith('http')) {
        let quality = 'SD';
        if (text.includes('HD')) quality = 'HD';
        if (text.includes('Audio') || text.includes('MP3')) quality = 'Audio';

        results.push({ url: link, quality: quality });
      }
    });

    if (results.length === 0) throw new Error("Tidak ada link download yang tersedia.");

    return {
      title: title || "Facebook Video",
      thumbnail: thumb,
      downloads: results
    };

  } catch (err) {
    throw new Error(err.message || "Gagal mengambil data dari Facebook.");
  }
}

let handler = async (m, { conn, args, q, command, reply }) => {
  const inputUrl = q || (args && args.length > 0 ? args.join(' ') : '');

  if (!inputUrl) {
    return reply(`Harap sertakan link Facebook.
Contoh: *${command} https://www.facebook.com/share/r/xxxx*`);
  }

  reply('Sedang memproses video Facebook...');

  try {
    const data = await fbScrape(inputUrl);

    const video = data.downloads.find(v => v.quality === 'HD') || 
                  data.downloads.find(v => v.quality === 'SD') ||
                  data.downloads[0];

    if (!video) throw new Error("Link video gagal diekstrak.");

    const caption = `*Facebook Downloader*
` +
                    `──────────────────
` +
                    `*Title:* ${data.title}
` +
                    `*Quality:* ${video.quality}
` +
                    `──────────────────`;

    await conn.sendMessage(m.chat, { 
      video: { url: video.url }, 
      caption: caption,
      mimetype: 'video/mp4'
    }, { quoted: m });

  } catch (e) {
    console.error('[FB Handler Error]', e);
    reply(`❌ Gagal: ${e.message}`);
  }
};

handler.help = ['facebook', 'fb'];
handler.tags = ['downloader'];
handler.command = /^(facebook|fb|fbdl)$/i;

export default handler;