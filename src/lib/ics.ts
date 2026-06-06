/**
 * Génère une invitation agenda .ics (RFC 5545) — pièce jointe de l'email de RDV.
 * Dates en UTC (suffixe Z) : compatible Google Agenda, Apple Calendrier, Outlook.
 * Aucune dépendance.
 */
import { SITE } from './site';

function pad(n: number): string { return String(n).padStart(2, '0'); }

/** Date → format iCalendar UTC : YYYYMMDDTHHMMSSZ */
function toIcsUtc(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

/** Échappe les caractères spéciaux iCalendar (virgule, point-virgule, antislash, retours ligne). */
function esc(s: string): string {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Replie les lignes > 75 octets (RFC 5545 : continuation par espace en début de ligne). */
function fold(line: string): string {
  if (line.length <= 73) return line;
  const out: string[] = [];
  let s = line;
  while (s.length > 73) { out.push(s.slice(0, 73)); s = ' ' + s.slice(73); }
  out.push(s);
  return out.join('\r\n');
}

export interface IcsInput {
  summary: string;
  start: Date;
  durationMin?: number; // défaut 60
  location?: string;
  description?: string;
  uid?: string;
}

export function buildIcs(input: IcsInput): string {
  const durationMin = input.durationMin && input.durationMin > 0 ? input.durationMin : 60;
  const end = new Date(input.start.getTime() + durationMin * 60_000);
  const uid = input.uid || `${toIcsUtc(input.start)}-${Math.random().toString(36).slice(2, 10)}@soloris.fr`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Soloris//RDV//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(input.start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${esc(input.summary)}`,
    input.location ? `LOCATION:${esc(input.location)}` : '',
    `DESCRIPTION:${esc(input.description || `Rendez-vous Soloris. Une question ? ${SITE.phoneDisplay}.`)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).map(fold);

  return lines.join('\r\n') + '\r\n';
}
