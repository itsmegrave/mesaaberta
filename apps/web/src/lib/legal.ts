// Facts the privacy policy and the terms both state. Who answers for the data comes from the
// deployment (`PRIVACY_CONTROLLER_NAME`, `PRIVACY_EMAIL`; see `siteOf`).

/** The date both documents took effect. */
export const updated = { iso: '2026-09-27', label: '27 de setembro de 2026' };

/**
 * Who answers for the personal data (LGPD art. 5, VI) and where the data subject writes to, from
 * the deployment's site settings (`page.data.site`). Empty while they are not loaded.
 */
export const controllerOf = (
  site: { PRIVACY_CONTROLLER_NAME?: string; PRIVACY_EMAIL?: string } | null | undefined,
) => ({
  name: site?.PRIVACY_CONTROLLER_NAME ?? '',
  email: site?.PRIVACY_EMAIL ?? '',
});
