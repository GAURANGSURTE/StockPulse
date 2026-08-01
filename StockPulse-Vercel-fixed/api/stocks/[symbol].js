// api/stocks/[symbol].js — GET /api/stocks/:symbol
import { handleCors, requireAuth } from '../_auth.js';
import { getDb } from '../_db.js';
import { autoInit, formatStock, predictPrice } from '../_stocks.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    await autoInit();
    const user = await requireAuth(req, res);
    if (!user) return;

    const symbol = (req.query.symbol || '').toUpperCase();
    if (!symbol) return res.status(400).json({ success: false, message: 'Symbol is required.' });

    const sql = getDb();
    const rows = await sql`SELECT * FROM stocks WHERE symbol = ${symbol} LIMIT 1`;
    if (!rows.length) return res.status(404).json({ success: false, message: `Stock not found: ${symbol}` });

    const stock = rows[0];
    const { predicted, confidence } = predictPrice(
      symbol,
      parseFloat(stock.current_price),
      parseFloat(stock.change_percent || 0)
    );

    // Persist prediction
    await sql`
      UPDATE stocks SET predicted_price = ${predicted}, prediction_confidence = ${confidence}
      WHERE symbol = ${symbol}
    `;
    stock.predicted_price = predicted;
    stock.prediction_confidence = confidence;

    const formatted = formatStock(stock);
    formatted.predictedPrice = predicted;

    return res.status(200).json({ success: true, message: 'OK', data: formatted });
  } catch (err) {
    console.error('[stocks/symbol]', err);
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}
