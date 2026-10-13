/**
 * Indian Rupee (₹) and Indian Date (DD-MM-YYYY) formatting helpers
 */

export function formatCurrency(amount) {
  const num = Number(amount || 0);
  // Format according to en-IN locale
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function formatDateIN(dateStr) {
  if (!dateStr) return '';
  // If already DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) return dateStr;
  // If YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-');
    return `${day}-${month}-${year}`;
  }
  // Try Date object
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    }
  } catch (e) {}
  return dateStr;
}

export function toInputDate(dateStr) {
  if (!dateStr) return new Date().toISOString().slice(0, 10);
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('-');
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

export function getMonthName(monthStr) {
  if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) return monthStr;
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function getCurrentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getCurrentDateISO() {
  return new Date().toISOString().slice(0, 10);
}
