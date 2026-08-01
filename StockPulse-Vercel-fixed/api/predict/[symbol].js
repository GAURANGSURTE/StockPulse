// api/predict/[symbol].js — GET /api/predict/:symbol
import { handleCors, requireAuth } from '../_auth.js';
import { getDb } from '../_db.js';
import { autoInit, predictPrice } from '../_stocks.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    await autoInit();
    const user = await requireAuth(req, res);
    if (!user) return;

    const symbol = (req.query.symbol || '').toUpperCase();
    const sql = getDb();
    const rows = await sql`SELECT * FROM stocks WHERE symbol = ${symbol} LIMIT 1`;
    if (!rows.length) return res.status(404).json({ success: false, message: 'Stock not found.' });

    const stock = rows[0];
    const currentPrice = parseFloat(stock.current_price);
    const changePercent = parseFloat(stock.change_percent || 0);
    const { predicted, confidence } = predictPrice(symbol, currentPrice, changePercent);

    await sql`
      UPDATE stocks SET predicted_price = ${predicted}, prediction_confidence = ${confidence}
      WHERE symbol = ${symbol}
    `;

    return res.status(200).json({
      success: true,
      message: 'OK',
      data: {
        symbol,
        currentPrice,
        predictedPrice: predicted,
        confidence,
        signal: predicted > currentPrice ? 'BUY' : 'SELL'
      }
    });
  } catch (err) {
    console.error('[predict/symbol]', err);
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}
