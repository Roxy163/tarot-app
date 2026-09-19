import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { CardAnnotationEditor } from './CardAnnotationEditor';
import { cardAnnotationService } from '../services/cardAnnotationService';
import { readLocalDraft, resetDraftMemory } from '../hooks/useLocalDraft';

describe('annotation editor drafts', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); resetDraftMemory(); cardAnnotationService.clearAllUserData(); });
  afterEach(() => vi.restoreAllMocks());
  it('does not create stale drafts just by viewing a card', () => {
    const first = render(<CardAnnotationEditor isOpen initialCardId="ar00" onClose={vi.fn()} />);
    first.unmount();
    resetDraftMemory();
    expect(readLocalDraft('tarot_annotation_draft_guest_ar00')).toBeNull();
    cardAnnotationService.saveUserAnnotation('ar00', { personalNotes: '另一处更新的注解' });
    render(<CardAnnotationEditor isOpen initialCardId="ar00" onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText('记录你个人对这张牌的理解和感悟...')).toHaveValue('另一处更新的注解');
  });
  it('restores unsaved personal notes after closing and reopening', async () => {
    const user = userEvent.setup();
    const first = render(<CardAnnotationEditor isOpen initialCardId="ar00" onClose={vi.fn()} />);
    await user.type(screen.getByPlaceholderText('记录你个人对这张牌的理解和感悟...'), '还没正式保存的理解');
    first.unmount();
    resetDraftMemory();
    render(<CardAnnotationEditor isOpen initialCardId="ar00" onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText('记录你个人对这张牌的理解和感悟...')).toHaveValue('还没正式保存的理解');
    expect(cardAnnotationService.getUserAnnotation('ar00')).toBeNull();
  });
  it('shows an error and keeps the text when a save fails', async () => {
    const user = userEvent.setup();
    render(<CardAnnotationEditor isOpen initialCardId="ar00" onClose={vi.fn()} />);
    await user.type(screen.getByPlaceholderText('记录你个人对这张牌的理解和感悟...'), '不要丢失');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    await user.click(screen.getByRole('button', { name: '保存修改' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('保存失败'));
    expect(screen.getByPlaceholderText('记录你个人对这张牌的理解和感悟...')).toHaveValue('不要丢失');
    expect(screen.queryByText('《愚者》的注解已保存')).not.toBeInTheDocument();
  });
});
