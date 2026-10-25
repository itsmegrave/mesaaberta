import { instagramExtension } from '../instagram/extension';
import type { Extension } from './contract';

/**
 * The extensions this build carries. A private build replaces this one file to add its own, and
 * nothing else in the public code names an extension. Instagram is still here until it moves to
 * the private package (Trello #209-#212); after that the public default is an empty list.
 */
export const extensions: readonly Extension[] = [instagramExtension];
