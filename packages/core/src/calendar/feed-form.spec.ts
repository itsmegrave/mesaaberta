import { describe, expect, it } from 'vitest';
import { calendarFeedSchema, calendarFeedUrls } from './feed-form';

describe('calendar feed form', () => {
  it('takes on as the strings true or false only', () => {
    expect(calendarFeedSchema.safeParse({ on: 'true' }).success).toBe(true);
    expect(calendarFeedSchema.safeParse({ on: 'false' }).success).toBe(true);
    expect(calendarFeedSchema.safeParse({ on: 'yes' }).success).toBe(false);
  });

  it('builds the https, webcal and Google addresses from the origin', () => {
    const token = 'a'.repeat(43);
    const urls = calendarFeedUrls('https://mesaaberta.app', token);
    expect(urls.https).toBe(`https://mesaaberta.app/calendar/${token}.ics`);
    expect(urls.webcal).toBe(`webcal://mesaaberta.app/calendar/${token}.ics`);
    expect(urls.google).toBe(
      `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(urls.webcal)}`,
    );
  });
});
