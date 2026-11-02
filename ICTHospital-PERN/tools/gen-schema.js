// Parses the Laravel migrations (up() bodies only) and emits PostgreSQL DDL.
const fs = require('fs'), path = require('path');
const dir = process.argv[2], out = process.argv[3];
const files = fs.readdirSync(dir).filter(f => f.endsWith('.php')).sort();
const tables = {}; // name -> {cols: [{name,type,nullable,def,pk}], uniques:[], indexes:[], legacy}
const DATE_ONLY = ['birthdate','date','add_date','e_date','report_date','payDate'];
const NOT_DATES = ['date_string','s_time_key','time_slot','flat_vat','vat'];
const SKIP = new Set(['sessions','cache','cache_locks','jobs','job_batches','failed_jobs','password_reset_tokens','password_resets']);
function upBody(src) {
  const i = src.indexOf('function up()'); if (i < 0) return '';
  const j = src.indexOf('function down()', i);
  return src.slice(i, j > 0 ? j : undefined);
}
function splitArgs(s) { const a = []; let d = 0, cur = '', q = null;
  for (const ch of s) { if (q) { cur += ch; if (ch === q) q = null; continue; }
    if (ch === "'" || ch === '"') { q = ch; cur += ch; continue; }
    if ('([{'.includes(ch)) d++; if (')]}'.includes(ch)) d--;
    if (ch === ',' && d === 0) { a.push(cur.trim()); cur = ''; } else cur += ch; }
  if (cur.trim()) a.push(cur.trim()); return a; }
function splitStmts(b) { const out = []; let cur = '', q = null, d = 0;
  b = b.replace(/\/\/.*$/gm, '');
  for (const ch of b) { if (q) { cur += ch; if (ch === q) q = null; continue; }
    if (ch === "'" || ch === '"') { q = ch; cur += ch; continue; }
    if ('([{'.includes(ch)) d++; if (')]}'.includes(ch)) d--;
    if (ch === ';' && d === 0) { out.push(cur); cur = ''; } else cur += ch; }
  out.push(cur); return out; }
const unq = s => s.replace(/^['"]|['"]$/g, '');
function pgType(t, args) {
  switch (t) {
    case 'increments': return 'SERIAL'; case 'bigIncrements': case 'id': return 'BIGSERIAL';
    case 'string': return `VARCHAR(${args[1] || 255})`;
    case 'text': case 'mediumText': case 'longText': return 'TEXT';
    case 'integer': case 'unsignedInteger': return 'INTEGER';
    case 'unsignedBigInteger': case 'foreignId': return 'BIGINT';
    case 'unsignedTinyInteger': case 'unsignedSmallInteger': return 'SMALLINT';
    case 'decimal': return `NUMERIC(${args[1] || 8},${args[2] || 2})`;
    case 'boolean': return 'BOOLEAN';
    case 'dateTime': case 'timestamp': return 'TIMESTAMP';
    case 'date': return 'DATE'; case 'uuid': return 'UUID'; default: return null; }
}
function addColumn(tb, stmt, legacy) {
  const m = stmt.match(/^\$(?:table|t|blueprint)->(\w+)(?:\((.*?)\))?(.*)$/s); if (!m) return;
  const [, t, rawArgs = '', rest] = m; const args = splitArgs(rawArgs);
  const T = tables[tb];
  if (t === 'timestamps') { T.cols.push({ name: 'created_at', type: 'TIMESTAMP', nullable: true }, { name: 'updated_at', type: 'TIMESTAMP', nullable: true }); return; }
  if (t === 'rememberToken') { T.cols.push({ name: 'remember_token', type: 'VARCHAR(100)', nullable: true }); return; }
  if (t === 'unique' || t === 'index') { const cols = rawArgs.match(/'([^']+)'/g)?.map(unq) || []; (t === 'unique' ? T.uniques : T.indexes).push(cols); return; }
  if (t === 'dropColumn') { const names = rawArgs.match(/'([^']+)'/g)?.map(unq) || []; T.cols = T.cols.filter(c => !names.includes(c.name)); return; }
  if (t === 'change') return;
  let type = pgType(t, args); if (!type) return;
  const name = t === 'id' ? 'id' : unq(args[0] || 'id');
  const col = { name: t === 'increments' || t === 'bigIncrements' ? (args[0] ? unq(args[0]) : 'id') : name, type, nullable: /nullable/.test(rest), pk: /Increments|increments|^id$/.test(t) };
  if (t === 'id') col.name = 'id';
  const d = rest.match(/->default\((.*?)\)(?:->|$)/s) || rest.match(/->default\((.*)\)/s);
  if (d) { let v = d[1].trim(); if (/^true$/i.test(v)) v = 'TRUE'; else if (/^false$/i.test(v)) v = 'FALSE'; else if (/^['"]/.test(v)) v = `'${unq(v).replace(/'/g, "''")}'`; col.def = v; }
  if (/->unique\(\)/.test(rest)) T.uniques.push([col.name]);
  if (/->index\(\)/.test(rest)) T.indexes.push([col.name]);
  if (/->useCurrent\(\)/.test(rest)) col.def = 'CURRENT_TIMESTAMP';
  if (!tb.length) return;
  T.cols = T.cols.filter(c => c.name !== col.name); T.cols.push(col);
}
for (const f of files) {
  const src = upBody(fs.readFileSync(path.join(dir, f), 'utf8'));
  const legacy = /^2026_09_08/.test(f);
  const re = /Schema::(create|table)\(\s*'([^']+)'\s*,\s*(?:function|fn)\s*\([^)]*\)\s*(?:use\s*\([^)]*\)\s*)?(?:=>|\{)/g;
  let m; while ((m = re.exec(src))) {
    const [, kind, name] = m; if (SKIP.has(name)) continue;
    // find the block end by brace/paren matching
    let i = re.lastIndex, depth = m[0].endsWith('{') ? 1 : 0, start = i;
    if (depth === 0) { // arrow fn: statement until ');'
      const end = src.indexOf(');', i); const body = src.slice(start, end);
      if (!tables[name]) continue; addColumn(name, body.trim().replace(/;$/, ''), legacy); continue; }
    while (i < src.length && depth > 0) { if (src[i] === '{') depth++; else if (src[i] === '}') depth--; i++; }
    const body = src.slice(start, i - 1);
    if (kind === 'create') tables[name] = { cols: [], uniques: [], indexes: [], legacy };
    if (!tables[name]) continue;
    for (const st of splitStmts(body)) { const s = st.replace(/\/\/.*$/gm, '').replace(/\s+/g, ' ').trim(); if (s.startsWith('$')) addColumn(name, s, legacy); }
  }
  // Schema::table(..., fn => dropColumn) style one-liners
  for (const dm of src.matchAll(/Schema::table\('([^']+)',\s*fn\s*\(Blueprint \$t\)\s*=>\s*\$t->dropColumn\((\[[^\]]*\]|'[^']+')\)/g)) {
    const names = dm[2].match(/'([^']+)'/g).map(unq); if (tables[dm[1]]) tables[dm[1]].cols = tables[dm[1]].cols.filter(c => !names.includes(c.name)); }
}
// school tables removed by migration 2026_09_09_140000
const REMOVED = ['family_vouchar','voucherhistories','invoice_history','admissionfee_collections','exam','question_temps','questions','timetable','section_attendance','section','acadamic_year','teacher','admission','diaries','referals','dormitory_student','dormitory_fee','dormitory','level'];
REMOVED.forEach(t => delete tables[t]);
Object.keys(tables).filter(t => /^oauth_/.test(t)).forEach(t => delete tables[t]);
for (const T of Object.values(tables)) T.cols = T.cols.filter(c => !c.name.includes('$'));
// modernise: legacy varchar date-ish columns become real dates; legacy columns tolerate NULL
for (const [n, T] of Object.entries(tables)) for (const c of T.cols) {
  if (T.legacy && c.type.startsWith('VARCHAR') && (/date/i.test(c.name) || /_time$/.test(c.name)) && !NOT_DATES.includes(c.name)) c.type = DATE_ONLY.includes(c.name) ? 'DATE' : 'TIMESTAMP';
  if (T.legacy && !c.pk) c.nullable = true;
}
// foreign keys from SchemaModerniser::RELATIONS (ON DELETE SET NULL)
const REL = { appointment:{patient:'patient',doctor:'doctor'}, payment:{patient:'patient',doctor:'doctor'}, prescription:{patient:'patient',doctor:'doctor'}, lab:{patient:'patient',doctor:'doctor'}, report:{patient:'patient',doctor:'doctor'}, medical_history:{patient_id:'patient'}, patient_deposit:{patient:'patient'}, patient_material:{patient:'patient'}, ot_payment:{patient:'patient'}, alloted_bed:{patient:'patient',bed_id:'bed'} };
let sql = '-- Generated from the Laravel migrations by tools/gen-schema.js\n-- PostgreSQL 14+\n\n';
const q = s => `"${s}"`;
const fks = [];
for (const [n, T] of Object.entries(tables)) {
  const lines = T.cols.map(c => { let t = c.type;
    if (REL[n]?.[c.name]) t = 'INTEGER';
    let l = `  ${q(c.name)} ${t}`; if (c.pk) l += ' PRIMARY KEY'; else if (!c.nullable) l += ' NOT NULL'; if (c.def !== undefined && !c.pk) l += ` DEFAULT ${c.def}`; return l; });
  for (const [col, par] of Object.entries(REL[n] || {})) if (T.cols.find(c => c.name === col) && tables[par]) fks.push(`DO $$ BEGIN ALTER TABLE ${q(n)} ADD CONSTRAINT ${q(`${n}_${col}_fk`)} FOREIGN KEY (${q(col)}) REFERENCES ${q(par)}("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
  sql += `CREATE TABLE IF NOT EXISTS ${q(n)} (\n${lines.join(',\n')}\n);\n`;
  T.uniques.forEach((u, i) => sql += `CREATE UNIQUE INDEX IF NOT EXISTS ${q(`${n}_${u.join('_')}_uq`)} ON ${q(n)} (${u.map(q).join(', ')});\n`);
  T.indexes.forEach(u => sql += `CREATE INDEX IF NOT EXISTS ${q(`${n}_${u.join('_')}_ix`)} ON ${q(n)} (${u.map(q).join(', ')});\n`);
  sql += '\n';
}
sql += fks.join('\n') + '\n\n';
sql += `CREATE TABLE IF NOT EXISTS "activity_log" (
  "id" SERIAL PRIMARY KEY, "description" TEXT, "userType" VARCHAR(255), "userId" INTEGER, "route" TEXT,
  "ipAddress" VARCHAR(45), "userAgent" TEXT, "locale" VARCHAR(255), "referer" TEXT, "methodType" VARCHAR(20),
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP, "deleted_at" TIMESTAMP
);
`;
fs.writeFileSync(out, sql);
fs.writeFileSync(out.replace(/\.sql$/, '.json'), JSON.stringify(Object.fromEntries(Object.entries(tables).map(([n, T]) => [n, T.cols.map(c => c.name)])), null, 1));
console.log(Object.keys(tables).length + ' tables');
