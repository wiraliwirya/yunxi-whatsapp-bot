import axios from 'axios';

class AiGenerator {
    constructor() {
        this.baseUrl = "https://image.pollinations.ai/prompt/";
        this.styleSuffix = " (highly detailed:1.2), (8k, photorealistic, cinematic lighting), unreal engine 5 render, sharp focus, masterpiece, vibrant colors";
    }

    async generateImage(prompt) {
        try {
            const seed = Math.floor(Math.random() * 1000000000);
            
            const finalPrompt = `${prompt}, ${this.styleSuffix}`;
            const encodedPrompt = encodeURIComponent(finalPrompt);

            const url = `${this.baseUrl}${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`;

            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                },
                timeout: 60000
            });

            return {
                buffer: response.data,
                prompt: prompt,
                seed: seed,
                model: 'Flux-Realism'
            };

        } catch (error) {
            console.error("[AI Image Error]:", error.message);
            throw new Error("Server AI sedang sibuk atau timeout. Coba lagi nanti.");
        }
    }
}

let handler = async (m, { conn, text, q, args, prefix, command, reply }) => {
    const input = text || q || (args && args.length > 0 ? args.join(' ') : '');

    if (!input) {
        return reply(
            `[Cara Pakai]\n` +
            `Harap sertakan deskripsi gambar.\n\n` +
            `Contoh:\n` +
            `• *${prefix}${command} kucing cyberpunk neon city*\n` +
            `• *${prefix}${command} pemandangan gunung sore hari aesthetic*`
        );
    }

    reply(`[Sedang generate]\n"${input}"\n\n_Mohon tunggu 5-10 detik..._`);

    const ai = new AiGenerator();

    try {
        const result = await ai.generateImage(input);

        const caption = `[AI IMAGE RESULT]\n` +
                       `──────────────────\n` +
                       `Prompt: ${result.prompt}\n` +
                       `Model: ${result.model}\n` +
                       `Seed: ${result.seed}\n` +
                       `──────────────────\n` +

        await conn.sendMessage(m.chat, { 
            image: result.buffer, 
            caption: caption 
        }, { quoted: m });

    } catch (e) {
        console.error('[AI Handler Error]', e);
        reply(`[Error]: ${e.message}`);
    }
};

handler.help = ['imagine', 'aiimage'];
handler.tags = ['ai'];
handler.command = /^(imagine|aiimg|aiimage|txt2img|img)$/i;
handler.prefix = ".";

export default handler;