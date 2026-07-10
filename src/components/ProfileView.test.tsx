import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProfileView } from './ProfileView';
import { TarotReading, UserProfile } from '../types';

const profile: UserProfile = {
  id: 'user-1',
  user_public_id: 'TAROT-00000001',
  display_name: 'Roxy',
  bio: '在森林里记录牌的回声',
  createdAt: '2026-05-21T00:00:00.000Z',
};

const makeReading = (id: string, date: string, question: string): TarotReading => ({
  id,
  userId: 'user-1',
  date,
  question,
  spread: '单牌阵',
  cards: [{ name: '女祭司', isReversed: false, label: '主牌' }],
  interpretation: {
    singleCard: '',
    combination: '',
    summary: '',
  },
  keywords: ['直觉'],
  isPublic: false,
  authorName: 'Roxy',
  isAnonymous: false,
});

const baseProps = {
  authorName: 'Roxy',
  profile,
  readings: [
    makeReading('old-reading', '2026-05-01T00:00:00.000Z', '更早的问题'),
    makeReading('new-reading', '2026-07-04T00:00:00.000Z', '最新的问题'),
  ],
  cardMetadata: [],
  onTagClick: vi.fn(),
  onEditReading: vi.fn(),
  onDeleteReading: vi.fn(),
  onTogglePublic: vi.fn(),
  onUpdateProfile: vi.fn(),
  onViewAll: vi.fn(),
  onLogout: vi.fn(),
};

describe('ProfileView', () => {
  it('uses a compact profile dashboard while keeping account actions and latest reading', () => {
    render(<ProfileView {...baseProps} />);

    expect(screen.getByTestId('profile-dashboard-card')).toBeInTheDocument();
    expect(screen.getByText('Roxy')).toBeInTheDocument();
    expect(screen.getByText('在森林里记录牌的回声')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '复制阁主编号' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '功能介绍' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '封印离阁' })).toBeInTheDocument();
    expect(screen.getByText('阁中典籍')).toBeInTheDocument();
    expect(screen.getByText('最新的问题')).toBeInTheDocument();
    expect(screen.queryByText('更早的问题')).not.toBeInTheDocument();
  });
});
