import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const makeReading = (id: string, question: string, userFeedback = ''): TarotReading => ({
  id,
  userId: 'user-1',
  date: '2026-07-04T00:00:00.000Z',
  question,
  spread: '单牌阵',
  cards: [{ name: '女祭司', isReversed: false, label: '主牌' }],
  interpretation: {
    singleCard: '',
    combination: '',
    summary: '',
  },
  keywords: ['直觉'],
  userFeedback,
  isPublic: false,
  authorName: 'Roxy',
  isAnonymous: false,
});

const baseProps = {
  authorName: 'Roxy',
  profile,
  isLoggedIn: true,
  isEmailVerified: true,
  email: 'roxy@example.com',
  readings: [
    makeReading('reading-1', '第一条'),
    makeReading('reading-2', '第二条', '已经复盘。'),
  ],
  cardMetadata: [
    {
      id: 'card-1',
      name: '女祭司',
      english: 'The High Priestess',
      keywords: ['直觉'],
      meaning: '内在智慧',
      reversedMeaning: '',
    },
  ],
  onUpdateProfile: vi.fn(),
  onLogin: vi.fn(),
  onBackHome: vi.fn(),
  onOpenSecurity: vi.fn(),
  onLogout: vi.fn(),
};

describe('ProfileView', () => {
  it('shows a focused account settings page without the old profile dashboard', () => {
    render(<ProfileView {...baseProps} />);

    expect(screen.getByTestId('account-settings-page')).toBeInTheDocument();
    expect(screen.getByText('管理登录与名称')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Roxy')).toBeInTheDocument();
    expect(screen.getByDisplayValue('在森林里记录牌的回声')).toBeInTheDocument();
    expect(screen.getByText('roxy@example.com')).toBeInTheDocument();
    expect(screen.getByText('已验证')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '邮箱与密码管理' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '退出登录' })).toBeInTheDocument();

    expect(screen.queryByText('公开案例')).not.toBeInTheDocument();
    expect(screen.queryByText('最近研习')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '复制阁主编号' })).not.toBeInTheDocument();
  });

  it('saves edited display name and bio', async () => {
    const user = userEvent.setup();
    const onUpdateProfile = vi.fn().mockResolvedValue(undefined);
    render(<ProfileView {...baseProps} onUpdateProfile={onUpdateProfile} />);

    await user.clear(screen.getByDisplayValue('Roxy'));
    await user.type(screen.getByPlaceholderText('给自己起一个好记的名字'), 'Roxy 新名字');
    await user.click(screen.getByRole('button', { name: '保存账号资料' }));

    expect(onUpdateProfile).toHaveBeenCalledWith({
      display_name: 'Roxy 新名字',
      bio: '在森林里记录牌的回声',
    });
  });

  it('shows guest login entry when the user is not signed in', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();
    render(
      <ProfileView
        {...baseProps}
        profile={null}
        isLoggedIn={false}
        email={null}
        readings={[]}
        cardMetadata={[]}
        onLogin={onLogin}
      />,
    );

    expect(screen.getByText('登录与同步')).toBeInTheDocument();
    expect(screen.getByText('当前是访客模式。登录后，手记、日运和牌义注疏会同步到云端。')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '登录并开启同步' }));
    expect(onLogin).toHaveBeenCalledTimes(1);
  });
});
