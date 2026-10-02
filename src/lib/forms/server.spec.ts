import { describe, expect, it } from 'vitest';
import { initialForm, issueErrors } from './contract';
import { z } from 'zod';
import '$lib/forms/zod-codes';
import { refuse, responseForm, withoutSecrets } from './server';

const schema = z.object({ email: z.string().min(3), password: z.string().min(8) });
const validated = (values: { email: string; password: string }) => {
  const result = schema.safeParse(values);
  return {
    ...initialForm(values),
    valid: result.success,
    errors: result.success ? {} : issueErrors(result.error.issues),
  };
};
const filled = () => validated({ email: 'ana@example.com', password: 'a-long-password' });

describe('zod codes', () => {
  it('reports the code of the rule that failed, not English text', async () => {
    const form = validated({ email: 'a', password: 'b' });

    expect(form.valid).toBe(false);
    expect(form.errors.email).toEqual(['too_small']);
    expect(form.errors.password).toEqual(['too_small']);
  });
});

describe('withoutSecrets', () => {
  it('empties the named fields and leaves the rest', async () => {
    const form = withoutSecrets(await filled(), ['password']);

    expect(form.data).toEqual({ email: 'ana@example.com', password: '' });
  });
});

describe('refuse', () => {
  it('puts the code on the field it names, when the form has that field', async () => {
    const result = refuse(await filled(), 400, 'invalid', 'email');

    expect(result).toMatchObject({
      status: 400,
      data: { form: { errors: { email: ['invalid'] } } },
    });
  });

  it('puts the code in the form message when the field is not in the schema, or none is named', async () => {
    const image = refuse(await filled(), 400, 'not_an_image', 'image');
    const plain = refuse(await filled(), 429, 'rate_limited');
    const prototype = refuse(await filled(), 400, 'invalid_field', '__proto__');

    expect(image).toMatchObject({
      status: 400,
      data: { form: { message: { code: 'not_an_image', field: 'image' } } },
    });
    expect(plain).toMatchObject({
      status: 429,
      data: { form: { message: { code: 'rate_limited' } } },
    });
    expect(prototype).toMatchObject({
      status: 400,
      data: { form: { message: { code: 'invalid_field', field: '__proto__' } } },
    });
  });
});

it('removes file bytes from validation failures before action serialization', () => {
  const result = responseForm({
    valid: false,
    data: { title: 'Draft', image: new File(['private bytes'], 'photo.png') },
    errors: { image: ['too_big'] },
  });
  expect(result.data).toEqual({ title: 'Draft' });
  expect(result.errors.image).toEqual(['too_big']);
});
