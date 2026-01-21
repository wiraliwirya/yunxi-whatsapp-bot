import fs from 'fs';
import { tmpdir } from 'os';
import Crypto from 'crypto';
import ff from 'fluent-ffmpeg';
import webp from 'node-webpmux';
import path from 'path';

import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
ff.setFfmpegPath(ffmpegInstaller.path);

const getRandomFile = (ext) => {
    return path.join(tmpdir(), `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.${ext}`);
};

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
        if (fs.existsSync(tmpFileIn)) fs.unlinkSync(tmpFileIn);
        if (fs.existsSync(tmpFileOut)) fs.unlinkSync(tmpFileOut);
    }
}

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
                    "-vf", "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1",
                    "-loop", "0",
                    "-ss", "00:00:00",
                    "-t", "00:00:05", // Limit 5 detik biar ga berat
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
        if (fs.existsSync(tmpFileIn)) fs.unlinkSync(tmpFileIn);
        if (fs.existsSync(tmpFileOut)) fs.unlinkSync(tmpFileOut);
    }
}

async function generateExifBuffer(packname, author, categories = ['']) {
    const json = {
        "sticker-pack-id": "com.system.optimized",
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

export async function writeExifImg(media, metadata) {
    let wMedia = await imageToWebp(media);
    const tmpFileIn = getRandomFile('webp');
    const tmpFileOut = getRandomFile('webp');

    fs.writeFileSync(tmpFileIn, wMedia);

    try {
        const img = new webp.Image();
        const exif = await generateExifBuffer(metadata.packname || "", metadata.author || "", metadata.categories);
        
        await img.load(tmpFileIn);
        img.exif = exif;
        await img.save(tmpFileOut);

        return fs.readFileSync(tmpFileOut);
    } catch (e) {
        throw e;
    } finally {
        if (fs.existsSync(tmpFileIn)) fs.unlinkSync(tmpFileIn);
        if (fs.existsSync(tmpFileOut)) fs.unlinkSync(tmpFileOut);
    }
}

export async function writeExifVid(media, metadata) {
    let wMedia = await videoToWebp(media);
    const tmpFileIn = getRandomFile('webp');
    const tmpFileOut = getRandomFile('webp');

    fs.writeFileSync(tmpFileIn, wMedia);

    try {
        const img = new webp.Image();
        const exif = await generateExifBuffer(metadata.packname || "", metadata.author || "", metadata.categories);
        
        await img.load(tmpFileIn);
        img.exif = exif;
        await img.save(tmpFileOut);

        return fs.readFileSync(tmpFileOut);
    } catch (e) {
        throw e;
    } finally {
        if (fs.existsSync(tmpFileIn)) fs.unlinkSync(tmpFileIn);
        if (fs.existsSync(tmpFileOut)) fs.unlinkSync(tmpFileOut);
    }
}

export async function addExif(webpBuffer, packname, author, categories = ['']) {
    const img = new webp.Image();
    const exif = await generateExifBuffer(packname, author, categories);
    
    await img.load(webpBuffer);
    img.exif = exif;
    
    return await img.save(null); 
}
