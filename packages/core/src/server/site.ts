import {
  publicConfig,
  publicConfigSchema,
  readConfig,
  type PublicConfig,
} from '@mesaaberta/config';
import type { Logger } from '@mesaaberta/core/server/logger';

export type Site = PublicConfig;

/**
 * What the pages say about this deployment: its address, who to write to, who answers for the
 * personal data, its Instagram. They come from the deployment's variables (`APP_ORIGIN`,
 * `CONTACT_EMAIL`, `PRIVACY_CONTROLLER_NAME`, `PRIVACY_EMAIL`, `INSTAGRAM_HANDLE`); a blank one
 * takes a placeholder. A malformed one is logged and other public facts fall back to placeholders.
 * A valid public origin is preserved independently so unrelated settings cannot change SEO URLs.
 */
export function siteOf(env: App.Locals['env'], log?: Pick<Logger, 'warn'>): Site {
  try {
    return publicConfig(readConfig((env ?? {}) as Record<string, unknown>));
  } catch {
    log?.warn('site.configuration_invalid', { code: 'site_config_invalid' });
    const fallback = publicConfig(readConfig());
    // Contact and calendar settings must not replace valid canonical/sitemap URLs with localhost.
    const origin = publicConfigSchema.shape.APP_ORIGIN.safeParse(env?.APP_ORIGIN);
    return { ...fallback, APP_ORIGIN: origin.success ? origin.data : fallback.APP_ORIGIN };
  }
}
