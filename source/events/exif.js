import fs from 'fs';
import { tmpdir } from 'os';
import Crypto from 'crypto';
import ff from 'fluent-ffmpeg';
import path from 'path';
import { createRequire } from 'module'; 
const require = createRequire(import.meta.url);
const webp = require('node-webpmux');

import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
ff.setFfmpegPath(ffmpegInstaller.path);

const getRandomFile = (ext) => {
    return path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.${ext}`);
};

export async function videoToWebp(media) {
    const tmpFileIn = getRandomFile('mp4');
    const tmpFileOut = getRandomFile('webp');

    fs.writeFileSync(tmpFileIn, media);

    try {
        await new Promise((resolve, reject) => {
            ff(tmpFileIn)
                .on("error", reject)
                .on("end", () => resolve(true))
                .addOutputOptions([
                    "-vcodec", "libwebp",
                    "-vf", "scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:-1:-1:color=white@0.0,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=ffffff[p];[b][p]paletteuse",
                    "-loop", "0",
                    "-ss", "00:00:00",
                    "-t", "00:00:05",
                    "-preset", "default",
                    "-an",
                    "-vsync", "0"
                ])
                .toFormat("webp")
                .save(tmpFileOut);
        });

        const buff = fs.readFileSync(tmpFileOut);
        return buff;
    } catch (e) {
        throw e;
    } finally {
        try {
            if (fs.existsSync(tmpFileIn)) fs.unlinkSync(tmpFileIn);
            if (fs.existsSync(tmpFileOut)) fs.unlinkSync(tmpFileOut);
        } catch (e) {}
    }
}

export async function imageToWebp(media) {
    const tmpFileIn = getRandomFile('jpg');
    const tmpFileOut = getRandomFile('webp');

    fs.writeFileSync(tmpFileIn, media);

    try {
        await new Promise((resolve, reject) => {
            ff(tmpFileIn)
                .on("error", reject)
                .on("end", () => resolve(true))
                .addOutputOptions([
                    "-vcodec", "libwebp",
                    "-vf", "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1",
                    "-loop", "0",
                    "-preset", "default",
                    "-an",
                    "-vsync", "0"
                ])
                .toFormat("webp")
                .save(tmpFileOut);
        });

        const buff = fs.readFileSync(tmpFileOut);
        return buff;
    } catch (e) {
        throw e;
    } finally {
        try {
            if (fs.existsSync(tmpFileIn)) fs.unlinkSync(tmpFileIn);
            if (fs.existsSync(tmpFileOut)) fs.unlinkSync(tmpFileOut);
        } catch (e) {}
    }
}

async function generateExifBuffer(packname, author, categories = ['']) {
    const json = {
        "sticker-pack-id": "com.hry.sticker",
        "sticker-pack-name": packname,
        "sticker-pack-publisher": author,
        "emojis": categories,
        "android-app-store-link": "https://play.google.com/store/apps/details?id=com.whatsapp",
        "ios-app-store-link": "https://itunes.apple.com/app/whatsapp-messenger/id310633997"
    };

    const exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
    const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8");
    const exif = Buffer.concat([exifAttr, jsonBuff]);
    
    exif.writeUIntLE(jsonBuff.length, 14, 4);
    
    return exif;
}

export async function writeExif(media, metadata) {
    const tmpFileIn = getRandomFile('webp');
    const tmpFileOut = getRandomFile('webp');

    fs.writeFileSync(tmpFileIn, media);

    try {
        const img = new webp.Image();
        const exif = await generateExifBuffer(metadata.packname || "Sticker Bot", metadata.author || "Created By Bot", metadata.categories);
        
        await img.load(tmpFileIn);
        img.exif = exif;
        await img.save(tmpFileOut);

        return fs.readFileSync(tmpFileOut);
    } catch (e) {
        throw e;
    } finally {
        try {
            if (fs.existsSync(tmpFileIn)) fs.unlinkSync(tmpFileIn);
            if (fs.existsSync(tmpFileOut)) fs.unlinkSync(tmpFileOut);
        } catch (e) {}
    }
}

export async function writeExifImg(media, metadata) {
    return await writeExif(media, metadata);
}

export async function writeExifVid(media, metadata) {
    return await writeExif(media, metadata);
}