import { describe, expect, it } from 'vitest';
import { syncBrowserTimezone } from './browser-timezone';

const fakeDocument = (protocol = 'https:') => ({ cookie: '', location: { protocol } });

describe('syncBrowserTimezone', () => {
	it("stores the browser's zone and asks for a reload when the page used another", () => {
		const doc = fakeDocument();

		const reload = syncBrowserTimezone(
			{ timezone: 'America/Sao_Paulo', source: 'default' },
			'Europe/Lisbon',
			doc
		);

		expect(reload).toBe(true);
		expect(doc.cookie).toBe('tz=Europe%2FLisbon; path=/; max-age=31536000; samesite=lax; secure');
	});

	it('does not reload when the page already used that zone', () => {
		const doc = fakeDocument('http:');

		expect(
			syncBrowserTimezone({ timezone: 'Europe/Lisbon', source: 'browser' }, 'Europe/Lisbon', doc)
		).toBe(false);
		expect(doc.cookie).not.toContain('secure');
	});

	it("leaves the zone on the profile alone, and ignores a zone it doesn't know", () => {
		const doc = fakeDocument();

		expect(
			syncBrowserTimezone({ timezone: 'Asia/Tokyo', source: 'profile' }, 'Europe/Lisbon', doc)
		).toBe(false);
		expect(
			syncBrowserTimezone({ timezone: 'America/Sao_Paulo', source: 'default' }, 'Nowhere', doc)
		).toBe(false);
		expect(doc.cookie).toBe('');
	});
});
