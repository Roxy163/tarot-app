import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LegalModal } from './LegalModal';

describe('LegalModal', () => {
  it('lets users switch between privacy policy and user agreement', async () => {
    const user = userEvent.setup();

    render(<LegalModal isOpen onClose={vi.fn()} initialTab="privacy" />);

    expect(screen.getByRole('heading', { name: '隐私政策' })).toBeInTheDocument();
    expect(screen.getByText('会保存什么')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: '用户协议' }));

    expect(screen.getByRole('heading', { name: '用户协议' })).toBeInTheDocument();
    expect(screen.getByText('广场规则')).toBeInTheDocument();
  });
});
