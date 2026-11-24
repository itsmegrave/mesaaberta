// Claude Code's PreToolUse hook for Bash (.claude/settings.json). It stops the few commands the
// project rules forbid outright and asks before the ones they say to announce first (CLAUDE.md,
// "Rules for changes"). It reads the command as text, so it is a seatbelt, not a sandbox.

export type Verdict = { decision: 'deny' | 'ask'; reason: string };

const CLOUDFLARE_RESOURCE =
  /\bwrangler\s+(queues|kv|d1|r2|hyperdrive|vectorize|pipelines|secret|secrets-store)\b.*\b(create|delete|put|bulk|update)\b/;

/** What to do with one shell command, or null when the normal permission flow applies. */
export function judge(command: string): Verdict | null {
  // Each part of a chain is judged on its own, so `--dry-run` on one cannot cover the next.
  for (const part of command.split(/&&|\|\||[;|\n]/)) {
    if (/\bwrangler\s+(deploy|versions\s+(deploy|upload)|rollback)\b/.test(part)) {
      if (!/--dry-run\b/.test(part))
        return {
          decision: 'deny',
          reason:
            'Production deploys come only from the pinned release in mesaaberta-infra. Use `wrangler deploy --dry-run` to bundle.',
        };
    }
    if (
      /\bgit\s+push\b/.test(part) &&
      /(\s-f\b|--force|\s\+\S)/.test(part) &&
      /(^|[\s:+])main(\s|$)/.test(part)
    )
      return { decision: 'deny', reason: 'Never force-push main.' };
    if (CLOUDFLARE_RESOURCE.test(part))
      return {
        decision: 'ask',
        reason:
          'This creates or changes a Cloudflare resource. The project rule is to tell the user first.',
      };
  }
  return null;
}

if (import.meta.main) {
  const input = JSON.parse(await Bun.stdin.text()) as { tool_input?: { command?: string } };
  const verdict = judge(input.tool_input?.command ?? '');
  if (verdict)
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: verdict.decision,
          permissionDecisionReason: verdict.reason,
        },
      }),
    );
}
