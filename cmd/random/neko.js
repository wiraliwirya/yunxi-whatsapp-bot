import axios from 'axios';

const fetchBuffer = async (url) => {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  return res.data;
};

async function getNekoImage() {
  try {
    const { data } = await axios.get('https://api.waifu.pics/sfw/neko');
    if (!data.url) throw new Error('API neko tidak merespon.');
    return await fetchBuffer(data.url);
  } catch (e) {
    throw new Error(`Gagal mengambil gambar neko: ${e.message}`);
  }
}

let handler = async (m, { conn, reply }) => {
  reply('🐱 Mencari Gambar Neko...');

  try {
    const buffer = await getNekoImage();

    await conn.sendMessage(
      m.chat,
      { 
        image: buffer, 
        caption: '*Random Neko*' 
      }, 
      { quoted: m }
    );

  } catch (e) {
    console.error('[Neko Error]:', e);
    reply(`❌ Gagal: ${e.message}`);
  }
};

handler.help = ['neko'];
handler.tags = ['random'];
handler.command = /^neko$/i;

export default handler;