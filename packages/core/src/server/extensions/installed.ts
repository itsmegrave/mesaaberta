import type { Extension } from './contract';

/**
 * The extensions this build carries: none. A private build replaces this one file to add its own
 * (`@mesaaberta/privy`, injected at build time), and nothing else in the public code names an
 * extension, so this project builds and runs on its own with no connector (`SOCIAL_PROVIDER=none`).
 */
export const extensions: readonly Extension[] = [];
