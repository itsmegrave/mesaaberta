import { describe, expect, it, vi } from 'vitest';
import type { Post } from '#lib/blog.js';
import { blogFeed } from './blog-feed';
import { renderPost, visiblePosts } from './blog';

const origin = 'https://mesaaberta.example';
const post = (slug: string, extra: Partial<Post> = {}): Post => ({
  slug,
  title: `Post ${slug} & cia`,
  date: '2026-10-20',
  summary: 'Resumo <curto>.',
  author: 'ana',
  tags: ['dicas'],
  draft: false,
  minutes: 1,
  body: 'Texto.',
  ...extra,
});

describe('blog rendering', () => {
  it('keeps the page title the only h1 and site links working', () => {
    const html = renderPost(
      '# Um\n\n### Dois\n\n#### Três\n\n[Mesas](/t) e [fora](https://x.example)',
      origin,
    );
    expect(html).toContain('<h2>Um</h2>');
    expect(html).toContain('<h3>Dois</h3>');
    expect(html).toContain('<h3>Três</h3>');
    expect(html).not.toContain('<h1');
    expect(html).toContain(`href="${origin}/t"`);
    expect(html).toContain('href="https://x.example"');
  });

  it('drops anything outside the rich-text subset, so a post cannot run code', () => {
    const html = renderPost(
      '<script>alert(1)</script>\n\n![img](https://x.example/a.png)\n\n[x](javascript:alert(1))',
      origin,
    );
    expect(html).not.toMatch(/<script|<img|javascript:/);
  });
});

describe('who sees which posts', () => {
  const posts = [post('out'), post('draft', { draft: true })];
  const locals = (role: string | null) =>
    ({
      getProfile: vi.fn(async () => (role ? { id: 'p', role, status: 'active' } : null)),
    }) as unknown as App.Locals;

  it('shows drafts to admins only', async () => {
    expect((await visiblePosts(locals(null), posts)).posts.map((p) => p.slug)).toEqual(['out']);
    expect((await visiblePosts(locals('user'), posts)).posts.map((p) => p.slug)).toEqual(['out']);
    const admin = await visiblePosts(locals('admin'), posts);
    expect(admin).toMatchObject({ admin: true });
    expect(admin.posts.map((p) => p.slug)).toEqual(['out', 'draft']);
  });
});

describe('blog feed', () => {
  it('lists published posts with escaped text and absolute links', () => {
    const xml = blogFeed(
      origin,
      [post('future', { date: '2027-01-01' }), post('a'), post('b', { draft: true })],
      '2026-10-26',
    );
    expect(xml).toContain(`<link>${origin}/blog/a</link>`);
    expect(xml).toContain('<title>Post a &amp; cia</title>');
    expect(xml).toContain('<description>Resumo &lt;curto&gt;.</description>');
    expect(xml).not.toContain('/blog/b<');
    expect(xml).not.toContain('/blog/future');
  });
});
