import { initializeApp, getApps, getApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getAuth, signInWithPhoneNumber, RecaptchaVerifier, signOut, onAuthStateChanged, User, ConfirmationResult, createUserWithEmailAndPassword, signInWithEmailAndPassword, linkWithCredential, PhoneAuthProvider, EmailAuthProvider, sendPasswordResetEmail, sendEmailVerification, applyActionCode, verifyPasswordResetCode, confirmPasswordReset as firebaseConfirmPasswordReset, reauthenticateWithCredential, updatePassword, reload, deleteUser } from 'firebase/auth';

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
let auth: ReturnType<typeof getAuth> | null = null;

if (isFirebaseReady) {
  try {
    firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(firebaseApp);
  } catch (error) {
    console.warn('Firebase initialization failed, running in guest mode');
    firebaseApp = null;
    auth = null;
  }
}

export const getFirebaseApp = (): FirebaseApp => {
  if (!firebaseApp) {
    throw new Error('Firebase 未配置。请设置 VITE_FIREBASE_API_KEY、VITE_FIREBASE_AUTH_DOMAIN、VITE_FIREBASE_PROJECT_ID 等环境变量。');
  }

  return firebaseApp;
};

export const firebaseAuth = auth;

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

const ensureFirebase = () => {
  if (!auth) {
    throw new Error('Firebase 未配置。请设置 VITE_FIREBASE_API_KEY、VITE_FIREBASE_AUTH_DOMAIN、VITE_FIREBASE_PROJECT_ID 等环境变量。');
  }
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
  if (!auth) return null;

  const { canSend, resetDate } = canSendSms();
  if (!canSend) {
    const error: any = new Error(`本月短信额度已用完，请于${resetDate}后再试`);
    error.code = 'auth/quota-exceeded';
    throw error;
  }

  const appVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
    size: 'invisible',
    callback: () => {},
    'expired-callback': () => {}
  });

  return signInWithPhoneNumber(auth, phoneNumber, appVerifier);
};

export const verifySmsCode = async (confirmationResult: ConfirmationResult, code: string): Promise<User> => {
  const result = await confirmationResult.confirm(code);
  return result.user;
};

export const signInWithPassword = async (email: string, password: string) => {
  ensureFirebase();
  return signInWithEmailAndPassword(auth!, email, password);
};

export const signUpWithEmail = async (email: string, password: string) => {
  ensureFirebase();
  return createUserWithEmailAndPassword(auth!, email, password);
};

export const updateUserPassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  ensureFirebase();
  const user = auth!.currentUser;

  if (!user) throw new Error('用户未登录');
  if (!user.email) throw new Error('用户邮箱未设置');

  try {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
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
  ensureFirebase();

  try {
    const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
    await linkWithCredential(user, credential);
    return user;
  } catch (error: any) {
    if (error.code === 'auth/credential-already-in-use') {
      throw new Error('该手机号已绑定到其他账号');
    }
    throw error;
  }
};

export const linkEmailPassword = async (user: User, email: string, password: string): Promise<User> => {
  ensureFirebase();

  try {
    const credential = EmailAuthProvider.credential(email, password);
    await linkWithCredential(user, credential);
    return user;
  } catch (error: any) {
    if (error.code === 'auth/credential-already-in-use') {
      throw new Error('该邮箱已绑定到其他账号');
    }
    throw error;
  }
};

export const signOutUser = async (): Promise<void> => {
  if (!auth) return;
  await signOut(auth);
};

export const getCurrentUser = (): User | null => {
  if (!auth) return null;
  return auth.currentUser;
};

export const onAuthStateChangedListener = (callback: (user: User | null) => void): (() => void) => {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
};

export const sendPasswordReset = async (email: string): Promise<void> => {
  ensureFirebase();

  try {
    await sendPasswordResetEmail(auth!, email, {
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
  ensureFirebase();

  const user = auth!.currentUser;
  if (!user) throw new Error('请先登录后再发送验证邮件。');
  if (!user.email) throw new Error('当前账号没有绑定邮箱。');

  await reload(user);
  if (user.emailVerified) return;

  await sendEmailVerification(user, {
    url: window.location.origin,
    handleCodeInApp: false,
  });
};

export const refreshCurrentUser = async (): Promise<User> => {
  ensureFirebase();

  const user = auth!.currentUser;
  if (!user) throw new Error('请先登录后再刷新验证状态。');

  await reload(user);
  return auth!.currentUser || user;
};

export const deleteUserAccount = async (): Promise<void> => {
  ensureFirebase();

  const user = auth!.currentUser;
  if (!user) throw new Error('用户未登录');

  await deleteUser(user);
};

export const confirmPasswordReset = async (oobCode: string, newPassword: string): Promise<void> => {
  ensureFirebase();

  try {
    await firebaseConfirmPasswordReset(auth!, oobCode, newPassword);
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
  if (!auth) return null;

  if (mode === 'resetPassword') {
    await verifyPasswordResetCode(auth, oobCode);
    return null;
  }

  if (mode === 'verifyEmail' || mode === 'signIn') {
    await applyActionCode(auth, oobCode);
    return auth.currentUser;
  }

  return null;
};
