import { extensions, type Extension } from '../extensions/index';
import { noSocial } from './none';
import type { SocialEnv, SocialPublisher } from './port';

export type { PublishResult, QueueResult, SocialEnv, SocialPublisher } from './port';

/**
 * The connector for this deployment, from the installed extensions. `SOCIAL_PROVIDER` names one
 * (`none` opts out); unset takes the first installed, so a build with Instagram keeps today's
 * behaviour and a build with no connector gets `none`. A name nothing installed answers is `none`.
 */
export function socialFor(
  env: SocialEnv | undefined,
  installed: readonly Extension[] = extensions,
): SocialPublisher {
  const provider = env?.SOCIAL_PROVIDER;
  if (provider === 'none') return noSocial;
  const connectors = installed.flatMap((extension) => (extension.social ? [extension.social] : []));
  const chosen = provider
    ? connectors.find((connector) => connector.name === provider)
    : connectors[0];
  return chosen ?? noSocial;
}
