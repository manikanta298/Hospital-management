// Port of config/hospital_staff.php (`table` replaces the Eloquent model class).
module.exports = {
  nurse: { group: 'Nurse', table: 'nurse', label: 'Nurses', singular: 'nurse', permission: 'nurse' },
  pharmacist: { group: 'Pharmacist', table: 'pharmacist', label: 'Pharmacists', singular: 'pharmacist', permission: 'staff' },
  laboratorist: { group: 'Laboratorist', table: 'laboratorist', label: 'Laboratory staff', singular: 'laboratory technician', permission: 'staff' },
  receptionist: { group: 'Receptionist', table: 'receptionist', label: 'Receptionists', singular: 'receptionist', permission: 'staff' },
  accountant: { group: 'Accountant', table: 'accountant', label: 'Accountants', singular: 'accountant', permission: 'staff' },
};
