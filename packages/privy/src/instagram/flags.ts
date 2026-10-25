/**
 * The flags Instagram owns, with their defaults (the key in GrowthBook is the same name).
 * `use_table_image`: off, the post is text and QR artwork; on, it includes the table photo as its
 * background. `api_admin_instagram`: off, the admin's hand actions on posts (queue a table,
 * reconcile an uncertain post, save the account the OAuth callback connected) run in the web
 * Worker; on, the api Worker does them over the Service Binding while the render and the publish
 * stay in the background. A call that cannot be made falls back to the web path. Every admin may
 * have it: the flag is a kill switch.
 */
export const instagramFlags = {
  use_table_image: false,
  api_admin_instagram: false,
} as const satisfies Record<string, boolean>;
