const router = require('express').Router();
const db = require('../db');
const { can } = require('../middleware/auth');
const { wrap, notFound } = require('../lib/http');
router.delete('/package-items/:id(\\d+)', can('service_update'), wrap(async (req, res) => {
  const i = notFound(await db.find('service_package_item', req.params.id)); await db.remove('service_package_item', i.id);
  res.json({ success: 'Removed from the package.', package_id: i.package_id });
}));
module.exports = router;
