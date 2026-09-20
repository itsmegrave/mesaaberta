import type { Mailer } from './mailer';

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
					text: mail.text,
					html: mail.html || `<p>${escapeHtml(mail.text).replace(/\n/g, '<br>')}</p>`,
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
