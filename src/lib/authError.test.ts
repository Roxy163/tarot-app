import { describe, expect, it } from 'vitest';
import { getAuthErrorDisplay, getFirebaseAuthErrorCode } from './authError';

describe('getFirebaseAuthErrorCode', () => {
  it('reads Firebase code from error objects', () => {
    expect(getFirebaseAuthErrorCode({ code: 'auth/network-request-failed' })).toBe('auth/network-request-failed');
  });

  it('extracts Firebase code from message text', () => {
    expect(getFirebaseAuthErrorCode(new Error('Firebase: Error (auth/unauthorized-domain).'))).toBe('auth/unauthorized-domain');
  });
});

describe('getAuthErrorDisplay', () => {
  it('turns wrong password errors into a reset-password recovery action', () => {
    const display = getAuthErrorDisplay({ code: 'auth/invalid-credential' }, 'login');

    expect(display.title).toBe('邮箱或密码不正确');
    expect(display.action).toBe('reset-password');
    expect(display.tips.join(' ')).toContain('密码区分大小写');
  });

  it('explains mobile or VPN network login failures without implying data loss', () => {
    const display = getAuthErrorDisplay({ code: 'auth/network-request-failed' }, 'login');

    expect(display.title).toBe('网络没有连上认证服务');
    expect(display.message).toContain('本机记录');
    expect(display.tips.join(' ')).toContain('手机浏览器');
    expect(display.action).toBe('retry');
  });

  it('marks Firebase setup errors as configuration issues', () => {
    const display = getAuthErrorDisplay({ code: 'auth/unauthorized-domain' }, 'signup');

    expect(display.title).toBe('登录配置需要检查');
    expect(display.tips.join(' ')).toContain('Authorized domains');
    expect(display.action).toBe('none');
  });
});
