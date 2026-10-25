import { RESERVED_USERNAMES } from '@mesaaberta/core/profile/username';

export function indexingPolicy(
  url: { pathname: string; searchParams: Pick<URLSearchParams, 'get' | 'getAll'> },
  origin: string,
  options: { draft?: boolean; status?: number; maintenance?: boolean } = {},
) {
  const path = url.pathname;
  const profile = /^\/u\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(path);
  const publicProfile = profile && !RESERVED_USERNAMES.has(profile[1]);
  const publicPath =
    ['/', '/t', '/p', '/cf', '/changelog', '/privacy', '/terms'].includes(path) ||
    /^\/t\/(?!new$)[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path) ||
    publicProfile;
  if (!publicPath || (options.status ?? 200) >= 400 || options.maintenance)
    return { canonical: null, index: false };
  const canonical = new URL(path, origin);
  let index = !options.draft;
  const copy = (key: string, values: string[]) => {
    for (const value of [...new Set(values)].sort()) canonical.searchParams.append(key, value);
  };
  if (path === '/t') {
    for (const key of ['system', 'modality', 'platform', 'tag']) {
      const values = (
        key === 'modality' ? [url.searchParams.get(key) ?? ''] : url.searchParams.getAll(key)
      ).filter((value) =>
        key === 'modality'
          ? ['online', 'in_person'].includes(value)
          : value.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
      );
      copy(key, values);
    }
    if (canonical.search) index = false;
  }
  if (path === '/p' || path === '/cf') {
    const q = url.searchParams.get('q')?.trim();
    if (q) {
      canonical.searchParams.set('q', q.slice(0, 100));
      index = false;
    }
  }
  if (path === '/cf' && url.searchParams.get('status') === 'ended')
    canonical.searchParams.set('status', 'ended');
  if (path === '/cf' && ['newest', 'name'].includes(url.searchParams.get('sort') ?? '')) {
    canonical.searchParams.set('sort', url.searchParams.get('sort')!);
    index = false;
  }
  if (path === '/p' && url.searchParams.get('sort') === 'name') {
    canonical.searchParams.set('sort', 'name');
    index = false;
  }
  if (path === '/changelog') {
    const kind = url.searchParams.get('tipo');
    if (kind && ['new', 'improved', 'fixed'].includes(kind)) {
      canonical.searchParams.set('tipo', kind);
      index = false;
    }
  }
  const paginatedCrowdfunding = path === '/cf' && url.searchParams.get('status') === 'ended';
  if (publicProfile || path === '/p' || paginatedCrowdfunding || path === '/changelog') {
    const page = url.searchParams.get('page');
    if (
      page &&
      /^[1-9]\d{0,6}$/.test(page) &&
      Number.isSafeInteger(Number(page)) &&
      Number(page) > 1
    ) {
      canonical.searchParams.set('page', page);
      if (path === '/changelog') index = false;
    }
  }
  return { canonical: canonical.href, index };
}
