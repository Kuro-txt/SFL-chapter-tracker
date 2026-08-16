export function getMondayBasedWeekId(d) {
  let date;
  try {
    if (!d) {
      date = new Date();
    } else if (typeof d === 'number') {
      // Handle both seconds (Unix timestamp) and milliseconds
      date = new Date(d < 1e11 ? d * 1000 : d);
    } else if (typeof d === 'string') {
      // Clean up string dates if they are numeric strings
      if (/^\d+$/.test(d)) {
        const num = parseInt(d, 10);
        date = new Date(num < 1e11 ? num * 1000 : num);
      } else {
        date = new Date(d.includes('T') ? d : `${d}T00:00:00.000Z`);
      }
    } else if (d instanceof Date) {
      date = new Date(d.getTime());
    } else {
      date = new Date();
    }
  } catch (err) {
    date = new Date();
  }

  // Fallback if date is still invalid (NaN)
  if (!date || isNaN(date.getTime())) {
    date = new Date();
  }

  const day = date.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
  const utcDate = date.getUTCDate();
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  date.setUTCDate(utcDate + diffToMonday);
  
  return date.toISOString().split('T')[0];
}
