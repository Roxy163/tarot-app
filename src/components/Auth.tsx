import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, Send, Sparkles, ArrowRight, CloudOff, Home, Clock, CheckCircle, X, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { checkIfMagicLink, confirmPasswordReset } from '../lib/firebase';

export const Auth: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { session, lastLogin, signIn, signUp, signOut, resetPassword, updatePassword } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password || loading) return;

    setLoading(true);
    setError(null);

    try {
      await signIn(normalizedEmail, password);
    } catch (err: any) {
      let errorMessage = err.message || "登录失败，请重试。";
      
      switch (err.code) {
        case 'auth/invalid-credential':
          errorMessage = "邮箱或密码不正确，请重试。";
          break;
        case 'auth/invalid-email':
          errorMessage = "请输入有效的邮箱地址。";
          break;
        case 'auth/too-many-requests':
          errorMessage = "尝试次数过多，请稍后再试。";
          break;
        case 'auth/user-not-found':
          errorMessage = "该邮箱尚未注册，请先注册账号。";
          break;
        case 'auth/wrong-password':
          errorMessage = "密码错误，请重试。";
          break;
        case 'auth/user-disabled':
          errorMessage = "账号已被禁用，请联系管理员。";
          break;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password || loading) return;

    setLoading(true);
    setError(null);

    try {
      await signUp(normalizedEmail, password);
    } catch (err: any) {
      let errorMessage = err.message || "注册失败，请重试。";
      
      switch (err.code) {
        case 'auth/invalid-email':
          errorMessage = "请输入有效的邮箱地址。";
          break;
        case 'auth/weak-password':
          errorMessage = "密码强度不足，请使用至少6位字符。";
          break;
        case 'auth/email-already-in-use':
          errorMessage = "该邮箱已被注册，请尝试找回密码。";
          setResetEmail(email);
          setShowResetPassword(true);
          break;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;

    setLoading(true);
    setResetMessage('');
    setResetError('');

    try {
      await resetPassword(resetEmail);
      setResetMessage('密码重置邮件已发送，请查收您的邮箱。');
      setResetEmail('');
    } catch (err: any) {
      setResetError(err.message || '发送失败，请重试。');
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
      setTimeout(() => {
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
      setTimeout(() => {
        setShowChangePassword(false);
      }, 3000);
    } catch (err: any) {
      setChangePasswordError(err.message || '修改密码失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-forest-bg flex flex-col items-center justify-center p-4">
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
            <div className="relative p-8">
              <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-forest-accent to-forest-pink flex items-center justify-center text-forest-card font-serif text-2xl shadow-lg mb-4">
                  <Sparkles size={24} />
                </div>
                <h1 className="font-serif text-xl font-bold text-forest-ink">执印入阁</h1>
                <p className="text-xs text-forest-muted mt-1">塔罗研习阁 · 身份验证</p>
              </div>

              {!!session ? (
                <div className="space-y-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-forest-accent/10 flex items-center justify-center mx-auto">
                    <CheckCircle className="text-forest-accent" size={32} />
                  </div>
                  <div>
                    <h2 className="font-serif text-lg font-bold text-forest-ink">印鉴已验证</h2>
                    <p className="text-xs text-forest-muted mt-1">欢迎归来，研习阁主</p>
                  </div>
                  
                  {lastLogin && (
                    <div className="bg-forest-bg/30 rounded-xl p-4 text-left">
                      <p className="text-xs text-forest-muted flex items-center gap-2">
                        <Clock size={12} />
                        上次入阁：{lastLogin.displayDate}
                      </p>
                      <p className="text-xs text-forest-accent mt-1">{lastLogin.type} · {lastLogin.identifier}</p>
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
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-forest-muted uppercase tracking-wider flex items-center gap-2">
                      <Mail size={12} /> 邮箱
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        disabled={loading}
                        className="w-full pl-10 pr-4 py-3.5 bg-forest-bg/30 border border-forest-accent/10 rounded-xl focus:ring-2 focus:ring-forest-accent/20 transition-all outline-none text-sm"
                        placeholder="example@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-muted" size={16} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-forest-muted uppercase tracking-wider flex items-center gap-2">
                      <Lock size={12} /> 密码
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        required
                        disabled={loading}
                        className="w-full pl-10 pr-4 py-3.5 bg-forest-bg/30 border border-forest-accent/10 rounded-xl focus:ring-2 focus:ring-forest-accent/20 transition-all outline-none text-sm"
                        placeholder="至少6位字符"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-muted" size={16} />
                    </div>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs text-red-500 bg-red-50 p-3 rounded-lg border border-red-100"
                    >
                      <p className="text-center">{error}</p>
                      {(error.includes('密码错误') || error.includes('密码不正确') || error.includes('找回密码')) && (
                        <motion.button
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          onClick={() => {
                            setShowResetPassword(true);
                            setResetEmail(email);
                          }}
                          className="block w-full mt-2 py-1.5 text-xs text-forest-accent hover:underline transition-colors"
                        >
                          忘记密码？点击找回
                        </motion.button>
                      )}
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
                        执印入阁
                      </>
                    )}
                  </button>

                  <div className="pt-4 border-t border-forest-accent/5 space-y-3">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-xs text-forest-muted">尚未执印入阁？</span>
                      <button
                        type="button"
                        onClick={handleSignUp}
                        className="text-xs font-bold text-forest-accent hover:underline transition-colors"
                      >
                        注册新号
                      </button>
                    </div>
                    
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-text/20 backdrop-blur-sm"
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
                      required
                      disabled={loading}
                      className="w-full pl-10 pr-4 py-3.5 bg-forest-bg/30 border border-forest-accent/10 rounded-xl focus:ring-2 focus:ring-forest-accent/20 transition-all outline-none text-sm"
                      placeholder="example@email.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-text/20 backdrop-blur-sm"
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
                  <div className="relative">
                    <input
                      type="password"
                      required
                      disabled={loading}
                      className="w-full pl-10 pr-4 py-3.5 bg-forest-bg/30 border border-forest-accent/10 rounded-xl focus:ring-2 focus:ring-forest-accent/20 transition-all outline-none text-sm"
                      placeholder="至少6位字符"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-muted" size={16} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-forest-muted uppercase tracking-wider flex items-center gap-2">
                    <Lock size={12} /> 确认密码
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      disabled={loading}
                      className="w-full pl-10 pr-4 py-3.5 bg-forest-bg/30 border border-forest-accent/10 rounded-xl focus:ring-2 focus:ring-forest-accent/20 transition-all outline-none text-sm"
                      placeholder="再次输入密码"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-muted" size={16} />
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-text/20 backdrop-blur-sm"
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
                  <div className="relative">
                    <input
                      type="password"
                      required
                      disabled={loading}
                      className="w-full pl-10 pr-4 py-3.5 bg-forest-bg/30 border border-forest-accent/10 rounded-xl focus:ring-2 focus:ring-forest-accent/20 transition-all outline-none text-sm"
                      placeholder="请输入当前密码"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-muted" size={16} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-forest-muted uppercase tracking-wider flex items-center gap-2">
                    <Lock size={12} /> 新密码
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      disabled={loading}
                      className="w-full pl-10 pr-4 py-3.5 bg-forest-bg/30 border border-forest-accent/10 rounded-xl focus:ring-2 focus:ring-forest-accent/20 transition-all outline-none text-sm"
                      placeholder="至少6位字符"
                      value={newPasswordForChange}
                      onChange={(e) => setNewPasswordForChange(e.target.value)}
                    />
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-muted" size={16} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-forest-muted uppercase tracking-wider flex items-center gap-2">
                    <Lock size={12} /> 确认新密码
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      disabled={loading}
                      className="w-full pl-10 pr-4 py-3.5 bg-forest-bg/30 border border-forest-accent/10 rounded-xl focus:ring-2 focus:ring-forest-accent/20 transition-all outline-none text-sm"
                      placeholder="再次输入新密码"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                    />
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-muted" size={16} />
                  </div>
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
