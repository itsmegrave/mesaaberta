/** What the Instagram panel reads: the load of the extension (core) and the site settings. */
export type InstagramPanelData = {
  site: { INSTAGRAM_HANDLE?: string };
  account: { username: string; expiresAt: Date | string } | null;
  unreadable: boolean;
  configured: boolean;
  connected: boolean;
  connectionError: boolean;
  uncertain: { tableId: string; containerId: string | null; createdAt: Date | string }[];
};
