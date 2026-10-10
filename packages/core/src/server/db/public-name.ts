import { sql, type AnyColumn } from 'drizzle-orm';

import { NAMELESS } from '../../profile/handle';

export { NAMELESS };

/** The public name of a profile: its username, or a placeholder while it has none. */
export const publicName = (username: AnyColumn) => sql<string>`coalesce(${username}, ${NAMELESS})`;
