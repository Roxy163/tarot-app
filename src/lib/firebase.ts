import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPhoneNumber, RecaptchaVerifier, signOut, onAuthStateChanged, User, ConfirmationResult, createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePhoneNumber, updateEmail, linkWithCredential, PhoneAuthProvider, EmailAuthProvider, sendPasswordResetEmail, applyActionCode, verifyPasswordResetCode, confirmPasswordReset as firebaseConfirmPasswordReset, signInAnonymously, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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

let auth: ReturnType<typeof getAuth> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;
let storage: ReturnType<typeof getStorage> | null = null;

if (isFirebaseReady) {
  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch (error) {
    console.warn('Firebase initialization failed, running in guest mode');
    auth = null;
    db = null;
    storage = null;
  }
}

export const firebaseAuth = auth;
export const firebaseDb = db;
export const firebaseStorage = storage;

// 登录历史管理
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

// 用户账户管理（用于本地记录）
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

// 检查Firebase是否可以发送短信
export const canSendSms = (): { canSend: boolean; remaining: number; resetDate: string } => {
  const accounts = getUserAccounts();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  // 计算本月已使用的短信次数
  let totalSmsCount = 0;
  Object.values(accounts).forEach(acc => {
    if (acc.lastSmsReset === currentMonth) {
      totalSmsCount += acc.smsCount;
    }
  });
  
  const remaining = Math.max(0, 10000 - totalSmsCount);
  
  // 计算下个月重置日期
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
    
    // 如果是新的月份，重置计数器
    if (account.lastSmsReset !== currentMonth) {
      account.smsCount = 0;
      account.lastSmsReset = currentMonth;
    }
    
    account.smsCount++;
    accounts[uid] = account;
    localStorage.setItem(USER_ACCOUNTS_KEY, JSON.stringify(accounts));
  }
};

// 获取用户上次登录信息
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

// Phone Verification (手机验证码登录)
export const sendSmsCode = async (phoneNumber: string): Promise<ConfirmationResult | null> => {
  if (!auth) return null;
  
  const { canSend, remaining, resetDate } = canSendSms();
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
  
  try {
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
    return confirmationResult;
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw error;
  }
};

export const verifySmsCode = async (confirmationResult: ConfirmationResult, code: string): Promise<User> => {
  const result = await confirmationResult.confirm(code);
  return result.user;
};

// 邮箱密码登录
export const signInWithPassword = async (email: string, password: string) => {
  if (!auth) throw new Error('Firebase not configured');
  return await signInWithEmailAndPassword(auth, email, password);
};

// 邮箱注册
export const signUpWithEmail = async (email: string, password: string) => {
  if (!auth) throw new Error('Firebase not configured');
  return await createUserWithEmailAndPassword(auth, email, password);
};

// 修改密码（需要先验证当前密码）
export const updateUserPassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  if (!auth) throw new Error('Firebase not configured');
  const user = auth.currentUser;
  
  if (!user) throw new Error('用户未登录');
  if (!user.email) throw new Error('用户邮箱未设置');
  
  try {
    // 先重新验证用户身份
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    
    // 然后更新密码
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

// 链接手机号到当前用户
export const linkPhoneNumber = async (user: User, verificationId: string, verificationCode: string): Promise<User> => {
  if (!auth) throw new Error('Firebase not configured');
  
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

// 链接邮箱密码到当前用户
export const linkEmailPassword = async (user: User, email: string, password: string): Promise<User> => {
  if (!auth) throw new Error('Firebase not configured');
  
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
  return await signOut(auth);
};

export const getCurrentUser = (): User | null => {
  if (!auth) return null;
  return auth.currentUser;
};

export const onAuthStateChangedListener = (callback: (user: User | null) => void): (() => void) => {
  if (!auth) {
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
};

// 发送密码重置邮件
export const sendPasswordReset = async (email: string): Promise<void> => {
  if (!auth) throw new Error('Firebase not configured');
  
  try {
    // 配置密码重置链接的跳转地址
    const actionCodeSettings = {
      url: window.location.origin,
      handleCodeInApp: true,
    };
    
    await sendPasswordResetEmail(auth, email, actionCodeSettings);
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

// 确认密码重置
export const confirmPasswordReset = async (oobCode: string, newPassword: string): Promise<void> => {
  if (!auth) throw new Error('Firebase not configured');
  
  try {
    await firebaseConfirmPasswordReset(auth, oobCode, newPassword);
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

// Magic Link（邮箱链接登录）相关函数
export const checkIfMagicLink = (): { mode: string; oobCode: string } | null => {
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');
  const oobCode = urlParams.get('oobCode');
  
  if (!mode || !oobCode) return null;
  
  return { mode, oobCode };
};

export const verifyMagicLink = async (mode: string, oobCode: string): Promise<User | null> => {
  if (!auth) return null;
  
  try {
    // 处理密码重置链接
    if (mode === 'resetPassword') {
      // 验证密码重置链接是否有效
      await verifyPasswordResetCode(auth, oobCode);
      // 返回 null，让前端显示重置密码表单
      return null;
    } else if (mode === 'verifyEmail') {
      // 邮箱验证链接
      await applyActionCode(auth, oobCode);
      return auth.currentUser;
    } else if (mode === 'signIn') {
      // 邮箱登录链接 - 使用 applyActionCode 处理
      await applyActionCode(auth, oobCode);
      return auth.currentUser;
    }
  } catch (error) {
    console.error('Error verifying magic link:', error);
    throw error;
  }
  
  return null;
};
