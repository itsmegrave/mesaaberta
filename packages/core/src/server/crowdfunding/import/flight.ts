/** Read Next.js Flight data without executing a script. Text records are byte-length prefixed. */
export function readFlight(html: string): Map<string, unknown> {
  let from = 0,
    content = '';
  const marker = 'self.__next_f.push([1,';
  while (from < html.length) {
    const p = html.indexOf(marker, from);
    if (p === -1) break;
    let i = p + marker.length;
    while (/\s/.test(html[i] ?? '') && i < html.length) i++;
    if (html[i] !== '"') throw new Error('source_schema');
    const start = i++;
    let escaped = false;
    for (; i < html.length; i++) {
      if (!escaped && html[i] === '"') break;
      if (!escaped && html[i] === '\\') escaped = true;
      else escaped = false;
    }
    if (i === html.length) throw new Error('source_schema');
    content += JSON.parse(html.slice(start, i + 1));
    from = i + 1;
  }
  const bytes = new TextEncoder().encode(content),
    decode = new TextDecoder();
  const records = new Map<string, unknown>();
  let i = 0;
  while (i < bytes.length) {
    let colon = i;
    while (colon < bytes.length && bytes[colon] !== 58 && bytes[colon] !== 10) colon++;
    if (bytes[colon] !== 58) {
      i = colon + 1;
      continue;
    }
    const id = decode.decode(bytes.slice(i, colon));
    if (!/^[a-f0-9]+$/.test(id)) {
      i = colon + 1;
      continue;
    }
    i = colon + 1;
    if (bytes[i] === 84) {
      let comma = i + 1;
      while (comma < bytes.length && bytes[comma] !== 44) comma++;
      const size = parseInt(decode.decode(bytes.slice(i + 1, comma)), 16);
      if (!Number.isFinite(size) || size < 0 || comma + 1 + size > bytes.length)
        throw new Error('source_schema');
      records.set(id, decode.decode(bytes.slice(comma + 1, comma + 1 + size)));
      i = comma + 1 + size;
    } else {
      let end = i;
      while (end < bytes.length && bytes[end] !== 10) end++;
      const value = decode.decode(bytes.slice(i, end));
      if (value.startsWith('{') || value.startsWith('[')) {
        try {
          records.set(id, JSON.parse(value));
        } catch {
          throw new Error('source_schema');
        }
      }
      i = end + 1;
    }
  }
  if (!records.size) throw new Error('source_schema');
  return records;
}
export function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
export function findObject(
  values: Iterable<unknown>,
  predicate: (o: Record<string, unknown>) => boolean,
): Record<string, unknown> | null {
  const pending = [...values];
  let examined = 0;
  while (pending.length && examined++ < 20_000) {
    const v = pending.pop();
    const o = object(v);
    if (o && predicate(o)) return o;
    if (o) pending.push(...Object.values(o));
    else if (Array.isArray(v)) pending.push(...v);
  }
  return null;
}
