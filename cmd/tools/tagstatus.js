/*──────────────────────────────────────
  Script : Tag Status WhatsApp (Fixed)
  Fix    : Parsing Link & Broadcasting Method
  Logic  : Send to 'status@broadcast' + Mentions All Member
──────────────────────────────────────*/

let handler = async (m, { conn, text, usedPrefix, command, isGroup }) => {
    // 1. Validasi Awal
    if (!isGroup && !text) return m.reply(`⚠️ Command ini hanya bisa digunakan di dalam grup atau dengan menyertakan link grup!`);

    // --- WARNA BACKGROUND (Untuk Status Teks) ---
    const colorMap = {
        'biru': '#34B7F1', 'hijau': '#25D366', 'kuning': '#FFD700',
        'jingga': '#FF8C00', 'merah': '#FF3B30', 'ungu': '#9C27B0',
        'abu': '#9E9E9E', 'hitam': '#000000', 'putih': '#FFFFFF',
        'cyan': '#00BCD4', 'coklat': '#8B4513', 'pink': '#FF69B4'
    };

    // 2. Variabel Default
    let targetJid = m.chat;
    let targetName = "Grup Ini";
    let caption = "";
    let bgColor = "#000000"; // Default Hitam
    let inviteLink = "";

    // 3. Parsing Input Cerdas (Teks | Warna | Link)
    // Regex untuk mencari Link Grup WA
    const linkRegex = /chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/i;
    
    if (text) {
        let args = text.split('|').map(v => v.trim());
        
        // Cek setiap bagian apakah ada link atau warna
        for (let arg of args) {
            if (linkRegex.test(arg)) {
                inviteLink = arg; // Ketemu Link
            } else if (colorMap[arg.toLowerCase()]) {
                bgColor = colorMap[arg.toLowerCase()]; // Ketemu Warna
            } else {
                caption = arg; // Sisanya Caption/Teks
            }
        }
    }

    // 4. Validasi Link Grup (Jika Ada)
    if (inviteLink) {
        try {
            m.reply('🔍 Memverifikasi link grup...');
            const code = inviteLink.match(linkRegex)[1];
            const groupInfo = await conn.groupGetInviteInfo(code);
            targetJid = groupInfo.id;
            targetName = groupInfo.subject;
        } catch (e) {
            return m.reply('❌ Link grup tidak valid atau bot tidak memiliki akses!');
        }
    }

    // 5. Ambil Data Member (Wajib untuk Tagging)
    // Bot harus ada di dalam grup target untuk mengambil list member
    let participantIds = [];
    try {
        const metadata = await conn.groupMetadata(targetJid);
        participantIds = metadata.participants.map(p => p.id);
    } catch (e) {
        return m.reply(`❌ Gagal mengambil data member grup "${targetName}".\nPastikan Bot sudah bergabung di grup tersebut!`);
    }

    // 6. Handle Media (Reply atau Upload)
    let mime = (m.quoted ? m.quoted.mimetype : m.mimetype) || '';
    let isMedia = /image|video|audio|sticker/.test(mime);
    let mediaBuffer = null;

    // Feedback Proses
    m.reply(`⏳ Mengunduh media & mengirim status ke ${participantIds.length} member...`);

    try {
        // --- OPSI A: KIRIM MEDIA ---
        if (isMedia) {
            mediaBuffer = await (m.quoted ? m.quoted.download() : m.download());
            
            // Generate pesan status
            let msgOptions = {
                caption: caption || "", 
                mentions: participantIds // INI KUNCINYA (Supaya muncul notif di status)
            };

            // Kirim ke status@broadcast
            if (/image/.test(mime)) {
                await conn.sendMessage('status@broadcast', { image: mediaBuffer, ...msgOptions }, { 
                    backgroundColor: bgColor, 
                    font: 1,
                    statusJidList: participantIds // Tambahan support untuk beberapa library Baileys
                });
            } else if (/video/.test(mime)) {
                await conn.sendMessage('status@broadcast', { video: mediaBuffer, ...msgOptions }, { 
                    backgroundColor: bgColor, 
                    font: 1,
                    statusJidList: participantIds
                });
            } else if (/audio/.test(mime)) {
                await conn.sendMessage('status@broadcast', { audio: mediaBuffer, mimetype: 'audio/mp4', ...msgOptions }, { 
                    backgroundColor: bgColor,
                    statusJidList: participantIds
                });
            } else if (/sticker/.test(mime)) {
                await conn.sendMessage('status@broadcast', { sticker: mediaBuffer, ...msgOptions }, { 
                    backgroundColor: bgColor,
                    statusJidList: participantIds
                });
            }
        } 
        
        // --- OPSI B: KIRIM TEKS (Background Warna) ---
        else {
            if (!caption) return m.reply("❌ Masukkan teks untuk status!");
            
            await conn.sendMessage('status@broadcast', {
                text: caption,
                mentions: participantIds // Tag semua member
            }, {
                backgroundColor: bgColor, // Warna background
                font: 1, // Jenis font (1-5)
                statusJidList: participantIds
            });
        }

        // 7. Pesan Sukses (Sesuai Request Desain)
        m.reply(
`✅ *Status Terkirim!*
──────────────────
🎯 *Target:* ${targetName}
👥 *Penerima:* ${participantIds.length} Member
🆔 *ID:* ${targetJid.split('@')[0]}
🎨 *Tipe:* ${isMedia ? 'Media' : 'Teks'}
⏰ *Waktu:* ${new Date().toLocaleTimeString('id-ID')}
──────────────────
_Cek tab Status WA lu bang!_`
        );

    } catch (e) {
        console.error(e);
        m.reply(`❌ Gagal mengirim status: ${e.message}`);
    }
};

handler.help = ['tagsw'];
handler.tags = ['group'];
handler.command = /^(tagsw|tagstatus)$/i;
handler.group = false; // False supaya bisa pakai link di private chat juga

export default handler;