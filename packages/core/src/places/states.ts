/** The 26 Brazilian states and the Distrito Federal, by name: what Onde jogar's Estado filter offers. */
export const BRAZIL_STATES = [
  { uf: 'AC', name: 'Acre' },
  { uf: 'AL', name: 'Alagoas' },
  { uf: 'AP', name: 'Amapá' },
  { uf: 'AM', name: 'Amazonas' },
  { uf: 'BA', name: 'Bahia' },
  { uf: 'CE', name: 'Ceará' },
  { uf: 'DF', name: 'Distrito Federal' },
  { uf: 'ES', name: 'Espírito Santo' },
  { uf: 'GO', name: 'Goiás' },
  { uf: 'MA', name: 'Maranhão' },
  { uf: 'MT', name: 'Mato Grosso' },
  { uf: 'MS', name: 'Mato Grosso do Sul' },
  { uf: 'MG', name: 'Minas Gerais' },
  { uf: 'PA', name: 'Pará' },
  { uf: 'PB', name: 'Paraíba' },
  { uf: 'PR', name: 'Paraná' },
  { uf: 'PE', name: 'Pernambuco' },
  { uf: 'PI', name: 'Piauí' },
  { uf: 'RJ', name: 'Rio de Janeiro' },
  { uf: 'RN', name: 'Rio Grande do Norte' },
  { uf: 'RS', name: 'Rio Grande do Sul' },
  { uf: 'RO', name: 'Rondônia' },
  { uf: 'RR', name: 'Roraima' },
  { uf: 'SC', name: 'Santa Catarina' },
  { uf: 'SP', name: 'São Paulo' },
  { uf: 'SE', name: 'Sergipe' },
  { uf: 'TO', name: 'Tocantins' },
] as const;

export type StateOption = { slug: string; label: string; count: number };

/**
 * Every state for the Estado filter, by name, each with how many listed places it has (`counts`,
 * keyed by the state tag's slug, `pe`). A slug outside the 27 (an address typed by hand) still
 * shows, after them, so a place never falls out of its own filter.
 */
export function stateOptions(counts: ReadonlyMap<string, number>): StateOption[] {
  const known = BRAZIL_STATES.map(({ uf, name }) => ({
    slug: uf.toLowerCase(),
    label: name,
    count: counts.get(uf.toLowerCase()) ?? 0,
  }));
  const slugs = new Set(known.map((state) => state.slug));
  const others = [...counts]
    .filter(([slug]) => !slugs.has(slug))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slug, count]) => ({ slug, label: slug.toUpperCase(), count }));
  return [...known, ...others];
}
