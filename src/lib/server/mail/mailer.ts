import type { TemplateVariables } from './templates';

/** A transport seam: domain handlers describe a message and never call an e-mail provider directly. */
export type Mail = {
	to: string;
	subject: string;
	/** The inline plain-text copy, sent when no hosted template is configured. */
	text: string;
	/** A hosted template; when set, the provider sends it instead of `text`. */
	template?: { id: string; variables: TemplateVariables };
	attachments?: Array<{ filename: string; content: string; contentType: string }>;
	/** A provider-supported idempotency key for an at-least-once domain event. */
	idempotencyKey: string;
};

export type Mailer = { send(mail: Mail): Promise<void> };
