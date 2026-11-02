const db = require('../db');
const { round2 } = require('../lib/http');
const SETTINGS = { opd: 'Outpatient (OPD)', ipd: 'Inpatient (IPD)' };
// Price for a service for a patient type and care setting; falls back to the service's list price.
async function priceFor(service, patientTypeId = null, setting = 'opd', c) {
  setting = setting === 'ipd' ? 'ipd' : 'opd';
  if (patientTypeId) {
    const row = await db.one('SELECT * FROM service_price WHERE payment_category_id=$1 AND patient_type_id=$2', [service.id, patientTypeId], c);
    const price = row ? row[`${setting}_price`] : null;
    if (price !== null && price !== undefined && price !== '') return round2(parseFloat(price));
  }
  return round2(parseFloat(service.c_price) || 0);
}
async function matrix() {
  const out = {};
  for (const row of await db.q('SELECT * FROM service_price')) for (const s of ['opd', 'ipd']) {
    const p = row[`${s}_price`];
    if (p !== null && p !== undefined) { out[row.patient_type_id] = out[row.patient_type_id] || {}; (out[row.patient_type_id][s] = out[row.patient_type_id][s] || {})[row.payment_category_id] = parseFloat(p); }
  }
  return out;
}
module.exports = { SETTINGS, priceFor, matrix };
