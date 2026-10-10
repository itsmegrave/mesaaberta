export const IMPORT_SOURCES = ['catarse', 'meeplestarter'] as const;
export type ImportSource = (typeof IMPORT_SOURCES)[number];
export type SourceCandidate = {
  source: ImportSource;
  externalId: string;
  url: string;
  name: string;
  owner: string;
  startsOn: string;
  endsOn: string;
  imageUrl: string | null;
};
export type Listing = { urls: string[]; nextPage: number | null };
export type SourceReader = (url: string) => Promise<string>;
export type SourceAdapter = {
  source: ImportSource;
  /** Changes when persisted pagination positions no longer refer to the same feed. */
  cursorVersion?: string;
  list(page: number, read: SourceReader): Promise<Listing>;
  detail(url: string, now: Date, read: SourceReader): Promise<SourceCandidate | null>;
};
