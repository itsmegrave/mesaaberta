import { describe, expect, it } from 'vitest';
import { createSchema, mergeSchema } from '$lib/admin/catalog';
import { z } from 'zod';
import { validateFormData, validateStringForm } from './contract';

const fields = ['kind', 'name', 'id', 'into'];
const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [field, value] of Object.entries(values)) data.set(field, value);
  return data;
};

describe('scalar action contract', () => {
  it('normalizes valid values and omits unknown sensitive fields', () => {
    const result = validateStringForm(
      form({ kind: 'tag', name: ' Terror ', password: 'secret' }),
      createSchema,
      fields,
    );
    expect(result).toEqual({ valid: true, data: { kind: 'tag', name: 'Terror' }, errors: {} });
  });
  it('preserves the entered value and the schema error code on failure', () => {
    const result = validateStringForm(form({ kind: 'tag', name: ' a ' }), createSchema, fields);
    expect(result.valid).toBe(false);
    expect(result.data.name).toBe(' a ');
    expect(result.errors.name).toEqual(['too_small']);
  });
  it('refuses repeated scalar keys instead of choosing an ambiguous value', () => {
    const data = form({ kind: 'tag', name: 'Terror' });
    data.append('kind', 'platform');
    const result = validateStringForm(data, createSchema, fields);
    expect(result.valid).toBe(false);
    expect(result.errors.kind).toEqual(['invalid']);
  });
  it('never echoes uploaded files, even on a validation failure', () => {
    const data = form({ kind: 'tag' });
    data.set('name', new File(['private'], 'private.txt'));
    const result = validateStringForm(data, createSchema, fields);
    expect(result.valid).toBe(false);
    expect(result.errors.name).toEqual(['invalid']);
    expect(result.data).not.toHaveProperty('name');
  });
  it('retains cross-field error paths', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    const result = validateStringForm(form({ kind: 'tag', id, into: id }), mergeSchema, fields);
    expect(result.errors.into).toEqual(['same']);
  });
});

describe('compound native POST decoding', () => {
  const schema = z.object({
    tags: z.array(z.string()),
    enabled: z.boolean(),
    image: z.instanceof(File).optional(),
  });
  const defaults = { tags: [], enabled: false, image: undefined };
  const options = { arrays: ['tags'], booleans: ['enabled'], files: ['image'] };
  it('keeps repeated values in order and accepts an unchecked checkbox and empty upload', () => {
    const data = new FormData();
    data.append('tags', 'first');
    data.append('tags', 'second');
    data.append('image', new File([], ''));
    data.append('secret', 'unlisted');
    expect(validateFormData(data, schema, defaults, options)).toEqual({
      valid: true,
      data: { tags: ['first', 'second'], enabled: false, image: undefined },
      errors: {},
    });
  });
  it('rejects ambiguous flags while retaining a genuine upload for validation', () => {
    const data = new FormData();
    const image = new File(['bytes'], 'image.png');
    data.append('enabled', 'true');
    data.append('enabled', 'false');
    data.append('image', image);
    const result = validateFormData(data, schema, defaults, options);
    expect(result.valid).toBe(false);
    expect(result.errors.enabled).toEqual(['invalid']);
    expect(result.data.image).toEqual(image);
  });
});
