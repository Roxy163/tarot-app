import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { 
  signOutUser, 
  onAuthStateChangedListener, 
  getCurrentUser, 
  signInWithPassword, 
  signUpWithEmail, 
  saveLoginHistory, 
  getLastLoginInfo, 
  sendPasswordReset,
  updateUserPassword,
  sendCurrentUserEmailVerification,
  refreshCurrentUser
} from '../lib/firebase';

interface LoginHistory {
  type: string;
  identifier: string;
  displayDate: string;
}

interface AuthContextType {
  session: User | null;
  isLoading: boolean;
  isEmailVerified: boolean;
  lastLogin: LoginHistory | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [lastLogin, setLastLogin] = useState<LoginHistory | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChangedListener((user) => {
      setSession(user);
      setIsEmailVerified(!!user?.emailVerified);
      setIsLoading(false);
      if (user) {
        const info = getLastLoginInfo(user.uid);
        setLastLogin(info);
      } else {
        setLastLogin(null);
      }
    });

    const user = getCurrentUser();
    setSession(user);
    setIsEmailVerified(!!user?.emailVerified);
    if (user) {
      const info = getLastLoginInfo(user.uid);
      setLastLogin(info);
    }
    setIsLoading(false);

    return () => unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const userCredential = await signInWithPassword(email, password);
    
    const now = new Date();
    const loginRecord = {
      type: 'email' as const,
      identifier: email.split('@')[0] + '@***',
      timestamp: now.getTime(),
      displayDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    };
    saveLoginHistory(loginRecord);
    setLastLogin({ type: '邮箱', identifier: loginRecord.identifier, displayDate: loginRecord.displayDate });
    setSession(userCredential.user);
    setIsEmailVerified(userCredential.user.emailVerified);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const userCredential = await signUpWithEmail(email, password);
    
    try {
      await sendCurrentUserEmailVerification();
    } catch (error) {
      console.warn('Email verification was not sent automatically:', error);
    }
    
    const now = new Date();
    const loginRecord = {
      type: 'email' as const,
      identifier: email.split('@')[0] + '@***',
      timestamp: now.getTime(),
      displayDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    };
    saveLoginHistory(loginRecord);
    setLastLogin({ type: '邮箱', identifier: loginRecord.identifier, displayDate: loginRecord.displayDate });
    setSession(userCredential.user);
    setIsEmailVerified(userCredential.user.emailVerified);
  }, []);

  const signOut = useCallback(async () => {
    await signOutUser();
    setSession(null);
    setIsEmailVerified(false);
    setLastLogin(null);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordReset(email);
  }, []);

  const updatePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await updateUserPassword(currentPassword, newPassword);
  }, []);

  const sendVerificationEmail = useCallback(async () => {
    await sendCurrentUserEmailVerification();
  }, []);

  const refreshUser = useCallback(async () => {
    const user = await refreshCurrentUser();
    setSession(user);
    setIsEmailVerified(user.emailVerified);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        isEmailVerified,
        lastLogin,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
        sendVerificationEmail,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
