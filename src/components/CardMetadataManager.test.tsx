import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cardAnnotationService } from '../services/cardAnnotationService';
import { CardMetadataManager } from './CardMetadataManager';

vi.mock('./CardAnnotationEditor', () => ({
  CardAnnotationEditor: ({ isOpen, initialCardId, onAnnotationsUpdated }: {
    isOpen: boolean;
    initialCardId?: string;
    onAnnotationsUpdated?: () => void;
  }) => {
    if (!isOpen) return null;

    return (
      <div>
        {initialCardId && <p>正在编辑 {initialCardId}</p>}
        <button
          type="button"
          onClick={() => {
            cardAnnotationService.saveUserAnnotation('ar00', {
              uprightMeaning: '模拟注解',
            });
            onAnnotationsUpdated?.();
          }}
        >
          模拟保存
        </button>
      </div>
    );
  },
}));

vi.mock('./ConfirmDialog', () => ({
  ConfirmDialog: () => null,
}));

describe('CardMetadataManager', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  let anchorClickSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    localStorage.clear();
    cardAnnotationService.clearAllUserData();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:card-library-export'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    anchorClickSpy?.mockRestore();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: originalRevokeObjectURL,
    });
  });

  it('refreshes the modified count after annotation updates from the editor', async () => {
    const user = userEvent.setup();

    render(
      <CardMetadataManager
        metadata={[]}
        onUpdate={vi.fn()}
        readings={[]}
        onShowSnackbar={vi.fn()}
        isLoggedIn={false}
      />,
    );

    expect(screen.queryByText(/已自定义 \d+ 张牌的注解/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '批量编辑单牌牌义' }));
    await user.click(screen.getByRole('button', { name: '模拟保存' }));

    expect(screen.getByText('已自定义 1 张牌的注解')).toBeInTheDocument();
  });

  it('opens the annotation editor directly for an initial card id', () => {
    render(
      <CardMetadataManager
        metadata={[]}
        onUpdate={vi.fn()}
        readings={[]}
        onShowSnackbar={vi.fn()}
        isLoggedIn={false}
        initialCardId="ar00"
      />,
    );

    expect(screen.getByText('正在编辑 ar00')).toBeInTheDocument();
  });

  it('shows saved daily fortune examples and full daily history for each card', async () => {
    const user = userEvent.setup();
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    render(
      <CardMetadataManager
        metadata={[]}
        onUpdate={vi.fn()}
        readings={[]}
        dailyFortunes={[
          {
            id: 'fortune-1',
            userId: 'local',
            date: `${currentMonth}-17`,
            cardName: '愚者',
            isReversed: false,
            interpretation: '今天是充满可能性的一天。',
            keywords: ['愚者', '正位'],
            initialImpression: '想要跳出原来的规则。',
            dailyReview: '下午真的临时改了计划。',
            reflection: '第一直觉：想要跳出原来的规则。\n\n今日回看：下午真的临时改了计划。',
            archivedAt: '2026-07-17T21:00:00.000Z',
            savedToCardAnnotationAt: '2026-07-17T22:00:00.000Z',
            source: 'physical-draw',
            createdAt: '2026-07-17T08:00:00.000Z',
          },
          {
            id: 'fortune-2',
            userId: 'local',
            date: `${currentMonth}-16`,
            cardName: '愚者',
            isReversed: true,
            interpretation: '今天需要更加谨慎。',
            keywords: ['愚者', '逆位'],
            reflection: '旧记录只有一段回看。',
            archivedAt: '2026-07-16T21:00:00.000Z',
            source: 'app-draw',
            createdAt: '2026-07-16T08:00:00.000Z',
          },
        ]}
        onShowSnackbar={vi.fn()}
        isLoggedIn={false}
      />,
    );

    expect(screen.getByText('日运 ×2')).toBeInTheDocument();
    expect(screen.getByText('本月 ×2')).toBeInTheDocument();
    expect(screen.getByText('例证 ×1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '查看愚者研习资料' }));

    expect(screen.getByRole('dialog', { name: '愚者研习资料' })).toBeInTheDocument();
    expect(screen.getByText('日运例证')).toBeInTheDocument();
    expect(screen.getAllByText(/想要跳出原来的规则/).length).toBeGreaterThan(0);
    expect(screen.getByText('日运历史')).toBeInTheDocument();
    expect(screen.getByText(/旧记录只有一段回看/)).toBeInTheDocument();
  });

  it('opens the booklet export menu and downloads the selected format', async () => {
    const user = userEvent.setup();
    const onShowSnackbar = vi.fn();

    render(
      <CardMetadataManager
        metadata={[]}
        onUpdate={vi.fn()}
        readings={[]}
        onShowSnackbar={onShowSnackbar}
        isLoggedIn={false}
        ownerName="阿若"
      />,
    );

    await user.click(screen.getByRole('button', { name: '撰录成册' }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('当前筛选 78 张')).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: '表格' }));

    expect(anchorClickSpy).toHaveBeenCalled();
    expect(onShowSnackbar).toHaveBeenCalledWith('已开始下载当前筛选 78 张的表格。');
  });

  it('closes the booklet export menu when clicking outside', async () => {
    const user = userEvent.setup();

    render(
      <CardMetadataManager
        metadata={[]}
        onUpdate={vi.fn()}
        readings={[]}
        isLoggedIn={false}
      />,
    );

    await user.click(screen.getByRole('button', { name: '撰录成册' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(screen.getByText('塔罗牌库'));

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });
});
