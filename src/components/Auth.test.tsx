import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Auth } from './Auth';
import { useAuth } from '../context/AuthContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../lib/firebase', () => ({
  checkIfMagicLink: vi.fn(() => null),
  confirmPasswordReset: vi.fn(),
}));

const mockUseAuth = vi.mocked(useAuth);

const setupAuth = (overrides: Partial<ReturnType<typeof useAuth>> = {}) => {
  mockUseAuth.mockReturnValue({
    session: null,
    isLoading: false,
    isLocalFallback: false,
    isEmailVerified: false,
    lastLogin: null,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    resetPassword: vi.fn(),
    updatePassword: vi.fn(),
    sendVerificationEmail: vi.fn(),
    refreshUser: vi.fn(),
    ...overrides,
  });
};

describe('Auth', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows actionable network guidance when login cannot reach Firebase', async () => {
    const user = userEvent.setup();
    setupAuth({
      signIn: vi.fn().mockRejectedValue({ code: 'auth/network-request-failed' }),
    });

    const onClose = vi.fn();
    render(<Auth onClose={onClose} />);

    await user.type(screen.getByPlaceholderText('example@email.com'), 'roxy@example.com');
    await user.type(screen.getByPlaceholderText('至少6位字符'), 'secret123');
    await user.click(screen.getByRole('button', { name: '登录' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('网络没有连上认证服务')).toBeInTheDocument();
    expect(screen.getByText('账号和本机记录都不会因此清空。', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('可以先返回研习阁，在本机记录，无需等待登录。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '网络好了再试' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '先不登录，开始记录' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('opens password reset from wrong password recovery action', async () => {
    const user = userEvent.setup();
    setupAuth({
      signIn: vi.fn().mockRejectedValue({ code: 'auth/invalid-credential' }),
    });

    render(<Auth />);

    await user.type(screen.getByPlaceholderText('example@email.com'), 'roxy@example.com');
    await user.type(screen.getByPlaceholderText('至少6位字符'), 'wrong-pass');
    await user.click(screen.getByRole('button', { name: '登录' }));

    expect(await screen.findByText('邮箱或密码不正确')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '找回密码' }));

    expect(screen.getByRole('heading', { name: '找回密码' })).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('roxy@example.com')).toHaveLength(2);
  });

  it('exposes privacy and terms links from the login form', async () => {
    const user = userEvent.setup();
    const onOpenLegal = vi.fn();
    setupAuth();

    render(<Auth onOpenLegal={onOpenLegal} />);

    await user.click(screen.getByRole('button', { name: /用户协议/ }));
    expect(onOpenLegal).toHaveBeenCalledWith('terms');

    await user.click(screen.getByRole('button', { name: /隐私政策/ }));
    expect(onOpenLegal).toHaveBeenCalledWith('privacy');
  });
});
