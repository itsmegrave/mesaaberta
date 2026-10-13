/**
 * What the announcement action tells the form besides field errors: `confirm` (how many it will
 * reach, and the one person when there is one), `empty` (an audience of nobody) or `invalid`.
 */
export type AnnouncementMessage = {
  code: 'confirm' | 'empty' | 'invalid';
  count?: number;
  recipient?: string;
};
