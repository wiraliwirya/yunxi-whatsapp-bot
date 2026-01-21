import axios from 'axios';
import * as cheerio from 'cheerio';
import { URLSearchParams } from 'url';

async function scrapeTwitter(url) {
  try {
    const { data: homeHtml } = await axios.get("https://snaptwitter.com/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    
    const $ = cheerio.load(homeHtml);
    const token = $('input[name="token"]').attr('value') || 
                  $('input[type="hidden"]').eq(0).attr('value'); 

    if (!token) throw new Error("Gagal mengambil token sesi.");

    const formData = new URLSearchParams();
    formData.append("url", url);
    formData.append("token", token);

    const { data: resultHtml } = await axios.post("https://snaptwitter.com/action.php", formData, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Origin": "https://snaptwitter.com",
        "Referer": "https://snaptwitter.com/"
      }
    });

    const $res = cheerio.load(resultHtml.data || resultHtml);

    let downloadLink = $res(".abuttons a").first().attr("href");
    const thumb = $res(".videotikmate-left img").attr("src");
    
    if (!downloadLink) {
      $res("a").each((i, el) => {
        if ($res(el).text().includes("Download")) downloadLink = $res(el).attr("href");
      });
    }

    if (!downloadLink) throw new Error("Video tidak ditemukan atau link kadaluarsa.");

    return {
      url: downloadLink,
      thumb: thumb,
      desc: "Twitter Video"
    };

  } catch (error) {
    console.error("Twitter Scraper Error:", error.message);
    throw new Error("Gagal mengambil video Twitter.");
  }
}

let handler = async (m, { conn, args, q, command, reply }) => {
  const inputUrl = q || (args && args.length > 0 ? args.join(' ') : '');

  if (!inputUrl) {
    return reply(`Harap sertakan link Twitter/X.
Contoh: *${command} https://x.com/username/status/12345*`);
  }

  if (!/(twitter.com|x.com)/.test(inputUrl)) {
    return reply('❌ URL tidak valid.');
  }

  reply('Sedang memproses Video Twitter...');

  try {
    const data = await scrapeTwitter(inputUrl);

    await conn.sendMessage(m.chat, { 
      video: { url: data.url }, 
      caption: `*Twitter/X Downloader*

Video berhasil diambil.`,
      mimetype: 'video/mp4'
    }, { quoted: m });

  } catch (e) {
    console.error('[Twitter Handler Error]', e);
    reply(`❌ Gagal: ${e.message}`);
  }
};

handler.help = ['twitter', 'tw', 'xdl'];
handler.tags = ['downloader'];
handler.command = /^(twitter|tw|xdl|x)$/i;

export default handler;