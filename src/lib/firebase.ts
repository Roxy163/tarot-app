import type { FirebaseApp } from 'firebase/app';
import type { Auth, ConfirmationResult, User } from 'firebase/auth';

type FirebaseAppApi = typeof import('firebase/app');
type FirebaseAuthApi = typeof import('firebase/auth');

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ''
};

export const isFirebaseReady = !!import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_API_KEY.length > 10;

let firebaseApp: FirebaseApp | null = null;
let firebaseAppApi: FirebaseAppApi | null = null;
let firebaseAppApiPromise: Promise<FirebaseAppApi> | null = null;
let auth: Auth | null = null;
let authApiPromise: Promise<FirebaseAuthApi> | null = null;
let authPersistencePromise: Promise<void> | null = null;
const AUTH_OPERATION_TIMEOUT_MS = 6500;

const loadFirebaseAppApi = async (): Promise<FirebaseAppApi> => {
  firebaseAppApiPromise ||= import('firebase/app').then(module => {
    firebaseAppApi = module;
    return module;
  });
  return firebaseAppApiPromise;
};

export const getFirebaseApp = async (): Promise<FirebaseApp> => {
  if (!isFirebaseReady) {
    throw new Error('Firebase 未配置。请设置 VITE_FIREBASE_API_KEY、VITE_FIREBASE_AUTH_DOMAIN、VITE_FIREBASE_PROJECT_ID 等环境变量。');
  }

  if (!firebaseApp) {
    const api = firebaseAppApi || await loadFirebaseAppApi();
    try {
      firebaseApp = api.getApps().length > 0 ? api.getApp() : api.initializeApp(firebaseConfig);
    } catch (error) {
      console.warn('Firebase initialization failed, running in guest mode');
      firebaseApp = null;
    }
  }

  if (!firebaseApp) {
    throw new Error('Firebase 未配置。请设置 VITE_FIREBASE_API_KEY、VITE_FIREBASE_AUTH_DOMAIN、VITE_FIREBASE_PROJECT_ID 等环境变量。');
  }

  return firebaseApp;
};

const loadAuthApi = async (): Promise<FirebaseAuthApi> => {
  authApiPromise ||= import('firebase/auth');
  return authApiPromise;
};

const getFirebaseAuth = async (): Promise<Auth | null> => {
  if (!isFirebaseReady) return null;
  const api = await loadAuthApi();
  const app = await getFirebaseApp();

  if (!auth) {
    auth = api.getAuth(app);
  }

  return auth;
};

const ensureFirebaseAuth = async (): Promise<{ auth: Auth; api: FirebaseAuthApi }> => {
  const firebaseAuth = await getFirebaseAuth();
  const api = await loadAuthApi();

  if (!firebaseAuth) {
    throw new Error('Firebase 未配置。请设置 VITE_FIREBASE_API_KEY、VITE_FIREBASE_AUTH_DOMAIN、VITE_FIREBASE_PROJECT_ID 等环境变量。');
  }

  return { auth: firebaseAuth, api };
};

const createAuthNetworkTimeoutError = () => Object.assign(
  new Error('认证服务连接超时，请检查网络或 VPN 后再试。'),
  { code: 'auth/network-request-failed' },
);

const withAuthOperationTimeout = async <T,>(operation: Promise<T>): Promise<T> => {
  let timer: number | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => reject(createAuthNetworkTimeoutError()), AUTH_OPERATION_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) window.clearTimeout(timer);
  }
};

export const firebaseAuth = {
  get currentUser() {
    return auth?.currentUser || null;
  },
};

const LOGIN_HISTORY_KEY = 'tarot_login_history';
const USER_ACCOUNTS_KEY = 'tarot_user_accounts';

interface LoginRecord {
  type: 'phone' | 'email';
  identifier: string;
  timestamp: number;
  displayDate: string;
}

interface UserAccount {
  uid: string;
  phone?: string;
  email?: string;
  createdAt: number;
  lastLogin?: LoginRecord;
  smsCount: number;
  lastSmsReset: string;
}

export const ensureAuthPersistence = async (): Promise<void> => {
  const firebaseAuth = await getFirebaseAuth();
  if (!firebaseAuth) return;

  if (!authPersistencePromise) {
    const api = await loadAuthApi();
    authPersistencePromise = api.setPersistence(firebaseAuth, api.browserLocalPersistence).catch(error => {
      console.warn('Firebase auth persistence unavailable, continuing with default persistence:', error);
    });
  }

  await authPersistencePromise;
};

export const getLoginHistory = (): LoginRecord | null => {
  try {
    const history = localStorage.getItem(LOGIN_HISTORY_KEY);
    return history ? JSON.parse(history) : null;
  } catch {
    return null;
  }
};

export const saveLoginHistory = (record: LoginRecord) => {
  localStorage.setItem(LOGIN_HISTORY_KEY, JSON.stringify(record));
};

export const getUserAccounts = (): Record<string, UserAccount> => {
  try {
    const accounts = localStorage.getItem(USER_ACCOUNTS_KEY);
    return accounts ? JSON.parse(accounts) : {};
  } catch {
    return {};
  }
};

export const saveUserAccount = (account: UserAccount) => {
  const accounts = getUserAccounts();
  accounts[account.uid] = account;
  localStorage.setItem(USER_ACCOUNTS_KEY, JSON.stringify(accounts));
};

export const getAccountByPhone = (phone: string): UserAccount | null => {
  const accounts = getUserAccounts();
  return Object.values(accounts).find(acc => acc.phone === phone) || null;
};

export const getAccountByEmail = (email: string): UserAccount | null => {
  const accounts = getUserAccounts();
  return Object.values(accounts).find(acc => acc.email === email) || null;
};

export const canSendSms = (): { canSend: boolean; remaining: number; resetDate: string } => {
  const accounts = getUserAccounts();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let totalSmsCount = 0;

  Object.values(accounts).forEach(acc => {
    if (acc.lastSmsReset === currentMonth) {
      totalSmsCount += acc.smsCount;
    }
  });

  const remaining = Math.max(0, 10000 - totalSmsCount);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const resetDate = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

  return {
    canSend: remaining > 0,
    remaining,
    resetDate
  };
};

export const incrementSmsCount = (uid: string) => {
  const accounts = getUserAccounts();
  const account = accounts[uid];

  if (account) {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    if (account.lastSmsReset !== currentMonth) {
      account.smsCount = 0;
      account.lastSmsReset = currentMonth;
    }

    account.smsCount++;
    accounts[uid] = account;
    localStorage.setItem(USER_ACCOUNTS_KEY, JSON.stringify(accounts));
  }
};

export const getLastLoginInfo = (uid: string): { type: string; identifier: string; displayDate: string } | null => {
  const accounts = getUserAccounts();
  const account = accounts[uid];

  if (account?.lastLogin) {
    return {
      type: account.lastLogin.type === 'phone' ? '手机号' : '邮箱',
      identifier: account.lastLogin.identifier,
      displayDate: account.lastLogin.displayDate
    };
  }
  return null;
};

export const sendSmsCode = async (phoneNumber: string): Promise<ConfirmationResult | null> => {
  const firebaseAuth = await getFirebaseAuth();
  if (!firebaseAuth) return null;
  const api = await loadAuthApi();

  const { canSend, resetDate } = canSendSms();
  if (!canSend) {
    const error: any = new Error(`本月短信额度已用完，请于${resetDate}后再试`);
    error.code = 'auth/quota-exceeded';
    throw error;
  }

  const appVerifier = new api.RecaptchaVerifier(firebaseAuth, 'recaptcha-container', {
    size: 'invisible',
    callback: () => {},
    'expired-callback': () => {}
  });

  return api.signInWithPhoneNumber(firebaseAuth, phoneNumber, appVerifier);
};

export const verifySmsCode = async (confirmationResult: ConfirmationResult, code: string): Promise<User> => {
  const result = await confirmationResult.confirm(code);
  return result.user;
};

export const signInWithPassword = async (email: string, password: string) => {
  const { auth: firebaseAuth, api } = await ensureFirebaseAuth();
  await ensureAuthPersistence();
  return withAuthOperationTimeout(api.signInWithEmailAndPassword(firebaseAuth, email, password));
};

export const signUpWithEmail = async (email: string, password: string) => {
  const { auth: firebaseAuth, api } = await ensureFirebaseAuth();
  await ensureAuthPersistence();
  return withAuthOperationTimeout(api.createUserWithEmailAndPassword(firebaseAuth, email, password));
};

export const updateUserPassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  const { auth: firebaseAuth, api } = await ensureFirebaseAuth();
  const user = firebaseAuth.currentUser;

  if (!user) throw new Error('用户未登录');
  if (!user.email) throw new Error('用户邮箱未设置');

  try {
    const credential = api.EmailAuthProvider.credential(user.email, currentPassword);
    await api.reauthenticateWithCredential(user, credential);
    await api.updatePassword(user, newPassword);
  } catch (error: any) {
    let errorMessage = error.message || '修改密码失败';

    switch (error.code) {
      case 'auth/wrong-password':
        errorMessage = '当前密码错误';
        break;
      case 'auth/weak-password':
        errorMessage = '新密码强度不足，请使用至少6位字符';
        break;
      case 'auth/requires-recent-login':
        errorMessage = '请重新登录后再尝试修改密码';
        break;
      case 'auth/network-request-failed':
        errorMessage = '网络连接失败，请检查网络设置或稍后再试';
        break;
      case 'auth/internal-error':
        errorMessage = '服务器内部错误，请稍后再试';
        break;
    }

    throw new Error(errorMessage);
  }
};

export const linkPhoneNumber = async (user: User, verificationId: string, verificationCode: string): Promise<User> => {
  const { api } = await ensureFirebaseAuth();

  try {
    const credential = api.PhoneAuthProvider.credential(verificationId, verificationCode);
    await api.linkWithCredential(user, credential);
    return user;
  } catch (error: any) {
    if (error.code === 'auth/credential-already-in-use') {
      throw new Error('该手机号已绑定到其他账号');
    }
    throw error;
  }
};

export const linkEmailPassword = async (user: User, email: string, password: string): Promise<User> => {
  const { api } = await ensureFirebaseAuth();

  try {
    const credential = api.EmailAuthProvider.credential(email, password);
    await api.linkWithCredential(user, credential);
    return user;
  } catch (error: any) {
    if (error.code === 'auth/credential-already-in-use') {
      throw new Error('该邮箱已绑定到其他账号');
    }
    throw error;
  }
};

export const signOutUser = async (): Promise<void> => {
  const firebaseAuth = await getFirebaseAuth();
  if (!firebaseAuth) return;
  const api = await loadAuthApi();
  await api.signOut(firebaseAuth);
};

export const getCurrentUser = (): User | null => {
  if (!auth) return null;
  return auth.currentUser;
};

export const onAuthStateChangedListener = (
  callback: (user: User | null) => void,
  onError?: (error: unknown) => void,
): (() => void) => {
  let unsubscribe: (() => void) | null = null;
  let cancelled = false;

  void (async () => {
    try {
      const firebaseAuth = await getFirebaseAuth();
      if (!firebaseAuth) {
        if (!cancelled) callback(null);
        return;
      }

      const authWithStateReady = firebaseAuth as Auth & {
        authStateReady?: () => Promise<void>;
      };
      await authWithStateReady.authStateReady?.();
      if (cancelled) return;

      const api = await loadAuthApi();
      if (cancelled) return;
      unsubscribe = api.onAuthStateChanged(firebaseAuth, callback);
    } catch (error) {
      console.warn('Firebase auth listener unavailable, continuing in guest mode:', error);
      if (!cancelled) onError?.(error);
    }
  })();

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
};

export const sendPasswordReset = async (email: string): Promise<void> => {
  const { auth: firebaseAuth, api } = await ensureFirebaseAuth();

  try {
    await api.sendPasswordResetEmail(firebaseAuth, email, {
      url: window.location.origin,
      handleCodeInApp: true,
    });
  } catch (error: any) {
    let errorMessage = error.message || '发送重置邮件失败，请重试。';

    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage = '该邮箱尚未注册，请先注册账号。';
        break;
      case 'auth/invalid-email':
        errorMessage = '请输入有效的邮箱地址。';
        break;
    }

    throw new Error(errorMessage);
  }
};

export const sendCurrentUserEmailVerification = async (): Promise<void> => {
  const { auth: firebaseAuth, api } = await ensureFirebaseAuth();

  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('请先登录后再发送验证邮件。');
  if (!user.email) throw new Error('当前账号没有绑定邮箱。');

  await api.reload(user);
  if (user.emailVerified) return;

  await api.sendEmailVerification(user, {
    url: window.location.origin,
    handleCodeInApp: false,
  });
};

export const refreshCurrentUser = async (): Promise<User> => {
  const { auth: firebaseAuth, api } = await ensureFirebaseAuth();

  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('请先登录后再刷新验证状态。');

  await api.reload(user);
  return firebaseAuth.currentUser || user;
};

export const deleteUserAccount = async (): Promise<void> => {
  const { auth: firebaseAuth, api } = await ensureFirebaseAuth();

  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('用户未登录');

  await api.deleteUser(user);
};

export const confirmPasswordReset = async (oobCode: string, newPassword: string): Promise<void> => {
  const { auth: firebaseAuth, api } = await ensureFirebaseAuth();

  try {
    await api.confirmPasswordReset(firebaseAuth, oobCode, newPassword);
  } catch (error: any) {
    let errorMessage = error.message || '密码重置失败，请重试。';

    switch (error.code) {
      case 'auth/invalid-action-code':
        errorMessage = '链接已过期或无效，请重新获取重置链接。';
        break;
      case 'auth/weak-password':
        errorMessage = '密码强度不足，请使用至少6位字符。';
        break;
    }

    throw new Error(errorMessage);
  }
};

export const checkIfMagicLink = (): { mode: string; oobCode: string } | null => {
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');
  const oobCode = urlParams.get('oobCode');

  if (!mode || !oobCode) return null;

  return { mode, oobCode };
};

export const verifyMagicLink = async (mode: string, oobCode: string): Promise<User | null> => {
  const firebaseAuth = await getFirebaseAuth();
  if (!firebaseAuth) return null;
  const api = await loadAuthApi();

  if (mode === 'resetPassword') {
    await api.verifyPasswordResetCode(firebaseAuth, oobCode);
    return null;
  }

  if (mode === 'verifyEmail' || mode === 'signIn') {
    await api.applyActionCode(firebaseAuth, oobCode);
    return firebaseAuth.currentUser;
  }

  return null;
};
