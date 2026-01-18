import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { watchFile, unwatchFile, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const apiKeys = {
    openai: process.env.OPENAI_API_KEY || "sk-IsiKeyLuDisini",
    removebg: process.env.REMOVEBG_API_KEY || "IsiKeyLuDisini",
};

const globalConfig = {
    owner: [
        ["6283879152564", "liwirya", true],
        ["6287840530026", "wildan", true] 
    ],

    botName: "Yunxi - Assistant",
    botFooter: "© 2026 Yunxi",
    version: "1.0.0 Beta",
    
    sessionName: "yunxi-session", 
    
    sticker: {
        packname: "Stiker by",
        author: "Yunxi"
    },
    
    prefix: [".", "/", "#", "!"], 
    publicMode: true, 
    
    api: apiKeys,

    limit: {
        enable: true,
        free: 20, 
        premium: 9999, 
        resetIntervalMs: 24 * 60 * 60 * 1000, 
        message: "[ ! ] Limit harian habis. Limit lu: %limit% hit. Riset dalam %remainingTime%."
    },

    mess: {
        success: "[ OK ] Done, berhasil ya senpai.",
        admin: "[ ! ] Fitur ini khusus Admin Grup, minggir dulu.",
        botAdmin: "[ ! ] Jadiin bot Admin dulu baru bisa jalan.",
        owner: "[ ! ] Access Denied. Lu bukan Owner gue.",
        group: "[ ! ] Fitur ini cuma jalan di dalam Grup.",
        private: "[ ! ] Pake fitur ini di Private Chat (PC) aja.",
        premium: "[ $ ] Khusus user Premium. Upgrade dulu bro.",
        wait: "[ ... ] Sabar, lagi dimasak...",
        error: "[ X ] Ada error sistem. Coba lagi nanti.",
        endLimit: "[ ! ] Limit harian lu abis. Balik lagi besok atau beli premium."
    }
};

global.conf = globalConfig;

let file = __filename;
watchFile(file, () => {
    unwatchFile(file);
    console.log(`\n\n >> [ UPDATE ] File config.js berubah. Silakan restart bot jika perubahan tidak ngefek (ESM limitation).\n`);
});

export default globalConfig;