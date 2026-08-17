export function getMondayBasedWeekId(d) {
  let date;
  try {
    if (!d || d === 0 || d === '0') {
      date = new Date();
    } else if (typeof d === 'string') {
      const trimmed = d.trim();
      const isoWeekMatch = trimmed.match(/^(\d{4})-W(\d{1,2})$/i);
      if (isoWeekMatch) {
        const year = parseInt(isoWeekMatch[1], 10);
        const week = parseInt(isoWeekMatch[2], 10);
        const jan4 = new Date(Date.UTC(year, 0, 4));
        const dayOfWeek = jan4.getUTCDay() || 7;
        const monWeek1 = new Date(jan4.getTime() - (dayOfWeek - 1) * 86400000);
        date = new Date(monWeek1.getTime() + (week - 1) * 7 * 86400000);
      } else if (/^\d+$/.test(trimmed)) {
        const num = parseInt(trimmed, 10);
        date = new Date(num < 1e11 ? num * 1000 : num);
      } else {
        date = new Date(trimmed.includes('T') ? trimmed : `${trimmed}T00:00:00.000Z`);
      }
    } else if (typeof d === 'number') {
      date = new Date(d < 1e11 ? d * 1000 : d);
    } else if (d instanceof Date) {
      date = new Date(d.getTime());
    } else {
      date = new Date();
    }
  } catch (err) {
    date = new Date();
  }

  if (!date || isNaN(date.getTime())) {
    date = new Date();
  }

  const day = date.getUTCDay();
  const utcDate = date.getUTCDate();
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  date.setUTCDate(utcDate + diffToMonday);
  return date.toISOString().split('T')[0];
}
