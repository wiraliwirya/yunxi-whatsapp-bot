import crypto from 'crypto';
import axios from 'axios';
import FormData from 'form-data';

function getApiKey() {
  const prefix = 'tryit';
  const id = Math.floor(1e10 + Math.random() * 9e10).toString();
  const hash = crypto.randomBytes(16).toString('hex');
  return `${prefix}-${id}-${hash}`;
}

export async function DeepAI(input) {
  const form = new FormData();
  form.append('chat_style', 'chat');
  form.append('chatHistory', JSON.stringify([{ role: 'user', content: `${input}` }]));
  form.append('model', 'standard');
  form.append('hacker_is_stinky', 'very_stinky');

  const headers = {
    ...form.getHeaders(),
    'api-key': getApiKey(),
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
    'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
    'sec-ch-ua-platform': '"Android"',
    'Accept': '*/*',
    'Origin': 'https://deepai.org'
  };

  try {
    const response = await axios.post('https://api.deepai.org/hacking_is_a_serious_crime', form, { headers });
    return response.data;
  } catch (error) {
    console.error("[DEEPAI API ERROR]", error.response ? error.response.data : error.message);
    throw new Error(`Gagal terhubung ke DeepAI API: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
  }
}
