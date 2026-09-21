import type { Mail, Mailer } from './mailer';
import { templateVariables } from './templates';

export type ResendEnv = { RESEND_API_KEY: string; RESEND_FROM: string };
type Fetch = typeof fetch;

const escapeHtml = (value: string) =>
	value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const utf8Base64 = (value: string) => {
	const bytes = new TextEncoder().encode(value);
	let binary = '';
	for (let start = 0; start < bytes.length; start += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
	}
	return btoa(binary);
};

/**
 * Resend rejects `text`, `html` and `react` next to a `template`, so a hosted template sends its
 * id and variables and the inline copy is sent only without one. `subject` stays in both: the
 * payload's subject wins over the template's default, and a template with none would fail.
 */
const content = (mail: Mail) =>
	mail.template
		? { template: { id: mail.template.id, variables: templateVariables(mail.template.variables) } }
		: {
				text: mail.text,
				html: `<p>${escapeHtml(mail.text).replace(/\n/g, '<br>')}</p>`
			};

/** Resend's HTTP API is Worker-native, so no Node-only SDK or persistent process is needed. */
export function resendMailer(env: ResendEnv, request: Fetch = fetch): Mailer {
	return {
		async send(mail) {
			const response = await request('https://api.resend.com/emails', {
				method: 'POST',
				headers: {
					authorization: `Bearer ${env.RESEND_API_KEY}`,
					'content-type': 'application/json',
					'Idempotency-Key': mail.idempotencyKey
				},
				body: JSON.stringify({
					from: env.RESEND_FROM,
					to: [mail.to],
					subject: mail.subject,
					...content(mail),
					attachments: mail.attachments?.map((attachment) => ({
						filename: attachment.filename,
						content: utf8Base64(attachment.content),
						content_type: attachment.contentType
					}))
				})
			});
			if (!response.ok) throw new Error(`Resend request failed (${response.status})`);
		}
	};
}
