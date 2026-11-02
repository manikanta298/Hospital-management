// Port of CronjobController::paymentReminder: one reminder campaign for patients with an unpaid balance.
// Run it on a schedule:  node src/jobs/paymentReminder.js   (or POST /api/cron/payment-reminder)
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const db = require('../db');
const ict = require('../support/ictcore');
const BATCH = 200;
const normalise = (p) => { p = String(p || '').trim(); if (!p) return null; if (/^0\d+$/.test(p)) p = `92${p.slice(1)}`; const d = p.replace(/\D/g, ''); return d.length >= 10 ? d : null; };
async function run() {
  const skip = (reason) => ({ status: 'skipped', reason, contacts: 0 });
  const note = await db.one("SELECT * FROM notification_type WHERE notification IN ('payment','fess') LIMIT 1");
  if (!note || !note.type) return skip('no notification type is configured for patient payments');
  const cfg = await db.one('SELECT * FROM ictcore_integration WHERE type=$1', [note.type]); if (!cfg) return skip(`no ICTCore integration is configured for type ${note.type}`);
  const rows = await db.q(`SELECT COALESCE(NULLIF(p.patient_name,''), pt.name) AS name, COALESCE(NULLIF(p.patient_phone,''), pt.phone) AS phone, pt.email
    FROM payment p LEFT JOIN patient pt ON pt.id=p.patient
    WHERE CAST(COALESCE(NULLIF(p.gross_total,''),'0') AS NUMERIC) > CAST(COALESCE(NULLIF(p.amount_received,''),'0') AS NUMERIC) AND (p.status IS NULL OR p.status NOT IN ('paid','Paid','cancelled','Cancelled')) LIMIT ${BATCH}`);
  if (!rows.length) return { status: 'ok', reason: 'nothing outstanding', contacts: 0 };
  const telenor = cfg.method === 'telenor';
  const groupId = telenor ? await ict.telenorApis('group', '', '', '', '', '') : await ict.ictcoreApi('groups', 'POST', { name: 'Patient payment reminder', description: 'Outstanding patient payments, created by the ICTHospital cron job' });
  if (!groupId) return skip('ICTCore did not return a contact group, check the integration settings');
  const numbers = [];
  for (const r of rows) { const phone = normalise(r.phone); if (!phone) continue; if (telenor) { numbers.push(phone); continue; } const cid = await ict.ictcoreApi('contacts', 'POST', { first_name: r.name, last_name: '', phone, email: r.email || '' }); if (cid) { await ict.ictcoreApi(`contacts/${cid}/link/${groupId}`, 'PUT', {}); numbers.push(phone); } }
  if (!numbers.length) return skip('no usable phone numbers on the outstanding payments');
  if (telenor) await ict.telenorApis('add_contact', groupId, numbers.join(','), '', '', '');
  const fees = await db.one('SELECT * FROM ictcore_fees LIMIT 1'); const message = (fees && fees.description) || 'You have an outstanding balance at our hospital. Please contact reception to settle it.';
  let campaign;
  if (telenor) campaign = await ict.telenorApis('campaign_create', groupId, '', message, fees ? fees.telenor_file_id : '', note.type);
  else {
    let programId = fees ? fees.ictcore_program_id : null;
    if (note.type === 'sms' || !programId) { const textId = await ict.ictcoreApi('messages/texts', 'POST', { name: 'payment_reminder', data: message, type: 'utf-8', description: '' }); programId = await ict.ictcoreApi('programs/sendsms', 'POST', { name: 'payment_reminder', text_id: textId }); }
    campaign = programId ? await ict.ictcoreApi('campaigns', 'POST', { program_id: programId, group_id: groupId, delay: '', try_allowed: '' }) : null;
  }
  return { status: 'ok', reason: 'reminder campaign created', contacts: numbers.length, campaign };
}
module.exports = { run };
if (require.main === module) db.init().then(run).then((r) => { console.log(JSON.stringify(r)); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
