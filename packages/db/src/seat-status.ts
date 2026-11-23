// Where a player stands at a table (`registrations`) and at one of its sessions
// (`table_session_signups`). Leaving or being turned down deletes the row, so neither has an end
// state.
export const REGISTRATION_STATUSES = ['pending', 'confirmed'] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export const SESSION_SIGNUP_STATUSES = ['going', 'waiting'] as const;
export type SessionSignupStatus = (typeof SESSION_SIGNUP_STATUSES)[number];
