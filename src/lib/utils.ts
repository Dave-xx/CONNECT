import { Booking, WorkingHoursMap } from '../types/index.ts';

export function formatCurrency(amount: number, currency = 'KSh'): string {
  if (!Number.isFinite(amount)) return `${currency} 0`;
  return `${currency} ${Math.round(amount).toLocaleString('en-KE')}`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function generateBookingReference(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `SC-${suffix}`;
}

export function generateSafeId(prefix = 'id'): string {
  const rand = Math.random().toString(36).slice(2, 9);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function formatTimestamp(ts: any): string {
  if (!ts) return 'Just now';
  try {
    const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    return new Intl.DateTimeFormat('en-KE', {
      timeZone: 'Africa/Nairobi',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return 'Recent';
  }
}

export function formatDateTimeNairobi(ts: any): string {
  if (!ts) return 'Just now';
  try {
    const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    return new Intl.DateTimeFormat('en-KE', {
      timeZone: 'Africa/Nairobi',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return 'Recent';
  }
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function computeAvailableTimeSlots(
  dateStr: string,
  workingHours: (WorkingHoursMap & { maxBookingsPerDay?: number; daysOff?: string[] }) | undefined,
  existingBookings: Booking[],
  durationMins = 60
): string[] {
  if (!dateStr) return [];
  if (workingHours?.daysOff?.includes(dateStr)) return [];

  const parsed = new Date(`${dateStr}T09:00:00+03:00`);
  if (Number.isNaN(parsed.getTime())) return [];
  const dayName = WEEKDAYS[parsed.getDay()];

  const daySchedule = workingHours?.[dayName] || {
    enabled: dayName !== 'Sunday',
    open: '08:00',
    close: '17:00',
  };

  if (!daySchedule.enabled) return [];

  const dayBookings = existingBookings.filter(
    (b) =>
      b.scheduledDate === dateStr &&
      !['cancelled', 'disputed'].includes(b.status)
  );

  const maxPerDay = workingHours?.maxBookingsPerDay || 6;
  if (dayBookings.length >= maxPerDay) return [];

  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const toHHMM = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const openMins = toMinutes(daySchedule.open || '08:00');
  const closeMins = toMinutes(daySchedule.close || '17:00');
  const breakStart = daySchedule.breakStart ? toMinutes(daySchedule.breakStart) : -1;
  const breakEnd = daySchedule.breakEnd ? toMinutes(daySchedule.breakEnd) : -1;

  const bookedTimes = new Set(dayBookings.map((b) => b.scheduledTime));
  const step = Math.max(60, Math.min(120, durationMins));
  const slots: string[] = [];

  for (let t = openMins; t + 60 <= closeMins; t += step) {
    if (breakStart >= 0 && breakEnd > breakStart && t >= breakStart && t < breakEnd) {
      continue;
    }
    const label = toHHMM(t);
    if (!bookedTimes.has(label)) {
      slots.push(label);
    }
  }
  return slots;
}

export function getBookingStatusLabel(status: string): string {
  const map: Record<string, string> = {
    requested: 'Requested',
    awaiting_quotation: 'Awaiting Quote',
    quotation_sent: 'Quote Sent',
    awaiting_customer_approval: 'Awaiting Approval',
    confirmed: 'Confirmed',
    provider_en_route: 'En Route',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    disputed: 'Disputed',
  };
  return map[status] || status;
}

export function getVerificationStatusLabel(status: string): string {
  const map: Record<string, string> = {
    not_submitted: 'Not Submitted',
    pending_review: 'Pending Review',
    approved: 'Verified',
    rejected: 'Rejected',
    additional_info_required: 'Info Requested',
    suspended: 'Suspended',
  };
  return map[status] || status;
}
