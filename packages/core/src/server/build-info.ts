/**
 * Which build an app runs, as the deploy pipeline sets it on each Worker: the release version
 * (`DEPLOYMENT_VERSION`, the tag without its `v`) and the source commit (`DEPLOYMENT_SOURCE_SHA`).
 * Both are absent on local and self-hosted runs that do not set them.
 */
export type BuildEnv = { DEPLOYMENT_VERSION?: string; DEPLOYMENT_SOURCE_SHA?: string };

export type BuildInfo = { version: string | null; revision: string | null };

export function buildInfoOf(env: BuildEnv | undefined): BuildInfo {
  return {
    version: env?.DEPLOYMENT_VERSION?.trim().replace(/^v/, '') || null,
    revision: env?.DEPLOYMENT_SOURCE_SHA?.trim() || null,
  };
}
