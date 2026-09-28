import { describe, expect, it } from 'vitest';
import { tableFormSchema, toTableInput } from './schema';

const parseTableForm = (data: FormData) => {
  const parsed = tableFormSchema.safeParse(Object.fromEntries(data));
  if (parsed.success) return { ok: true as const, data: toTableInput(parsed.data) };

  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
  return { ok: false as const, errors };
};

const valid = {
  systemSlug: 'daggerheart',
  title: 'Mesa do Dragão',
  description: 'Uma noite só.',
  extraInfo: '',
  kind: 'one_shot',
  capacity: '5',
  startsAtLocal: '2026-10-10T19:00',
  timezone: 'America/Sao_Paulo',
  durationMinutes: '240',
  repeat: '',
  until: '',
  joinMode: 'auto',
};

const form = (over: Record<string, string> = {}) => {
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...valid, ...over })) data.set(key, value);
  return data;
};

const errorsOf = (over: Record<string, string>) => {
  const result = parseTableForm(form(over));
  if (result.ok) throw new Error('expected the form to be refused');
  return result.errors;
};

describe('parseTableForm', () => {
  it('accepts a one-shot and turns the text fields into typed values', () => {
    const result = parseTableForm(form());

    expect(result).toEqual({
      ok: true,
      data: {
        systemSlug: 'daggerheart',
        title: 'Mesa do Dragão',
        description: 'Uma noite só.',
        extraInfo: null,
        kind: 'one_shot',
        capacity: 5,
        startsAtLocal: '2026-10-10T19:00',
        timezone: 'America/Sao_Paulo',
        durationMinutes: 240,
        recurrence: null,
        untilLocalDate: null,
        welcomeMessage: null,
        joinMode: 'auto',
        modality: 'online',
        locationArea: null,
        joinDetails: null,
        postalCode: null,
        locationNeighbourhood: null,
        locationCity: null,
        locationState: null,
        platforms: [],
        tags: [],
      },
    });
  });

  it('trims text, and an empty extra info becomes null', () => {
    const result = parseTableForm(form({ title: '  Mesa  ', extraInfo: '   ' }));

    expect(result.ok && result.data).toMatchObject({ title: 'Mesa', extraInfo: null });
  });

  describe('recurrence', () => {
    it.each([
      ['weekly', 'FREQ=WEEKLY'],
      ['biweekly', 'FREQ=WEEKLY;INTERVAL=2'],
    ])('a %s campaign becomes the rule %s', (repeat, rule) => {
      const result = parseTableForm(form({ kind: 'campaign', repeat }));

      expect(result.ok && result.data.recurrence).toBe(rule);
    });

    it('is required for a campaign, as the database insists', () => {
      expect(errorsOf({ kind: 'campaign', repeat: '' })).toHaveProperty('repeat');
    });

    it('is ignored for a one-shot, whatever the form still carries', () => {
      const result = parseTableForm(
        form({ kind: 'one_shot', repeat: 'weekly', until: '2026-12-01' }),
      );

      expect(result.ok && result.data).toMatchObject({ recurrence: null, untilLocalDate: null });
    });

    it('refuses a repeat it does not offer', () => {
      expect(errorsOf({ kind: 'campaign', repeat: 'daily' })).toHaveProperty('repeat');
    });
  });

  describe('end date', () => {
    it('is optional for a campaign, and kept when given', () => {
      const result = parseTableForm(
        form({ kind: 'campaign', repeat: 'weekly', until: '2026-12-01' }),
      );

      expect(result.ok && result.data.untilLocalDate).toBe('2026-12-01');
    });

    it('cannot come before the first session', () => {
      expect(errorsOf({ kind: 'campaign', repeat: 'weekly', until: '2026-10-09' })).toHaveProperty(
        'until',
      );
    });
  });

  it.each([
    ['title', { title: 'ab' }],
    ['title', { title: 'x'.repeat(81) }],
    ['title', { title: '   ' }],
    ['description', { description: 'x'.repeat(4001) }],
    ['extraInfo', { extraInfo: 'x'.repeat(2001) }],
    ['kind', { kind: 'epic' }],
    ['capacity', { capacity: '0' }],
    ['capacity', { capacity: '31' }],
    ['capacity', { capacity: '2.5' }],
    ['capacity', { capacity: 'muitas' }],
    ['durationMinutes', { durationMinutes: '5' }],
    ['durationMinutes', { durationMinutes: '1441' }],
    ['startsAtLocal', { startsAtLocal: 'amanhã' }],
    ['startsAtLocal', { startsAtLocal: '2026-13-40T99:99' }],
    ['timezone', { timezone: 'Mars/Olympus' }],
    ['systemSlug', { systemSlug: '' }],
    ['joinMode', { joinMode: 'lottery' }],
  ])('refuses a bad %s: %j', (field, over) => {
    expect(errorsOf(over)).toHaveProperty(field);
  });

  it('reports every problem at once, so the form can mark them all', () => {
    expect(Object.keys(errorsOf({ title: '', capacity: '0', timezone: 'x' })).sort()).toEqual([
      'capacity',
      'timezone',
      'title',
    ]);
  });

  describe('modality', () => {
    it('is online when the form does not say, and keeps the private join details', () => {
      const data = form({ joinDetails: '  https://discord.gg/abc  ' });

      const result = parseTableForm(data);
      expect(result.ok && result.data).toMatchObject({
        modality: 'online',
        locationArea: null,
        joinDetails: 'https://discord.gg/abc',
      });
    });

    it('needs the neighbourhood and city for an in-person table', () => {
      expect(parseTableForm(form({ modality: 'in_person', locationArea: ' ' }))).toMatchObject({
        ok: false,
        errors: { locationArea: 'required' },
      });

      const result = parseTableForm(
        form({ modality: 'in_person', locationArea: 'Boa Viagem, Recife' }),
      );
      expect(result.ok && result.data).toMatchObject({
        modality: 'in_person',
        locationArea: 'Boa Viagem, Recife',
      });
    });

    it('drops a location left in the form when the table is online', () => {
      const result = parseTableForm(form({ modality: 'online', locationArea: 'Recife' }));
      expect(result.ok && result.data.locationArea).toBeNull();
    });

    it('takes a CEP in any punctuation, and it stands in for the area', () => {
      const result = parseTableForm(form({ modality: 'in_person', postalCode: '52011-000' }));
      expect(result.ok && result.data).toMatchObject({
        postalCode: '52011000',
        locationArea: null,
      });
    });

    it('refuses a CEP that is not 8 digits, and ignores one on an online table', () => {
      expect(parseTableForm(form({ modality: 'in_person', postalCode: '5201' }))).toMatchObject({
        ok: false,
        errors: { postalCode: 'invalid' },
      });
      const online = parseTableForm(form({ modality: 'online', postalCode: '52011-000' }));
      expect(online.ok && online.data.postalCode).toBeNull();
    });

    it('refuses a modality it does not offer', () => {
      expect(parseTableForm(form({ modality: 'hybrid' }))).toMatchObject({
        ok: false,
        errors: { modality: expect.any(String) },
      });
    });
  });

  it('defaults the join mode to auto when the form does not send it', () => {
    const data = form();
    data.delete('joinMode');

    const result = parseTableForm(data);
    expect(result.ok && result.data.joinMode).toBe('auto');
  });

  it('does not let unknown fields through', () => {
    const data = form();
    data.set('gmId', '00000000-0000-4000-8000-000000000001');
    data.set('status', 'disabled');
    data.set('slug', 'chosen-by-the-attacker');

    const result = parseTableForm(data);
    expect(result.ok && Object.keys(result.data)).not.toEqual(
      expect.arrayContaining(['gmId', 'status', 'slug']),
    );
  });
});
