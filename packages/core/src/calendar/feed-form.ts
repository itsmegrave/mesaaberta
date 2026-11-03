import { z } from 'zod';

/** "Criar link" / "Gerar novo link" (`true`: a new secret) and "Desligar" (`false`). */
export const calendarFeedSchema = z.object({ on: z.enum(['true', 'false']) });

/** The feed's addresses for a secret: the page (`https:`) and the calendar apps' (`webcal:`). */
export function calendarFeedUrls(origin: string, token: string) {
  const https = `${origin}/calendar/${token}.ics`;
  const webcal = https.replace(/^https?:/, 'webcal:');
  return {
    https,
    webcal,
    // Google Agenda adds a subscription from this link (it takes the webcal address).
    google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
  };
}
