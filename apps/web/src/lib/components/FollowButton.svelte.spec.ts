import '../../routes/layout.css';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import FollowButton from './FollowButton.svelte';

const profileId = '00000000-0000-4000-8000-000000000002';

describe('FollowButton', () => {
  it('is "Seguir", not pressed, and posts follow=true', async () => {
    render(FollowButton, { profileId, username: 'rafa', following: false });

    const button = page.getByRole('button', { name: 'Seguir @rafa' });
    await expect.element(button).toHaveAttribute('aria-pressed', 'false');
    await expect.element(button).toHaveTextContent('Seguir');
    const form = button.element().closest('form')!;
    expect(new FormData(form).get('follow')).toBe('true');
    expect(new FormData(form).get('profileId')).toBe(profileId);
  });

  it('is "Seguindo" and pressed while following, and its name says a press stops it', async () => {
    render(FollowButton, { profileId, username: 'rafa', following: true });

    const button = page.getByRole('button', { name: 'Seguindo @rafa. Deixar de seguir' });
    await expect.element(button).toHaveAttribute('aria-pressed', 'true');
    expect(new FormData(button.element().closest('form')!).get('follow')).toBe('false');
  });

  it('sends a visitor to Entrar and back', async () => {
    render(FollowButton, { profileId, username: 'rafa', following: false, signedIn: false });

    const link = page.getByRole('link', { name: 'Seguir @rafa' });
    await expect.element(link).toHaveAttribute('href', expect.stringMatching(/^\/login\?next=/));
  });
});
