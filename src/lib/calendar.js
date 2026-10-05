// "Add to calendar" for a guest who has confirmed: the phone itself reminds
// them two days before, the day before and six hours before, whatever happens
// to messages.
//
// Pure functions, used by the .ics endpoint (iPhone) and by the invitation
// page for Google Calendar's link (Android).

// Weddings are in Kuwait; times are written as Kuwait time.
const KUWAIT_OFFSET = "+03:00";
// No end time is recorded for a wedding; four hours covers the evening.
const DURATION_MS = 4 * 60 * 60 * 1000;

function toUtcStamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** { start, end } as Dates, or null when the wedding has no usable date. */
export function eventWindow(eventDate, eventTime) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate || "")) return null;
  const time = /^\d{2}:\d{2}$/.test(eventTime || "") ? eventTime : "20:00";
  const start = new Date(`${eventDate}T${time}:00${KUWAIT_OFFSET}`);
  if (Number.isNaN(start.getTime())) return null;
  return { start, end: new Date(start.getTime() + DURATION_MS) };
}

export function calendarTitle(coupleNames, lang) {
  return lang === "en" ? `Wedding of ${coupleNames}` : `حفل زفاف ${coupleNames}`;
}

export function googleCalendarUrl({ title, start, end, location, details }) {
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${toUtcStamp(start)}/${toUtcStamp(end)}`,
    location: location || "",
    details: details || "",
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

function icsEscape(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function icsFile({ uid, title, start, end, location, details, url, lang }) {
  const alarms = [
    ["-P2D", lang === "en" ? `In two days: ${title}` : `بعد يومين: ${title}`],
    ["-P1D", lang === "en" ? `Tomorrow: ${title}` : `بكرة: ${title}`],
    ["-PT6H", lang === "en" ? `In 6 hours: ${title}` : `بعد ٦ ساعات: ${title}`],
  ];
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Da3wa//Invitation//AR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}@da3wa.digital`,
    `DTSTAMP:${toUtcStamp(new Date())}`,
    `DTSTART:${toUtcStamp(start)}`,
    `DTEND:${toUtcStamp(end)}`,
    `SUMMARY:${icsEscape(title)}`,
    `LOCATION:${icsEscape(location)}`,
    `DESCRIPTION:${icsEscape(details)}`,
    url ? `URL:${url}` : null,
    ...alarms.flatMap(([trigger, text]) => [
      "BEGIN:VALARM",
      `TRIGGER:${trigger}`,
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsEscape(text)}`,
      "END:VALARM",
    ]),
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}
