export function getMondayBasedWeekId(d = new Date()) {
  let date;
  if (typeof d === 'string') {
    date = new Date(d.includes('T') ? d : `${d}T00:00:00.000Z`);
  } else if (typeof d === 'number') {
    date = new Date(d);
  } else {
    date = new Date(d.getTime());
  }

  const day = date.getUTCDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
  const utcDate = date.getUTCDate();
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  date.setUTCDate(utcDate + diffToMonday);
  return date.toISOString().split('T')[0];
}
