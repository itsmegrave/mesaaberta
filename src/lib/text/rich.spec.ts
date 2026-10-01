import { describe, expect, it } from 'vitest';
import { cleanRichHtml, plainToHtml, richTextLength, toPlainText } from './rich';
import { richText } from './rich-schema';

describe('cleanRichHtml', () => {
  it('keeps the formatting the editor can make', () => {
    const html =
      '<h2>Regras</h2><p><strong>negrito</strong> <em>itálico</em> <u>sub</u> <s>riscado</s></p><ul><li>um</li></ul><blockquote>citação</blockquote>';
    expect(cleanRichHtml(html)).toBe(html);
  });

  it('removes scripts, event handlers and styles, so stored text cannot run code', () => {
    const dirty =
      '<p onclick="x()" style="color:red">oi<script>alert(1)</script><img src=x onerror=alert(1)></p><style>p{}</style>';
    const clean = cleanRichHtml(dirty);
    expect(clean).toBe('<p>oi</p>');
  });

  it('drops a link address that is not http, https or mailto', () => {
    expect(cleanRichHtml('<p><a href="javascript:alert(1)">x</a></p>')).not.toContain('javascript');
    expect(cleanRichHtml('<p><a href="data:text/html,hi">x</a></p>')).not.toContain('data:');
    expect(cleanRichHtml('<p><a href=" JaVaScRiPt:alert(1)">x</a></p>')).not.toContain('script:');
  });

  it('keeps the text of a link whose address was refused, without a link', () => {
    expect(cleanRichHtml('<p><a href="javascript:alert(1)">clique</a> aqui</p>')).toBe(
      '<p>clique aqui</p>',
    );
  });

  it('opens links safely in a new tab', () => {
    expect(cleanRichHtml('<p><a href="https://example.com">x</a></p>')).toBe(
      '<p><a target="_blank" rel="noopener nofollow ugc" href="https://example.com">x</a></p>',
    );
  });

  it('does not let a link choose its own rel or target', () => {
    const html = cleanRichHtml('<p><a href="https://a.test" rel="opener" target="_self">x</a></p>');
    expect(html).not.toContain('opener"');
    expect(html).not.toContain('_self');
  });

  it('turns text with no tags into paragraphs, escaped (a form sent without JavaScript)', () => {
    expect(cleanRichHtml('olá & <3\r\nlinha\r\n\r\nsegunda')).toBe(
      '<p>olá &amp; &lt;3<br>linha</p><p>segunda</p>',
    );
  });

  it('is empty when nothing is visible', () => {
    expect(cleanRichHtml('<p></p>')).toBe('');
    expect(cleanRichHtml('  ')).toBe('');
    expect(cleanRichHtml('<p><br></p>')).toBe('');
  });
});

describe('toPlainText', () => {
  it('separates paragraphs by a blank line and keeps line breaks', () => {
    expect(toPlainText('<p>a<br>b</p><p>c</p>')).toBe('a\nb\n\nc');
  });

  it('marks list items, numbered ones in order', () => {
    expect(toPlainText('<ul><li>um</li><li>dois</li></ul><ol><li>x</li><li>y</li></ol>')).toBe(
      '• um\n• dois\n\n1. x\n2. y',
    );
  });

  it('follows a link with its address, unless the text is the address', () => {
    expect(toPlainText('<p><a href="https://a.test">site</a></p>')).toBe('site (https://a.test)');
    expect(toPlainText('<p><a href="https://a.test">https://a.test</a></p>')).toBe(
      'https://a.test',
    );
  });

  it('reads entities back as characters', () => {
    expect(toPlainText('<p>a &amp; b &lt;3 &#39;x&#39;</p>')).toBe("a & b <3 'x'");
  });

  it('round-trips plain text', () => {
    const text = 'um & dois\n\n<três>';
    expect(toPlainText(plainToHtml(text))).toBe(text);
  });
});

describe('richText', () => {
  it('counts what a reader sees, not the markup', () => {
    const formatted = '<p><strong>aaaaa</strong><em>aaaaa</em></p>';
    expect(richTextLength(formatted)).toBe(10);
    expect(richText(10).safeParse(formatted).success).toBe(true);
    expect(richText(9).safeParse(formatted).success).toBe(false);
  });

  it('refuses a stored size beyond the hard cap even when the text is short', () => {
    const heavy = `<p>${'<strong></strong>'.repeat(10)}a</p>`;
    expect(richText(10).safeParse(heavy).success).toBe(false);
  });

  it('reports the same code as the other length limits', () => {
    const result = richText(1).safeParse('ab');
    expect(result.error?.issues[0].message).toBe('too_big');
  });
});
