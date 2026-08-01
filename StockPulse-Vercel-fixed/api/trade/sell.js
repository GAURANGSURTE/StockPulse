// api/trade/sell.js — POST /api/trade/sell
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

    const portfolioRows = await sql`
      SELECT * FROM portfolio WHERE user_id = ${user.id} AND stock_symbol = ${sym} LIMIT 1
    `;
    if (!portfolioRows.length)
      return res.status(400).json({ success: false, message: `You don't own any shares of ${sym}` });

    const portfolio = portfolioRows[0];
    if (portfolio.quantity < qty)
      return res.status(400).json({
        success: false,
        message: `Insufficient shares. You own ${portfolio.quantity} shares of ${sym}`
      });

    const pricePerShare = parseFloat(stock.current_price);
    const subtotal = pricePerShare * qty;
    const fee = +(subtotal * TRADE_FEE).toFixed(2);
    const proceeds = +(subtotal - fee).toFixed(2);

    // Credit balance
    const freshUser = await sql`SELECT balance FROM users WHERE id = ${user.id} LIMIT 1`;
    const newBalance = +(parseFloat(freshUser[0].balance) + proceeds).toFixed(2);
    await sql`UPDATE users SET balance = ${newBalance}, updated_at = NOW() WHERE id = ${user.id}`;

    // Record trade
    await sql`
      INSERT INTO trades (user_id, stock_symbol, trade_type, quantity, price_per_share, total_amount, fee, status)
      VALUES (${user.id}, ${sym}, 'SELL', ${qty}, ${pricePerShare}, ${proceeds}, ${fee}, 'COMPLETED')
    `;

    // Update portfolio
    const remaining = portfolio.quantity - qty;
    if (remaining <= 0) {
      await sql`DELETE FROM portfolio WHERE id = ${portfolio.id}`;
    } else {
      const newTotal = parseFloat(portfolio.average_buy_price) * remaining;
      await sql`
        UPDATE portfolio SET quantity = ${remaining}, total_invested = ${newTotal}
        WHERE id = ${portfolio.id}
      `;
    }

    return res.status(200).json({
      success: true,
      message: `Successfully sold ${qty} shares of ${sym} at ₹${pricePerShare.toFixed(2)}`,
      symbol: sym, quantity: qty, pricePerShare, totalAmount: proceeds, newBalance, tradeType: 'SELL'
    });
  } catch (err) {
    console.error('[trade/sell]', err);
    return res.status(500).json({ success: false, message: 'Server error: ' + err.message });
  }
}
