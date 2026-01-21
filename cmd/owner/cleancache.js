import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execPromise = promisify(exec);

class SystemCleaner {
    constructor() {
        this.targetFolders = [
            './tmp',
            './temp',
            './sessions/pre-key',
            './store',
            './.cache'
        ];

        this.junkExtensions = [
            '.log', '.tmp', '.bak', '.old', '.zip', '.rar', '.7z'
        ];
    }

    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async cleanDirectory(dirPath) {
        let deletedCount = 0;
        let freedSpace = 0;
        const absolutePath = path.resolve(dirPath);

        if (!fs.existsSync(absolutePath)) {
            return { count: 0, size: 0 };
        }

        try {
            const files = await fs.promises.readdir(absolutePath);
            for (const file of files) {
                const curPath = path.join(absolutePath, file);
                try {
                    const stat = await fs.promises.stat(curPath);
                    if (stat.isDirectory()) {
                        const subResult = await this.cleanDirectory(curPath);
                        deletedCount += subResult.count;
                        freedSpace += subResult.size;
                        try {
                            await fs.promises.rmdir(curPath);
                        } catch {}
                    } else {
                        freedSpace += stat.size;
                        await fs.promises.unlink(curPath);
                        deletedCount++;
                    }
                } catch (err) {
                }
            }
        } catch (e) {
            console.log(`[Cleaner] Skip ${dirPath}`);
        }
        
        return { count: deletedCount, size: freedSpace };
    }

    async cleanLogs() {
        let count = 0;
        let size = 0;
        const rootDir = process.cwd();
        
        try {
            const files = await fs.promises.readdir(rootDir);
            for (const file of files) {
                if (file.endsWith('.log') || file.includes('npm-debug') || file.includes('core.')) {
                    const curPath = path.join(rootDir, file);
                    const stat = await fs.promises.stat(curPath);
                    size += stat.size;
                    await fs.promises.unlink(curPath);
                    count++;
                }
            }
        } catch (e) {}
        
        return { count, size };
    }

    async runShellClean() {
        try {
            const command = 'npm cache clean --force && rm -rf ~/.cache && rm -rf ~/.npm/_cacache';
            await execPromise(command);
            return true;
        } catch (e) {
            console.error('[Shell Clean Error]', e.message);
            return false;
        }
    }

    runGarbageCollector() {
        try {
            if (global.gc) {
                global.gc();
                return true;
            }
        } catch (e) {}
        return false;
    }
}

let handler = async (m, { conn, reply }) => {
    const cleaner = new SystemCleaner();
    const memBefore = process.memoryUsage().rss;
    
    reply('[SYSTEM DEEP CLEAN STARTED]\n\nMenghapus cache NPM, Playwright, Temp Files, dan Logs...');

    try {
        let totalFiles = 0;
        let totalSize = 0;

        for (const folder of cleaner.targetFolders) {
            const res = await cleaner.cleanDirectory(folder);
            totalFiles += res.count;
            totalSize += res.size;
        }

        const logClean = await cleaner.cleanLogs();
        totalFiles += logClean.count;
        totalSize += logClean.size;

        const shellStatus = await cleaner.runShellClean();

        const gcStatus = cleaner.runGarbageCollector();
        const memAfter = process.memoryUsage().rss;
        const memFreed = memBefore - memAfter;
        
        const caption = `[SERVER OPTIMIZATION REPORT]\n` +
                       `──────────────────\n` +
                       `Files Deleted: ${totalFiles} Files\n` +
                       `Disk Freed: ${cleaner.formatSize(totalSize)}\n` +
                       `NPM/OS Cache: ${shellStatus ? 'Cleaned' : 'Failed'}\n` +
                       `RAM Usage: ${cleaner.formatSize(memAfter)}\n` +
                       `RAM Freed: ${memFreed > 0 ? cleaner.formatSize(memFreed) : 'Optimized'}\n` +
                       `GC Status: ${gcStatus ? 'Forced' : 'Auto'}\n` +
                       `──────────────────\n` +
                       `Bot sekarang berjalan lebih cepat & ringan!`;

        await conn.sendMessage(m.chat, { 
            text: caption,
            contextInfo: {
                externalAdReply: {
                    title: "System Optimized",
                    body: "Pterodactyl Performance Booster",
                    thumbnailUrl: "https://img.icons8.com/3d-fluency/94/rocket.png",
                    sourceUrl: "https://github.com/Liwirya",
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            } 
        }, { quoted: m });

    } catch (e) {
        console.error('[Cleanup Error]', e);
        reply(`[System Error]:\n${e.message}`);
    }
};

handler.help = ['clearcache', 'cs'];
handler.tags = ['owner'];
handler.command = /^(clearcache|cleartmp|cleaner|cs)$/i;
handler.owner = true;

export default handler;