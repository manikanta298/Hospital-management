const db = require('../db');
const KINDS = { general: 'General (private)', panel: 'Panel company', charity: 'Charity', online: 'Online booking platform', staff: 'Staff' };
const defaultId = (c) => db.val("SELECT id FROM patient_type WHERE kind='general' ORDER BY id LIMIT 1", [], c);
const bucket = (kind) => (kind === 'panel' ? 'Panel' : kind === 'charity' ? 'Charity' : 'Private');
module.exports = { KINDS, defaultId, bucket };
