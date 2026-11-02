// Outbound SMS. Port of ICTCoreController::biz_sms (BizSMS branded SMS over HTTP).
const base = (process.env.BIZ_SMS_URL || 'http://api.bizsms.pk/api-send-branded-sms.aspx');
async function bizSms({ numbers, message }) {
  const user = process.env.BIZ_SMS_USERNAME, pass = process.env.BIZ_SMS_PASSWORD, mask = process.env.BIZ_SMS_MASK || '';
  if (!user || !pass) { console.warn(`[sms] BIZ_SMS_* not configured; message to ${numbers} not sent: ${message}`); return { sent: false, response: ['not configured'] }; }
  const url = `${base}?username=${encodeURIComponent(user)}&pass=${encodeURIComponent(pass)}&text=${encodeURIComponent(message)}&masking=${encodeURIComponent(mask)}&destinationnum=${encodeURIComponent(numbers)}&language=English`;
  try { const r = await fetch(url, { signal: AbortSignal.timeout(15000) }); const html = await r.text(); const m = html.match(/id="lblmessage"[^>]*>([^<]*)</); return { sent: r.ok, response: m ? [m[1].trim()] : [] }; }
  catch (e) { console.error('[sms] failed', e.message); return { sent: false, response: [e.message] }; }
}
const localToIntl = (phone) => (/^0\d+$/.test(String(phone || '')) ? String(phone).replace(/^0/, '92') : String(phone || ''));
module.exports = { bizSms, localToIntl };
