/** A transport seam: domain handlers describe a message and never call an e-mail provider directly. */
export type Mail = {
	to: string;
	subject: string;
	text: string;
	html: string;
	attachments?: Array<{ filename: string; content: string; contentType: string }>;
	/** A provider-supported idempotency key for an at-least-once domain event. */
	idempotencyKey: string;
};

export type Mailer = { send(mail: Mail): Promise<void> };
