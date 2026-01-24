import "../settings/config.js";
import {
    BufferJSON,
    WA_DEFAULT_EPHEMERAL,
    generateWAMessageFromContent,
    generateWAMessageContent,
    generateWAMessage,
    prepareWAMessageMedia,
    areJidsSameUser,
    getContentType,
    downloadContentFromMessage,
} from "@whiskeysockets/baileys";
import fs from "fs-extra";
import util from "util";
import chalk from "chalk";
import {
    exec,
    spawn
} from "child_process";
import { performance } from 'perf_hooks';
import v8 from 'v8'; 
import axios from "axios";
import {
    fileURLToPath
} from "url";
import path from "path";
import os from "os";
import JsConfuser from "js-confuser";
import * as jimp from "jimp";
import speed from "performance-now";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import sharp from "sharp";
import fileType from "file-type";
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let syntaxerror;
try {
    syntaxerror = require('syntax-error');
} catch (e) {
    syntaxerror = null;
}

import {
    addProduk,
    getListProduk,
    deleteProduk,
    editProduk,
    findProduk,
} from "./events/store.js";

import {
    generateProfilePicture,
    getBuffer,
    fetchJson,
    fetchText,
    getRandom,
    runtime,
    sleep,
    makeid,
    toRupiah,
} from "../source/myfunc.js";

import {
    qtext,
    metaai,
    qpoll,
    qpay,
    qvideo,
    qloc,
    qproduct,
    qorder,
    qevent,
} from "../source/qouted.js";
import {
    runPlugins,
    pluginsLoader
} from "../handler.js";
import {
    makeStickerFromUrl
} from "../source/events/_sticker.js";
import Case from "./events/system.js";
let prefix = ".";
let mode = true;

function levenshtein(a, b) {
    let dp = Array.from({
            length: a.length + 1
        }, (_, i) =>
        Array.from({
            length: b.length + 1
        }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            dp[i][j] =
                a[i - 1] === b[j - 1] ?
                dp[i - 1][j - 1] :
                Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
        }
    }
    return dp[a.length][b.length];
}

function similarityPercent(a, b) {
    let maxLength = Math.max(a.length, b.length);
    if (maxLength === 0) return 100;
    let distance = levenshtein(a, b);
    return Math.round(((maxLength - distance) / maxLength) * 100);
}

async function getCaseCommands(filePath) {
    try {
        let code = await fs.promises.readFile(filePath, "utf8");
        let regex = /case\s+['"`](.*?)['"`]/g;
        let matches = [];
        let match;
        while ((match = regex.exec(code)) !== null) matches.push(match[1]);
        return matches;
    } catch {
        return [];
    }
}

export default async (conn, m) => {
    try {
        let body = m.body || m.text || "";
        let budy = body;
        let command = body.startsWith(prefix) ? body.slice(prefix.length).trim().split(/ +/)[0].toLowerCase() : "";
        let commands = command; 
        let args = body.trim().split(/ +/).slice(1);
        let q = args.join(" ");
        let qmsg = m.quoted || m;
        let quoted = m.quoted ? m.quoted : m;
        let mime = quoted?.msg?.mimetype || quoted?.mimetype || null;
        let message = m;
        let messageType = m.mtype;
        let messageKey = message.key;
        let pushName = m.pushName || "Undefined";
        let itsMe = m.key.fromMe;
        let chat = m.chat;
        let sender = m.sender;
        let userId = sender.split("@")[0];
        let isOwner = global.owner.includes(userId) || global.owner.includes(sender);
        let botNumber = conn.user.id.split(":")[0] + "@s.whatsapp.net";
        let isGroup = m.key.remoteJid.endsWith("@g.us");

        let groupMetadata = {};
        let groupName = "";
        let groupId = "";
        let groupMembers = [];
        let isGroupAdmins = false;
        let isBotGroupAdmins = false;
        let me = {};

        if (isGroup) {
            groupMetadata = await conn.groupMetadata(chat).catch(() => ({}));
            groupName = groupMetadata.subject || "";
            groupId = groupMetadata.id || "";
            groupMembers = groupMetadata.participants || [];
            isGroupAdmins = !!groupMembers.find((p) => p.admin && p.id === sender);
            isBotGroupAdmins = !!groupMembers.find((p) => p.admin && p.id === botNumber);
            me = groupMembers.find((p) => p.id === sender || p.jid === sender) || {};
        }

        let TypeMess = getContentType(m?.message);
        let reactions = TypeMess === "reactionMessage" ? m?.message[TypeMess]?.text : false;

        let reply = async (text) => {
            return conn.sendMessage(
                m.chat, {
                    text,
                    mentions: [m.sender],
                    contextInfo: {
                        externalAdReply: {
                            title: `${global.namebotz}`,
                            body: `Are you Reddy?`,
                            thumbnail: fs.readFileSync("./settings/image/image.jpg"),
                            sourceUrl: "https://t.me/FauziAlifatah",
                        },
                    },
                }, {
                    quoted: m
                }
            );
        };

        if (reactions && ["😂"].includes(reactions)) {
            conn.sendMessage(m.chat, {
                text: "*KWKWKWKWK😹*"
            }, {
                quoted: null
            });
        }

if (body.startsWith('$')) {
    if (!isOwner) return;
    const cmd = body.slice(1).trim();
    if (!cmd) return;
    
    m.reply('[Executing shell command]');
    
    exec(cmd, (err, stdout, stderr) => {
        if (err) {
            return m.reply(`[ERROR]\n\n\`\`\`${err.toString()}\`\`\``);
        }
        if (stderr) {
            return m.reply(`[STDERR]\n\n\`\`\`${stderr.toString()}\`\`\``);
        }
        if (stdout) {
            return m.reply(`[OUTPUT]\n\n\`\`\`${stdout.toString()}\`\`\``);
        }
    });
    return;
}

if (body.startsWith('>')) {
    if (!isOwner) return;
    const code = body.slice(1).trim();
    if (!code) return;

    try {
        const evalCmd = `(async () => { 
            try { 
                ${code} 
            } catch(e) { 
                console.error(e); 
                throw e; 
            } 
        })()`;
        
        await eval(evalCmd);
        await m.react('✅');
        
    } catch (e) {
        const err = syntaxerror ? syntaxerror(code, "EvalError") : e;
        const errorMsg = util.format(e);
        m.reply(`[SCRIPT ERROR]\n\n\`\`\`javascript\n${err || errorMsg}\n\`\`\``);
    }
    return;
}

if (body.startsWith('=>')) {
    if (!isOwner) return;
    const code = body.slice(2).trim();
    if (!code) return;

    try {
        const evalCmd = `(async () => { 
            try { 
                return ${code} 
            } catch(e) { 
                throw e; 
            } 
        })()`;
        
        const result = await eval(evalCmd);
        
        let output;
        if (typeof result === 'string') {
            output = result;
        } else if (typeof result === 'function') {
            output = result.toString();
        } else {
            output = util.format(result);
        }
        
        m.reply(`[EVAL RESULT]\n\n\`\`\`javascript\n${output}\n\`\`\``);
        
    } catch (e) {
        const err = syntaxerror ? syntaxerror(code, "EvalError") : e;
        const errorMsg = util.format(e);
        m.reply(`[SCRIPT ERROR]\n\n\`\`\`javascript\n${err || errorMsg}\n\`\`\``);
    }
    return;
}

        if (m.message) {
            let time = new Date().toLocaleTimeString("id-ID", {
                hour12: false
            });
            let line = chalk.gray("│");
            let who = `${chalk.yellow(pushName)} ${chalk.gray("(" + sender + ")" )}`;
            let place = isGroup ? chalk.magenta("Group: " + groupName) : chalk.green("Private");
            console.log(
                chalk.gray("╭────────────────────────────────"),
                `\n${line} ${chalk.cyan("🕒")} ${time}`,
                `\n${line} ${chalk.cyan("💬")} ${chalk.green(budy || m.mtype)}`,
                `\n${line} ${chalk.cyan("👤")} ${who}`,
                `\n${line} ${chalk.cyan("📞")} ${sender.split("@")[0]}`,
                `\n${line} ${chalk.cyan("🏷️")} ${place}`,
                `\n${chalk.gray("╰────────────────────────────────")}\n`
            );
        }

        if (!mode && !itsMe) return;
        if (!body.startsWith(prefix)) return;

        let resize = async (imagePathOrUrl, width, height) => {
            let imageBuffer;
            if (/^https?:\/\//.test(imagePathOrUrl)) {
                let response = await axios.get(imagePathOrUrl, {
                    responseType: "arraybuffer"
                });
                imageBuffer = response.data;
            } else {
                imageBuffer = await fs.readFile(imagePathOrUrl);
            }
            let read = await jimp.read(imageBuffer);
            return await read.resize(width, height).getBufferAsync(jimp.MIME_JPEG);
        };

        let reaction = async (jid, emoji) => {
            conn.sendMessage(jid, {
                react: {
                    text: emoji,
                    key: m.key
                }
            });
        };

        let plug = {
            conn,
            command,
            quoted,
            fetchJson,
            qtext,
            budy,
            commands,
            args,
            q,
            message,
            messageType,
            messageKey,
            pushName,
            itsMe,
            chat,
            sender,
            userId,
            reply,
            botNumber,
            isGroup,
            groupMetadata,
            groupName,
            groupId,
            groupMembers,
            isBotGroupAdmins,
            isGroupAdmins,
            generateProfilePicture,
            getBuffer,
            fetchJson,
            fetchText,
            getRandom,
            runtime,
            sleep,
            makeid,
            prefix,
            reaction,
            resize,
            metaai,
            isNumber: sender.split("@")[0],            
            toRupiah,
        };

        let pluginHandled = await runPlugins(m, plug);
        if (pluginHandled) return;

        let __filename = fileURLToPath(import.meta.url);
        let __dirname = path.dirname(__filename);

        let plugins = await pluginsLoader(path.resolve(__dirname, "../cmd"));
        let pluginCommands = plugins.flatMap((p) => p.command || []);
        let caseCommands = await getCaseCommands(__filename);
        let allCommands = [...new Set([...pluginCommands, ...caseCommands])];

        if (!allCommands.includes(command)) {
            let similarities = allCommands.map((cmd) => ({
                name: cmd,
                percent: similarityPercent(command, cmd),
            }));
            let filtered = similarities
                .sort((a, b) => b.percent - a.percent)
                .slice(0, 3)
                .filter((s) => s.percent >= 60);

            if (filtered.length) {
                let suggestions = filtered
                    .map((s, i) => `${i + 1}. *${prefix + s.name}* — ${s.percent}%`)
                    .join("\n");

                let buttons = filtered.map((s) => ({
                    buttonId: `${prefix}${s.name}`,
                    buttonText: {
                        displayText: `${prefix}${s.name}`
                    },
                    type: 1,
                }));

                await conn.sendMessage(
                    m.chat, {
                        text: `🔍 Mungkin yang kamu maksud:\n${suggestions}`,
                        footer: global.namebotz || "Bot",
                        buttons,
                        headerType: 1,
                        viewOnce: true,
                    }, {
                        quoted: metaai
                    }
                );
            }
            return;
        }

        switch (commands) {
            case "mode":
                await reaction(m.chat, "🧠");
                reply(`🤖 Bot Mode: ${conn.public ? "Public" : "Self"}`);
                break;

            case "only":
                if (!isOwner) return reply("Perintah ini hanya untuk Owner.");
                let code = body.slice(body.indexOf(commands) + commands.length).trim() || "return m";
                try {
                    let evaled = await eval(`(async () => { ${code} })()`);
                    if (typeof evaled !== "string") evaled = util.inspect(evaled);
                    await reply(evaled);
                } catch (err) {
                    reply(String(err));
                }
                break;

            case "cekidch":
            case "idch":
                if (!q) return reply(`*Contoh penggunaan :*\nketik ${commands} linkchannel`);
                if (!q.includes("https://whatsapp.com/channel/")) return reply("Link channel tidak valid");
                let result = q.split("https://whatsapp.com/channel/")[1];
                let res = await conn.newsletterMetadata("invite", result);
                reply(`${res.id}`);
                break;

            case "sticker":
            case "s": {
                let quotedMessage = m.quoted || m;
                let mime = (quotedMessage.msg || quotedMessage).mimetype || "";
                if (!/image|video/.test(mime))
                    return reply(`Reply sebuah gambar/video dengan caption ${prefix}${commands}`);
                try {
                    if (/image/.test(mime)) {
                        let media = await quotedMessage.download();
                        let imageUrl = `data:${mime};base64,${media.toString("base64")}`;
                        await makeStickerFromUrl(imageUrl, conn, m, reply);
                    } else if (/video/.test(mime)) {
                        let duration = (quotedMessage?.msg || quotedMessage)?.seconds;
                        if (duration > 10) return reply("Durasi video maksimal 10 detik!");
                        let media = await quotedMessage.download();
                        let videoUrl = `data:${mime};base64,${media.toString("base64")}`;
                        await makeStickerFromUrl(videoUrl, conn, m, reply);
                    }
                } catch (error) {
                    console.error(error);
                    reply("Terjadi kesalahan saat memproses media. Coba lagi.");
                }
            }
            break;

            case "autotag":
            case "atag":
                try {
                    if (args.length < 2) return reply(`*${prefix + command}* 628xx,628xx url caption`);
                    let nomorList = args[0];
                    let url = args[1];
                    let teksTag = args.slice(2).join(" ");

                    let jids = nomorList
                        .split(",")
                        .map((no) => no.replace(/[^0-9]/g, "") + "@s.whatsapp.net")
                        .filter((v) => v.length > 15);

                    if (typeof conn.sendStatusMentions === "function") {
                        await conn.sendStatusMentions({
                            image: {
                                url
                            },
                            fauzi: teksTag
                        }, jids);
                        reply(`✅ Status berhasil dikirim dan mention ke: ${jids.map((j) => `@${j.split("@")[0]}`).join(", ")}`, m.chat, {
                            mentions: jids
                        });
                    } else {
                        reply("Baileys kamu belum support `sendStatusMentions()`. Update Baileys atau aktifkan fitur Status API.");
                    }
                } catch (err) {
                    reply("❌ Gagal mengirim status mention.\n" + (err?.message || err));
                }
                break;

            case "bot":
                await conn.sendMessage(m.chat, {
                    requestPhoneNumber: {}
                });
                break;

            case "jid":
            case "getjid":
                reply(chat);
                break;

            case "getcase":
                if (!isOwner) return reply("Perintah ini hanya untuk Owner.");
                if (!q) return reply(`Contoh: ${prefix}getcase namacase`);
                try {
                    let hasil = Case.get(q);
                    reply(`✅ Case ditemukan:\n\n${hasil}`);
                } catch (e) {
                    reply(e.message);
                }
                break;

            case "addcase":
                if (!isOwner) return reply("Perintah ini hanya untuk Owner.");
                if (!q)
                    return reply(`Contoh: ${prefix}addcase case "namacase": {\n  reply("test");\n  break;\n}`);
                try {
                    Case.add(q);
                    reply("✅ Case berhasil ditambahkan.\n\n*Catatan:* Restart bot buat ngejalanin case baru.");
                } catch (e) {
                    reply(e.message);
                }
                break;

            case "delcase":
                if (!isOwner) return reply("Perintah ini hanya untuk Owner.");
                if (!q) return reply(`Contoh: ${prefix}delcase namacase`);
                try {
                    Case.delete(q);
                    reply(`✅ Case "${q}" berhasil dihapus.\n\n*Catatan:* Restart bot untuk perubahan.`);
                } catch (e) {
                    reply(e.message);
                }
                break;

            case "listcase":
                if (!isOwner) return reply("Perintah ini hanya untuk Owner.");
                try {
                    let listString = Case.list();
                    if (listString === "Tidak ada case!") {
                        return reply("📜 *List Case*\n\nBelum ada case custom yang ditambah.");
                    }
                    let commands = listString.split("\n");
                    let total = commands.length;
                    let formattedList = commands.map((c) => `- ${prefix}${c}`).join("\n");
                    reply(`*--- LIST CASE ---*\n\n${formattedList}\n\n*Total: ${total} Case*`);
                } catch (e) {
                    reply(e.message);
                }
                break;

            case "rvo":
            case "readviewonce": {
                if (!m.quoted) return conn.sendMessage(m.chat, {
                    text: "Reply pesan viewOnce nya!"
                }, {
                    quoted: m
                });
                let msg = m.quoted.message || m.quoted.fakeObj.message;
                let type = Object.keys(msg)[0];
                if (!msg[type].viewOnce && m.quoted.mtype !== "viewOnceMessageV2")
                    return conn.sendMessage(m.chat, {
                        text: "Pesan itu bukan viewonce!"
                    }, {
                        quoted: m
                    });

                let media = await downloadContentFromMessage(msg[type], type == "imageMessage" ? "image" : type == "videoMessage" ? "video" : "audio");
                let buffer = Buffer.from([]);
                for await (let chunk of media) {
                    buffer = Buffer.concat([buffer, chunk]);
                }
                if (/video/.test(type)) {
                    return conn.sendMessage(m.chat, {
                        video: buffer,
                        caption: msg[type].caption || ""
                    }, {
                        quoted: m
                    });
                } else if (/image/.test(type)) {
                    return conn.sendMessage(m.chat, {
                        image: buffer,
                        caption: msg[type].caption || ""
                    }, {
                        quoted: m
                    });
                } else if (/audio/.test(type)) {
                    return conn.sendMessage(m.chat, {
                        audio: buffer,
                        mimetype: "audio/mpeg",
                        ptt: true
                    }, {
                        quoted: m
                    });
                }
            }
            break;

            case "tourl": {
                if (!/image|video|audio|application/.test(mime)) return m.reply("Kirim atau reply mediamu dulu");

                async function uploadToCatbox(buffer) {
                    try {
                        const typeInfo = await fileType.fromBuffer(buffer);
                        const ext = typeInfo?.ext || "bin";
                        const mimeType = typeInfo?.mime || "application/octet-stream";
                        const blob = new Blob([buffer], {
                            type: mimeType
                        });
                        const form = new FormData();
                        form.append("reqtype", "fileupload");
                        form.append("fileToUpload", blob, "file." + ext);
                        const res = await fetch("https://catbox.moe/user/api.php", {
                            method: "POST",
                            body: form,
                        });
                        return await res.text();
                    } catch {
                        return null;
                    }
                }

                try {
                    const mediaPath = await conn.downloadAndSaveMediaMessage(qmsg);
                    const buffer = fs.readFileSync(mediaPath);
                    const url = await uploadToCatbox(buffer);
                    fs.unlinkSync(mediaPath);

                    if (!url || !url.startsWith("https://")) throw new Error("Gagal upload ke Catbox");

                    let thumbnailURL = /image/.test(mime) ? url : "https://i.ibb.co/7N0M0V9/noimage.jpg";

                    await conn.sendMessage(
                        m.chat, {
                            productMessage: {
                                title: "URL Converter",
                                description: "Berhasil upload media",
                                thumbnail: {
                                    url: thumbnailURL
                                },
                                productId: "URL001",
                                retailerId: "FauziBot",
                                body: `- URL : ${url}\n- 🕒 Exp : Permanent`,
                                footer: "Permanent URL",
                                priceAmount1000: 0,
                                currencyCode: "IDR",
                                buttons: [{
                                    name: "cta_copy",
                                    buttonParamsJson: JSON.stringify({
                                        display_text: "copy URL",
                                        id: "123456789",
                                        copy_code: url,
                                    }),
                                }, ],
                            },
                        }, {
                            quoted: null
                        }
                    );
                } catch {
                    m.reply("Terjadi kesalahan waktu upload.");
                }
            }
            break;

            case "menu": {
                let pathSmall = "./settings/image/image.jpg";
                let bufferSmallRaw = fs.readFileSync(pathSmall);
                
                let bufferSmall = await sharp(bufferSmallRaw)
                    .resize(400, 400, {
                        fit: "cover",
                        position: 'center'
                    })
                    .jpeg({
                        quality: 80
                    }) 
                    .toBuffer();

                let pathLarge = "./settings/image/thumbnail.jpg";
                let bufferLargeRaw = fs.readFileSync(pathLarge);

                let bufferLarge = await sharp(bufferLargeRaw)
                    .resize(600) 
                    .jpeg({
                        quality: 80
                    })
                    .toBuffer();

                let intro = `Hi ${pushName} 🪸, aku, Yunxi Assistant yang siap bantu kamu buat apa aja lewat chat ini.`;

                let buttons = [{
                        buttonId: `${prefix}owner`,
                        buttonText: {
                            displayText: "Owner"
                        }
                    },
                    {
                        buttonId: ".ping",
                        buttonText: {
                            displayText: "Ping"
                        }
                    },
                ];

                let flowActions = [{
                    buttonId: "action",
                    buttonText: {
                        displayText: "Aksi dengan flow"
                    },
                    type: 4,
                    nativeFlowInfo: {
                        name: "single_select",
                        paramsJson: JSON.stringify({
                            title: "Hii",
                            sections: [{
                                title: "Yunxi Assistant",
                                highlight_label: "label",
                                rows: [{
                                        header: "header",
                                        title: "piw",
                                        description: "hahh",
                                        id: ".play"
                                    },
                                    {
                                        header: "header",
                                        title: "title",
                                        description: "",
                                        id: ".play"
                                    },
                                ],
                            }, ],
                        }),
                    },
                    viewOnce: true,
                }, ];

                buttons.push(...flowActions);

                const buttonMessage = {
                    document: bufferSmallRaw,
                    mimetype: "image/png",
                    fileName: "Yunxi Assistant ",
                    fileLength: bufferSmallRaw.length,
                    pageCount: 1,
                    jpegThumbnail: bufferSmall,

                    caption: intro,
                    footer: "© Yunxi Assistant\n",
                    mentions: [m.sender],
                    buttons,
                    headerType: 6,
                    contextInfo: {
                        forwardingScore: 999,
                        isForwarded: true,
                        forwardedNewsletterMessageInfo: {
                            newsletterJid: `120363293494889157@newsletter`,
                            newsletterName: `Shiina Shiyori`,
                            serverMessageId: -1
                        },
                        externalAdReply: {
                            showAdAttribution: true,
                            title: "Whatsapp - Bot",
                            body: `Hi ${pushName}`,
                            mediaType: 1,
                            renderLargerThumbnail: true, 
                            thumbnail: bufferLarge,
                            sourceUrl: "https://whatsapp.com/channel/0029VadHRVCEQIagiLHVJV0d",
                        },
                    },
                    viewOnce: true,
                };

                await conn.sendMessage(m.chat, buttonMessage, {
                    quoted: metaai
                });
            }
            break;

                    case "rt":
        case "ping": {
            const start = performance.now();
            
            const formatTime = (seconds) => {
                seconds = Number(seconds);
                const d = Math.floor(seconds / (3600 * 24));
                const h = Math.floor((seconds % (3600 * 24)) / 3600);
                const m = Math.floor((seconds % 3600) / 60);
                const s = Math.floor(seconds % 60);
                return `${d > 0 ? d + 'd ' : ''}${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm ' : ''}${s}s`;
            };

            const formatSize = (bytes) => {
                if (bytes === 0) return '0 B';
                const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                const i = Math.floor(Math.log(bytes) / Math.log(1024));
                return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
            };
            
            const cpus = os.cpus();
            const cpuModel = cpus[0] ? cpus[0].model.trim() : 'Unknown Architecture';
            const cpuSpeed = cpus[0] ? cpus[0].speed : 0;
            const coreCount = cpus.length;
            const loadAvg = os.loadavg(); 

            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            const memUsage = ((usedMem / totalMem) * 100).toFixed(1);
            
            const heapStat = v8.getHeapStatistics();
            const heapUsed = formatSize(process.memoryUsage().heapUsed);
            const heapTotal = formatSize(heapStat.total_heap_size);

            let diskTotal = 'Restricted';
            let diskUsed = 'Restricted';
            let diskPersen = '0%';
            
            try {
                if (process.platform === 'linux' || process.platform === 'darwin') {
                    const diskInfo = execSync('df -h /').toString().split('\n')[1].split(/\s+/);
                    diskTotal = diskInfo[1];
                    diskUsed = diskInfo[2];
                    diskPersen = diskInfo[4];
                } 
                else if (process.platform === 'win32') {
                    diskTotal = 'Windows env detected'; 
                    diskUsed = 'N/A';
                }
            } catch (e) {
                diskTotal = 'Access Denied';
            }

            const end = performance.now();
            const latency = (end - start).toFixed(3);

            const timestamp = new Date().toLocaleString("id-ID", {
                timeZone: "Asia/Jakarta",
                hour12: false,
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });

            let statusInfo = `
≡ NETWORK & HARDWARE MONITOR
Datasets: Valid | Kernel: ${os.type()} ${os.release()}
─────────────────────────────
[ HOST INFORMATION ]
> Hostname : ${os.hostname()}
> Platform : ${process.platform} (${os.arch()})
> Uptime   : ${formatTime(os.uptime())}
> Date     : ${timestamp}

[ CPU ALLOCATION ]
> Model    : ${cpuModel}
> Cores    : ${coreCount} Core(s) @ ${cpuSpeed} MHz
> Load Avg : ${loadAvg[0].toFixed(2)}% (1m)

[ MEMORY MANAGEMENT ]
> RAM Total: ${formatSize(totalMem)}
> RAM Used : ${formatSize(usedMem)} (${memUsage}%)
> RAM Free : ${formatSize(freeMem)}
> V8 Heap  : ${heapUsed} / ${heapTotal}

[ STORAGE VOLUME ]
> Capacity : ${diskTotal}
> Used     : ${diskUsed} (${diskPersen})

[ PROCESS METRICS ]
> PID      : ${process.pid}
> Node.js  : ${process.version}
> Latency  : ${latency} ms
> Runtime  : ${formatTime(process.uptime())}
─────────────────────────────
_root@system:~#_ status_verified`;

            reply(statusInfo);
        }
            break;

            default:
                break;
        }
    } catch (err) {
        conn.sendMessage(m.chat, {
            text: util.format(err)
        }, {
            quoted: m
        });
    }
};