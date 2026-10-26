import { describe, expect, it } from 'vitest';
import { PAGE_SIZE, blogHref, isPublished, loadPosts, parsePost, postPage } from './blog';

const files = import.meta.glob<string>('../content/blog/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const post = (fields: string, body = 'Texto do post.') => `---\n${fields}\n---\n\n${body}\n`;
const valid = [
  'title: "Mesa nova: e agora?"',
  'date: 2026-10-26',
  'summary: Dicas para a primeira sessão.',
  'author: ana',
  'tags: [dicas, "primeira sessão"]',
].join('\n');

describe('blog posts', () => {
  it('reads every post in the repository, so a broken file fails here and not in production', () => {
    expect(() => loadPosts(files)).not.toThrow();
  });

  it('takes the address from the file name and the fields from the frontmatter', () => {
    const result = parsePost('src/content/blog/mesa-nova.md', post(valid));
    expect(result).toMatchObject({
      slug: 'mesa-nova',
      title: 'Mesa nova: e agora?',
      date: '2026-10-26',
      author: 'ana',
      tags: ['dicas', 'primeira sessão'],
      draft: false,
      minutes: 1,
      body: 'Texto do post.',
    });
  });

  it('names the file and the field when a post is broken', () => {
    const broken: [string, string, RegExp][] = [
      ['Mesa_Nova.md', post(valid), /Mesa_Nova\.md.*file name/],
      ['a.md', 'sem frontmatter', /a\.md.*frontmatter/],
      ['a.md', post(valid.replace('2026-10-26', '2026-02-30')), /date/],
      ['a.md', post(valid.replace('author: ana', 'author: "@Ana"')), /author/],
      ['a.md', post(`${valid}\nlayout: wide`), /layout/],
      ['a.md', post(`${valid}\ntitle: outro`), /repeats "title"/],
      ['a.md', post(valid, ''), /no text/],
    ];
    for (const [path, source, message] of broken)
      expect(() => parsePost(path, source)).toThrow(message);
  });

  it('lists the newest first and hides drafts and posts whose day has not come', () => {
    const posts = loadPosts({
      'old.md': post(valid.replace('2026-10-26', '2026-01-01')),
      'new.md': post(valid),
    });
    expect(posts.map((item) => item.slug)).toEqual(['new', 'old']);
    expect(isPublished(posts[0], '2026-10-26')).toBe(true);
    expect(isPublished(posts[0], '2026-10-25')).toBe(false);
    expect(isPublished({ ...posts[0], draft: true }, '2026-12-01')).toBe(false);
  });

  it('pages by ?page=N, reading anything else as page 1', () => {
    const many = Array.from({ length: PAGE_SIZE + 1 }, (_, n) =>
      parsePost(`p${n}.md`, post(valid)),
    );
    expect(postPage(many, '2')).toMatchObject({ page: 2, pages: 2 });
    expect(postPage(many, '2').posts).toHaveLength(1);
    for (const input of ['0', '-1', '1.5', 'x', null]) expect(postPage(many, input).page).toBe(1);
    expect(postPage([], null)).toMatchObject({ page: 1, pages: 1, posts: [] });
    expect(blogHref(1)).toBe('/blog');
    expect(blogHref(3)).toBe('/blog?page=3');
  });
});
