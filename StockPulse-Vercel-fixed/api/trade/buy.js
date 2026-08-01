// api/trade/buy.js — POST /api/trade/buy
import { handleCors, requireAuth } from '../_auth.js';
import { getDb } from '../_db.js';
import { autoInit } from '../_stocks.js';

const TRADE_FEE = 0.001; // 0.1%

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    await autoInit();
    const user = await requireAuth(req, res);
    if (!user) return;

    const sql = getDb();
    const { symbol, quantity } = req.body || {};
    if (!symbol || !quantity || quantity <= 0)
      return res.status(400).json({ success: false, message: 'Symbol and positive quantity are required.' });

    const sym = symbol.toUpperCase();
    const qty = parseInt(quantity);

    const stockRows = await sql`SELECT * FROM stocks WHERE symbol = ${sym} LIMIT 1`;
    if (!stockRows.length)
      return res.status(400).json({ success: false, message: `Stock not found: ${sym}` });

    const stock = stockRows[0];
    const pricePerShare = parseFloat(stock.current_price);
    const subtotal = pricePerShare * qty;
    const fee = +(subtotal * TRADE_FEE).toFixed(2);
    const total = +(subtotal + fee).toFixed(2);

    // Refresh user balance
    const freshUser = await sql`SELECT * FROM users WHERE id = ${user.id} LIMIT 1`;
    const balance = parseFloat(freshUser[0].balance);

    if (balance < total)
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Required: ₹${total.toFixed(2)}, Available: ₹${balance.toFixed(2)}`
      });

    // Deduct balance
    const newBalance = +(balance - total).toFixed(2);
    await sql`UPDATE users SET balance = ${newBalance}, updated_at = NOW() WHERE id = ${user.id}`;

    // Record trade
    await sql`
      INSERT INTO trades (user_id, stock_symbol, trade_type, quantity, price_per_share, total_amount, fee, status)
      VALUES (${user.id}, ${sym}, 'BUY', ${qty}, ${pricePerShare}, ${total}, ${fee}, 'COMPLETED')
    `;

    // Update portfolio
    const portfolioRows = await sql`
      SELECT * FROM portfolio WHERE user_id = ${user.id} AND stock_symbol = ${sym} LIMIT 1
    `;
    if (portfolioRows.length) {
      const p = portfolioRows[0];
      const newQty = p.quantity + qty;
      const newTotal = parseFloat(p.total_invested) + subtotal;
      const newAvg = +(newTotal / newQty).toFixed(4);
      await sql`
        UPDATE portfolio SET quantity = ${newQty}, total_invested = ${newTotal}, average_buy_price = ${newAvg}
        WHERE id = ${p.id}
      `;
    } else {
      await sql`
        INSERT INTO portfolio (user_id, stock_symbol, quantity, average_buy_price, total_invested)
        VALUES (${user.id}, ${sym}, ${qty}, ${pricePerShare}, ${subtotal})
      `;
    }

    return res.status(200).json({
      success: true,
      message: `Successfully bought ${qty} shares of ${sym} at ₹${pricePerShare.toFixed(2)}`,
      symbol: sym, quantity: qty, pricePerShare, totalAmount: total, newBalance, tradeType: 'BUY'
    });
  } catch (err) {
    console.error('[trade/buy]', err);
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}
