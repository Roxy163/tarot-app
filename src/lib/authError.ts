export type AuthErrorContext = 'login' | 'signup' | 'reset-password' | 'verification' | 'change-password';

export type AuthRecoveryAction =
  | 'reset-password'
  | 'switch-signup'
  | 'switch-login'
  | 'retry'
  | 'none';

export interface AuthErrorDisplay {
  title: string;
  message: string;
  tips: string[];
  action: AuthRecoveryAction;
  actionLabel?: string;
  supportCode?: string;
}

const getErrorMessage = (error: unknown) => (
  error instanceof Error ? error.message : String(error || '')
);

export const getFirebaseAuthErrorCode = (error: unknown): string | null => {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String((error as { code?: unknown }).code || '').trim();
    if (code) return code;
  }

  const message = getErrorMessage(error);
  return message.match(/auth\/[a-z0-9-]+/i)?.[0] || null;
};

const buildUnknownError = (error: unknown): AuthErrorDisplay => ({
  title: '登录暂时没有完成',
  message: '系统没有返回明确原因，可以先确认网络后再试一次。',
  tips: [
    '确认邮箱和密码没有多余空格。',
    '如果正在使用手机浏览器，切换网络或重开页面后再试。',
    '本机记录不会因为登录失败被清空。',
  ],
  action: 'retry',
  actionLabel: '再试一次',
  supportCode: getFirebaseAuthErrorCode(error) || undefined,
});

export const getAuthErrorDisplay = (
  error: unknown,
  context: AuthErrorContext,
): AuthErrorDisplay => {
  const code = getFirebaseAuthErrorCode(error);

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return {
        title: '邮箱或密码不正确',
        message: '这个账号没有通过验证。可以重新输入，或直接找回密码。',
        tips: [
          '确认邮箱里的点号是英文句号，系统会自动修正中文句号。',
          '密码区分大小写。',
          '如果很久没登录，建议先找回密码。',
        ],
        action: 'reset-password',
        actionLabel: '找回密码',
        supportCode: code,
      };
    case 'auth/user-not-found':
      return {
        title: '这个邮箱还没有注册',
        message: '当前邮箱没有对应的研习阁账号。',
        tips: [
          '确认是否用了另一个常用邮箱注册。',
          '如果是第一次使用，可以直接注册新号。',
        ],
        action: context === 'signup' ? 'none' : 'switch-signup',
        actionLabel: context === 'signup' ? undefined : '注册新号',
        supportCode: code,
      };
    case 'auth/email-already-in-use':
      return {
        title: '这个邮箱已经注册过',
        message: '可以返回登录；如果忘记密码，就找回密码。',
        tips: [
          '不用重复注册，同一个邮箱登录后会读取它自己的云端典籍。',
          '忘记密码时使用邮箱重置即可。',
        ],
        action: 'reset-password',
        actionLabel: '找回密码',
        supportCode: code,
      };
    case 'auth/invalid-email':
      return {
        title: '邮箱格式不对',
        message: '请输入完整邮箱，例如 name@example.com。',
        tips: [
          '中文句号、全角 @ 会自动转成英文符号。',
          '请检查邮箱前后是否有空格。',
        ],
        action: 'none',
        supportCode: code,
      };
    case 'auth/weak-password':
      return {
        title: '密码强度不够',
        message: '请使用至少 6 位字符，建议加入字母和数字。',
        tips: ['不要使用过短或过于常见的密码。'],
        action: 'none',
        supportCode: code,
      };
    case 'auth/too-many-requests':
      return {
        title: '尝试次数过多',
        message: 'Firebase 为了保护账号，暂时限制了继续登录。',
        tips: [
          '先暂停几分钟再试。',
          '如果是密码不确定，建议直接找回密码。',
        ],
        action: context === 'login' ? 'reset-password' : 'retry',
        actionLabel: context === 'login' ? '找回密码' : '稍后重试',
        supportCode: code,
      };
    case 'auth/network-request-failed':
    case 'auth/internal-error':
      return {
        title: '网络没有连上认证服务',
        message: '登录请求没有稳定到达 Firebase。账号和本机记录都不会因此清空。',
        tips: [
          '确认 VPN 或网络加速已作用到当前浏览器。',
          '切换 Wi-Fi/蜂窝网络，或关闭省流量/拦截插件后重试。',
          '如果手机端失败、电脑端正常，优先检查手机浏览器的网络代理。',
        ],
        action: 'retry',
        actionLabel: '网络好了再试',
        supportCode: code,
      };
    case 'auth/unauthorized-domain':
    case 'auth/app-not-authorized':
    case 'auth/configuration-not-found':
    case 'auth/operation-not-allowed':
    case 'auth/invalid-api-key':
      return {
        title: '登录配置需要检查',
        message: '这通常不是用户输错，而是 Firebase 登录配置或当前访问域名没有完全开通。',
        tips: [
          '确认正在打开正式地址或本地预览地址。',
          'Firebase Authentication 需要启用 Email/Password。',
          'Authorized domains 里需要包含当前访问域名。',
        ],
        action: 'none',
        supportCode: code,
      };
    case 'auth/user-disabled':
      return {
        title: '账号已被禁用',
        message: '这个账号暂时不能登录。',
        tips: ['请联系管理员检查 Firebase Authentication 里的账号状态。'],
        action: 'none',
        supportCode: code,
      };
    case 'auth/requires-recent-login':
    case 'auth/user-token-expired':
    case 'auth/invalid-user-token':
      return {
        title: '登录状态已过期',
        message: '为了账号安全，请重新登录后再继续。',
        tips: ['重新登录后，云端典籍会再次合并，不会用空本地记录覆盖云端。'],
        action: 'switch-login',
        actionLabel: '重新登录',
        supportCode: code,
      };
    default:
      return buildUnknownError(error);
  }
};
