/**
 * Whether an address reads like someone's home: an apartment, a block, a condominium, a numbered
 * house. "Onde jogar" only takes places open to the public, and members have sent their own homes.
 * Only a hint: the form warns while it is typed and the admin queue flags it, nothing is refused
 * (a shop in a "bloco" of a shopping centre is fine). Looks at the street line and the complement.
 */
const RESIDENTIAL = [
  // Words that mean a home on their own.
  /\b(apto|apartamento|condom[ií]nio|residencial|resid[eê]ncia|kitnet|quitinete)(?![a-z])/i,
  // Short forms that need a number after them ("ap 12", "bl. B", "casa 2"), so "Casa de Cultura" is not one.
  /\b(ap|apt|bl|bloco|casa|cs)\.?\s*[0-9]/i,
  /\b(bloco|bl)\.?\s+[a-z]\b/i,
];

export const looksResidential = (...parts: (string | null | undefined)[]): boolean => {
  const text = parts.filter(Boolean).join(' ');
  return RESIDENTIAL.some((pattern) => pattern.test(text));
};
