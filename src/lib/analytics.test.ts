import { describe, expect, it } from 'vitest';
import { sanitizeAnalyticsParams } from './analytics';

describe('analytics privacy sanitizer', () => {
  it('keeps coarse usage values and removes sensitive fields', () => {
    expect(sanitizeAnalyticsParams({
      tab: 'home',
      card_count: 3,
      is_logged_in: true,
      question: '我的工作怎么选？',
      clientName: '小明',
      prompt_text: '你是塔罗师……',
      uid: 'secret-user-id',
      email: 'user@example.com',
    })).toEqual({
      tab: 'home',
      card_count: 3,
      is_logged_in: true,
    });
  });

  it('normalizes invalid keys and trims long string values', () => {
    const result = sanitizeAnalyticsParams({
      'active tab': 'metadata',
      format: 'markdown'.repeat(20),
      infinity: Number.POSITIVE_INFINITY,
      unused: null,
    });

    expect(result.active_tab).toBe('metadata');
    expect(result.format).toHaveLength(80);
    expect(result).not.toHaveProperty('infinity');
    expect(result).not.toHaveProperty('unused');
  });
});
