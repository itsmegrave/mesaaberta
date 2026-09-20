import { describe, expect, it } from 'vitest';
import { MAX_SLUG_LENGTH, nextFreeSlug, slugify } from './slug';

describe('slugify', () => {
	it.each([
		['Mesa do Dragão', 'mesa-do-dragao'],
		['Stalker 2ª Edição', 'stalker-2-edicao'],
		['Caçador: A Revanche', 'cacador-a-revanche'],
		['Sensōji TTRPG', 'sensoji-ttrpg'],
		['Mörk Borg', 'mork-borg'],
		['Dungeons & Dragons 5e (2014)', 'dungeons-e-dragons-5e-2014'],
		['Warhammer 40,000 Wrath & Glory', 'warhammer-40-000-wrath-e-glory'],
		['D&D', 'dd'],
		['3D&T Victory', '3dt-victory'],
		['Defensores de Tóquio (OD&T)', 'defensores-de-toquio-odt'],
		['+2d6', '2d6'],
		[':Otherscape', 'otherscape'],
		["Assassin's Creed RPG", 'assassins-creed-rpg'],
		['Troika!', 'troika'],
		['  espaços   demais  ', 'espacos-demais']
	])('turns %j into %j', (title, slug) => {
		expect(slugify(title)).toBe(slug);
	});

	it('falls back when nothing usable is left, such as an emoji-only title', () => {
		expect(slugify('🎲🎲')).toBe('item');
		expect(slugify('!!! ???')).toBe('item');
		expect(slugify('🎲', { fallback: 'mesa' })).toBe('mesa');
	});

	it('caps the length without leaving a trailing dash', () => {
		const long = `${'palavra '.repeat(20)}fim`;
		const slug = slugify(long);

		expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
		expect(slug.endsWith('-')).toBe(false);
		expect(slug.startsWith('palavra-palavra')).toBe(true);
	});

	it('leaves a slug unchanged when it is slugified again', () => {
		for (const title of ['Mesa do Dragão', 'D&D', '3D&T Victory']) {
			expect(slugify(slugify(title))).toBe(slugify(title));
		}
	});

	it('only ever produces lowercase letters, digits and single dashes', () => {
		for (const title of ['Ünï©ødé  &  ★ Spaß', 'a--b', '---x---', 'Ａｂｃ ＿ ｄｅｆ']) {
			expect(slugify(title)).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
		}
	});
});

describe('nextFreeSlug', () => {
	const takenSet = (...slugs: string[]) => {
		const taken = new Set(slugs);
		return (slug: string) => taken.has(slug);
	};

	it('keeps the base when it is free', () => {
		expect(nextFreeSlug('cairn', takenSet())).toBe('cairn');
	});

	it('appends -2, then -3, while the slug is taken', () => {
		expect(nextFreeSlug('cairn', takenSet('cairn'))).toBe('cairn-2');
		expect(nextFreeSlug('cairn', takenSet('cairn', 'cairn-2'))).toBe('cairn-3');
	});

	it('keeps the result within the length cap when the suffix has to fit', () => {
		const base = slugify('x '.repeat(40));
		const slug = nextFreeSlug(base, takenSet(base));

		expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
		expect(slug.endsWith('-2')).toBe(true);
		expect(slug).not.toContain('--');
	});
});
