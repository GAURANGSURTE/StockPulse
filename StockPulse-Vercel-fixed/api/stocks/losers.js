// api/stocks/losers.js — GET /api/stocks/losers
import { handleCors, requireAuth } from '../_auth.js';
import { getDb } from '../_db.js';
import { autoInit, formatStock } from '../_stocks.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    await autoInit();
    const user = await requireAuth(req, res);
    if (!user) return;

    const sql = getDb();
    const stocks = await sql`
      SELECT * FROM stocks ORDER BY change_percent ASC LIMIT 5
    `;

    return res.status(200).json({ success: true, data: stocks.map(formatStock) });
  } catch (err) {
    console.error('[stocks/losers]', err);
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}
