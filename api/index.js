import app from '../server/app.js';
import { initDb } from '../server/db.js';

let isInitialized = false;

export default async function handler(req, res) {
  if (!isInitialized) {
    try {
      await initDb();
      isInitialized = true;
    } catch (e) {
      console.error('Vercel initDb error:', e);
    }
  }
  return app(req, res);
}
