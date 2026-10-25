import { describe, expect, it } from 'vitest';
import {
  CROWDFUNDING_REPORT_REASONS,
  PARTNER_REPORT_REASONS,
} from '@mesaaberta/core/moderation/reports';
import {
  ban,
  banReason,
  closeTable,
  removeCrowdfunding,
  removePartner,
} from './moderation-presets';

describe('moderation presets', () => {
  it('names what is taken down and asks for a reason worded for it', () => {
    const campaign = removeCrowdfunding('Dados de Ouro');
    const partner = removePartner('Loja do Dragão');

    expect(campaign.title).toContain('Dados de Ouro');
    expect(campaign.reasons).toBe(CROWDFUNDING_REPORT_REASONS);
    expect(partner.title).toContain('Loja do Dragão');
    expect(partner.reasons).toBe(PARTNER_REPORT_REASONS);
    expect(partner.reasonTarget).toBe('partner');
    expect([campaign.danger, partner.danger]).toEqual([true, true]);
  });

  it('makes closing a table and banning ask for a written justification', () => {
    expect(closeTable('Mesa X')).toMatchObject({ danger: true, write: { required: true } });
    expect(closeTable('Mesa X').title).toContain('Mesa X');
    expect(ban('@ana')).toMatchObject({ danger: true, durations: true, write: banReason() });
    expect(banReason()).toMatchObject({ name: 'reason', required: true });
  });
});
