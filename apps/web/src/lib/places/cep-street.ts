/**
 * What "Rua e número" becomes once a CEP is found (`use_cep_street`): the street the CEP is on, while
 * the field is empty or still holds what the CEP filled last (`filled`). Anything typed there stays
 * (null: leave it). A CEP that covers a whole town has no street, so it clears an earlier fill.
 */
export function streetFromCep(
  current: string,
  filled: string | null,
  suggested: string | null,
): { street: string; filled: string | null } | null {
  if (current.trim() !== '' && current !== filled) return null;
  const street = suggested?.trim() ?? '';
  return { street, filled: street || null };
}
