import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_SIZE_MB = 150;

class BilibiliEngine {
  constructor() {
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.bilibili.tv/',
      'Origin': 'https://www.bilibili.tv'
    };
  }

  extractId(url) {
    const patterns = [
      /bilibili\.tv\/(?:en|id|[a-z]{2})\/video\/(\d+)/i,
      /bilibili\.tv\/video\/(\d+)/i,
      /^(\d{10,})$/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  async getMetadata(aid, qn = 64) {
    // qn=64 itu setara 720p, qn=32 itu 480p.
    const apiUrl = `https://api.bilibili.tv/intl/gateway/web/playurl?s_locale=id_ID&platform=web&aid=${aid}&qn=${qn}&type=0&device=wap&tf=0&force_container=2`;
    
    try {
      console.log(`[LOG] Fetching metadata AID: ${aid}`);
      const { data } = await axios.get(apiUrl, { headers: this.headers });

      if (data.code !== 0) throw new Error(`[API_ERR] ${data.message}`);

      const playInfo = data.data.playurl;
      if (!playInfo || !playInfo.video || playInfo.video.length === 0) {
        throw new Error('[404] Video stream tidak ditemukan.');
      }

      const videoData = playInfo.video.find(v => v.stream_info.quality === qn) || playInfo.video[0];
      
      return {
        url: videoData.video_resource.url,
        quality: videoData.stream_info.description || 'SD',
        size_bytes: videoData.stream_info.size || 0
      };
    } catch (e) {
      throw new Error(`[META_FAIL] ${e.message}`);
    }
  }

  async downloadStream(url, savePath) {
    const writer = fs.createWriteStream(savePath);
    
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      headers: this.headers
    });

    const totalSize = response.headers['content-length'];
    if (totalSize && (parseInt(totalSize) / (1024 * 1024) > MAX_SIZE_MB)) {
      writer.close();
      fs.unlinkSync(savePath);
      throw new Error(`[LIMIT] File terlalu besar (${(parseInt(totalSize)/(1024*1024)).toFixed(2)} MB). Max ${MAX_SIZE_MB}MB.`);
    }

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(savePath));
      writer.on('error', (err) => {
        writer.close();
        if (fs.existsSync(savePath)) fs.unlinkSync(savePath);
        reject(err);
      });
    });
  }
}

let handler = async (m, { conn, args, q, prefix, command, reply }) => {
  const inputUrl = q || (args && args.length > 0 ? args.join(' ') : '');

  if (!inputUrl) {
    return reply(`
[ ! ] PARAMETER KOSONG
Format: ${command} <url_bilibili>

Contoh:
>>> ${command} https://www.bilibili.tv/en/video/4797959484348416
`);
  }

  if (!/bilibili\.tv/.test(inputUrl)) {
    return reply('[ ! ] URL Invalid. Pastikan link dari Bilibili TV.');
  }

  reply('[ ... ] Sedang Proses, Harap Tunggu...');

  const engine = new BilibiliEngine();
  const aid = engine.extractId(inputUrl);

  if (!aid) return reply('[ ! ] Gagal mengambil ID video dari URL.');

  const tmpDir = path.resolve('./tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const uniqueId = `bili_${aid}_${Date.now()}`;
  const filePath = path.join(tmpDir, `${uniqueId}.mp4`);

  try {
    const meta = await engine.getMetadata(aid, 64);

    // reply(`[ ... ] Downloading stream (${meta.quality})...`);
    await engine.downloadStream(meta.url, filePath);

    const stats = fs.statSync(filePath);
    const sizeMB = stats.size / (1024 * 1024);

    const caption = 
`[ BILIBILI DOWNLOADER ]
=======================
[>] ID   : ${aid}
[>] Qual : ${meta.quality}
[>] Size : ${sizeMB.toFixed(2)} MB
=======================
[<] Credit By Yunxi Assistant`;

    await conn.sendMessage(m.chat, { 
      video: fs.readFileSync(filePath), 
      caption: caption,
      mimetype: 'video/mp4' 
    }, { quoted: m });

  } catch (e) {
    console.error('[ERR] Bilibili Handler:', e);
    
    let msg = '[ x ] System Error.';
    if (e.message.includes('[LIMIT]')) msg = e.message;
    if (e.message.includes('[API_ERR]')) msg = '[ x ] API Bilibili menolak request.';
    if (e.message.includes('[404]')) msg = '[ x ] Video tidak ditemukan / Region Locked.';

    reply(msg);

  } finally {
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, (err) => {
        if (err) console.error(`[WARN] Gagal hapus temp: ${filePath}`);
      });
    }
  }
};

handler.help = ['bilibili', 'bstation'];
handler.tags = ['downloader'];
handler.command = /^(bilibili|bstation|bst)$/i;

export default handler;