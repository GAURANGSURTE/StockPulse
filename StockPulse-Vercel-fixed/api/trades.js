// api/trades.js — GET /api/trades
import { handleCors, requireAuth } from './_auth.js';
import { getDb } from './_db.js';
import { autoInit } from './_stocks.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    await autoInit();
    const user = await requireAuth(req, res);
    if (!user) return;

    const sql = getDb();
    const trades = await sql`
      SELECT * FROM trades WHERE user_id = ${user.id}
      ORDER BY executed_at DESC
    `;

    const data = trades.map(t => ({
      id:           t.id,
      symbol:       t.stock_symbol,
      type:         t.trade_type,
      quantity:     t.quantity,
      pricePerShare: parseFloat(t.price_per_share),
      totalAmount:  parseFloat(t.total_amount),
      fee:          parseFloat(t.fee),
      status:       t.status,
      executedAt:   t.executed_at ? t.executed_at.toISOString() : ''
    }));

    return res.status(200).json({ success: true, count: trades.length, trades: data });
  } catch (err) {
    console.error('[trades]', err);
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}
