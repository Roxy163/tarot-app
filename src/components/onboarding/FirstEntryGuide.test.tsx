import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { OnboardingProvider } from '../../context/OnboardingContext';
import { FirstEntryGuide } from './FirstEntryGuide';

const renderGuide = () => render(
  <OnboardingProvider>
    <FirstEntryGuide />
  </OnboardingProvider>,
);

describe('FirstEntryGuide', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with a functional app preview instead of a decorative icon page', () => {
    renderGuide();

    expect(screen.getByRole('heading', { name: '先看全貌' })).toBeInTheDocument();
    expect(screen.getByText('导览路线')).toBeInTheDocument();
    expect(screen.getByText('每日抽牌')).toBeInTheDocument();
    expect(screen.getByText('自由牌阵')).toBeInTheDocument();
    expect(screen.getAllByTestId('guide-card-back')).toHaveLength(3);
    expect(screen.getAllByRole('img', { name: '未揭晓的塔罗牌' })).toHaveLength(3);
    expect(screen.getByTestId('first-entry-primary-action')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始导览' })).toBeInTheDocument();
  });

  it('moves through feature preview steps with the primary action', async () => {
    const user = userEvent.setup();
    renderGuide();

    await user.click(screen.getByRole('button', { name: '开始导览' }));
    expect(await screen.findByRole('heading', { name: '研习台' })).toBeInTheDocument();
    expect(screen.getByText('日运练习')).toBeInTheDocument();
    expect(screen.getAllByTestId('guide-card-back')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: '下一步' }));
    expect(await screen.findByRole('heading', { name: '抽牌手记' })).toBeInTheDocument();
    expect(screen.getByText('直觉与复盘')).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(screen.getByRole('img', { name: '女祭司 The High Priestess' })).toHaveAttribute('src', expect.stringContaining('ar02.jpg'));
    expect(screen.getByRole('img', { name: '隐士 The Hermit' })).toHaveAttribute('src', expect.stringContaining('ar09.jpg'));
    expect(screen.getByRole('img', { name: '星币侍从 Page of Pentacles' })).toHaveAttribute('src', expect.stringContaining('pepa.jpg'));

    await user.click(screen.getByRole('button', { name: '下一步' }));
    expect(await screen.findByRole('heading', { name: '牌阵工作台' })).toBeInTheDocument();
    expect(screen.getByText('自由画布')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '下一步' }));
    expect(await screen.findByRole('heading', { name: '个人典籍' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '星币侍从 Page of Pentacles' })).toHaveAttribute('src', expect.stringContaining('pepa.jpg'));
  });
});
