import { cleanRichHtml, plainToHtml, toPlainText } from '$lib/text/rich';

/**
 * Hosted Resend templates. The copy of each e-mail is written and versioned in the Resend dashboard;
 * the app only says which template to use and fills in variables. See "Hosted e-mail templates" in
 * the README for what each template must contain.
 */
export type TemplateKey = 'invite' | 'cancel' | 'joinRequested' | 'joinDeclined' | 'accountBanned';

/** One optional Worker variable per template. Ids are not secrets, but they may not be set yet. */
export type TemplateEnv = {
  RESEND_TEMPLATE_INVITE?: string;
  RESEND_TEMPLATE_CANCEL?: string;
  RESEND_TEMPLATE_JOIN_REQUESTED?: string;
  RESEND_TEMPLATE_JOIN_DECLINED?: string;
  RESEND_TEMPLATE_ACCOUNT_BANNED?: string;
};

const envNames: Record<TemplateKey, keyof TemplateEnv> = {
  invite: 'RESEND_TEMPLATE_INVITE',
  cancel: 'RESEND_TEMPLATE_CANCEL',
  joinRequested: 'RESEND_TEMPLATE_JOIN_REQUESTED',
  joinDeclined: 'RESEND_TEMPLATE_JOIN_DECLINED',
  accountBanned: 'RESEND_TEMPLATE_ACCOUNT_BANNED',
};

/** A missing or blank variable means "not configured yet": the caller sends its inline copy. */
export function templateIdFor(env: TemplateEnv, key: TemplateKey): string | undefined {
  return env[envNames[key]]?.trim() || undefined;
}

/**
 * The only values that ever reach Resend for a template. Names are upper case and avoid the ones
 * Resend reserves (`FIRST_NAME`, `LAST_NAME`, `EMAIL`, `UNSUBSCRIBE_URL`, `contact`, `this`).
 * Never add an id, a token, an address or anything secret here.
 *
 * `WELCOME_MESSAGE` is optional and is the whole "Mensagem da mesa" section as HTML (`welcomeHtml`),
 * heading included, for `{{{WELCOME_MESSAGE}}}` in a block of its own:
 * Resend templates have no conditionals, so a template that owned the heading would show it above
 * nothing. Absent values are omitted, so the template gives it an empty fallback in the dashboard.
 *
 * `PLAYER_MESSAGE` works the same way for `mesaaberta-join-requested`: the introduction the player
 * wrote when asking for the seat, as an `<h3>Mensagem de @user</h3>` section for `{{{PLAYER_MESSAGE}}}`.
 */
export const TEMPLATE_VARIABLES = [
  'RECIPIENT_NAME',
  'TABLE_TITLE',
  'TABLE_URL',
  'CONTEXT',
  'STARTS_AT',
  'FALLBACK_TEXT',
  'WELCOME_MESSAGE',
  'PLAYER_MESSAGE',
] as const;

/** The variables of the account-banned template, which has no table (see `BanVariables`). */
export const BAN_TEMPLATE_VARIABLES = [
  'RECIPIENT_NAME',
  'BAN_SUMMARY',
  'BAN_REASON',
  'FALLBACK_TEXT',
] as const;

export type TemplateVariables = {
  RECIPIENT_NAME: string;
  TABLE_TITLE: string;
  TABLE_URL: string;
  /** Which message this is; it is also the template's purpose. */
  CONTEXT: 'REQUEST' | 'CANCEL' | 'JOIN_REQUESTED' | 'JOIN_DECLINED';
  /** The session start as people say it, in the table's own time zone. */
  STARTS_AT: string;
  /** The plain-text copy. Resend refuses `text` next to a template, so it travels as a variable. */
  FALLBACK_TEXT: string;
  /** The GM's welcome message as HTML with its heading (see `welcomeHtml`); absent when there is none. */
  WELCOME_MESSAGE?: string;
  /** The player's introduction as HTML with its heading (see `playerMessageHtml`); only on a join request that has one. */
  PLAYER_MESSAGE?: string;
};

/** What `mesaaberta-account-banned` receives: the sentence that says until when, and the admin's reason. */
export type BanVariables = {
  RECIPIENT_NAME: string;
  /** "Sua conta ... foi suspensa até <data>." or the permanent wording. */
  BAN_SUMMARY: string;
  /** What the admin wrote; it is the person's own business, so it goes to them alone. */
  BAN_REASON: string;
  FALLBACK_TEXT: string;
};

/** Resend limits a string variable to 2,000 characters. */
const MAX_LENGTH = 2000;

/**
 * Resend documents variables as `{{{NAME}}}` and does not say whether values are escaped, so
 * angle brackets, which are what start a tag, are removed. Users write titles and names.
 */
const clean = (value: string) => value.replace(/[<>]/g, '').slice(0, MAX_LENGTH);

/**
 * The welcome and player-message sections are the variables that are markup, so angle brackets
 * stay. Each is cleaned to the allowed tags again, and when it does not fit Resend's limit it is
 * cut as plain text (never as HTML, which would leave a tag open) and the ellipsis marks the cut.
 * Both start with an `<h3>` heading, which is kept whole.
 */
function sectionVariable(html: string): string {
  const safe = cleanRichHtml(html);
  if (safe.length <= MAX_LENGTH) return safe;
  const heading = safe.match(/^<h3>[^<]*<\/h3>/)?.[0] ?? '';
  let text = toPlainText(safe.slice(heading.length));
  let out: string;
  do {
    out = `${heading}${plainToHtml(`${text}…`)}`;
    text = text.slice(0, Math.floor(text.length * 0.9));
  } while (out.length > MAX_LENGTH && text.length > 0);
  return out.length > MAX_LENGTH ? '' : out;
}

const SECTION_VARIABLES = new Set(['WELCOME_MESSAGE', 'PLAYER_MESSAGE']);

/** Picks the allowlisted variables and cleans them; anything else is dropped. */
export function templateVariables<T extends TemplateVariables | BanVariables>(input: T): T {
  const picked: Record<string, string> = {};
  for (const name of new Set([...TEMPLATE_VARIABLES, ...BAN_TEMPLATE_VARIABLES])) {
    const value = (input as Record<string, string | undefined>)[name];
    if (value === undefined) continue;
    picked[name] = SECTION_VARIABLES.has(name) ? sectionVariable(value) : clean(value);
  }
  return picked as T;
}

/** The heading shared by the inline copy and the hosted template variable. */
export const WELCOME_HEADING = 'Mensagem da mesa';

/** The welcome section as text, or undefined when there is nothing to say: never a bare heading. */
export function welcomeSection(message: string | undefined): string | undefined {
  const trimmed = message ? toPlainText(cleanRichHtml(message)) : '';
  return trimmed ? `${WELCOME_HEADING}:\n${trimmed}` : undefined;
}

/** The same section as HTML (the message is rich-text HTML): heading and message, or undefined. */
export function welcomeHtml(message: string | undefined): string | undefined {
  const safe = message ? cleanRichHtml(message) : '';
  return safe ? `<h3>${WELCOME_HEADING}</h3>${safe}` : undefined;
}

/**
 * What a player wrote when asking for the seat, for the GM: a heading naming the player (`who`, as
 * people see them, like `@ana`) and the text (plain text, so escaped), or undefined when there is
 * nothing to say. Never a bare heading.
 */
export function playerMessageHtml(who: string, message: string | null | undefined) {
  const html = message ? plainToHtml(message) : '';
  return html ? `<h3>Mensagem de ${who.replace(/[<>&]/g, '')}</h3>${html}` : undefined;
}

/** The same section as plain text, for the inline e-mail and `FALLBACK_TEXT`. */
export function playerMessageText(who: string, message: string | null | undefined) {
  const trimmed = message?.trim();
  return trimmed ? `Mensagem de ${who}:\n${trimmed}` : undefined;
}
