const KINDS = { consultation: 'Consultation', procedure: 'Procedure', lab: 'Laboratory', radiology: 'Radiology', dialysis: 'Dialysis', ot: 'Operation theatre', room: 'Room and ward', package: 'Package', pharmacy: 'Pharmacy', donation: 'Donation', misc: 'Miscellaneous' };
module.exports = { KINDS, label: (k) => KINDS[k] ?? 'Other' };
