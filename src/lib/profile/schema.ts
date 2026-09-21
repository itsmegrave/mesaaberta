import { z } from 'zod';
import { usernameProblem } from './username';
import { MAX_SOCIAL_LINKS, isNetwork, parseSocialUrl, type Network } from './social-links';

// The profile form, for the browser (instant feedback) and the server (which decides). Every
// message is a short code, not text: the form turns a code into a translated sentence.

export const PROFILE_LIMITS = {
	name: 80,
	gender: 40,
	city: 80,
	age: { min: 13, max: 120 }
} as const;

// The links travel as two parallel lists (`linkNetwork`, `linkUrl`) rather than a list of objects,
// so a plain form post with JavaScript off carries them too.
export const profileSchema = z
	.object({
		username: z
			.string()
			.trim()
			.toLowerCase()
			.superRefine((value, ctx) => {
				const problem = usernameProblem(value);
				if (problem) ctx.addIssue({ code: 'custom', message: problem });
			}),
		name: z.string().trim().max(PROFILE_LIMITS.name, 'too_long').default(''),
		age: z
			.number('invalid')
			.int('invalid')
			.min(PROFILE_LIMITS.age.min, 'invalid')
			.max(PROFILE_LIMITS.age.max, 'invalid')
			.nullable()
			.default(null),
		gender: z.string().trim().max(PROFILE_LIMITS.gender, 'too_long').default(''),
		city: z.string().trim().max(PROFILE_LIMITS.city, 'too_long').default(''),
		linkNetwork: z.array(z.string()).default([]),
		linkUrl: z.array(z.string()).default([])
	})
	.superRefine(({ linkNetwork, linkUrl }, ctx) => {
		if (linkNetwork.length !== linkUrl.length) {
			ctx.addIssue({ code: 'custom', message: 'invalid', path: ['linkUrl'] });
			return;
		}

		const filled = linkUrl.filter((url) => url.trim() !== '').length;
		if (filled > MAX_SOCIAL_LINKS) {
			ctx.addIssue({ code: 'custom', message: 'too_many', path: ['linkUrl'] });
			return;
		}

		const seen = new Set<string>();
		linkUrl.forEach((raw, index) => {
			// A row left empty is skipped, but it still counts for the position of the ones after it.
			if (raw.trim() === '') return;

			if (!isNetwork(linkNetwork[index])) {
				ctx.addIssue({ code: 'custom', message: 'invalid_network', path: ['linkNetwork', index] });
				return;
			}

			const url = parseSocialUrl(raw);
			if (!url) {
				ctx.addIssue({ code: 'custom', message: 'invalid_url', path: ['linkUrl', index] });
			} else if (seen.has(url)) {
				ctx.addIssue({ code: 'custom', message: 'duplicate', path: ['linkUrl', index] });
			} else {
				seen.add(url);
			}
		});
	});

export type ProfileInput = z.infer<typeof profileSchema>;

/** The links to store, in the order sent: empty rows dropped, addresses normalised. Validate first. */
export function profileLinks({
	linkNetwork,
	linkUrl
}: Pick<ProfileInput, 'linkNetwork' | 'linkUrl'>): { network: Network; url: string }[] {
	return linkUrl.flatMap((raw, index) => {
		const url = parseSocialUrl(raw);
		const network = linkNetwork[index];

		return url && isNetwork(network) ? [{ network, url }] : [];
	});
}
