export function tableFilters(params: URLSearchParams) {
  const raw = params.get('status');
  const status: 'all' | 'active' | 'disabled' =
    raw === 'active' || raw === 'disabled' ? raw : 'all';
  const page = params.get('page') ?? '1';
  const size = Number(params.get('size') ?? 20);
  return {
    status,
    query: (params.get('q') ?? '').trim().slice(0, 100),
    page: /^\d+$/.test(page) ? Math.min(1000000, Math.max(1, Number(page))) : 1,
    pageSize: [20, 50, 100].includes(size) ? size : 20,
  };
}
