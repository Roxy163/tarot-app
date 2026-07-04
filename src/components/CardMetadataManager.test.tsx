import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cardAnnotationService } from '../services/cardAnnotationService';
import { CardMetadataManager } from './CardMetadataManager';

vi.mock('./CardAnnotationEditor', () => ({
  CardAnnotationEditor: ({ isOpen, onAnnotationsUpdated }: {
    isOpen: boolean;
    onAnnotationsUpdated?: () => void;
  }) => {
    if (!isOpen) return null;

    return (
      <div>
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
  beforeEach(() => {
    localStorage.clear();
    cardAnnotationService.clearAllUserData();
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

    await user.click(screen.getByRole('button', { name: '批量编辑牌义' }));
    await user.click(screen.getByRole('button', { name: '模拟保存' }));

    expect(screen.getByText('已自定义 1 张牌的注解')).toBeInTheDocument();
  });
});
