export type CannyLinks = { feedbackUrl: string | null; changelogUrl: string | null };

/** An http(s) URL without credentials, or null: a blank or malformed variable hides the link. */
function webUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !URL.canParse(value.trim())) return null;
  const url = new URL(value.trim());
  const ok = ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  return ok ? url.href : null;
}

/** The footer's Canny links come from the deployment (`CANNY_FEEDBACK_URL`, `CANNY_CHANGELOG_URL`). */
export function cannyLinks(
  env: Partial<Record<'CANNY_FEEDBACK_URL' | 'CANNY_CHANGELOG_URL', unknown>> | undefined,
): CannyLinks {
  return {
    feedbackUrl: webUrl(env?.CANNY_FEEDBACK_URL),
    changelogUrl: webUrl(env?.CANNY_CHANGELOG_URL),
  };
}
