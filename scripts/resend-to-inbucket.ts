import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { connect } from 'node:net';

type ResendBody = {
  from: string;
  to: string[];
  subject: string;
  text?: string;
  attachments?: Array<{ filename: string; content: string; content_type: string }>;
};

const inboxIp = () =>
  JSON.parse(
    execFileSync(
      'docker',
      ['inspect', 'supabase_inbucket_mesaaberta', '--format', '{{json .NetworkSettings.Networks}}'],
      {
        encoding: 'utf8',
      },
    ),
  ) as Record<string, { IPAddress: string }>;

const smtp = (from: string, recipients: string[], message: string) =>
  new Promise<void>((resolve, reject) => {
    const networks = inboxIp();
    const host = Object.values(networks)[0]?.IPAddress;
    if (!host) return reject(new Error('Supabase Inbucket has no Docker IP address'));
    const socket = connect(1025, host);
    let buffer = '';
    const commands = [
      `HELO mesaaberta-e2e`,
      `MAIL FROM:<${from}>`,
      ...recipients.map((to) => `RCPT TO:<${to}>`),
      'DATA',
      `${message}\r\n.`,
      'QUIT',
    ];
    let index = 0;
    socket.on('data', (chunk) => {
      buffer += chunk;
      if (!buffer.includes('\n')) return;
      const response = buffer;
      buffer = '';
      if (!/^2|^3/.test(response.trim())) return socket.destroy(new Error(response.trim()));
      const command = commands[index++];
      if (command) socket.write(`${command}\r\n`);
      else socket.end();
    });
    socket.on('error', reject);
    socket.on('close', () => (index > commands.length ? resolve() : undefined));
  });

createServer(async (request, response) => {
  if (request.method !== 'POST' || request.url !== '/emails') {
    response.writeHead(404).end();
    return;
  }
  let raw = '';
  for await (const chunk of request) raw += chunk;
  try {
    const body = JSON.parse(raw) as ResendBody;
    const boundary = 'mesaaberta-e2e-boundary';
    const files = body.attachments ?? [];
    const message = [
      `From: ${body.from}`,
      `To: ${body.to.join(', ')}`,
      `Subject: ${body.subject}`,
      'MIME-Version: 1.0',
      files.length
        ? `Content-Type: multipart/mixed; boundary="${boundary}"`
        : 'Content-Type: text/plain; charset=utf-8',
      '',
      ...(files.length
        ? [
            `--${boundary}`,
            'Content-Type: text/plain; charset=utf-8',
            '',
            body.text ?? '',
            ...files.flatMap((file) => [
              `--${boundary}`,
              `Content-Type: ${file.content_type}; name="${file.filename}"`,
              'Content-Transfer-Encoding: base64',
              `Content-Disposition: attachment; filename="${file.filename}"`,
              '',
              file.content,
            ]),
            `--${boundary}--`,
          ]
        : [body.text ?? '']),
    ].join('\r\n');
    await smtp(body.from.match(/<([^>]+)>/)?.[1] ?? body.from, body.to, message);
    response.writeHead(200, { 'content-type': 'application/json' }).end('{"id":"e2e-mailpit"}');
  } catch (error) {
    response
      .writeHead(500, { 'content-type': 'application/json' })
      .end(JSON.stringify({ error: String(error) }));
  }
}).listen(4175, '127.0.0.1');
