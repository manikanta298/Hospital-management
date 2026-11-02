// Port of config/hospital_permissions.php
module.exports = {
  groups: { admin: 'Admin', doctor: 'Doctors', nurse: 'Nurses', accountant: 'Accountants', receptionist: 'Receptionists', pharmacist: 'Pharmacists', laboratorist: 'Laboratory Staff' },
  permissions: [
    'Patient View','Patient Add','Patient Update','Patient Delete','Patient Medical History','Patient Portal Access','Patient Bulk Add',
    'Appointment View','Appointment Add','Appointment Update','Appointment Cancel','Appointment Calendar','View Appointment Reports',
    'Admission View','Admission Add','Admission Discharge','Bed View','Bed Allot','Bed Release','Ward View','Ward Add','Ward Update','Ward Delete',
    'Prescription View','Prescription Add','Prescription Update','Prescription Delete','Lab Test View','Lab Test Add','Lab Test Update','Lab Test Delete',
    'Diagnostic Report View','Diagnostic Report Add','Operation Theatre View','Operation Theatre Schedule',
    'Medicine View','Medicine Add','Medicine Update','Medicine Delete','Pharmacy Sale','Pharmacy Stock View','View Pharmacy Reports',
    'Doctor View','Doctor Add','Doctor Update','Doctor Delete','Doctor Schedule','Doctor Portal Access',
    'Nurse View','Nurse Add','Nurse Update','Nurse Delete','Staff View','Staff Add','Staff Update','Staff Delete',
    'Department View','Department Add','Department Update','Department Delete',
    'Payment View','Payment Add','Payment Update','Payment Delete','Patient Deposit','Invoice View','Invoice Print',
    'Expense View','Expense Add','Expense Update','Expense Delete','Payroll View','Payroll Process','View Payment Reports','Accounting',
    'Send Sms/Voice','Send Notification','View Sms/voice log Reports',
    'Service View','Service Add','Service Update','Service Delete','Holidays View','Holidays Add','Holidays Delete',
    'Hospital Information Add','Branch View','Branch Add','Branch Update','Branch Delete',
    'Doctor Share View','Doctor Share Approve','Cash Close','Cash Close All Users','Consultation View','Consultation Add',
  ],
};
