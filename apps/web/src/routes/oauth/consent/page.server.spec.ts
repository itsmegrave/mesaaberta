import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { actions, load } from './+page.server';

const ID = 'auth-123';
const profile = {
  id: '00000000-0000-4000-8000-0000000000aa',
  username: 'grave',
  status: 'active',
  role: 'admin',
};

type Oauth = {
  getAuthorizationDetails: ReturnType<typeof vi.fn>;
  approveAuthorization: ReturnType<typeof vi.fn>;
  denyAuthorization: ReturnType<typeof vi.fn>;
};

function setup({
  signedIn = true,
  mcpOn = true,
  role = 'admin',
  details = {
    data: {
      authorization_id: ID,
      redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
      client: { id: 'c', name: 'Claude', uri: '', logo_uri: '' },
      user: { id: profile.id, email: 'g@example.com' },
      scope: '',
    },
    error: null,
  } as unknown,
  decision = {
    data: { redirect_url: 'https://claude.ai/api/mcp/auth_callback?code=xyz' },
    error: null,
  } as unknown,
} = {}) {
  const oauth: Oauth = {
    getAuthorizationDetails: vi.fn(async () => details),
    approveAuthorization: vi.fn(async () => decision),
    denyAuthorization: vi.fn(async () => decision),
  };
  const isEnabled = vi.fn(async (name: string) => name === 'use_mcp' && mcpOn);
  const locals = {
    supabase: { auth: { oauth } },
    getUser: async () => (signedIn ? { id: profile.id } : null),
    getProfile: async () => (signedIn ? { ...profile, role } : null),
    flags: { isEnabled },
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
  };
  const event = (search = `?authorization_id=${ID}`, fields?: Record<string, string>) => {
    const url = new URL(`https://mesaaberta.app/oauth/consent${search}`);
    const body = new FormData();
    for (const [key, value] of Object.entries(fields ?? {})) body.set(key, value);
    return {
      locals,
      url,
      setHeaders: vi.fn(),
      request: new Request(url, { method: 'POST', body }),
    } as unknown as RequestEvent;
  };
  return { oauth, isEnabled, event };
}

const read = (event: RequestEvent) => (load as (e: RequestEvent) => Promise<unknown>)(event);
const act = (name: 'approve' | 'deny', event: RequestEvent) =>
  (actions as Record<string, (e: RequestEvent) => Promise<unknown>>)[name](event);

describe('the OAuth consent page', () => {
  it('sends a visitor to sign in first and back here after', async () => {
    const { event } = setup({ signedIn: false });
    await expect(read(event())).rejects.toMatchObject({
      status: 303,
      location: `/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${ID}`)}`,
    });
  });

  it('is a 404 while use_mcp is off for the person, and asks Supabase nothing', async () => {
    const { event, oauth, isEnabled } = setup({ mcpOn: false });
    await expect(read(event())).rejects.toMatchObject({ status: 404 });
    expect(isEnabled).toHaveBeenCalledWith('use_mcp', { id: profile.id, isAdmin: true });
    expect(oauth.getAuthorizationDetails).not.toHaveBeenCalled();
  });

  it('is a 404 for anyone who is not an admin, even with use_mcp on', async () => {
    const { event, oauth, isEnabled } = setup({ role: 'member' });
    await expect(read(event())).rejects.toMatchObject({ status: 404 });
    expect(isEnabled).not.toHaveBeenCalled();
    expect(oauth.getAuthorizationDetails).not.toHaveBeenCalled();
  });

  it('refuses a non-admin decision, even with a request id', async () => {
    const { event, oauth } = setup({ role: 'member' });
    await expect(act('approve', event('', { authorizationId: ID }))).rejects.toMatchObject({
      status: 404,
    });
    expect(oauth.approveAuthorization).not.toHaveBeenCalled();
  });

  it('names the client, the account and only the host it returns to', async () => {
    const { event } = setup();
    expect(await read(event())).toMatchObject({
      request: { client: 'Claude', returnsTo: 'claude.ai', username: 'grave' },
      form: { data: { authorizationId: ID } },
    });
  });

  it('sends the person straight back when they already approved this client', async () => {
    const { event } = setup({
      details: { data: { redirect_url: 'https://claude.ai/cb?code=1' }, error: null },
    });
    await expect(read(event())).rejects.toMatchObject({
      status: 303,
      location: 'https://claude.ai/cb?code=1',
    });
  });

  it('says the request no longer holds when Supabase does not know it', async () => {
    const { event } = setup({ details: { data: null, error: new Error('not found') } });
    expect(await read(event())).toEqual({ request: null });
  });

  it('approves the request it was given and hands the person back to the client', async () => {
    const { event, oauth } = setup();
    await expect(act('approve', event('', { authorizationId: ID }))).rejects.toMatchObject({
      status: 303,
      location: 'https://claude.ai/api/mcp/auth_callback?code=xyz',
    });
    expect(oauth.approveAuthorization).toHaveBeenCalledWith(ID, { skipBrowserRedirect: true });
    expect(oauth.denyAuthorization).not.toHaveBeenCalled();
  });

  it('denies without approving anything', async () => {
    const { event, oauth } = setup();
    await expect(act('deny', event('', { authorizationId: ID }))).rejects.toMatchObject({
      status: 303,
    });
    expect(oauth.denyAuthorization).toHaveBeenCalledWith(ID, { skipBrowserRedirect: true });
    expect(oauth.approveAuthorization).not.toHaveBeenCalled();
  });

  it('refuses a decision while use_mcp is off, even with a request id', async () => {
    const { event, oauth } = setup({ mcpOn: false });
    await expect(act('approve', event('', { authorizationId: ID }))).rejects.toMatchObject({
      status: 404,
    });
    expect(oauth.approveAuthorization).not.toHaveBeenCalled();
  });

  it('answers an expired request as a form message, never a redirect', async () => {
    const { event } = setup({ decision: { data: null, error: new Error('expired') } });
    expect(await act('approve', event('', { authorizationId: ID }))).toMatchObject({
      status: 400,
      data: { form: { message: { code: 'expired' } } },
    });
  });
});
