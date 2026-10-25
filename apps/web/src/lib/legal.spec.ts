import { describe, expect, it } from 'vitest';
import { controllerOf } from './legal';

describe('controllerOf', () => {
  it('names the controller and the address from the deployment', () => {
    expect(
      controllerOf({ PRIVACY_CONTROLLER_NAME: 'Coletivo de jogos', PRIVACY_EMAIL: 'dados@x.org' }),
    ).toEqual({ name: 'Coletivo de jogos', email: 'dados@x.org' });
  });

  it('is empty, never "undefined" in the text, before the settings load', () => {
    expect(controllerOf(undefined)).toEqual({ name: '', email: '' });
  });
});
