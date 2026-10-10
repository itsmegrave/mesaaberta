import type { SocialPublisher } from './port';

/** No social network: every request is unavailable and nothing is persisted or sent. */
export const noSocial: SocialPublisher = {
  name: 'none',
  configured: () => false,
  queueTable: async () => 'unavailable',
  publishTable: async () => 'unavailable',
  publishDue: async () => 0,
  handlers: [],
};
