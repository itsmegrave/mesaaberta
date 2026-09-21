import { describe, expect, it, vi } from 'vitest';
import type { Mail } from './mailer';
import { resendMailer } from './resend';
import { TEMPLATE_VARIABLES, type TemplateVariables } from './templates';

const env = { RESEND_API_KEY: 're_test', RESEND_FROM: 'Mesa Aberta <convites@mesaaberta.app>' };

const variables: TemplateVariables = {
	RECIPIENT_NAME: 'Ana',
	TABLE_TITLE: 'Mesa do Dragão',
	TABLE_URL: 'https://mesaaberta.app/tables/mesa',
	CONTEXT: 'REQUEST',
	STARTS_AT: 'sábado, 10 de outubro, 19:00 GMT-3',
	FALLBACK_TEXT: 'Você tem uma vaga confirmada.'
};

const attachment = {
	filename: 'mesa-aberta.ics',
	content: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR',
	contentType: 'text/calendar; method=REQUEST; charset=utf-8'
};

const inline: Mail = {
	to: 'ana@example.com',
	subject: 'Convite: Mesa do Dragão',
	text: 'Você tem uma vaga confirmada.',
	idempotencyKey: 'event:player:REQUEST'
};

function capture(status = 200) {
	const calls: Array<{ url: string; init: RequestInit }> = [];
	const request = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
		calls.push({ url: String(url), init: init as RequestInit });
		return new Response('{}', { status });
	}) as unknown as typeof fetch;
	const body = () => JSON.parse(String(calls[0].init.body));
	return { request, calls, body };
}

describe('resend mailer', () => {
	it('sends the inline copy as text and html when there is no template', async () => {
		const sent = capture();

		await resendMailer(env, sent.request).send({ ...inline, text: 'Olá <Ana> & amigos\nfim' });

		expect(sent.body()).toMatchObject({
			from: env.RESEND_FROM,
			to: ['ana@example.com'],
			subject: 'Convite: Mesa do Dragão',
			text: 'Olá <Ana> & amigos\nfim',
			html: '<p>Olá &lt;Ana&gt; &amp; amigos<br>fim</p>'
		});
		expect(sent.body()).not.toHaveProperty('template');
	});

	it('sends a template id and variables, and neither text nor html, which Resend rejects with a template', async () => {
		const sent = capture();

		await resendMailer(env, sent.request).send({
			...inline,
			template: { id: 'tpl-invite', variables }
		});

		const body = sent.body();
		expect(body.template).toEqual({ id: 'tpl-invite', variables });
		expect(body).not.toHaveProperty('text');
		expect(body).not.toHaveProperty('html');
		expect(body).toMatchObject({ from: env.RESEND_FROM, to: ['ana@example.com'] });
	});

	it('still sends the subject with a template, since the payload subject wins over the template default', async () => {
		const sent = capture();

		await resendMailer(env, sent.request).send({
			...inline,
			template: { id: 'tpl-invite', variables }
		});

		expect(sent.body().subject).toBe('Convite: Mesa do Dragão');
	});

	it('sends only allowlisted variables even if the mail carries more', async () => {
		const sent = capture();
		const smuggled = { ...variables, playerId: 'p-1', token: 'secret' } as TemplateVariables;

		await resendMailer(env, sent.request).send({
			...inline,
			template: { id: 'tpl-invite', variables: smuggled }
		});

		expect(Object.keys(sent.body().template.variables).sort()).toEqual(
			[...TEMPLATE_VARIABLES].filter((name) => name !== 'WELCOME_MESSAGE').sort()
		);
	});

	describe('the GM welcome message', () => {
		const message = 'Bem-vinda! <b>WhatsApp</b>: (11) 99999-0000';

		it('is the WELCOME_MESSAGE variable of a hosted template, with its heading and no angle brackets', async () => {
			const sent = capture();

			await resendMailer(env, sent.request).send({
				...inline,
				welcomeMessage: message,
				template: { id: 'tpl-invite', variables }
			});

			expect(sent.body().template.variables).toEqual({
				...variables,
				WELCOME_MESSAGE: 'Mensagem do mestre:\nBem-vinda! bWhatsApp/b: (11) 99999-0000'
			});
			expect(sent.body()).not.toHaveProperty('text');
		});

		it.each([undefined, '', '  '])(
			'is no variable at all for %j, so the template falls back to empty',
			async (empty) => {
				const sent = capture();

				await resendMailer(env, sent.request).send({
					...inline,
					welcomeMessage: empty,
					template: { id: 'tpl-invite', variables }
				});

				expect(sent.body().template.variables).not.toHaveProperty('WELCOME_MESSAGE');
			}
		);

		it('is appended to the inline copy, escaped in the HTML', async () => {
			const sent = capture();

			await resendMailer(env, sent.request).send({ ...inline, welcomeMessage: message });

			expect(sent.body().text).toBe(`${inline.text}\n\nMensagem do mestre:\n${message}`);
			expect(sent.body().html).toContain(
				'Mensagem do mestre:<br>Bem-vinda! &lt;b&gt;WhatsApp&lt;/b&gt;'
			);
			expect(sent.body().html).not.toContain('<b>');
		});

		it.each([undefined, '', '  '])('leaves the inline copy untouched for %j', async (empty) => {
			const sent = capture();

			await resendMailer(env, sent.request).send({ ...inline, welcomeMessage: empty });

			expect(sent.body().text).toBe(inline.text);
			expect(sent.body().html).not.toContain('Mensagem do mestre');
		});
	});

	it('keeps the attachment and the idempotency key with a template', async () => {
		const sent = capture();

		await resendMailer(env, sent.request).send({
			...inline,
			attachments: [attachment],
			template: { id: 'tpl-invite', variables }
		});

		expect(sent.calls[0].init.headers).toMatchObject({
			'Idempotency-Key': 'event:player:REQUEST',
			authorization: 'Bearer re_test'
		});
		const [sentAttachment] = sent.body().attachments;
		expect(sentAttachment.filename).toBe('mesa-aberta.ics');
		expect(sentAttachment.content_type).toBe(attachment.contentType);
		expect(Buffer.from(sentAttachment.content, 'base64').toString()).toBe(attachment.content);
	});

	it('throws when Resend refuses, so the sweeper retries the event', async () => {
		const sent = capture(422);

		await expect(
			resendMailer(env, sent.request).send({ ...inline, template: { id: 'tpl', variables } })
		).rejects.toThrow('Resend request failed (422)');
	});
});
