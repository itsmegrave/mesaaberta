// Relative imports only: the Cron Trigger's Worker entry bundles this file without `#lib`.
import type { AnyStateMachine } from 'xstate';
import { TABLE_SESSION_STATUSES, TABLE_STATUSES } from '../tables/status-values';
import { REPORT_STATUSES } from '../moderation/reports';
import { reportMachine } from '../moderation/report-machine';
import { tableLifecycle } from '../tables/lifecycle-machine';
import { tableSessionMachine } from '../tables/session-machine';
import { INVITATION_STATUSES } from '@mesaaberta/db/invitation-status';
import { invitationMachine } from './invitation-machine';
import { CATALOG_STATUSES } from '@mesaaberta/db/catalog-status';
import { catalogMachine } from './catalog-machine';
import { IMPORT_RUN_STATUSES } from '@mesaaberta/db/import-run-status';
import { importRunMachine } from './import-run-machine';
import {
  LOGO_STATUSES,
  PARTNER_LINK_STATUSES,
  PLACE_CLAIM_STATUSES,
} from '@mesaaberta/db/review-status';
import { logoMachine, partnerLinkMachine, placeClaimMachine } from './review-machines';
import { REGISTRATION_STATUSES, SESSION_SIGNUP_STATUSES } from '@mesaaberta/db/seat-status';
import { registrationMachine, sessionSignupMachine } from './seat-machines';

/**
 * Every status machine, with the values its column can hold. A spec checks each machine has one
 * state per value, and `machines.md` beside it is drawn from this list (see machines.spec.ts).
 */
export const STATUS_MACHINES: {
  title: string;
  column: string;
  machine: AnyStateMachine;
  values: readonly string[];
}[] = [
  {
    title: 'Table (mesa)',
    column: 'game_tables.status',
    machine: tableLifecycle,
    values: TABLE_STATUSES,
  },
  {
    title: 'Table session (sessão)',
    column: 'table_sessions.status',
    machine: tableSessionMachine,
    values: TABLE_SESSION_STATUSES,
  },
  {
    title: 'Report (denúncia)',
    column: 'reports.status',
    machine: reportMachine,
    values: REPORT_STATUSES,
  },
  {
    title: 'Invitation (mesa, parceiro, lugar)',
    column: 'player_invitations / partner_invitations / place_host_invitations.status',
    machine: invitationMachine,
    values: INVITATION_STATUSES,
  },
  {
    title: 'Seat (vaga na mesa)',
    column: 'registrations.status',
    machine: registrationMachine,
    values: REGISTRATION_STATUSES,
  },
  {
    title: 'Session sign-up (vaga na sessão)',
    column: 'table_session_signups.status',
    machine: sessionSignupMachine,
    values: SESSION_SIGNUP_STATUSES,
  },
  {
    title: 'Catalog entry (sistema, plataforma, tag, recurso de lugar)',
    column: 'systems / platforms / tags / place_features.status',
    machine: catalogMachine,
    values: CATALOG_STATUSES,
  },
  {
    title: 'System logo (logo de sistema)',
    column: 'system_logos.status',
    machine: logoMachine,
    values: LOGO_STATUSES,
  },
  {
    title: 'Place claim (reivindicação de lugar)',
    column: 'place_claims.status',
    machine: placeClaimMachine,
    values: PLACE_CLAIM_STATUSES,
  },
  {
    title: 'Place partner link (parceiro no lugar)',
    column: 'place_partner_links.status',
    machine: partnerLinkMachine,
    values: PARTNER_LINK_STATUSES,
  },
  {
    title: 'Crowdfunding import run (importação diária)',
    column: 'crowdfunding_import_runs.status',
    machine: importRunMachine,
    values: IMPORT_RUN_STATUSES,
  },
];
