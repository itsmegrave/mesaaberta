import { describe, expect, it } from 'vitest';
import type { FormErrors } from './contract';
import { fieldErrors, problem } from './field-errors';
import type { FormMessage } from './message';

const text = (code: string, field: string) => `${field}: ${code}`;
const form = (errors: FormErrors, message?: FormMessage) => ({ errors, message });

describe('fieldErrors', () => {
  it('says the first error of a field, and nothing for a field without one', () => {
    const errors = fieldErrors(form({ title: ['too_small', 'too_big'] }), text);
    expect(errors.err('title')).toBe('title: too_small');
    expect(errors.err('name')).toBeUndefined();
  });

  it('reads the errors when asked, so a later failure shows', () => {
    const source = form({});
    const errors = fieldErrors(source, text);
    expect(errors.err('title')).toBeUndefined();
    source.errors = { title: ['required'] };
    expect(errors.err('title')).toBe('title: required');
  });

  it('can read the controller through a getter, for a controller passed as a prop', () => {
    let current = form({ title: ['required'] });
    const errors = fieldErrors(() => current, text);
    expect(errors.err('title')).toBe('title: required');
    current = form({});
    expect(errors.err('title')).toBeUndefined();
  });

  it("reads a list field's errors under `_errors`", () => {
    const errors = fieldErrors(form({ tags: { _errors: ['too_many'] } as never }), text);
    expect(errors.err('tags')).toBe('tags: too_many');
    expect(errors.invalid('tags')).toBe('true');
  });

  it('marks only the invalid fields', () => {
    const errors = fieldErrors(form({ title: ['required'] }), text);
    expect(errors.invalid('title')).toBe('true');
    expect(errors.invalid('name')).toBeUndefined();
  });

  it("takes the form message for the field it names, but the field's own error first", () => {
    const named = fieldErrors(form({}, { code: 'too_big', field: 'image' }), text);
    expect(named.withMessage('image')).toBe('image: too_big');
    expect(named.withMessage('logo')).toBeUndefined();
    expect(named.withMessage('image', (code) => `upload ${code}`)).toBe('upload too_big');

    const own = fieldErrors(form({ image: ['empty'] }, { code: 'too_big', field: 'image' }), text);
    expect(own.withMessage('image')).toBe('image: empty');
  });

  it('lists the invalid fields in the order given, by control id, then the extra problems', () => {
    const errors = fieldErrors(form({ ageRange: ['invalid'], name: ['too_long'] }), text);
    expect(
      errors.summary(
        [
          ['name', 'Nome'],
          ['city', 'Cidade'],
          ['ageRange', 'Faixa etária', 'age-range'],
        ],
        problem('image', 'Imagem', 'Grande demais.'),
        problem('logo', 'Logo', undefined),
      ),
    ).toEqual([
      { id: 'name', label: 'Nome', message: 'name: too_long' },
      { id: 'age-range', label: 'Faixa etária', message: 'ageRange: invalid' },
      { id: 'image', label: 'Imagem', message: 'Grande demais.' },
    ]);
  });

  it('leaves out a field whose code has no sentence', () => {
    const errors = fieldErrors(form({ title: ['odd'] }), () => undefined);
    expect(errors.summary([['title', 'Título']])).toEqual([]);
  });
});
