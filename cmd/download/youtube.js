import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_SIZE_MB = 100;
const TIMEOUT_MS = 60000;

const getRandomUA = () => {
  const versions = ['120.0.0.0', '121.0.0.0', '122.0.0.0', '123.0.0.0'];
  const v = versions[Math.floor(Math.random() * versions.length)];
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v} Safari/537.36`;
};

class YouTubeEngine {
  constructor() {
    this.baseUrl = 'https://p.savenow.to';
    this.apiToken = 'dfcb6d76f2f6a9894gjkege8a4ab232222'; // Public key dari frontend mereka
    this.headers = {
      'User-Agent': getRandomUA(),
      'Accept': '*/*',
      'Referer': 'https://y2down.cc/',
      'Origin': 'https://y2down.cc',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site'
    };
  }

  async initJob(url, format) {
    const fmt = format === 'mp3' ? 'mp3' : '720'; 
    
    try {
      const { data } = await axios.get(`${this.baseUrl}/ajax/download.php`, {
        params: {
          copyright: '0',
          format: fmt,
          url: url,
          api: this.apiToken
        },
        headers: this.headers,
        timeout: 10000
      });

      if (!data.progress_url) throw new Error('[API] Gagal inisiasi job konversi.');
      
      return {
        progressUrl: data.progress_url,
        title: data.info?.title || 'YouTube Media',
        thumbnail: data.info?.image || null
      };
    } catch (e) {
      throw new Error(`[INIT_FAIL] ${e.message}`);
    }
  }

  async pollStatus(progressUrl) {
    const maxRetries = 30; 
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const { data } = await axios.get(progressUrl, {
          headers: this.headers,
          timeout: 5000
        });

        if (data.download_url) {
            return data.download_url;
        }

        if (data.error || (data.text && data.text.toLowerCase().includes('error'))) {
             throw new Error(data.message || 'Konversi gagal di server.');
        }

        await new Promise(r => setTimeout(r, 2000));
        attempt++;

      } catch (e) {
        console.log(`[WARN] Polling retry ${attempt}...`);
        attempt++;
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    throw new Error('[TIMEOUT] Waktu konversi habis.');
  }

  async process(url, type) {
    console.log(`[LOG] Starting job for: ${url} [${type}]`);
    
    const metadata = await this.initJob(url, type);
    
    const downloadUrl = await this.pollStatus(metadata.progressUrl);
    
    return {
        ...metadata,
        downloadUrl,
        type
    };
  }
}

async function downloadStream(url, savePath) {
    const writer = fs.createWriteStream(savePath);
    
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
        headers: { 'User-Agent': getRandomUA() }
    });

    const totalSize = response.headers['content-length'];
    if (totalSize && (parseInt(totalSize) / (1024 * 1024) > MAX_SIZE_MB)) {
        writer.close();
        fs.unlinkSync(savePath);
        throw new Error(`[LIMIT] File kegedean (${(parseInt(totalSize)/(1024*1024)).toFixed(2)} MB). Max ${MAX_SIZE_MB}MB.`);
    }

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', (err) => {
            writer.close();
            if(fs.existsSync(savePath)) fs.unlinkSync(savePath);
            reject(err);
        });
    });
}

let handler = async (m, { conn, args, q, prefix, command, reply }) => {
  const inputUrl = q || args.join(' ');

  if (!inputUrl) {
    return reply(`
[ ! ] PARAMETER KOSONG
Gunakan format:
>>> ${prefix}ytmp3 <link> (Audio)
>>> ${prefix}ytmp4 <link> (Video)
`);
  }

  if (!/(youtube\.com|youtu\.be)/i.test(inputUrl)) {
    return reply('[ ! ] Link invalid. Harus domain YouTube.');
  }

  const isAudio = /mp3|song|audio|musik/i.test(command);
  const type = isAudio ? 'mp3' : 'mp4';
  
  reply(`[ ... ] Memproses ${type.toUpperCase()} dari YouTube Server...`);

  const engine = new YouTubeEngine();
  const tmpDir = path.resolve('./tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const uniqueId = `yt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const ext = isAudio ? 'mp3' : 'mp4';
  const filePath = path.join(tmpDir, `${uniqueId}.${ext}`);

  try {
    const data = await engine.process(inputUrl, type);

    await downloadStream(data.downloadUrl, filePath);

    const stats = fs.statSync(filePath);
    const sizeMB = stats.size / (1024 * 1024);

    const caption = 
`[ YOUTUBE DOWNLOADER ]
======================
[>] Title : ${data.title}
[>] Type  : ${type.toUpperCase()}
[>] Size  : ${sizeMB.toFixed(2)} MB
======================
[<] Credit By Yunxi Assistant`;

    if (isAudio) {
      await conn.sendMessage(m.chat, { 
        audio: fs.readFileSync(filePath), 
        mimetype: 'audio/mpeg', 
        fileName: `${data.title}.mp3`,
        ptt: false 
      }, { quoted: m });
    } else {
      await conn.sendMessage(m.chat, { 
        video: fs.readFileSync(filePath), 
        caption: caption,
        mimetype: 'video/mp4' 
      }, { quoted: m });
    }

  } catch (e) {
    console.error('[ERR] YouTube Handler:', e);
    
    let msg = '[ x ] System Error.';
    if (e.message.includes('[LIMIT]')) msg = e.message;
    if (e.message.includes('[TIMEOUT]')) msg = '[ x ] Server timeout, coba lagi nanti.';
    if (e.message.includes('[API]')) msg = '[ x ] Gagal fetch data dari provider.';

    reply(msg);
  } finally {
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, (err) => {
        if (err) console.error(`[WARN] Gagal hapus sampah: ${filePath}`);
      });
    }
  }
};

handler.help = ['ytmp3', 'ytmp4', 'play', 'video'];
handler.tags = ['downloader'];
handler.command = /^(ytmp3|ytmp4|play|ytv|yta)$/i;
handler.prefix = ".";

export default handler;