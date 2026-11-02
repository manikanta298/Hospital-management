const router = require('express').Router();
const db = require('../db');
const { can } = require('../middleware/auth');
const { wrap, validate, notFound, ValidationError } = require('../lib/http');
const SECRETS = ['merchant_key', 'salt', 'APIUsername', 'APIPassword', 'APISignature'];

async function validated(req, ignoreId = null) {
  const d = validate(req.body, { name: 'required|max:100', merchant_key: 'nullable|max:100', salt: 'nullable|max:100', APIUsername: 'nullable|max:100', APIPassword: 'nullable|max:100', APISignature: 'nullable|max:100' });
  if (await db.one('SELECT 1 FROM "paymentGateway" WHERE name=$1 AND ($2::int IS NULL OR id<>$2)', [d.name, ignoreId])) throw new ValidationError({ name: ['A gateway with that name is already configured.'] });
  for (const f of SECRETS) d[f] = d[f] ?? '';
  d.x = ''; d.y = ''; if (!ignoreId) d.status = 'disabled';
  return d;
}
// Secrets are write-only: the list shows whether each is set, never its value.
const mask = (g) => { const o = { ...g }; for (const f of SECRETS) { o[`${f}_set`] = !!g[f]; delete o[f]; } return o; };
router.get('/', can('payment_view'), wrap(async (req, res) => res.json({ gateways: (await db.q('SELECT * FROM "paymentGateway" ORDER BY name')).map(mask), secrets: SECRETS })));
router.post('/', can('payment_add'), wrap(async (req, res) => { const g = await db.insert('paymentGateway', await validated(req)); res.status(201).json({ success: `${g.name} added.`, gateway: mask(g) }); }));
router.put('/:id(\\d+)', can('payment_update'), wrap(async (req, res) => {
  const g = notFound(await db.find('paymentGateway', req.params.id)); const d = await validated(req, g.id);
  for (const f of SECRETS) if ((d[f] ?? '') === '') delete d[f];
  const u = await db.update('paymentGateway', g.id, d); res.json({ success: `${u.name} updated.` });
}));
router.post('/:id(\\d+)/enable', can('payment_update'), wrap(async (req, res) => {
  const g = notFound(await db.find('paymentGateway', req.params.id));
  await db.tx(async (c) => { await db.q("UPDATE \"paymentGateway\" SET status='disabled'", [], c); await db.update('paymentGateway', g.id, { status: 'enabled' }, c); });
  res.json({ success: `${g.name} is now the active gateway.` });
}));
router.post('/:id(\\d+)/disable', can('payment_update'), wrap(async (req, res) => { const g = notFound(await db.find('paymentGateway', req.params.id)); await db.update('paymentGateway', g.id, { status: 'disabled' }); res.json({ success: `${g.name} disabled.` }); }));
router.delete('/:id(\\d+)', can('payment_delete'), wrap(async (req, res) => { const g = notFound(await db.find('paymentGateway', req.params.id)); await db.remove('paymentGateway', g.id); res.json({ success: `Removed ${g.name}.` }); }));
module.exports = router;
