import axios from 'axios';

async function getRandomBlueArchiveImage() {
  try {
    const GIST_URL = 'https://gist.githubusercontent.com/siputzx/e985e0566c0529df3a2289fd64047d21/raw/1568d9d26ee25dbe82fb0bdf51b5c88727e3f602/bluearchive.json';
    
    const { data: images } = await axios.get(GIST_URL, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!Array.isArray(images) || images.length === 0) {
      throw new Error('Database gambar kosong.');
    }

    const randomImageUrl = images[Math.floor(Math.random() * images.length)];

    const imageResponse = await axios.get(randomImageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    return Buffer.from(imageResponse.data, 'binary');

  } catch (error) {
    console.error('[BA API Error]:', error.message);
    throw new Error('Gagal mengambil gambar Blue Archive.');
  }
}

let handler = async (m, { conn, reply }) => {
  reply('💠 Mengambil random gambar...');

  try {
    const buffer = await getRandomBlueArchiveImage();

    await conn.sendMessage(
      m.chat,
      { 
        image: buffer, 
        caption: `*Blue Archive Random*
Sensei, ini request gambarnya.` 
      }, 
      { quoted: m }
    );

  } catch (e) {
    console.error(e);
    reply(`❌ Gagal: ${e.message}`);
  }
};

handler.help = ['bluearchive', 'ba'];
handler.tags = ['random', 'anime'];
handler.command = /^(bluearchive|ba)$/i;

export default handler;