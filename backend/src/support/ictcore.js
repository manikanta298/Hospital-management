// Port of ICTCoreController's HTTP clients: ICTCore REST API, Telenor corporate SMS, and the notification helpers.
const db = require('../db');
const sms = require('./sms');
const intl = sms.localToIntl;

async function ictcoreApi(method, verb, args = {}) {
  const cfg = await db.one("SELECT * FROM ictcore_integration WHERE method='ictcore' LIMIT 1");
  if (!cfg) return { error: { message: 'ICTCore integration is not configured' } };
  let body = { ...args };
  if (method === 'transmissions') body = { ...args, account_id: cfg.ictcore_account_id };
  if (method === 'campaigns') body = { ...args, account_id: cfg.ictcore_account_id };
  for (const [k, v] of Object.entries(body)) if (v && typeof v === 'object') body[k] = JSON.stringify(v);
  try {
    const r = await fetch(`${String(cfg.ictcore_url).replace(/\/+$/, '')}/${method}`, { method: verb === 'PUT' ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', 'X-HTTP-Method-Override': verb, Authorization: `Basic ${Buffer.from(`${cfg.ictcore_user}:${cfg.ictcore_password}`).toString('base64')}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
    const text = await r.text(); try { return JSON.parse(text); } catch { return text; }
  } catch (e) { return { error: { message: e.message } }; }
}
const xmlData = (s) => { const m = String(s).match(/<data>([\s\S]*?)<\/data>/); return m ? m[1].trim() : ''; };
const T = 'https://telenorcsms.com.pk:27677/corporate_sms2/api';
async function telenorSession(user, pass) { const r = await fetch(`${T}/auth.jsp?msisdn=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`, { signal: AbortSignal.timeout(15000) }); return xmlData(await r.text()); }
async function telenorSms(to, msg, mask, user, pass, type = 'sms') {
  try {
    const sid = await telenorSession(user, pass); let url = type === 'voice' ? `${T}/makecall.jsp?session_id=${sid}&to=${intl(to)}&file_id=${encodeURIComponent(msg)}&max_retries=1` : `${T}/sendsms.jsp?session_id=${sid}&to=${intl(to)}&text=${encodeURIComponent(msg)}`;
    if (mask && type === 'sms') { const cfg = await db.one("SELECT * FROM ictcore_integration WHERE type='sms' AND method='telenor' LIMIT 1"); url += `&mask=${encodeURIComponent(cfg ? cfg.ictcore_url : mask)}`; }
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) }); return { response: xmlData(await r.text()) };
  } catch (e) { return { response: 'error', error: e.message }; }
}
async function telenorApis(method, groupId, to, text, fileId, type) {
  const cfg = await db.one("SELECT * FROM ictcore_integration WHERE method='telenor' LIMIT 1"); if (!cfg) return null;
  try {
    const sid = await telenorSession(cfg.ictcore_user, cfg.ictcore_password); let url;
    if (method === 'group') url = `${T}/list.jsp?session_id=${sid}&list_name=fee_defulter_${Date.now()}`;
    if (method === 'add_contact') url = `${T}/addcontacts.jsp?session_id=${sid}&list_id=${groupId}&to=${intl(to)}`;
    if (method === 'campaign_create' && type === 'sms') { const inst = await db.val('SELECT name FROM institute LIMIT 1'); let mask = String(inst || 'ICTHospital').replace(/[^A-Za-z0-9]/g, '').slice(0, 11); const s = await db.one("SELECT * FROM ictcore_integration WHERE type='sms' AND method='telenor' LIMIT 1"); if (s && mask) mask = s.ictcore_url; url = `${T}/campaign.jsp?session_id=${sid}&name=fee_defulter_${Date.now()}&group_ids=${groupId}&text=${encodeURIComponent(text)}&time=${encodeURIComponent(new Date(Date.now() + 3600e3).toISOString().slice(0, 19).replace('T', ' '))}&mask=${encodeURIComponent(mask)}`; }
    if (method === 'campaign_create' && type === 'voice') url = `${T}/voice_broadcast_campaign.jsp?session_id=${sid}&name=notification_voice_${Date.now()}&file_id=${fileId}&group_ids=${groupId}&text=${encodeURIComponent(text)}&max_retries=1`;
    if (method === 'send_msg') url = `${T}/campstatus.jsp?session_id=${sid}&campid=${type}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) }); const body = await r.text(); return method === 'add_contact' ? undefined : xmlData(body);
  } catch (e) { return null; }
}
module.exports = { ictcoreApi, telenorSms, telenorApis, bizSms: sms.bizSms, intl };
