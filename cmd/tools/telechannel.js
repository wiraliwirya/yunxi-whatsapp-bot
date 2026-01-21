import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TelegramChannel {
  constructor(channelUsername, options = {}) {
    this.channelUsername = channelUsername.replace('@', ''); 
    this.baseUrl = 'https://t.me';
    this.options = {
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 2000,
      requestTimeout: options.requestTimeout || 30000,
      ...options
    };
  }

  async retryRequest(requestFn, attempts = this.options.retryAttempts) {
    for (let i = 0; i < attempts; i++) {
      try {
        return await requestFn();
      } catch (error) {
        if (i === attempts - 1) throw error;
        // console.log(`[Retry] ${i + 1}/${attempts}: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));
      }
    }
  }

  async fetchChannelPage() {
    return this.retryRequest(async () => {
      const url = `${this.baseUrl}/s/${this.channelUsername}`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: this.options.requestTimeout
      });
      return response.data;
    });
  }

  parseMessage($, element) {
    const $msg = $(element);
    
    const textElement = $msg.find('.tgme_widget_message_text.js-message_text').first();
    const text = textElement.text().trim();
    const htmlText = textElement.html() ? textElement.html().trim() : '';
    
    const views = $msg.find('.tgme_widget_message_views').text().trim();
    const dateElement = $msg.find('.tgme_widget_message_date');
    const messageUrl = dateElement.attr('href');
    const messageId = messageUrl ? messageUrl.split('/').pop() : null;
    
    const hasPhoto = $msg.find('.tgme_widget_message_photo_wrap').length > 0;
    const hasVideo = $msg.find('.tgme_widget_message_video_wrap').length > 0 || 
                      $msg.find('.tgme_widget_message_video_player').length > 0;
    
    let photoUrl = null;
    if (hasPhoto) {
      const photoWrap = $msg.find('.tgme_widget_message_photo_wrap');
      const style = photoWrap.attr('style');
      const urlMatch = style?.match(/background-image:url\('(.+?)'\)/);
      if (urlMatch) photoUrl = urlMatch[1];
    }

    let videoUrl = null;
    let videoThumb = null;
    if (hasVideo) {
        const vidElem = $msg.find('video');
        videoUrl = vidElem.attr('src');
        
        const thumbStyle = $msg.find('.tgme_widget_message_video_thumb').attr('style');
        const thumbMatch = thumbStyle?.match(/background-image:url\('(.+?)'\)/);
        if (thumbMatch) videoThumb = thumbMatch[1];
    }

    let documentInfo = null;
    if ($msg.find('.tgme_widget_message_document').length > 0) {
        const docTitle = $msg.find('.tgme_widget_message_document_title').text().trim();
        const docSize = $msg.find('.tgme_widget_message_document_extra').text().trim();
        documentInfo = { title: docTitle, size: docSize };
    }

    return {
      id: messageId,
      url: messageUrl,
      text,
      htmlText,
      views: views || '0',
      media: {
        type: hasVideo ? 'video' : hasPhoto ? 'photo' : documentInfo ? 'document' : 'text',
        url: videoUrl || photoUrl || null,
        thumbnail: videoThumb,
        document: documentInfo
      }
    };
  }

  async getChannelInfo() {
    const html = await this.fetchChannelPage();
    const $ = cheerio.load(html);
    
    const title = $('.tgme_channel_info_header_title span').text().trim();
    const username = $('.tgme_channel_info_header_username a').text().trim();
    const description = $('.tgme_channel_info_description').text().trim();
    const subscribers = $('.tgme_channel_info_counter .counter_value').first().text().trim();
    
    let photoUrl = $('.tgme_page_photo_image img').attr('src');
    
    return {
      title,
      username,
      description,
      subscribers,
      photoUrl,
      url: `${this.baseUrl}/${this.channelUsername}`
    };
  }

  async getMessages(limit = 5) {
    const html = await this.fetchChannelPage();
    const $ = cheerio.load(html);
    const messages = [];
    
    const elements = $('.tgme_widget_message').toArray(); 
    
    const recentElements = elements.slice(-limit); 

    for (const element of recentElements) {
      const msg = this.parseMessage($, element);
      if (msg.id) messages.push(msg);
    }
    
    return messages.reverse(); 
  }
}

let handler = async (m, { conn, args, q, command, reply }) => {
    const input = q || (args && args.length > 0 ? args.join(' ') : '');

    if (!input) {
        return reply(
            `Harap sertakan Username Channel Telegram.\n` +
            `Contoh: *${command} hannuniverse*`
        );
    }

    let [username, limitStr] = input.split('|').map(s => s.trim());
    let limit = parseInt(limitStr) || 1; 
    if (limit > 5) limit = 5; 

    if (username.includes('t.me/')) {
        username = username.split('t.me/')[1].split('/')[0];
    }

    reply(`🔍 Mengambil data channel *${username}*...`);

    try {
        const scraper = new TelegramChannel(username);
        
        const info = await scraper.getChannelInfo();
        if (!info.title) throw new Error('Channel tidak ditemukan atau Username salah.');

        const infoCaption = `📢 *TELEGRAM CHANNEL INFO*\n` +
                            `──────────────────\n` +
                            `📌 *Nama:* ${info.title}\n` +
                            `🔗 *User:* ${info.username}\n` +
                            `👥 *Subs:* ${info.subscribers || 'Hidden'}\n` +
                            `📝 *Desc:* ${info.description || '-'}\n` +
                            `──────────────────\n` +
                            `_Mengambil ${limit} post terbaru..._`;

        await conn.sendMessage(m.chat, { 
            image: { url: info.photoUrl }, 
            caption: infoCaption 
        }, { quoted: m });

        const messages = await scraper.getMessages(limit);

        if (messages.length === 0) {
            return reply('Channel ini belum memiliki postingan atau diprivate.');
        }

        for (const msg of messages) {
            await new Promise(resolve => setTimeout(resolve, 1500)); 

            let caption = `💬 *POST #${msg.id}*\n` +
                          `👁️ *Views:* ${msg.views}\n` +
                          `🔗 *Link:* ${msg.url}\n\n` +
                          `${msg.text}`; 

            if (caption.length > 1000) caption = caption.substring(0, 1000) + '... (Baca selengkapnya di link)';

            if (msg.media.type === 'photo' && msg.media.url) {
                await conn.sendMessage(m.chat, { 
                    image: { url: msg.media.url }, 
                    caption: caption 
                }, { quoted: m });

            } else if (msg.media.type === 'video') {
                if (msg.media.url && msg.media.url.startsWith('http')) {
                    await conn.sendMessage(m.chat, { 
                        video: { url: msg.media.url }, 
                        caption: caption 
                    }, { quoted: m }).catch(async () => {
                        await conn.sendMessage(m.chat, { 
                            image: { url: msg.media.thumbnail || info.photoUrl }, 
                            caption: `🎥 *Video Post* (Gagal memuat preview)\n\n${caption}`
                        }, { quoted: m });
                    });
                } else {
                    await conn.sendMessage(m.chat, { 
                        image: { url: msg.media.thumbnail || info.photoUrl }, 
                        caption: `🎥 *Video Post*\n\n${caption}` 
                    }, { quoted: m });
                }

            } else if (msg.media.type === 'document') {
                await m.reply(`📄 *Document Post*\nNama: ${msg.media.document.title}\nSize: ${msg.media.document.size}\n\n${caption}`);
            
            } else {
                await m.reply(caption);
            }
        }

    } catch (e) {
        console.error('[Telegram Scraper Error]', e);
        reply(`❌ Gagal: ${e.message}`);
    }
};

handler.help = ['telegramchannel', 'tchannel'];
handler.tags = ['tools'];
handler.command = /^(telegramchannel|tgchannel|tchannel|tgch)$/i;

export default handler;