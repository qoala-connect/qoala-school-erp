import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY?.trim();
const genAI = new GoogleGenAI({ apiKey });

const pager = await genAI.models.list();
for await (const m of pager) {
  if (m.supportedActions?.includes('generateContent') && /flash|pro/i.test(m.name || '')) {
    console.log(m.name);
  }
}
