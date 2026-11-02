const router = require('express').Router();
const db = require('../db');
const { auth } = require('../middleware/auth');
const { wrap, num, int } = require('../lib/http');
const count = async (t) => int(await db.val(`SELECT COUNT(*) FROM "${t}"`));
router.get('/', auth, wrap(async (req, res) => {
  const [totalPatients, totalDoctors, totalNurses] = [await count('patient'), await count('doctor'), await count('nurse')];
  const totalStaff = totalDoctors + totalNurses + (await count('receptionist')) + (await count('pharmacist')) + (await count('laboratorist')) + (await count('accountant'));
  const totalBeds = await count('bed'); const occupiedBeds = int(await db.val('SELECT COUNT(*) FROM alloted_bed WHERE d_time IS NULL')); const freeBeds = Math.max(totalBeds - occupiedBeds, 0);
  const sum = async (sql) => num(await db.val(sql));
  const income = (await sum(`SELECT COALESCE(SUM(${db.numSql('amount_received')}),0) FROM payment`)) + (await sum(`SELECT COALESCE(SUM(${db.numSql('amount')}),0) FROM accounting WHERE type='Income'`));
  const expenses = (await sum(`SELECT COALESCE(SUM(${db.numSql('amount')}),0) FROM expense`)) + (await sum(`SELECT COALESCE(SUM(${db.numSql('amount')}),0) FROM accounting WHERE type='Expence'`));
  const recentPatients = await db.q('SELECT id, name, phone, sex, age, add_date FROM patient ORDER BY id DESC LIMIT 5');
  const recentAppointments = await db.q('SELECT id, patient, doctor, date, time_slot, status FROM appointment ORDER BY id DESC LIMIT 5');
  const names = async (table, ids) => (ids.length ? Object.fromEntries((await db.q(`SELECT id, name FROM "${table}" WHERE id = ANY($1)`, [ids])).map((r) => [r.id, r.name])) : {});
  res.json({
    totalPatients, totalDoctors, totalNurses, totalStaff, totalBeds, occupiedBeds, freeBeds, occupancy: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
    totalAppointments: await count('appointment'), pendingAppointments: int(await db.val("SELECT COUNT(*) FROM appointment WHERE LOWER(status)='pending'")), totalPrescriptions: await count('prescription'), totalLabTests: await count('lab'),
    totalReports: await count('report'), totalMedicines: await count('medicine'), income, expenses, balance: income - expenses, recentPatients, recentAppointments,
    patientNames: await names('patient', recentAppointments.map((a) => a.patient).filter(Boolean)), doctorNames: await names('doctor', recentAppointments.map((a) => a.doctor).filter(Boolean)),
  });
}));
module.exports = router;
