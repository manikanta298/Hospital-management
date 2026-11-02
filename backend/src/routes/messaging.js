// SMS formats and log, ICTCore / Telenor integration, notification settings, message templates and bulk send.
const router = require('express').Router();
const db = require('../db');
const { auth, can } = require('../middleware/auth');
const { wrap, validate, notFound, ValidationError } = require('../lib/http');
const ict = require('../support/ictcore');
router.use(auth);

// ---- SMS formats
router.get('/sms', can('send_sms/voice'), wrap(async (req, res) => res.json({ smses: await db.q('SELECT * FROM "smsFormat" ORDER BY id') })));
router.post('/sms', can('send_sms/voice'), wrap(async (req, res) => { const d = validate(req.body, { type: 'required', sender: 'required|max:100', message: 'required' }); res.status(201).json({ success: 'SMS Format Created Succesfully.', sms: await db.insert('smsFormat', d) }); }));
router.put('/sms/:id(\\d+)', can('send_sms/voice'), wrap(async (req, res) => { const s = notFound(await db.find('smsFormat', req.params.id)); await db.update('smsFormat', s.id, validate(req.body, { type: 'required', sender: 'required|max:100', message: 'required' })); res.json({ success: 'SMS Format Updated Succesfully.' }); }));
router.delete('/sms/:id(\\d+)', can('send_sms/voice'), wrap(async (req, res) => { const s = notFound(await db.find('smsFormat', req.params.id)); await db.remove('smsFormat', s.id); res.json({ success: 'SMS Format Deleted Succesfully.' }); }));
router.post('/smslog', can('view_sms/voice_log_reports'), wrap(async (req, res) => {
  const d = validate(req.body, { fromDate: 'required', toDate: 'required' });
  res.json({ smslogs: await db.q('SELECT * FROM "smsLog" WHERE created_at::date >= $1 AND created_at::date <= $2 ORDER BY id DESC', [d.fromDate, d.toDate]), foo: '1' });
}));
router.delete('/smslog/:id(\\d+)', can('view_sms/voice_log_reports'), wrap(async (req, res) => { const s = notFound(await db.find('smsLog', req.params.id)); await db.remove('smsLog', s.id); res.json({ success: 'SMS Log Deleted Succesfully.' }); }));

// ---- ICTCore / Telenor integration
router.get('/ictcore', can('send_notification'), wrap(async (req, res) => { const type = String(req.query.type || ''); res.json({ type, ictcore_integration: (await db.one('SELECT * FROM ictcore_integration WHERE type=$1', [type])) || { ictcore_url: '', ictcore_user: '', ictcore_password: '' } }); }));
router.post('/ictcore', can('send_notification'), wrap(async (req, res) => {
  const b = req.body; const withUrl = !!b.method;
  const d = validate(b, withUrl ? { ictcore_url: 'required', ictcore_user: 'required', ictcore_password: 'required', ictcore_account_id: 'required|numeric' } : { ictcore_user: 'required', ictcore_password: 'required' });
  await db.tx(async (c) => {
    await db.q('DELETE FROM ictcore_integration WHERE type=$1', [b.type], c);
    await db.insert('ictcore_integration', { ictcore_url: d.ictcore_url || 'http://core.ict.vision:180/api/', ictcore_user: d.ictcore_user, ictcore_password: d.ictcore_password, ictcore_account_id: d.ictcore_account_id ?? null, method: 'ictcore', type: b.type, type1: withUrl ? '' : 'ictcore_getway' }, c);
  });
  res.json({ success: 'Integration  Information saved.' });
}));

// ---- reminder wording (payment + appointment). The voice recording is stored; converting/uploading audio to ICTCore needs `sox`, which the Laravel app shelled out to.
const upload = require('../lib/upload').make('recordings', ['wav', 'mp3', 'ogg', 'm4a'], 10);
for (const [path, table] of [['fees', 'ictcore_fees'], ['attendance', 'ictcore_attendance']]) {
  router.get(`/ictcore/${path}`, can('send_notification'), wrap(async (req, res) => res.json({ message: (await db.one(`SELECT * FROM ${table} LIMIT 1`)) || { name: '', description: '', recording: '' } })));
  router.post(`/ictcore/${path}`, can('send_notification'), upload.single('recording'), wrap(async (req, res) => {
    const d = validate(req.body, { name: 'required|max:100', description: 'required' }); const old = await db.one(`SELECT * FROM ${table} LIMIT 1`);
    const row = { name: d.name, description: d.description, recording: req.file ? `recordings/${req.file.filename}` : (old ? old.recording : '') };
    res.json({ success: 'Message saved.', message: old ? await db.update(table, old.id, row) : await db.insert(table, { ...row, ictcore_recording_id: '', ictcore_program_id: '', telenor_file_id: '' }) });
  }));
}

// ---- notification settings (which channel, which time)
router.get('/notification-type', can('send_notification'), wrap(async (req, res) => res.json({ notification_types: await db.q('SELECT * FROM notification_type'), schedule: (await db.one('SELECT date, time FROM cronschedule LIMIT 1')) || { date: '', time: '' }, month: new Date().toLocaleString('en', { month: 'long' }), year: new Date().getFullYear() })));
router.post('/notification-type', can('send_notification'), wrap(async (req, res) => {
  const d = validate(req.body, { fess: 'required', attendance: 'required', time_set: 'required', time: 'required', date: 'required' });
  await db.tx(async (c) => {
    await db.q('DELETE FROM notification_type', [], c);
    for (const [k, v] of Object.entries(req.body)) if (v === 'sms' || v === 'voice') await db.insert('notification_type', { type: v, notification: k }, c);
    await db.q('DELETE FROM cronschedule', [], c); await db.insert('cronschedule', { date: d.date, time: d.time_set }, c);
  });
  res.json({ success: 'Notifications setting Created Succesfully.' });
}));

// ---- message templates
router.get('/template', can('send_sms/voice'), wrap(async (req, res) => res.json({ messages: await db.q('SELECT id, name, description, recording FROM message ORDER BY id') })));
router.post('/template', can('send_sms/voice'), wrap(async (req, res) => {
  const d = validate(req.body, { title: 'required', description: 'required' });
  if (await db.one('SELECT 1 FROM message WHERE name=$1', [d.title])) throw new ValidationError({ deplicate: ['Title all ready exists!!'] });
  res.status(201).json({ success: 'Message Created Succesfully.', message: await db.insert('message', { name: d.title, description: d.description, recording: '', ictcore_recording_id: '', ictcore_program_id: '', telenor_file_id: '' }) });
}));
router.get('/template/:id(\\d+)', can('send_sms/voice'), wrap(async (req, res) => res.json({ message: notFound(await db.find('message', req.params.id)) })));
router.put('/template/:id(\\d+)', can('send_sms/voice'), wrap(async (req, res) => { const m = notFound(await db.find('message', req.params.id)); const d = validate(req.body, { title: 'required' }); await db.update('message', m.id, { name: d.title, description: req.body.description ?? m.description }); res.json({ success: 'Message Updated Succesfully.' }); }));
router.delete('/template/:id(\\d+)', can('send_sms/voice'), wrap(async (req, res) => { const m = notFound(await db.find('message', req.params.id)); await db.remove('message', m.id); res.json({ success: 'Message Deleted Succesfully.' }); }));

// ---- send to all patients / all doctors / a list of numbers. stpye = 'quick' sends one by one, otherwise via a campaign.
router.get('/message', can('send_sms/voice'), wrap(async (req, res) => res.json({ messages: await db.q('SELECT id, name, description, recording FROM message ORDER BY id') })));
router.post('/message', can('send_sms/voice'), wrap(async (req, res) => {
  const b = req.body; validate(b, { role: 'required', message: 'required', mess_name: 'required' });
  const type = String(b.type || 'sms').toLowerCase(); const quick = b.stpye === 'quick';
  const cfg = await db.one('SELECT * FROM ictcore_integration WHERE type=$1', [type]);
  if (!cfg || !cfg.ictcore_user || !cfg.ictcore_password) return res.status(422).json({ error: 'Please Add ictcore integration in Setting Menu' });
  const telenor = cfg.method === 'telenor'; let programId = null; let fileId = '';
  if (type === 'voice' && b.message !== 'other') { const m = notFound(await db.find('message', b.message)); programId = m.ictcore_program_id; fileId = m.telenor_file_id; }
  else if (type === 'sms') { if (!telenor) { const textId = await ict.ictcoreApi('messages/texts', 'POST', { name: b.mess_name, data: b.message, type: 'utf-8', description: '' }); programId = await ict.ictcoreApi('programs/sendsms', 'POST', { name: b.mess_name, text_id: textId }); } }
  let groupId = null;
  if (!quick) groupId = telenor ? await ict.telenorApis('group', '', '', '', '', '') : await ict.ictcoreApi('groups', 'POST', { name: String(b.mess_name).replace(/ /g, '_'), description: b.mess_name });
  let recipients;
  if (b.role === 'patient' || b.role === 'all_patient') recipients = (await db.q('SELECT name, phone, email FROM patient')).map((r) => ({ first: r.name, last: '', phone: r.phone, email: '' }));
  else if (b.role === 'doctor') recipients = (await db.q('SELECT name, phone, email FROM doctor')).map((r) => ({ first: r.name, last: '', phone: r.phone, email: r.email }));
  else recipients = String(b.phone_number || '').split(',').map((p) => p.trim()).filter(Boolean).map((p) => ({ first: '', last: '', phone: p, email: '' }));
  let sent = 0;
  for (const r of recipients) {
    const to = ict.intl(r.phone); if (!to) continue;
    if (telenor) { if (!quick) await ict.telenorApis('add_contact', groupId, to, '', '', ''); else await ict.telenorSms(to, b.message, 'mask', cfg.ictcore_user, cfg.ictcore_password, type); }
    else {
      const contactId = await ict.ictcoreApi('contacts', 'POST', { first_name: r.first, last_name: r.last, phone: to, email: r.email });
      if (!quick) await ict.ictcoreApi(`contacts/${contactId}/link/${groupId}`, 'PUT', {});
      else { const tid = await ict.ictcoreApi('transmissions', 'POST', { title: 'Hospital Message', program_id: programId, contact_id: contactId, origin: 1, direction: 'outbound' }); await ict.ictcoreApi(`transmissions/${tid}/send`, 'POST', {}); }
    }
    sent++;
  }
  if (!quick) {
    if (telenor) { const campaign = await ict.telenorApis('campaign_create', groupId, '', b.message, fileId, type); await ict.telenorApis('send_msg', '', '', '', '', campaign); }
    else { const id = await ict.ictcoreApi('campaigns', 'POST', { program_id: programId, group_id: groupId, delay: '', try_allowed: '' }); await ict.ictcoreApi(`campaigns/${id}/start`, 'PUT', {}); }
  }
  await db.insert('smsLog', { type, sender: req.user.login, recipient: `${sent} recipient(s)`, message: String(b.message).slice(0, 1000), status: 'sent' });
  res.json({ success: 'campaign Created Succesfully.', recipients: sent });
}));
module.exports = router;
