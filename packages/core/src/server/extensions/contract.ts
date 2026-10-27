import type { ZodType } from 'zod';
import type { ViewerSegments } from '../audience/segments';
import type { BadgeDefinition } from '../badges/catalog';
import type { AnyDb } from '../db/client';
import type { Handler } from '../events/types';
import type { Flags } from '../flags/flags';
import type { SocialPublisher } from '../social/port';

/**
 * Saves what an OAuth handshake produced, through the admin action of that name. The host decides
 * whether the api Worker or this process runs it; the extension only names the action and its data.
 */
export type SaveAction = (action: string, data: Record<string, string>) => Promise<void>;

/** Connecting an external account from the admin: the browser leaves for `origin` and comes back. */
export interface OAuthConnection {
  /** The origin the authorize page lives on, so the redirect may leave the app. */
  readonly origin: string;
  /** Whether the deployment has the credentials to start the handshake. */
  configured(env: object | undefined): boolean;
  /** The page to send the admin to. `state` is checked when they come back. */
  authorizeUrl(env: object | undefined, state: string): URL;
  /** Trades the code for the account and saves it with `save`. Throws on any failure. */
  complete(env: object | undefined, code: string, save: SaveAction): Promise<void>;
}

/** What an admin does by hand with an extension, by name (the web form and the api route run these). */
export type AdminAction = {
  schema: ZodType;
  apply(db: AnyDb, env: never, data: never): Promise<Record<string, unknown>>;
};

/** A file the network fetches without cookies, such as the image of a post. */
export type PublicAsset = { body: Uint8Array<ArrayBuffer>; type: string };

/**
 * An extension's own entry in the admin navigation (under Communication), for a panel that is not
 * an account connection, such as the polls. `icon` is a name the web app's `<Icon>` knows; another
 * name draws the globe.
 */
export type AdminSection = { label: string; lede: string; icon: string };

/**
 * What the admin shows for an extension at `/admin/<id>`: a panel on the connections page, or a
 * section of its own when it has `section`. The connections page counts beside the navigation.
 */
export interface AdminSurface {
  /** How many things wait on an admin (the badge in the navigation). */
  count(db: AnyDb): Promise<number>;
  /** The data of its panel, merged into the page's data. Never a token or a secret. */
  load(db: AnyDb, env: object | undefined): Promise<Record<string, unknown>>;
  /** Its own section in the navigation instead of the connections page. */
  readonly section?: AdminSection;
}

/** The signed-in person a widget is chosen for, with the facts an audience rule reads. */
export type WidgetViewer = { id: string; segments: ViewerSegments };

/**
 * A widget for the page to show. `kind` picks its component (the `widgets` map of the web app's
 * `panels.ts`), which is the only reader of `data`. Plain JSON: it crosses the network.
 */
export type WidgetPayload = { id: string; kind: string; data: Record<string, unknown> };

/** What an answer did: the widget as it now stands, null once it has nothing more to show, or a refusal. */
export type WidgetAnswer = { widget: WidgetPayload | null } | { invalid: true };

/**
 * Small things shown over any page, such as a poll (Trello #231). The public code only asks for
 * them and hands answers back; which widgets exist, where they show and who sees them is the
 * extension's business. Every method reads its own flags, so a widget nobody turned on stays out.
 */
export interface WidgetSurface {
  /**
   * The widgets this person may see on the page with this SvelteKit route id (`/t/[slug]`), most
   * important first. The page shows the first one whose kind it has a component for.
   */
  forViewer(
    db: AnyDb,
    viewer: WidgetViewer,
    routeId: string,
    flags: Flags,
  ): Promise<readonly WidgetPayload[]>;
  /**
   * Records an answer (a vote, a dismissal: the form's fields, as the component sent them). Null
   * when there is no such widget for this person, which the page answers with a 404.
   */
  respond(
    db: AnyDb,
    viewer: WidgetViewer,
    widgetId: string,
    fields: Readonly<Record<string, string>>,
    flags: Flags,
  ): Promise<WidgetAnswer | null>;
  /**
   * The widget on its own page (`/<id>/w/<widgetId>`), for anyone, signed in or not: a poll's
   * public results. Null when it has no public page.
   */
  page?(db: AnyDb, widgetId: string, flags: Flags): Promise<WidgetPayload | null>;
}

/**
 * A feature that plugs into Mesa Aberta from outside the public code: Instagram today, more later
 * (Trello #207, #208). An extension fills only the points it uses. The public code reads extensions
 * from `installed.ts` and never names one, so a build without any still compiles and runs.
 *
 * Runtime-neutral like the rest of core: the delivery graph, the api and the background Worker all
 * load this, so nothing here may pull in SvelteKit, Svelte components or `Bun.*`.
 */
export interface Extension {
  /**
   * Stable and unique: it is the URL segment (`/admin/<id>`, `/<id>/assets/...`). Never rename one
   * that has shipped, and reserve it as a username, because a profile lives at `/u/<username>`.
   */
  readonly id: string;
  /**
   * The feature flags it owns, each with the value used when GrowthBook cannot answer (new flags
   * default to `false`). The key in GrowthBook is the same name. The public registry never lists
   * them, so a private flag's name stays out of the public code. `api_admin_<id>` is read for the
   * admin hand actions to run in the api Worker.
   */
  readonly flags?: Readonly<Record<string, boolean>>;
  /** A social network that tables are announced on (ADR 0001/0007). */
  readonly social?: SocialPublisher;
  /** Event handlers of its own, besides its connector's. Names are stored in `handledBy`. */
  readonly handlers?: readonly Handler[];
  /** Its panel on the admin's connections page (`/admin/<id>`). */
  readonly admin?: AdminSurface;
  /** Connecting its account from the admin. */
  readonly oauth?: OAuthConnection;
  /** Its admin hand actions, run by the web form and by the api Worker's route. */
  readonly adminActions?: Readonly<Record<string, AdminAction>>;
  /** Looks up a public asset by key, or null when there is none (or it expired). */
  asset?(db: AnyDb, key: string): Promise<PublicAsset | null>;
  /** Widgets shown over the app's pages, such as polls. */
  readonly widgets?: WidgetSurface;
  /**
   * Badges of its own, such as a supporter badge (Trello #224). The badge handler checks one after
   * the public events its `triggers` name; for an event of its own, the extension's handler calls
   * `awardBadges` with `triggers: []`. A `measure` reads its own tables through `stats.person`. The
   * id must be new: it is stored in `user_badges` and keys the badge's look in the web app's
   * `panels.ts` (`badges`).
   */
  readonly badges?: readonly BadgeDefinition[];
  /**
   * Erases what it keeps about a person whose account is being closed (`closeAccount`), inside
   * that transaction. The profile row stays, so a foreign key cascade never fires: delete here.
   */
  onAccountClosed?(tx: AnyDb, profileId: string): Promise<void>;
}
