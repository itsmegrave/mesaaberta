import { publicConfig, readConfig, type PublicConfig } from '@mesaaberta/config';
import type { Logger } from '@mesaaberta/core/server/logger';

export type Site = PublicConfig;

/**
 * What the pages say about this deployment: its address, who to write to, who answers for the
 * personal data, its Instagram. They come from the deployment's variables (`APP_ORIGIN`,
 * `CONTACT_EMAIL`, `PRIVACY_CONTROLLER_NAME`, `PRIVACY_EMAIL`, `INSTAGRAM_HANDLE`); a blank one
 * takes a placeholder. A malformed one is logged and every value falls back to the placeholders:
 * a typo in a variable must not take the site down.
 */
export function siteOf(env: App.Locals['env'], log?: Pick<Logger, 'warn'>): Site {
  try {
    return publicConfig(readConfig((env ?? {}) as Record<string, unknown>));
  } catch {
    log?.warn('site configuration invalid', { code: 'site_config_invalid' });
    return publicConfig(readConfig());
  }
}
