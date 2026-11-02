const { round2 } = require('../lib/http');
const db = require('../db');
// Mirrors Payment::paid()/balance()/settlement(). Attach .payments first (see hydratePayments).
const paid = (inv) => (inv.payments || []).reduce((a, p) => a + parseFloat(p.amount || 0), 0);
const balance = (inv) => round2(parseFloat(inv.gross_total || 0) - paid(inv));
const settlement = (inv) => { const p = paid(inv); if (p <= 0) return 'unpaid'; return balance(inv) > 0.004 ? 'part paid' : 'paid'; };
async function hydratePayments(rows, c) {
  const ids = rows.map((r) => r.id); if (!ids.length) return rows;
  const pays = await db.q('SELECT * FROM invoice_payment WHERE payment_id = ANY($1) ORDER BY id', [ids], c);
  for (const r of rows) r.payments = pays.filter((p) => p.payment_id === r.id);
  return rows;
}
async function hydrateItems(rows, c) {
  const ids = rows.map((r) => r.id); if (!ids.length) return rows;
  const items = await db.q('SELECT * FROM invoice_item WHERE payment_id = ANY($1) ORDER BY id', [ids], c);
  for (const r of rows) r.items = items.filter((p) => p.payment_id === r.id);
  return rows;
}
module.exports = { paid, balance, settlement, hydratePayments, hydrateItems };
