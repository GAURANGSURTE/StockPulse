// api/stocks/index.js — GET /api/stocks
import { handleCors, requireAuth } from '../_auth.js';
import { getDb } from '../_db.js';
import { autoInit, refreshStockPrices, formatStock } from '../_stocks.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    await autoInit();
    const user = await requireAuth(req, res);
    if (!user) return;

    // Refresh prices on every request (simulates @Scheduled)
    await refreshStockPrices();

    const sql = getDb();
    const stocks = await sql`SELECT * FROM stocks ORDER BY symbol ASC`;

    return res.status(200).json({
      success: true,
      count: stocks.length,
      data: stocks.map(formatStock)
    });
  } catch (err) {
    console.error('[stocks/index]', err);
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}
