import "./settings/config.js";
import { qtext, metaai, qloc, qvideo, qpay, qpoll } from "./source/qouted.js"; 
import fs from "fs";
import path from "path";
import chalk from "chalk";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pluginCache = new Map(); 
const aliasMap = new Map();    
const regexPlugins = []; 

const fakeQuotes = [qtext, metaai, qloc, qvideo, qpay, qpoll];
const getRandomQuote = () => fakeQuotes[Math.floor(Math.random() * fakeQuotes.length)];

const log = {
    cmd: (cmd, user, group) => console.log(`${chalk.bgHex('#FF4500').bold(' EXEC ')} ${chalk.greenBright(cmd)} by ${chalk.yellow(user)} ${chalk.gray(group ? '[GRP]' : '[PRV]')}`),
    error: (msg) => console.log(`${chalk.red.bold('[CRIT]')} ${msg}`),
    warn: (msg) => console.log(`${chalk.yellow.bold('[WARN]')} ${msg}`),
    sys: (msg) => console.log(`${chalk.cyanBright('[SYSTEM]')} ${msg}`)
};

const cacheBustImport = async (absPath) => {
    try {
        if (!absPath.startsWith(__dirname) && process.platform !== 'win32') {
             throw new Error("Access Denied: Path Traversal Attempt Detected");
        }
        
        const url = `${pathToFileURL(absPath).href}?v=${Date.now()}`;
        return await import(url);
    } catch (e) {
        log.error(`Failed to import: ${path.basename(absPath)} -> ${e.message}`);
        return null;
    }
};

const scanPlugins = (dir) => {
    let files = [];
    try {
        if (!fs.existsSync(dir)) return [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files = [...files, ...scanPlugins(fullPath)];
            } else if (entry.isFile() && entry.name.endsWith(".js")) {
                files.push(fullPath);
            }
        }
    } catch (e) {
        log.error(`Directory Scan Error: ${e.message}`);
    }
    return files;
};

export const pluginsLoader = async (directory) => {
    const targetDir = directory || path.resolve(__dirname, "./cmd");
    
    if (!fs.existsSync(targetDir)) {
        log.sys(`Creating plugin directory at '${path.basename(targetDir)}'`);
        fs.mkdirSync(targetDir, { recursive: true });
    }

    const files = scanPlugins(targetDir);
    
    pluginCache.clear();
    aliasMap.clear();
    regexPlugins.length = 0;

    let successCount = 0;
    let failCount = 0;

    for (const file of files) {
        const module = await cacheBustImport(file);
        
        if (module && module.default) {
            const plugin = module.default;
            plugin.filename = path.basename(file);
            plugin.path = file;

            pluginCache.set(plugin.filename, plugin);

            if (plugin.command) {
                const commands = Array.isArray(plugin.command) ? plugin.command : [plugin.command];

                commands.forEach(cmd => {
                    if (typeof cmd === 'string') {
                        aliasMap.set(cmd.toLowerCase(), plugin);
                    } else if (cmd instanceof RegExp) {
                        regexPlugins.push({ reg: cmd, plugin });
                    } else {
                        log.warn(`Invalid command type in ${plugin.filename}: ${typeof cmd} (Skipped)`);
                    }
                });
                successCount++;
            }
        } else {
            failCount++;
        }
    }
    
    if (global.isReloading) {
        log.sys(`Reload Complete. Loaded: ${successCount} | Failed: ${failCount}`);
        global.isReloading = false;
    }

    return Array.from(pluginCache.values());
};

global.isReloading = true;
pluginsLoader();

export const runPlugins = async (m, ctx) => {
    if (!ctx || typeof ctx !== 'object') return false;
    
    const cmdUser = (ctx.command && typeof ctx.command === 'string') ? ctx.command.toLowerCase() : "";
    if (!cmdUser) return false;

    let plugin = aliasMap.get(cmdUser);

    if (!plugin && regexPlugins.length > 0) {
        const found = regexPlugins.find(item => item.reg.test(cmdUser));
        if (found) plugin = found.plugin;
    }
    
    if (!plugin) return false; 

    const sender = ctx.sender || "";
    const senderNumber = sender.split("@")[0];
    
    if (plugin.owner) {
        if (!global.owner.includes(senderNumber)) {
            await m.reply(global.mess.owner);
            return true;
        }
    }

    if (plugin.group && !m.isGroup) {
        await m.reply(global.mess.group);
        return true;
    }

    if (plugin.admin && !ctx.isAdmin) {
        await m.reply(global.mess.admin);
        return true;
    }

    if (plugin.botAdmin && !ctx.isBotAdmin) {
        await m.reply(global.mess.botadmin);
        return true;
    }

    try {
        log.cmd(cmdUser, senderNumber, m.isGroup);
        await plugin(m, ctx, { quoted: getRandomQuote() });
        return true;
    } catch (error) {
        log.error(`Runtime Crash [${plugin.filename}]:`);
        console.error(error); 
        await m.reply(`${global.mess.error}\n\n> *Debug Info:* ${error.message}`);
        return true;
    }
};

const watchDebounce = new Map();
const cmdDir = path.resolve(__dirname, "./cmd");

const startWatcher = () => {
    if (!fs.existsSync(cmdDir)) return;

    log.sys(`Monitoring plugins in: ${cmdDir}`);

    fs.watch(cmdDir, { recursive: true }, (eventType, filename) => {
        if (!filename || !filename.endsWith('.js')) return;

        const lastTrigger = watchDebounce.get(filename);
        if (lastTrigger && (Date.now() - lastTrigger) < 2000) return;
        watchDebounce.set(filename, Date.now());

        log.sys(`Detected change in: ${filename}`);
        global.isReloading = true;
        
        try {
           const fullPath = path.join(cmdDir, filename);
           const resolved = import.meta.resolve(fullPath);
        } catch(e) {}

        pluginsLoader(cmdDir); 
    });
};

startWatcher();