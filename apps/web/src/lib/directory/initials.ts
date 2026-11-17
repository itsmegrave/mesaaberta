/**
 * The two characters on a directory's square mark when there is no picture: the first letter or
 * digit of the first two words ("Dungeons & Dragons 5e" → "DD", "Tormenta 20" → "T2"), or the
 * first two of a one-word name.
 */
export function initialsOf(name: string): string {
  const words = name.match(/[\p{L}\p{N}]+/gu) ?? [];
  const [first = '?', second] = words;
  const picked = second ? first[0] + second[0] : first.slice(0, 2);
  return picked.toLocaleUpperCase('pt-BR');
}
