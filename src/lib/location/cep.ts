/** A CEP as 8 digits, from what a person types ("50030-230", "50.030230"); null if it is not one. */
export function normalizeCep(input: string): string | null {
	const digits = input.replace(/\D/g, '');
	return /^\d{8}$/.test(digits) ? digits : null;
}

/** 8 digits shown the usual way: `50030-230`. */
export const formatCep = (cep: string) => `${cep.slice(0, 5)}-${cep.slice(5)}`;

/** What a CEP resolves to. */
export type CepPlace = { neighbourhood: string | null; city: string; state: string };

/** The public area text for a place: "Boa Viagem, Recife - PE", or the city alone. */
export const areaOf = ({ neighbourhood, city, state }: CepPlace) =>
	`${neighbourhood ? `${neighbourhood}, ` : ''}${city} - ${state}`;
