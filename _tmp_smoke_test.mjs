import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY?.trim();
const genAI = new GoogleGenAI({ apiKey });

for (const model of ['gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-lite-latest']) {
  try {
    const res = await genAI.models.generateContent({ model, contents: [{ role: 'user', parts: [{ text: 'Say OK' }] }] });
    console.log(model, '->', JSON.stringify(res.text).slice(0, 60));
  } catch (e) {
    console.log(model, '-> ERROR', e?.message?.slice(0, 120));
  }
}
