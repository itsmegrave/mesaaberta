// One-off, run by hand: creates and publishes the four hosted templates the app expects
// (see "Hosted e-mail templates" in the README) via the raw Resend API, then prints the ids to
// paste into `vars` in wrangler.jsonc. Safe to re-run: Resend refuses a duplicate alias, so an
// existing template is reported and skipped rather than overwritten.
//
// Usage: RESEND_API_KEY=re_... node --env-file-if-exists=.dev.vars scripts/create-resend-templates.ts

type Variable = { key: string; type: 'string'; fallbackValue: string };

const COMMON_VARIABLES: Variable[] = [
  { key: 'RECIPIENT_NAME', type: 'string', fallbackValue: 'você' },
  { key: 'TABLE_TITLE', type: 'string', fallbackValue: 'sua mesa' },
  { key: 'TABLE_URL', type: 'string', fallbackValue: 'https://mesaaberta.app' },
  { key: 'CONTEXT', type: 'string', fallbackValue: 'REQUEST' },
  { key: 'STARTS_AT', type: 'string', fallbackValue: 'em breve' },
  { key: 'FALLBACK_TEXT', type: 'string', fallbackValue: '' },
];

// `WELCOME_MESSAGE` must exist with an empty fallback, and only on `mesaaberta-invite` (README).
const WELCOME_MESSAGE_VARIABLE: Variable = {
  key: 'WELCOME_MESSAGE',
  type: 'string',
  fallbackValue: '',
};

type TemplateSpec = { alias: string; subject: string; html: string; variables: Variable[] };

const TEMPLATES: TemplateSpec[] = [
  {
    alias: 'mesaaberta-invite',
    subject: 'Convite: {{{TABLE_TITLE}}}',
    variables: [...COMMON_VARIABLES, WELCOME_MESSAGE_VARIABLE],
    html: `
			<p>Olá, {{{RECIPIENT_NAME}}}!</p>
			<p>Sua vaga na mesa <strong>{{{TABLE_TITLE}}}</strong> está confirmada. A sessão começa {{{STARTS_AT}}}.</p>
			<p style="white-space: pre-line">{{{WELCOME_MESSAGE}}}</p>
			<p>O convite de calendário está anexado: abra o arquivo para adicionar a mesa à sua agenda. Se a mesa mudar, você receberá um novo convite que atualiza o evento.</p>
			<p><a href="{{{TABLE_URL}}}">Ver a mesa</a></p>
		`.trim(),
  },
  {
    alias: 'mesaaberta-cancel',
    subject: 'Cancelada: {{{TABLE_TITLE}}}',
    variables: COMMON_VARIABLES,
    html: `
			<p>Olá, {{{RECIPIENT_NAME}}}.</p>
			<p>Sua participação na mesa <strong>{{{TABLE_TITLE}}}</strong> foi cancelada. O cancelamento de calendário está anexado: abra o arquivo para remover o evento da sua agenda.</p>
			<p><a href="{{{TABLE_URL}}}">Ver a mesa</a></p>
		`.trim(),
  },
  {
    alias: 'mesaaberta-join-requested',
    subject: 'Nova solicitação: {{{TABLE_TITLE}}}',
    variables: COMMON_VARIABLES,
    html: `
			<p>Olá, {{{RECIPIENT_NAME}}}!</p>
			<p>Há uma nova solicitação para entrar na sua mesa <strong>{{{TABLE_TITLE}}}</strong>. Abra a mesa para aprovar ou recusar.</p>
			<p><a href="{{{TABLE_URL}}}">Ver a mesa</a></p>
		`.trim(),
  },
  {
    alias: 'mesaaberta-join-declined',
    subject: 'Solicitação recusada: {{{TABLE_TITLE}}}',
    variables: COMMON_VARIABLES,
    html: `
			<p>Olá, {{{RECIPIENT_NAME}}}.</p>
			<p>Sua solicitação para a mesa <strong>{{{TABLE_TITLE}}}</strong> foi recusada. Há outras mesas abertas esperando por você.</p>
			<p><a href="{{{TABLE_URL}}}">Ver a mesa</a></p>
		`.trim(),
  },
];

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.error('RESEND_API_KEY is not set. Run with RESEND_API_KEY=re_... or via .dev.vars.');
  process.exit(1);
}

const headers = {
  authorization: `Bearer ${apiKey}`,
  'content-type': 'application/json',
};

async function resend(path: string, init: RequestInit) {
  const response = await fetch(`https://api.resend.com${path}`, { ...init, headers });
  const body = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, body };
}

const envNameFor: Record<string, string> = {
  'mesaaberta-invite': 'RESEND_TEMPLATE_INVITE',
  'mesaaberta-cancel': 'RESEND_TEMPLATE_CANCEL',
  'mesaaberta-join-requested': 'RESEND_TEMPLATE_JOIN_REQUESTED',
  'mesaaberta-join-declined': 'RESEND_TEMPLATE_JOIN_DECLINED',
};

const results: Array<{ alias: string; id?: string; note: string }> = [];

for (const template of TEMPLATES) {
  const created = await resend('/templates', {
    method: 'POST',
    body: JSON.stringify({
      name: template.alias,
      alias: template.alias,
      subject: template.subject,
      html: template.html,
      variables: template.variables,
    }),
  });

  if (!created.ok) {
    results.push({
      alias: template.alias,
      note: `create failed (${created.status}): ${JSON.stringify(created.body)}`,
    });
    continue;
  }

  const id = (created.body as { id?: string })?.id;
  if (!id) {
    results.push({
      alias: template.alias,
      note: `create returned no id: ${JSON.stringify(created.body)}`,
    });
    continue;
  }

  const published = await resend(`/templates/${id}/publish`, { method: 'POST' });
  results.push({
    alias: template.alias,
    id,
    note: published.ok
      ? 'created and published'
      : `created but publish failed (${published.status}): ${JSON.stringify(published.body)}`,
  });
}

console.log('\nResults:');
for (const result of results) {
  console.log(`  ${result.alias}: ${result.note}${result.id ? ` (id: ${result.id})` : ''}`);
}

const ok = results.filter((r) => r.id);
if (ok.length > 0) {
  console.log('\nPaste into `vars` in wrangler.jsonc, then deploy:\n');
  for (const result of ok) {
    console.log(`  "${envNameFor[result.alias]}": "${result.id}",`);
  }
  console.log(
    '\nThen preview and test each one in the Resend dashboard before trusting real e-mails to it.',
  );
}
