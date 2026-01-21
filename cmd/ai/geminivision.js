import axios from 'axios';
import FormData from 'form-data';

let handler = async (m, { conn, text, prefix, command, reply }) => {
    let q = m.quoted ? m.quoted : m;
    let mime = (q.msg || q).mimetype || '';
    
    if (!/image\/(png|jpe?g|webp)/.test(mime)) {
        return reply(
            `[Cara Pakai]\n` +
            `Kirim/Reply gambar dengan caption *${prefix}${command}*\n\n` +
            `Fitur ini membaca teks dari gambar menggunakan OCR.`
        );
    }

    reply(`[Sedang scan gambar]\n_Mohon tunggu sebentar..._`);

    try {
        const imgBuffer = await q.download();
        if (!imgBuffer) {
            throw new Error("Gagal mengunduh gambar.");
        }

        const form = new FormData();
        form.append('file', imgBuffer, { filename: 'image.jpg', contentType: mime });
        form.append('apikey', 'helloworld'); 
        form.append('language', 'eng');
        form.append('isOverlayRequired', 'false');

        const { data } = await axios.post('https://api.ocr.space/parse/image', form, {
            headers: {
                ...form.getHeaders(),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 30000
        });

        if (data.IsErroredOnProcessing) {
            throw new Error(data.ErrorMessage?.[0] || "Gagal memproses gambar.");
        }

        const parsedResult = data.ParsedResults?.[0];
        const parsedText = parsedResult?.ParsedText?.trim();

        if (!parsedText) {
            return reply(`[Hasil]: Tidak ada teks terbaca di gambar.`);
        }

        await m.reply(
            `[HASIL OCR]\n` +
            `──────────────────\n\n` +
            `${parsedText}`
        );

    } catch (e) {
        console.error('[OCR Error]', e.message);
        reply(`[Error]: ${e.message}`);
    }
};

handler.help = ['ocr', 'scan', 'vision'];
handler.tags = ['ai', 'tools'];
handler.command = /^(ocr|scan|vision|bacagambar)$/i;
handler.prefix = ".";

export default handler;