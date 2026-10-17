// src/utils/timeUtils.ts

/**
 * Converts a time string (e.g. "08:00 AM", "14:30", "7:15 PM") into sortable minutes from midnight
 */
export function parseTimeToMinutes(timeString?: string | null): number {
  if (!timeString) return 9999;

  let timeStr = timeString.trim().toUpperCase();
  const isPM = timeStr.includes('PM');
  const isAM = timeStr.includes('AM');

  timeStr = timeStr.replace('AM', '').replace('PM', '').trim();

  const parts = timeStr.split(':');
  let hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;

  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

/**
 * Checks if the given scheduled time has already passed today
 */
export function checkIfOverdue(timeString: string): boolean {
  const medMinutes = parseTimeToMinutes(timeString);
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return medMinutes < currentMinutes;
}

/**
 * Converts a scheduled time string into the next upcoming Date instance
 */
export function getNextDateForTime(timeString: string): Date {
  const totalMinutes = parseTimeToMinutes(timeString);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const now = new Date();
  const nextDate = new Date();
  nextDate.setHours(hours, minutes, 0, 0);

  if (nextDate <= now) {
    nextDate.setDate(nextDate.getDate() + 1);
  }
  return nextDate;
}

export type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'night';

/**
 * Categorizes a time into a day quadrant:
 * Morning (< 12:00 PM), Afternoon (12:00 PM - 5:00 PM),
 * Evening (5:00 PM - 9:00 PM), Night (>= 9:00 PM)
 */
export function getTimeSlot(timeString: string): TimeSlot {
  const minutes = parseTimeToMinutes(timeString);
  if (minutes < 720) return 'morning'; // before 12:00 PM
  if (minutes < 1020) return 'afternoon'; // 12:00 PM - 5:00 PM
  if (minutes < 1260) return 'evening'; // 5:00 PM - 9:00 PM
  return 'night'; // 9:00 PM onwards
}
