import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { User } from 'firebase/auth';
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
  refreshCurrentUser,
  ensureAuthPersistence
} from '../lib/firebase';

interface LoginHistory {
  type: string;
  identifier: string;
  displayDate: string;
}

interface AuthContextType {
  session: User | null;
  isLoading: boolean;
  isLocalFallback: boolean;
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

const AUTH_RESTORE_TIMEOUT_MS = 2200;

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocalFallback, setIsLocalFallback] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [lastLogin, setLastLogin] = useState<LoginHistory | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cachedUser = getCurrentUser();
    if (cachedUser) {
      setSession(cachedUser);
      setIsEmailVerified(!!cachedUser.emailVerified);
      setLastLogin(getLastLoginInfo(cachedUser.uid));
    }

    const restoreTimer = window.setTimeout(() => {
      if (cancelled) return;
      setIsLocalFallback(true);
      setIsLoading(false);
    }, AUTH_RESTORE_TIMEOUT_MS);

    const unsubscribe = onAuthStateChangedListener(
      (user) => {
        window.clearTimeout(restoreTimer);
        setSession(user);
        setIsEmailVerified(!!user?.emailVerified);
        setIsLocalFallback(false);
        setIsLoading(false);
        if (user) {
          setLastLogin(getLastLoginInfo(user.uid));
        } else {
          setLastLogin(null);
        }
      },
      () => {
        window.clearTimeout(restoreTimer);
        if (cancelled) return;
        setIsLocalFallback(true);
        setIsLoading(false);
      },
    );

    void ensureAuthPersistence().catch(error => {
      console.warn('Firebase auth persistence setup failed, continuing in local mode when needed:', error);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(restoreTimer);
      unsubscribe();
    };
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
    setIsLocalFallback(false);
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
    setIsLocalFallback(false);
  }, []);

  const signOut = useCallback(async () => {
    await signOutUser();
    setSession(null);
    setIsEmailVerified(false);
    setLastLogin(null);
    setIsLocalFallback(false);
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
    setIsLocalFallback(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        isLocalFallback,
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
