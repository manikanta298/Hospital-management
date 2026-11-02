const MODES = ['Cash', 'Bank transfer', 'Card', 'Cheque', 'Online'];
const WRITE_OFF = 'Write-off';
function bucket(method) {
  const m = String(method ?? '').trim().toLowerCase();
  if (m === '' || m === 'cash') return 'cash';
  if (m.includes('bank') || m.includes('transfer')) return 'bank_transfer';
  if (m.includes('card') || m.includes('pos')) return 'card';
  if (m.includes('cheque') || m.includes('check')) return 'cheque';
  return 'other';
}
const isWriteOff = (m) => String(m ?? '').trim().toLowerCase() === WRITE_OFF.toLowerCase();
const labels = () => ({ cash: 'Cash', bank_transfer: 'Bank transfer', card: 'Card', cheque: 'Cheque', other: 'Other' });
module.exports = { MODES, WRITE_OFF, bucket, isWriteOff, labels };
