import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, Send, Sparkles, ArrowRight, CloudOff, Home, Clock, CheckCircle, X, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { checkIfMagicLink, confirmPasswordReset } from '../lib/firebase';
import { normalizeEmailInput } from '../lib/emailInput';
import { getAuthErrorDisplay } from '../lib/authError';
import type { AuthErrorDisplay, AuthRecoveryAction } from '../lib/authError';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface AuthProps {
  onClose?: () => void;
  onSignedOut?: () => void;
}

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  showPassword: boolean;
  onToggle: () => void;
  fieldLabel?: string;
}

const PasswordInput: React.FC<PasswordInputProps> = ({
  showPassword,
  onToggle,
  fieldLabel = '密码',
  className = '',
  ...props
}) => (
  <div className="relative">
    <input
      {...props}
      type={showPassword ? 'text' : 'password'}
      className={`w-full rounded-xl border border-forest-accent/10 bg-forest-bg/30 py-3.5 pl-10 pr-12 text-sm outline-none transition-all focus:ring-2 focus:ring-forest-accent/20 ${className}`}
    />
    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-muted" size={16} />
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-forest-muted hover:bg-forest-accent/10 hover:text-forest-accent"
      aria-label={showPassword ? `隐藏${fieldLabel}` : `显示${fieldLabel}`}
      title={showPassword ? `隐藏${fieldLabel}` : `显示${fieldLabel}`}
    >
      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  </div>
);

export const Auth: React.FC<AuthProps> = ({ onClose, onSignedOut }) => {
  const { session, isEmailVerified, lastLogin, signIn, signUp, signOut, resetPassword, updatePassword, sendVerificationEmail, refreshUser } = useAuth();
  
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visiblePasswordField, setVisiblePasswordField] = useState<string | null>(null);
  const [isNewSignup, setIsNewSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<AuthErrorDisplay | null>(null);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showSetNewPassword, setShowSetNewPassword] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [oobCode, setOobCode] = useState<string | null>(null);
  // 修改密码相关状态
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPasswordForChange, setNewPasswordForChange] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changePasswordMessage, setChangePasswordMessage] = useState('');
  const [changePasswordError, setChangePasswordError] = useState('');
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const resetTimerRef = useRef<number | null>(null);
  const changePasswordTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  useBodyScrollLock(showResetPassword || showSetNewPassword || showChangePassword);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!session || isNewSignup || !onCloseRef.current) return undefined;

    closeTimerRef.current = window.setTimeout(() => onCloseRef.current?.(), 1500);
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [session, isNewSignup]);

  useEffect(() => () => {
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    if (changePasswordTimerRef.current !== null) window.clearTimeout(changePasswordTimerRef.current);
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  const scrollFocusedFieldIntoView = (event: React.FocusEvent<HTMLElement>) => {
    if (typeof window === 'undefined' || window.innerWidth >= 768) return;
    const target = event.currentTarget;
    window.setTimeout(() => {
      target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    }, 140);
  };

  const switchAuthMode = (nextMode: 'login' | 'signup') => {
    setAuthMode(nextMode);
    setAuthError(null);
    setVerificationMessage('');
    setVerificationError('');
  };

  const runAuthRecoveryAction = (action: AuthRecoveryAction) => {
    switch (action) {
      case 'reset-password':
        setResetEmail(normalizeEmailInput(email));
        setShowResetPassword(true);
        break;
      case 'switch-signup':
        switchAuthMode('signup');
        break;
      case 'switch-login':
        switchAuthMode('login');
        break;
      case 'retry':
        setAuthError(null);
        break;
      case 'none':
      default:
        break;
    }
  };

  // 检查是否是密码重置链接
  useEffect(() => {
    const magicLinkData = checkIfMagicLink();
    if (magicLinkData && magicLinkData.mode === 'resetPassword') {
      // 直接设置 OOB 码，稍后在设置密码时验证
      setOobCode(magicLinkData.oobCode);
      setShowSetNewPassword(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = normalizeEmailInput(email);
    if (!normalizedEmail || !password || loading) return;

    setLoading(true);
    setAuthError(null);
    setIsNewSignup(false);

    try {
      await signIn(normalizedEmail, password);
      if (onClose) onClose();
    } catch (err: any) {
      setAuthError(getAuthErrorDisplay(err, 'login'));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = normalizeEmailInput(email);
    if (!normalizedEmail || !password || loading) return;

    setLoading(true);
    setAuthError(null);
    setIsNewSignup(true);

    try {
      await signUp(normalizedEmail, password);
      setVerificationMessage(`验证邮件已发送至 ${normalizedEmail}，请查收并完成验证。`);
      setIsNewSignup(true);
      setPassword('');
      setVisiblePasswordField(null);
    } catch (err: any) {
      setIsNewSignup(false);
      setAuthError(getAuthErrorDisplay(err, 'signup'));
    } finally {
      setLoading(false);
    }
  };

  const handleSendVerificationEmail = async () => {
    if (verificationLoading) return;

    setVerificationLoading(true);
    setVerificationError('');
    setVerificationMessage('');

    try {
      await sendVerificationEmail();
      setVerificationMessage('验证邮件已重新发送，请查收邮箱。');
    } catch (err: any) {
      let errorMessage = err.message || '发送验证邮件失败，请稍后再试。';

      switch (err.code) {
        case 'auth/too-many-requests':
          errorMessage = '发送次数过多，请稍后再试。';
          break;
        case 'auth/network-request-failed':
          errorMessage = '网络连接失败，请检查网络设置。';
          break;
      }

      setVerificationError(errorMessage);
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleRefreshVerification = async () => {
    if (verificationLoading) return;

    setVerificationLoading(true);
    setVerificationError('');
    setVerificationMessage('');

    try {
      await refreshUser();
      setVerificationMessage('验证状态已刷新。');
    } catch (err: any) {
      setVerificationError(err.message || '刷新验证状态失败，请稍后再试。');
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;

    setLoading(true);
    setResetMessage('');
    setResetError('');

    try {
      await resetPassword(normalizeEmailInput(resetEmail));
      setResetMessage('密码重置邮件已发送，请查收您的邮箱。');
      setResetEmail('');
    } catch (err: any) {
      let errorMessage = err.message || '发送失败，请重试。';
      
      if (err.code === 'auth/network-request-failed') {
        errorMessage = '网络连接失败，请检查网络设置。';
      } else if (err.code === 'auth/user-not-found') {
        errorMessage = '该邮箱尚未注册，请先注册账号。';
      }
      
      setResetError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword || !oobCode) return;

    if (newPassword !== confirmPassword) {
      setResetError('两次输入的密码不一致，请重新输入。');
      return;
    }

    setLoading(true);
    setResetMessage('');
    setResetError('');

    try {
      await confirmPasswordReset(oobCode, newPassword);
      setResetMessage('密码重置成功！现在可以使用新密码登录。');
      setNewPassword('');
      setConfirmPassword('');
      setOobCode(null);
      
      // 清除URL中的参数
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // 3秒后返回登录表单
      resetTimerRef.current = window.setTimeout(() => {
        setShowSetNewPassword(false);
      }, 3000);
    } catch (err: any) {
      setResetError(err.message || '密码重置失败，请重试。');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    if (onSignedOut) onSignedOut();
    if (onClose) onClose();
  };

  // 修改密码
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPasswordForChange || !confirmNewPassword || loading) return;

    if (newPasswordForChange !== confirmNewPassword) {
      setChangePasswordError('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    setChangePasswordMessage('');
    setChangePasswordError('');

    try {
      await updatePassword(currentPassword, newPasswordForChange);
      setChangePasswordMessage('密码修改成功！');
      setCurrentPassword('');
      setNewPasswordForChange('');
      setConfirmNewPassword('');
      
      // 3秒后关闭弹窗
      changePasswordTimerRef.current = window.setTimeout(() => {
        setShowChangePassword(false);
      }, 3000);
    } catch (err: any) {
      setChangePasswordError(err.message || '修改密码失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-y-auto bg-forest-bg px-4 py-6 sm:flex sm:items-center sm:justify-center sm:py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-3xl shadow-2xl border border-forest-border overflow-hidden"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-forest-accent/5 to-forest-pink/5" />
            <div className="relative p-5 sm:p-8">
              <div className="mb-5 flex flex-col items-center sm:mb-8">
                <img
                  src="/app-icon.svg"
                  alt="塔罗研习阁图标"
                  className="mb-3 h-16 w-16 rounded-2xl shadow-lg shadow-forest-accent/10 sm:mb-4"
                  draggable={false}
                />
                <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-forest-accent">观牌，也观心</p>
                <h1 className="mt-1 font-serif text-xl font-bold text-forest-ink">
                  {authMode === 'signup' ? '注册塔罗研习阁' : '登录塔罗研习阁'}
                </h1>
                <p className="mt-1 text-xs text-forest-muted">
                  {authMode === 'signup' ? '创建账号，开启云端同步' : '执印入阁，继续你的研习记录'}
                </p>
              </div>

              {!!session ? (
                <div className="space-y-6 text-center">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-16 h-16 rounded-full bg-forest-accent/10 flex items-center justify-center mx-auto"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.5 }}
                    >
                      <CheckCircle className="text-forest-accent" size={32} />
                    </motion.div>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <h2 className="font-serif text-lg font-bold text-forest-ink">
                      {isNewSignup ? '账号已创建' : '印鉴已验证'}
                    </h2>
                    <p className="mt-1 text-xs text-forest-muted">
                      {isNewSignup ? '完成邮箱验证后即可开启云端同步。' : '欢迎归来，研习阁主'}
                    </p>
                  </motion.div>
                  
                  {!isEmailVerified ? (
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-left space-y-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="text-amber-500 mt-0.5" size={16} />
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-amber-700">邮箱尚未验证</p>
                          <p className="text-xs text-amber-700/80 leading-relaxed">
                            请前往 {session.email || '注册邮箱'} 点击验证链接。验证后回来刷新状态。
                          </p>
                        </div>
                      </div>
                      {(verificationMessage || verificationError) && (
                        <p className={`text-xs ${verificationError ? 'text-red-500' : 'text-green-600'}`}>
                          {verificationError || verificationMessage}
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={verificationLoading}
                          onClick={handleSendVerificationEmail}
                          className="py-2 bg-white border border-amber-200 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-100/40 transition-colors disabled:opacity-50"
                        >
                          重发邮件
                        </button>
                        <button
                          type="button"
                          disabled={verificationLoading}
                          onClick={handleRefreshVerification}
                          className="py-2 bg-forest-accent text-white rounded-xl text-xs font-bold hover:bg-forest-accent/90 transition-colors disabled:opacity-50"
                        >
                          我已验证
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-100 rounded-2xl p-3 text-xs text-green-600 flex items-center justify-center gap-2">
                      <CheckCircle size={14} />
                      邮箱已验证
                    </div>
                  )}
                  
                  <button
                    onClick={() => setShowChangePassword(true)}
                    className="w-full py-3 bg-forest-accent/10 text-forest-accent rounded-xl font-medium hover:bg-forest-accent/20 transition-colors"
                  >
                    修改密码
                  </button>

                  <button
                    onClick={handleLogout}
                    className="w-full py-3 bg-forest-accent/10 text-forest-accent rounded-xl font-medium hover:bg-forest-accent/20 transition-colors"
                  >
                    封印离阁
                  </button>

                  <button
                    onClick={onClose}
                    className="w-full py-3 text-forest-muted hover:text-forest-accent transition-colors text-sm"
                  >
                    返回研习阁
                  </button>
                </div>
              ) : (
                <form onSubmit={authMode === 'signup' ? handleSignUp : handleLogin} className="space-y-4 sm:space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-forest-muted uppercase tracking-wider flex items-center gap-2">
                      <Mail size={12} /> 邮箱
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        name="email"
                        inputMode="email"
                        lang="en"
                        autoComplete="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        required
                        disabled={loading}
                        onFocus={scrollFocusedFieldIntoView}
                        className="w-full pl-10 pr-4 py-3.5 bg-forest-bg/30 border border-forest-accent/10 rounded-xl focus:ring-2 focus:ring-forest-accent/20 transition-all outline-none text-sm"
                        placeholder="example@email.com"
                        value={email}
                        onChange={(e) => {
                          setEmail(normalizeEmailInput(e.target.value));
                          setAuthError(null);
                        }}
                      />
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-muted" size={16} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-forest-muted uppercase tracking-wider flex items-center gap-2">
                      <Lock size={12} /> 密码
                    </label>
                    <PasswordInput
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setAuthError(null);
                      }}
                      placeholder="至少6位字符"
                      required
                      disabled={loading}
                      autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                      onFocus={scrollFocusedFieldIntoView}
                      showPassword={visiblePasswordField === 'login'}
                      onToggle={() => setVisiblePasswordField(current => current === 'login' ? null : 'login')}
                    />
                  </div>

                  {authError && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs text-red-600 bg-red-50 p-3 rounded-2xl border border-red-100 space-y-2"
                      role="alert"
                    >
                      <div className="flex items-start gap-2">
                        <AlertCircle size={15} className="mt-0.5 shrink-0" />
                        <div className="space-y-1">
                          <p className="font-bold text-red-700">{authError.title}</p>
                          <p className="leading-relaxed text-red-600/90">{authError.message}</p>
                        </div>
                      </div>
                      <ul className="space-y-1 pl-6 text-[11px] leading-relaxed text-red-600/85 list-disc">
                        {authError.tips.map(tip => (
                          <li key={tip}>{tip}</li>
                        ))}
                      </ul>
                      <div className="flex items-center justify-between gap-2">
                        {authError.supportCode && (
                          <span className="text-[10px] text-red-400">错误码：{authError.supportCode}</span>
                        )}
                        {authError.action !== 'none' && authError.actionLabel && (
                          <button
                            type="button"
                            onClick={() => runAuthRecoveryAction(authError.action)}
                            className="ml-auto min-h-9 px-3 rounded-xl bg-white border border-red-100 text-red-600 text-[11px] font-bold hover:bg-red-100/50 transition-colors"
                          >
                            {authError.actionLabel}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !email || !password}
                    className="w-full py-3.5 bg-forest-accent text-white rounded-xl font-bold text-sm hover:bg-forest-accent/90 transition-all disabled:opacity-50 shadow-lg shadow-forest-accent/20 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                        <Send size={16} />
                      </motion.div>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        {authMode === 'signup' ? '注册' : '登录'}
                      </>
                    )}
                  </button>

                  <div className="pt-4 border-t border-forest-accent/5 space-y-3">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-xs text-forest-muted">
                        {authMode === 'signup' ? '已有账号？' : '还没有账号？'}
                      </span>
                      <button
                        type="button"
                        onClick={() => switchAuthMode(authMode === 'signup' ? 'login' : 'signup')}
                        className="text-xs font-bold text-forest-accent hover:underline transition-colors"
                      >
                        {authMode === 'signup' ? '返回登录' : '注册新号'}
                      </button>
                    </div>
                    
                    {authMode === 'login' && (
                      <div className="flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => setShowResetPassword(true)}
                          className="text-xs text-forest-muted hover:text-forest-accent transition-colors flex items-center gap-1"
                        >
                          <AlertCircle size={10} />
                          忘记密码？
                        </button>
                      </div>
                    )}
                  </div>
                </form>
              )}

              <div className="mt-8 pt-6 border-t border-forest-accent/5">
                <div className="flex items-center justify-center gap-4 text-[10px] text-forest-muted">
                  <span className="flex items-center gap-1">
                    <CloudOff size={12} />
                    数据加密传输
                  </span>
                  <span className="flex items-center gap-1">
                    <Lock size={12} />
                    安全存储
                  </span>
                </div>
                <p className="text-center text-[10px] text-forest-muted mt-3">
                  🔐 你的数据，只属于你。所有记录安全保存在云端。
                </p>
                <p className="text-[10px] text-forest-muted text-center opacity-60">
                  塔罗研习阁 · Firebase 安全认证
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 text-center"
        >
          <button
            onClick={onClose}
            className="text-xs text-forest-muted hover:text-forest-accent transition-colors flex items-center gap-2 mx-auto"
          >
            <Home size={14} />
            返回访客模式
          </button>
        </motion.div>
      </motion.div>

      {/* 密码重置弹窗 */}
      <AnimatePresence>
        {showResetPassword && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-text/20 backdrop-blur-sm overscroll-contain"
            onClick={() => setShowResetPassword(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-forest-border p-6 space-y-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-serif font-bold text-forest-ink">找回密码</h2>
                  <p className="text-xs text-forest-muted mt-1">输入注册时使用的邮箱</p>
                </div>
                <button
                  onClick={() => setShowResetPassword(false)}
                  className="p-2 hover:bg-forest-bg rounded-full transition-colors"
                >
                  <X size={18} className="text-forest-muted" />
                </button>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-forest-muted uppercase tracking-wider flex items-center gap-2">
                    <Mail size={12} /> 注册邮箱
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      name="reset-email"
                      inputMode="email"
                      lang="en"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      required
                      disabled={loading}
                      className="w-full pl-10 pr-4 py-3.5 bg-forest-bg/30 border border-forest-accent/10 rounded-xl focus:ring-2 focus:ring-forest-accent/20 transition-all outline-none text-sm"
                      placeholder="example@email.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(normalizeEmailInput(e.target.value))}
                    />
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-muted" size={16} />
                  </div>
                </div>

                {resetError && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-red-500 bg-red-50 p-3 rounded-lg border border-red-100 text-center"
                  >
                    {resetError}
                  </motion.div>
                )}

                {resetMessage && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-green-500 bg-green-50 p-3 rounded-lg border border-green-100 text-center"
                  >
                    {resetMessage}
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={loading || !resetEmail}
                  className="w-full py-3.5 bg-forest-accent text-white rounded-xl font-bold text-sm hover:bg-forest-accent/90 transition-all disabled:opacity-50 shadow-lg shadow-forest-accent/20"
                >
                  {loading ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                      <Send size={16} />
                    </motion.div>
                  ) : (
                    '发送重置邮件'
                  )}
                </button>
              </form>

              <button
                onClick={() => setShowResetPassword(false)}
                className="w-full py-2 text-xs text-forest-muted hover:text-forest-accent transition-colors"
              >
                返回登录
              </button>
            </motion.div>
          </motion.div>
        )}

        {/* 设置新密码弹窗（通过链接进入） */}
        {showSetNewPassword && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-text/20 backdrop-blur-sm overscroll-contain"
            onClick={() => {
              setShowSetNewPassword(false);
              window.history.replaceState({}, document.title, window.location.pathname);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-forest-border p-6 space-y-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-serif font-bold text-forest-ink">设置新密码</h2>
                  <p className="text-xs text-forest-muted mt-1">请设置您的新密码</p>
                </div>
                <button
                  onClick={() => {
                    setShowSetNewPassword(false);
                    window.history.replaceState({}, document.title, window.location.pathname);
                  }}
                  className="p-2 hover:bg-forest-bg rounded-full transition-colors"
                >
                  <X size={18} className="text-forest-muted" />
                </button>
              </div>

              <form onSubmit={handleSetNewPassword} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-forest-muted uppercase tracking-wider flex items-center gap-2">
                    <Lock size={12} /> 新密码
                  </label>
                  <PasswordInput
                    required
                    disabled={loading}
                    onFocus={scrollFocusedFieldIntoView}
                    autoComplete="new-password"
                    placeholder="至少6位字符"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    showPassword={visiblePasswordField === 'reset-new'}
                    onToggle={() => setVisiblePasswordField(current => current === 'reset-new' ? null : 'reset-new')}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-forest-muted uppercase tracking-wider flex items-center gap-2">
                    <Lock size={12} /> 确认密码
                  </label>
                  <PasswordInput
                    required
                    disabled={loading}
                    onFocus={scrollFocusedFieldIntoView}
                    autoComplete="new-password"
                    placeholder="再次输入密码"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    fieldLabel="确认密码"
                    showPassword={visiblePasswordField === 'reset-confirm'}
                    onToggle={() => setVisiblePasswordField(current => current === 'reset-confirm' ? null : 'reset-confirm')}
                  />
                </div>

                {resetError && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-red-500 bg-red-50 p-3 rounded-lg border border-red-100 text-center"
                  >
                    {resetError}
                  </motion.div>
                )}

                {resetMessage && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-green-500 bg-green-50 p-3 rounded-lg border border-green-100 text-center"
                  >
                    {resetMessage}
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={loading || !newPassword || !confirmPassword}
                  className="w-full py-3.5 bg-forest-accent text-white rounded-xl font-bold text-sm hover:bg-forest-accent/90 transition-all disabled:opacity-50 shadow-lg shadow-forest-accent/20"
                >
                  {loading ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                      <Send size={16} />
                    </motion.div>
                  ) : (
                    '确认重置密码'
                  )}
                </button>
              </form>

              <button
                onClick={() => {
                  setShowSetNewPassword(false);
                  window.history.replaceState({}, document.title, window.location.pathname);
                }}
                className="w-full py-2 text-xs text-forest-muted hover:text-forest-accent transition-colors"
              >
                返回登录
              </button>
            </motion.div>
          </motion.div>
        )}

        {/* 修改密码弹窗 */}
        {showChangePassword && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-text/20 backdrop-blur-sm overscroll-contain"
            onClick={() => setShowChangePassword(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-forest-border p-6 space-y-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-serif font-bold text-forest-ink">修改密码</h2>
                  <p className="text-xs text-forest-muted mt-1">请验证当前密码并设置新密码</p>
                </div>
                <button
                  onClick={() => setShowChangePassword(false)}
                  className="p-2 hover:bg-forest-bg rounded-full transition-colors"
                >
                  <X size={18} className="text-forest-muted" />
                </button>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-forest-muted uppercase tracking-wider flex items-center gap-2">
                    <Lock size={12} /> 当前密码
                  </label>
                  <PasswordInput
                    required
                    disabled={loading}
                    onFocus={scrollFocusedFieldIntoView}
                    autoComplete="current-password"
                    placeholder="请输入当前密码"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    fieldLabel="当前密码"
                    showPassword={visiblePasswordField === 'current'}
                    onToggle={() => setVisiblePasswordField(current => current === 'current' ? null : 'current')}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-forest-muted uppercase tracking-wider flex items-center gap-2">
                    <Lock size={12} /> 新密码
                  </label>
                  <PasswordInput
                    required
                    disabled={loading}
                    onFocus={scrollFocusedFieldIntoView}
                    autoComplete="new-password"
                    placeholder="至少6位字符"
                    value={newPasswordForChange}
                    onChange={(e) => setNewPasswordForChange(e.target.value)}
                    showPassword={visiblePasswordField === 'change-new'}
                    onToggle={() => setVisiblePasswordField(current => current === 'change-new' ? null : 'change-new')}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-forest-muted uppercase tracking-wider flex items-center gap-2">
                    <Lock size={12} /> 确认新密码
                  </label>
                  <PasswordInput
                    required
                    disabled={loading}
                    onFocus={scrollFocusedFieldIntoView}
                    autoComplete="new-password"
                    placeholder="再次输入新密码"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    fieldLabel="确认新密码"
                    showPassword={visiblePasswordField === 'change-confirm'}
                    onToggle={() => setVisiblePasswordField(current => current === 'change-confirm' ? null : 'change-confirm')}
                  />
                </div>

                {changePasswordError && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-red-500 bg-red-50 p-3 rounded-lg border border-red-100 text-center"
                  >
                    {changePasswordError}
                  </motion.div>
                )}

                {changePasswordMessage && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-green-500 bg-green-50 p-3 rounded-lg border border-green-100 text-center"
                  >
                    {changePasswordMessage}
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={loading || !currentPassword || !newPasswordForChange || !confirmNewPassword}
                  className="w-full py-3.5 bg-forest-accent text-white rounded-xl font-bold text-sm hover:bg-forest-accent/90 transition-all disabled:opacity-50 shadow-lg shadow-forest-accent/20"
                >
                  {loading ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                      <Send size={16} />
                    </motion.div>
                  ) : (
                    '确认修改'
                  )}
                </button>
              </form>

              <button
                onClick={() => setShowChangePassword(false)}
                className="w-full py-2 text-xs text-forest-muted hover:text-forest-accent transition-colors"
              >
                取消
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
