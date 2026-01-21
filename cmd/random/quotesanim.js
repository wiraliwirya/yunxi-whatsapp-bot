import axios from 'axios';
import * as cheerio from 'cheerio';

async function getQuotesAnime() {
  try {
    const page = Math.floor(Math.random() * 184) + 1;
    
    const { data } = await axios.get(
      `https://otakotaku.com/quote/feed/${page}`,
      {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }
    );

    const $ = cheerio.load(data);
    const hasil = [];

    $('div.kotodama-list').each(function (l, h) {
      hasil.push({
        link: $(h).find('a').attr('href'),
        gambar: $(h).find('img').attr('data-src'),
        karakter: $(h).find('div.char-name').text().trim(),
        anime: $(h).find('div.anime-title').text().trim(),
        episode: $(h).find('div.meta').text().trim(),
        quotes: $(h).find('div.quote').text().trim()
      });
    });

    if (hasil.length === 0) {
      throw new Error('Tidak ada quotes ditemukan di halaman ini.');
    }

    return hasil;

  } catch (error) {
    console.error('[Quotes Scraper Error]:', error.message);
    throw new Error('Gagal mengambil quotes dari server.');
  }
}

let handler = async (m, { conn, command, reply }) => {
  reply('📖 Sedang mencari kutipan bijak anime...');

  try {
    const quotesList = await getQuotesAnime();
    const randomQuote = quotesList[Math.floor(Math.random() * quotesList.length)];

    const caption = `*Anime Quotes*
` +
      `──────────────────
` +
      `🗣️ *Karakter:* ${randomQuote.karakter}
` +
      `🎬 *Anime:* ${randomQuote.anime}
` +
      `🎞️ *Episode:* ${randomQuote.episode}
` +
      `──────────────────

` +
      `_"${randomQuote.quotes}"_`;

    if (randomQuote.gambar) {
      await conn.sendMessage(
        m.chat,
        { 
          image: { url: randomQuote.gambar }, 
          caption 
        }, 
        { quoted: m }
      );
    } else {
      await m.reply(caption);
    }

  } catch (e) {
    console.error(e);
    reply(`❌ Gagal: ${e.message}`);
  }
};

handler.help = ['quotesanime', 'kataanime'];
handler.tags = ['random'];
handler.command = /^(quotesanime|kataanime|qanime)$/i;

export default handler;