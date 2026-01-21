import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Pinterest {
  constructor() {
    this.api = {
      base: "https://www.pinterest.com",
      endpoints: { pin: "/resource/PinResource/get/" }
    };
    
    this.headers = {
      accept: "application/json, text/javascript, */*, q=0.01",
      referer: "https://www.pinterest.com/",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
      "x-app-version": "f1222d7",
      "x-pinterest-appstate": "active",
      "x-pinterest-pws-handler": "www/[username]/[slug].js",
      "x-pinterest-source-url": "/search/pins/?rs=typed&q=xxx/",
      "x-requested-with": "XMLHttpRequest"
    };
    
    this.client = axios.create({ baseURL: this.api.base, headers: this.headers });
    this.cookies = "";
    
    this.client.interceptors.response.use(
      (response) => {
        const setCookie = response.headers["set-cookie"];
        if (setCookie) {
          const newCookies = setCookie.map(cookie => cookie.split(";")[0].trim());
          this.cookies = newCookies.join("; ");
          this.client.defaults.headers.cookie = this.cookies;
        }
        return response;
      },
      (error) => Promise.reject(error)
    );
  }

  isUrl(str) {
    try { new URL(str); return true; } catch { return false; }
  }

  isPin(url) {
    if (!url) return false;
    const patterns = [
      /^https?:\/\/(?:[\w-]+\.)?pinterest\.[\w.]+\/pin\/[\w.-]+/,
      /^https?:\/\/pin\.it\/[\w.-]+/,
      /^https?:\/\/(?:[\w-]+\.)?pinterest\.[\w.]+\/pin\/[\d]+(?:\/)?/,
    ];
    return patterns.some(pattern => pattern.test(url.trim().toLowerCase()));
  }

  async followRedirects(url, maxRedirects = 3) {
    try {
      let currentUrl = url;
      let count = 0;

      while (count < maxRedirects) {
        const response = await axios.head(currentUrl, {
          maxRedirects: 0,
          validateStatus: status => status >= 200 && status < 400,
          timeout: 10000
        });

        if (response.status >= 300 && response.status < 400 && response.headers.location) {
          currentUrl = response.headers.location;
          if (!currentUrl.startsWith("http")) {
            const baseUrl = new URL(url);
            currentUrl = new URL(currentUrl, baseUrl.origin).href;
          }
          count++;
        } else {
          break;
        }
      }
      return currentUrl;
    } catch (error) {
      if (error.response?.headers.location) return error.response.headers.location;
      return url;
    }
  }

  async initCookies() {
    try {
      await this.client.get("/");
      return true;
    } catch (error) {
      console.error("Gagal init cookies:", error.message);
      return false;
    }
  }

  async fetchPinData(pinUrl) {
    const finalUrl = await this.followRedirects(pinUrl);

    if (!this.isPin(finalUrl)) {
      throw new Error("Link ga valid atau bukan Pinterest!");
    }

    const pinId = finalUrl.match(/\/pin\/(\d+)/)?.[1];
    if (!pinId) throw new Error("Pin ID ga ketemu anjir!");

    if (!this.cookies) await this.initCookies();

    const params = {
      source_url: `/pin/${pinId}/`,
      data: JSON.stringify({
        options: { field_set_key: "detailed", id: pinId },
        context: {}
      }),
      _: Date.now()
    };

    const { data } = await this.client.get(this.api.endpoints.pin, { params });

    if (!data.resource_response?.data) {
      throw new Error("Pin ga ada (private/dihapus).");
    }

    const pd = data.resource_response.data;
    const result = {
      id: pd.id,
      title: pd.title || pd.grid_title || "Pinterest Pin",
      description: pd.description || "",
      type: "image",
      url: null,
      is_video: false
    };

    if (pd.videos?.video_list) {
      const vList = pd.videos.video_list;
      let bestVideo = vList.V_720P || vList.V_HLSV3_MOBILE || Object.values(vList)[0];
      
      if (bestVideo) {
        result.type = "video";
        result.is_video = true;
        result.url = bestVideo.url;
        if (result.url.includes(".m3u8")) {
          result.url = result.url.replace("/hls/", "/720p/").replace(".m3u8", ".mp4");
        }
      }
    } else if (pd.embed?.type === "gif" && pd.embed.src) {
      result.type = "gif";
      result.url = pd.embed.src;
    } else if (pd.images?.orig) {
      result.type = "image";
      result.url = pd.images.orig.url;
    }

    if (!result.url) throw new Error("Media ga ketemu!");
    
    return result;
  }

  async downloadFile(url, outputPath) {
    const writer = fs.createWriteStream(outputPath);
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      headers: { 'User-Agent': this.headers['user-agent'] }
    });
    
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }
}

let handler = async (m, { conn, args, q, command, reply }) => {
  const inputUrl = q || args.join(' ');

  if (!inputUrl) {
    return reply(`Kasih link Pinterest dong!

*Contoh:* ${command} https://pin.it/7jWBaQGhd`);
  }

  reply('📌 Proses Pin Pinterest...');

  const scraper = new Pinterest();
  const tmpDir = path.resolve('./tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const uniqueId = Date.now();
  let filePath = path.join(tmpDir, `pin_${uniqueId}`);

  try {
    const data = await scraper.fetchPinData(inputUrl);

    const ext = data.url.split('.').pop().split('?')[0];
    filePath += `.${ext}`;

    await scraper.downloadFile(data.url, filePath);

    const stats = fs.statSync(filePath);
    const sizeMB = stats.size / (1024 * 1024);
    if (sizeMB > 100) throw new Error(`File kegedean (${sizeMB.toFixed(2)} MB)!`);

    const caption = `📌 *Pinterest Downloader*
` +
                    `──────────────────
` +
                    `📝 *Judul:* ${data.title}
` +
                    `📄 *Tipe:* ${data.type.toUpperCase()}
` +
                    `💾 *Ukuran:* ${sizeMB.toFixed(2)} MB
` +
                    `──────────────────`;

    if (data.is_video || data.type === 'gif') {
      await conn.sendMessage(m.chat, {
        video: fs.readFileSync(filePath),
        caption,
        gifPlayback: data.type === 'gif'
      }, { quoted: m });
    } else {
      await conn.sendMessage(m.chat, {
        image: fs.readFileSync(filePath),
        caption
      }, { quoted: m });
    }

  } catch (e) {
    console.error('❌ Pinterest Error:', e);
    
    if (e.message.includes('ga ada') || e.message.includes('404')) {
      reply('❌ Pin udah dihapus atau private!');
    } else if (e.message.includes('ga valid') || e.message.includes('Pin ID')) {
      reply('❌ Link Pinterest lu ga bener!');
    } else {
      reply(`❌ Error: ${e.message}`);
    }
  } finally {
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
};

handler.help = ['pinterestdl', 'pindl'];
handler.tags = ['downloader'];
handler.command = /^(pinterestdl|pindl)$/i;

export default handler;