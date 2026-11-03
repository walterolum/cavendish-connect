/** Time zone used in chat messages and emails. Set APP_TIMEZONE per deployment. */
const TIME_ZONE = process.env.APP_TIMEZONE || 'Africa/Kampala';

/** Plain-text date and time, e.g. "Tue 12 Nov 2026, 14:30". */
export function formatPlain(d: Date) {
  return d.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  });
}
