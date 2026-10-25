import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import DateTimeField from './DateTimeField.svelte';
import SeatSlider from './SeatSlider.svelte';

// Until JavaScript runs, the date picker and the seat slider are native fields, so the form still
// posts what they hold.
describe('the pickers before JavaScript', () => {
  it('sends a native date field with its value, limits and description', () => {
    const { body } = render(DateTimeField, {
      props: {
        id: 'until',
        name: 'until',
        label: 'Até',
        value: '2026-11-01',
        min: '2026-10-25',
        invalid: true,
        describedby: 'until-error',
      },
    });

    expect(body).toMatch(/<input[^>]*type="date"/);
    expect(body).toContain('name="until"');
    expect(body).toContain('value="2026-11-01"');
    expect(body).toContain('min="2026-10-25"');
    expect(body).toContain('aria-invalid="true"');
    expect(body).toContain('aria-describedby="until-error"');
  });

  it('sends a native number field for the seats', () => {
    const { body } = render(SeatSlider, {
      props: { id: 'capacity', name: 'capacity', label: 'Vagas', value: 5, min: 1, max: 12 },
    });

    expect(body).toMatch(/<input[^>]*type="number"/);
    expect(body).toContain('name="capacity"');
    expect(body).toContain('value="5"');
    expect(body).toContain('max="12"');
    expect(body).toMatch(/<input[^>]*required/);
  });
});
