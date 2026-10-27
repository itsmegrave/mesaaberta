/**
 * The visitor's browser and OS families from the user agent, for splitting Web Vitals by device in
 * the error tracker. Families only: no versions, device models or the user agent itself.
 */
export type ClientFamily = { browser: string; os: string };

// First match wins: Edge, Opera and Samsung Internet also claim Chrome, and Chrome claims Safari.
const BROWSERS: [RegExp, string][] = [
  [/\bEdgA?\//, 'Edge'],
  [/\b(?:OPR|Opera)\//, 'Opera'],
  [/\bSamsungBrowser\//, 'Samsung Internet'],
  [/\b(?:Firefox|FxiOS)\//, 'Firefox'],
  [/\b(?:Chrome|CriOS|Chromium)\//, 'Chrome'],
  [/\bVersion\/[\d.]+.*\bSafari\//, 'Safari'],
];

const SYSTEMS: [RegExp, string][] = [
  [/\bAndroid\b/, 'Android'],
  [/\b(?:iPhone|iPad|iPod)\b/, 'iOS'],
  [/\bCrOS\b/, 'ChromeOS'],
  [/\bWindows\b/, 'Windows'],
  [/\bMac OS X\b|\bMacintosh\b/, 'macOS'],
  [/\bLinux\b/, 'Linux'],
];

const match = (rules: [RegExp, string][], userAgent: string) =>
  rules.find(([pattern]) => pattern.test(userAgent))?.[1] ?? 'Other';

export const clientFamilyOf = (userAgent: string): ClientFamily => ({
  browser: match(BROWSERS, userAgent),
  os: match(SYSTEMS, userAgent),
});
