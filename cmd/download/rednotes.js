import axios from 'axios';

async function scrapeRednote(url) {
  try {
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 Edg/132.0.0.0",
        "Cookie": "web_session=123"
      },
      timeout: 15000,
    });

    const extractMeta = (name) => {
      const regex = new RegExp(`<meta\\s+name="${name}"\\s+content="(.*?)"`, "i");
      return (data.match(regex) || [])[1]?.trim() || "";
    };

    const title = extractMeta("og:title") || extractMeta("description");
    const videoUrl = extractMeta("og:video");
    const image = extractMeta("og:image");
    
    const images = [];
    const imgRegex = /<metas+name="og:image"s+content="(.*?)"/gi;
    let match;
    while ((match = imgRegex.exec(data)) !== null) {
      images.push(match[1]);
    }

    return {
      title: title.replace(" - 小红书", ""),
      video: videoUrl,
      images: images.length > 0 ? images : [image],
      is_video: !!videoUrl
    };

  } catch (error) {
    console.error("Rednote Scraper Error:", error.message);
    throw new Error("Gagal mengambil data dari RedNote.");
  }
}

let handler = async (m, { conn, args, q, command, reply }) => {
  const inputUrl = q || (args && args.length > 0 ? args.join(' ') : '');

  if (!inputUrl) {
    return reply(`Harap sertakan link RedNote (Xiaohongshu).
Contoh: *${command} https://www.xiaohongshu.com/explore/xxxx*`);
  }

  if (!/(xiaohongshu.com|xhslink.com)/.test(inputUrl)) {
    return reply('❌ URL tidak valid.');
  }

  reply('Sedang memproses RedNote...');

  try {
    const data = await scrapeRednote(inputUrl);
    const caption = `*RedNote Downloader*

*Title:* ${data.title}`;

    if (data.is_video) {
      await conn.sendMessage(m.chat, { 
        video: { url: data.video }, 
        caption: caption 
      }, { quoted: m });
    } else {
      for (let i = 0; i < Math.min(data.images.length, 5); i++) {
        await conn.sendMessage(m.chat, { 
          image: { url: data.images[i] }, 
          caption: i === 0 ? caption : '' 
        }, { quoted: m });
      }
    }

  } catch (e) {
    console.error('[RedNote Handler Error]', e);
    reply(`❌ Gagal: ${e.message}`);
  }
};

handler.help = ['rednote', 'xiaohongshu', 'xhs'];
handler.tags = ['downloader'];
handler.command = /^(rednote|xiaohongshu|xhs|xhsdl)$/i;

export default handler;