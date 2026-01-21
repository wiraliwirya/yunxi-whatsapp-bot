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

async function getWaifuImage() {
  try {
    const { data } = await axios.get('https://api.waifu.pics/sfw/waifu');
    if (!data.url) throw new Error('API waifu tidak merespon.');
    return await fetchBuffer(data.url);
  } catch (e) {
    throw new Error(`Gagal mengambil gambar waifu: ${e.message}`);
  }
}

let handler = async (m, { conn, reply }) => {
  reply('🌸 Mencari Gambar Waifu...');

  try {
    const buffer = await getWaifuImage();

    await conn.sendMessage(
      m.chat,
      { 
        image: buffer, 
        caption: '*Random Waifu*' 
      }, 
      { quoted: m }
    );

  } catch (e) {
    console.error('[Waifu Error]:', e);
    reply(`❌ Gagal: ${e.message}`);
  }
};

handler.help = ['waifu'];
handler.tags = ['random'];
handler.command = /^waifu$/i;

export default handler;