import { execFileSync, spawn } from 'node:child_process';
import { openSync } from 'node:fs';

const dockerAnswers = () => {
  try {
    execFileSync('docker', ['info'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

const hasDockerd = () => {
  try {
    execFileSync('sh', ['-c', 'command -v dockerd'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

/**
 * Makes sure the Docker daemon answers before the local Supabase starts. Where it can (root with
 * `dockerd` installed, as in a Claude Code cloud session) it starts the daemon itself; anywhere
 * else it says what to do instead of letting the Supabase CLI fail with a socket error.
 */
export async function ensureDocker() {
  if (dockerAnswers()) return;

  if (process.getuid?.() !== 0 || !hasDockerd()) {
    throw new Error(
      'Docker is not running. Start Docker (Docker Desktop, or `sudo systemctl start docker`) and run `bun run dev:up` again.',
    );
  }

  console.log('Docker is not running; starting dockerd (log: /tmp/dockerd.log).');
  const log = openSync('/tmp/dockerd.log', 'a');
  spawn('dockerd', [], { detached: true, stdio: ['ignore', log, log] }).unref();

  for (let second = 0; second < 60; second++) {
    if (dockerAnswers()) return settle();
    await sleep(1000);
  }
  throw new Error('dockerd did not answer within 60 seconds. See /tmp/dockerd.log.');
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A daemon that comes back restarts the stack's containers on its own (`unless-stopped`), and
 * `supabase start` refuses while their health checks still say "starting". Waits for them, up to
 * two minutes.
 */
async function settle() {
  for (let second = 0; second < 120; second += 2) {
    const statuses = execFileSync(
      'docker',
      ['ps', '--filter', 'name=supabase_', '--format', '{{.Status}}'],
      { encoding: 'utf8' },
    );
    if (!/starting|Restarting/.test(statuses)) return;
    await sleep(2000);
  }
}
