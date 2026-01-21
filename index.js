import "./settings/config.js";
import {
  makeWASocket,
  useMultiFileAuthState,
  jidDecode,
  DisconnectReason,
  downloadContentFromMessage,
  makeCacheableSignalKeyStore
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import readline from "readline";
import pino from "pino";
import chalk from "chalk";
import fs from "fs-extra";
import NodeCache from "node-cache";
import axios from "axios";
import * as jimp from "jimp";
import { spawn } from "child_process";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import cfonts from "cfonts";

import pkg from "file-type";
const fileType = {
    fromBuffer: pkg.fileTypeFromBuffer || pkg.fromBuffer || (typeof pkg === 'function' ? pkg : null)
};

import { smsg } from "./source/myfunc.js";

global.mode = true;           
global.sessionName = "session"; 
const msgRetryCounterCache = new NodeCache();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const caserelog = path.resolve(__dirname, "./source/message.js");

const color = {
    primary: chalk.cyan.bold,
    secondary: chalk.gray,
    success: chalk.greenBright,
    error: chalk.redBright.bold,
    warn: chalk.yellowBright,
    info: chalk.blueBright
};

const timestamp = () => {
    const now = new Date();
    return `[${now.getHours().toString().padStart(2,0)}:${now.getMinutes().toString().padStart(2,0)}:${now.getSeconds().toString().padStart(2,0)}]`;
};

const log = {
    sys: (msg) => console.log(`${color.secondary(timestamp())} ${color.primary('SYSTEM')}   │ ${msg}`),
    info: (msg) => console.log(`${color.secondary(timestamp())} ${color.info('INFO')}     │ ${msg}`),
    success: (msg) => console.log(`${color.secondary(timestamp())} ${color.success('SUCCESS')}  │ ${msg}`),
    warn: (msg) => console.log(`${color.secondary(timestamp())} ${color.warn('WARNING')}  │ ${msg}`),
    error: (msg) => console.log(`${color.secondary(timestamp())} ${color.error('ERROR')}    │ ${msg}`),
    box: (title, details) => {
        console.log(color.secondary(`┌── [ ${title} ] ──────────────────────────────`));
        details.forEach(d => console.log(color.secondary(`│`) + `  ${d}`));
        console.log(color.secondary(`└──────────────────────────────────────────────────`));
    }
};

const SecurityGuard = {
    validatePayload: (m) => {
        const payloadSize = JSON.stringify(m).length;
        if (payloadSize > 50000 && !m.message.imageMessage && !m.message.videoMessage) {
            log.warn(`Dropped oversize payload: ${payloadSize} bytes`);
            return false;
        }
        return true;
    },
    
    spamMap: new Map(),
    isSpam: (sender) => {
        const now = Date.now();
        const lastMsg = SecurityGuard.spamMap.get(sender);
        if (lastMsg && now - lastMsg < 1000) { 
            return true;
        }
        SecurityGuard.spamMap.set(sender, now);
        return false;
    }
};

let rl = null;
const getRl = () => {
  if (!rl || rl.closed) {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  }
  return rl;
};
const question = (text) => new Promise((resolve) => getRl().question(text, resolve));

const getBuffer = async (url, options = {}) => {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("Invalid Protocol");
    
    const res = await axios({
      method: "get",
      url,
      headers: { DNT: 1, "Upgrade-Insecure-Request": 1 },
      responseType: "arraybuffer",
      timeout: 10000, 
      ...options
    });
    return res.data;
  } catch (e) {
    log.warn(`Download blocked/failed: ${e.message}`);
    return Buffer.alloc(0);
  }
};

let handleMessage; 
async function relogfile() {
  try {
    const cacheBust = Date.now();
    const modulePath = pathToFileURL(caserelog).href;
    const module = await import(`${modulePath}?v=${cacheBust}`);
    
    if (typeof module.default === "function") {
        handleMessage = module.default;
        log.success("Handler 'message.js' loaded successfully.");
    }
  } catch (err) {
    log.error(`Failed to load message handler: ${err.message}`);
  }
}

async function startServer() {
    console.clear();
    cfonts.say('SHIINA HIYORI', {
        font: 'tiny', align: 'left', colors: ['cyan'], background: 'transparent',
        letterSpacing: 1, lineHeight: 1, space: false
    });
    console.log(chalk.cyan("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
    log.sys("Initializing secure environment...");
    log.sys(`NodeJS: ${process.version} | Platform: ${process.platform}`);

    process.on("unhandledRejection", (err) => log.error(`Unhandled Rejection: ${err}`));
    process.on("uncaughtException", (err) => log.error(`Uncaught Exception: ${err}`));

    await relogfile();
    fs.watchFile(caserelog, () => {
        log.info("Detected change in message.js. Reloading...");
        relogfile();
    });

    const { state, saveCreds } = await useMultiFileAuthState(`./${sessionName}`);
    
    const conn = makeWASocket({
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["Mac OS", "Chrome", "121.0.0"], 
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        msgRetryCounterCache,
        connectTimeoutMs: 60000,
        emitOwnEvents: true,
        fireInitQueries: true,
        generateHighQualityLinkPreview: true,
        syncFullHistory: true,
        markOnlineOnConnect: true
    });

    global.conn = conn;

    if (!conn.authState.creds.registered) {
        console.log("");
        log.box("AUTHENTICATION REQUIRED", [
            "Session not found.",
            "Please provide WhatsApp Number to generate Pairing Code."
        ]);
        
        const phoneNumber = await question(color.primary("   ➤  Enter Number: "));
        const cleanNumber = phoneNumber.replace(/[^0-9]/g, "");
        
        setTimeout(async () => {
            let code = await conn.requestPairingCode(cleanNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            log.box("PAIRING CODE GENERATED", [
                `User: ${cleanNumber}`,
                `Code: ${chalk.bold.greenBright(code)}`,
                "Action: Enter this code on your device."
            ]);
        }, 3000);
    }

    conn.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === "close") {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            const reasonDesc = DisconnectReason[reason] || "Unknown";
            
            log.error(`Connection Lost: ${reasonDesc} (${reason})`);

            if (reason === DisconnectReason.loggedOut || reason === DisconnectReason.badSession) {
                log.error("CRITICAL: Session file is corrupt. Please delete 'session' folder.");
                process.exit(1);
            } else {
                log.info("Attempting automatic reconnection...");
                startServer();
            }
        } else if (connection === "open") {
            console.log("");
            log.box("SYSTEM ONLINE", [
                `User ID: ${conn.user.id.split(':')[0]}`,
                `Mode: ${global.mode ? 'Public' : 'Self'}`,
                `Security: Active`
            ]);
        }
    });

    conn.ev.on("creds.update", saveCreds);

    conn.ev.on("messages.upsert", async (chatUpdate) => {
        try {
            let m = chatUpdate.messages[0];
            if (!m?.message) return;

            m.message = Object.keys(m.message)[0] === "ephemeralMessage" 
                ? m.message.ephemeralMessage.message 
                : m.message;

            if (m.key.remoteJid === "status@broadcast") return;
            if (!conn.public && !m.key.fromMe && chatUpdate.type === "notify") return;
            
            if (!SecurityGuard.validatePayload(m)) return;

            m = smsg(conn, m); 
            if (handleMessage) await handleMessage(conn, m, chatUpdate);

        } catch (err) {
            if (!err.message?.includes("Bad MAC")) {
                log.error(`Stream Error: ${err.message}`);
            }
        }
    });

    conn.decodeJid = (jid) => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            const decode = jidDecode(jid) || {};
            return (decode.user && decode.server && decode.user + "@" + decode.server) || jid;
        }
        return jid;
    };
    
    conn.public = global.mode;
    conn.serializeM = (m) => smsg(conn, m);

    conn.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
        try {
            const quoted = message.msg ? message.msg : message;
            const mime = (message.msg || message).mimetype || "";
            const messageType = message.mtype ? message.mtype.replace(/Message/gi, "") : mime.split("/")[0];
            
            const stream = await downloadContentFromMessage(quoted, messageType);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

            const type = await fileType.fromBuffer(buffer);
            const ext = type?.ext || "bin";
            
            const safeName = filename ? path.basename(filename) : `file_${Date.now()}`;
            const finalName = attachExtension ? `${safeName}.${ext}` : safeName;

            await fs.writeFile(finalName, buffer);
            return finalName;
        } catch (err) {
            log.error(`File Write Error: ${err.message}`);
            return null;
        }
    };

    conn.sendText = (jid, teks, quoted = "", options = {}) => 
        conn.sendMessage(jid, { text: teks, ...options }, { quoted, ...options });

    conn.sendImage = async (jid, path, caption = "", quoted = "", options = {}) => {
        const buffer = Buffer.isBuffer(path) ? path : /^https?:\/\//.test(path) ? await getBuffer(path) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0);
        return await conn.sendMessage(jid, { image: buffer, caption, ...options }, { quoted });
    };

    const resize = async (imagePathOrUrl, width, height) => {
        const buffer = await getBuffer(imagePathOrUrl); 
        const read = await jimp.read(buffer); 
        return await read.resize(width, height).getBufferAsync(jimp.MIME_JPEG);
    };

    conn.sendButtonRelay = async (jid, text, buttons, quoted) => {
        const thumbnail = await resize("https://files.catbox.moe/prewfa.jpg", 300, 300); 
        const message = {
            viewOnceMessage: {
                message: {
                    interactiveMessage: {
                        header: {
                            locationMessage: { degreesLatitude: 0, degreesLongitude: 0, name: global.namebotz, address: global.nameown, jpegThumbnail: thumbnail },
                            hasMediaAttachment: true
                        },
                        body: { text },
                        nativeFlowMessage: {
                            buttons,
                            messageParamsJson: JSON.stringify({ limited_time_offer: { expiration_time: Date.now() + 300000 } })
                        }
                    }
                }
            }
        };
        return await conn.relayMessage(jid, message, { quoted });
    };

    setInterval(() => {
        const used = process.memoryUsage().heapUsed / 1024 / 1024;
        if (used > 200) {
            log.warn(`High Memory Usage: ${Math.round(used * 100) / 100} MB`);
        }
    }, 60000); 

    return conn;
}

fs.watchFile(__filename, () => {
  console.log(chalk.redBright(`\n[SYSTEM UPDATE] Core file changed. Restarting process...\n`));
  fs.unwatchFile(__filename);
  spawn(process.argv[0], [__filename], { stdio: "inherit" }).on('exit', () => process.exit());
});

startServer();