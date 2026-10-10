import { instagramSocial } from './instagram';
import { noSocial } from './none';
import type { SocialEnv, SocialPublisher } from './port';

export type { PublishResult, QueueResult, SocialEnv, SocialPublisher } from './port';

/**
 * The connector for this deployment: Instagram unless `SOCIAL_PROVIDER` says `none`. Unset keeps
 * today's behaviour, so a deployment opts out, not in.
 */
export function socialFor(env: SocialEnv | undefined): SocialPublisher {
  return env?.SOCIAL_PROVIDER === 'none' ? noSocial : instagramSocial;
}
