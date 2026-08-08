import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicTab } from './PublicTab';
import { getPublicReadings } from '../../lib/firebaseData';
import type { TarotReading } from '../../types';

vi.mock('../../lib/firebaseData', () => ({
  getPublicReadings: vi.fn(),
}));

const createReading = (overrides: Partial<TarotReading> = {}): TarotReading => ({
  id: 'public-reading-1',
  userId: 'user-1',
  date: '2026-07-28T08:12:37.036Z',
  question: '缓存公开记录',
  spread: '单牌阵',
  cards: [{ name: '愚者', isReversed: false }],
  interpretation: { singleCard: '保持开放。', combination: '', summary: '' },
  keywords: [],
  isPublic: true,
  authorName: 'Roxy',
  isAnonymous: false,
  ...overrides,
});

describe('PublicTab', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(getPublicReadings).mockReset();
  });

  it('keeps cached public readings visible when cloud loading fails', async () => {
    localStorage.setItem('tarot_public_readings_cache_v1', JSON.stringify([createReading()]));
    vi.mocked(getPublicReadings).mockRejectedValueOnce(new Error('offline'));

    render(
      <PublicTab
        readings={[]}
        cardMetadata={[]}
        onTagClick={vi.fn()}
        onAuthorClick={vi.fn()}
        onProcessAi={vi.fn()}
      />,
    );

    expect(screen.getByText('缓存公开记录')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('云端读取慢，先展示上次保存的公开手记。')).toBeInTheDocument();
    });
  });
});
