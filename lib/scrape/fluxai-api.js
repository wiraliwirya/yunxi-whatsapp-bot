import axios from 'axios';
import https from 'https';

function generateSessionHash(length = 11) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let hash = '';
    for (let i = 0; i < length; i++) {
        hash += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return hash;
}

export async function fluxAI(prompt) {
    const session_hash = generateSessionHash();

    const headers = {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36",
        "Accept": "/",
        "Content-Type": "application/json"
    };

    const payload = {
        "data": [
            prompt,
            0,
            true,
            1024,
            1024,
            4
        ],
        "event_data": null,
        "fn_index": 2,
        "trigger_id": 5,
        "session_hash": session_hash
    };

    const requestUrl = `https://black-forest-labs-flux-1-schnell.hf.space/queue/join?__theme=system`;
    const streamUrl = `https://black-forest-labs-flux-1-schnell.hf.space/queue/data?session_hash=${session_hash}`;

    await axios.post(requestUrl, payload, { headers });

    return new Promise((resolve, reject) => {
        const req = https.get(streamUrl, { headers }, (res) => {
            let buffer = '';

            res.on('data', (chunk) => {
                buffer += chunk.toString();

                const parts = buffer.split('\n\n');
                buffer = parts.pop();
                for (const part of parts) {
                    if (part.startsWith('data:')) {
                        const json = part.replace('data: ', '').trim();
                        try {
                            const parsed = JSON.parse(json);
                            if (parsed.msg === 'process_completed') {
                                const url = parsed.output.data[0]?.url;
                                if (url) {
                                    resolve(url);
                                    req.destroy();
                                    return;
                                }
                            } else if (parsed.msg === 'queue_full') {
                                reject(new Error('Antrian penuh, coba lagi nanti.'));
                                req.destroy();
                                return;
                            } else if (parsed.msg === 'estimation' && parsed.data.rank) {

                            }
                        } catch (e) {

                        }
                    }
                }
            });

            res.on('error', reject);
            res.on('end', () => reject('Stream berakhir tanpa hasil. Mungkin ada masalah dengan API atau prompt.'));
        });
        req.on('timeout', () => {
            req.destroy(new Error('Permintaan ke API FluxAI timeout.'));
        });
    });
}
