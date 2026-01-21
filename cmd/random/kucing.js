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

async function getCatImage() {
  try {
    const { data } = await axios.get('https://api.sefinek.net/api/v2/random/animal/cat');
    if (!data.message) throw new Error('API kucing tidak merespon.');
    return await fetchBuffer(data.message);
  } catch (e) {
    throw new Error(`Gagal mengambil gambar kucing: ${e.message}`);
  }
}

let handler = async (m, { conn, reply }) => {
  reply('🐈 Mencari gambar Kucing...');

  try {
    const buffer = await getCatImage();

    await conn.sendMessage(
      m.chat,
      { 
        image: buffer, 
        caption: '*Random Cat*' 
      }, 
      { quoted: m }
    );

  } catch (e) {
    console.error('[Cat Error]:', e);
    reply(`❌ Gagal: ${e.message}`);
  }
};

handler.help = ['kucing', 'cat'];
handler.tags = ['random'];
handler.command = /^(kucing|cat)$/i;

export default handler;