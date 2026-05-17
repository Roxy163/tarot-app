import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Send, Sparkles, Lock, UserPlus, LogIn, Key } from 'lucide-react';

type AuthMode = 'magic-link' | 'password-login' | 'password-signup';

export const Auth: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(''); // 新增：验证码状态
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AuthMode | 'reset-password'>('magic-link');
  const [hasActiveSession, setHasActiveSession] = useState(false);

  // ... (previous logic)

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || loading) return;
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      if (error.status === 429) setError("重置请求过于频繁，请 1 小时后再试。");
      else setError(error.message);
    } else {
      setSent(true);
      setError("重置灵钥已发往您的邮箱，请点击其中的链接重设密码。");
    }
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasActiveSession(!!session);
    });
  }, []);

  const handleLogoutInAuth = async () => {
    await supabase.auth.signOut();
    setHasActiveSession(false);
    setError("阁主印鉴已封印。您可以输入新邮箱执印入阁。");
    setTimeout(() => setError(null), 3000);
  };

  useEffect(() => {
    let timer: number;
    if (countdown > 0) {
      timer = window.setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || loading) return;

    setLoading(true);
    setError(null);

    try {
      // 恢复标准调用参数，并确保捕获所有阶段的异常
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        }
      });

      if (error) {
        // 关键：针对 Supabase 默认邮件服务 3次/小时 的限制进行精准提示
        if (error.status === 429 || error.message.toLowerCase().includes('rate limit')) {
          setError("「限流警告」Supabase 默认邮件每小时仅限发送 3 次。由于近期操作频繁，请 1 小时后再试，或改用密码登录。");
        } else {
          setError(`发送失败: ${error.message}`);
        }
      } else {
        setSent(true);
        setCountdown(60);
      }
    } catch (err: any) {
      setError("阁内灵力连接不稳，请刷新页面后重试。");
    } finally {
      setLoading(false);
    }
  };

  // 新增：处理验证码验证
  const handleVerifyOtp = async (otpToken?: string) => {
    const finalToken = otpToken || token;
    if (!finalToken || finalToken.length < 6) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: finalToken,
        type: 'magiclink'
      });

      if (error) {
        setError("验证码错误或已过期，请重试。");
        setLoading(false);
      } else if (data.session) {
        // 验证成功！显示一点点成功反馈再让 App.tsx 接管切换
        setSent(false); // 隐藏发送成功提示
        // 这里不调用 setLoading(false)，让加载动画持续到页面切换，显得更连贯
      } else {
        setLoading(false);
      }
    } catch (err) {
      setError("网络连接异常，请稍后重试。");
      setLoading(false);
    }
  };

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError(null);

    let result;
    if (mode === 'password-signup') {
      result = await supabase.auth.signUp({
        email,
        password,
      });
    } else {
      result = await supabase.auth.signInWithPassword({
        email,
        password,
      });
    }

    if (result.error) {
      setError(result.error.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-forest-bg flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-forest-border p-8 space-y-6"
      >
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-forest-accent/10 text-forest-accent mb-2">
            <Sparkles size={32} />
          </div>
          <h1 className="text-3xl font-serif font-bold text-forest-ink">执印入阁</h1>
          <p className="text-forest-muted text-xs leading-relaxed max-w-[280px] mx-auto">
            {mode === 'magic-link' ? (
              <>
                <span className="text-forest-accent font-bold">「特别提示」</span> 
                因资源有限，每号每日仅限接收 3 次灵钥。建议入阁后前往“安全印鉴”设置通行密码。
              </>
            ) : mode === 'password-login' ? (
              '欢迎归阁，请输入您的通行密码以验证印鉴。'
            ) : (
              '欢迎新阁主，请拟定您的入阁邮箱与密码。'
            )}
          </p>
        </div>

        <div className="flex p-1 bg-forest-bg/50 rounded-xl border border-forest-accent/5">
          <button 
            onClick={() => { setMode('magic-link'); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold rounded-lg transition-all ${mode === 'magic-link' ? 'bg-white text-forest-accent shadow-sm' : 'text-forest-muted hover:text-forest-accent'}`}
          >
            <Key size={12} /> 免密登录
          </button>
          <button 
            onClick={() => { setMode('password-login'); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold rounded-lg transition-all ${mode === 'password-login' ? 'bg-white text-forest-accent shadow-sm' : 'text-forest-muted hover:text-forest-accent'}`}
          >
            <LogIn size={12} /> 密码登录
          </button>
          <button 
            onClick={() => { setMode('password-signup'); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold rounded-lg transition-all ${mode === 'password-signup' ? 'bg-white text-forest-accent shadow-sm' : 'text-forest-muted hover:text-forest-accent'}`}
          >
            <UserPlus size={12} /> 注册新号
          </button>
        </div>

        <form 
          className="space-y-4" 
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === 'magic-link') {
              if (sent) handleVerifyOtp();
              else handleMagicLink(e);
            } else {
              handlePasswordAuth(e);
            }
          }}
        >
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-forest-muted uppercase tracking-wider flex items-center gap-2">
              <Mail size={12} /> 阁主邮箱
            </label>
            <div className="relative">
              <input
                type="email"
                required
                disabled={loading || (mode === 'magic-link' && sent && countdown > 0)}
                className="w-full pl-10 pr-4 py-3 bg-forest-bg/30 border border-forest-accent/10 rounded-xl focus:ring-2 focus:ring-forest-accent/20 transition-all outline-none text-sm"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-muted" size={16} />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {mode === 'magic-link' && sent && (
              <motion.div 
                key="otp-field"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-1.5 overflow-hidden"
              >
                <label className="text-[11px] font-bold text-forest-accent uppercase tracking-wider flex items-center gap-2">
                  <Key size={12} /> 灵钥验证码
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    pattern="\d{6}"
                    inputMode="numeric"
                    autoFocus
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-3 bg-forest-accent/5 border border-forest-accent/20 rounded-xl focus:ring-2 focus:ring-forest-accent/30 transition-all outline-none text-center text-lg font-mono tracking-[0.6em] text-forest-accent"
                    placeholder="0 0 0 0 0 0"
                    value={token}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setToken(val);
                      if (val.length === 6) {
                        handleVerifyOtp(val);
                      }
                    }}
                  />
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-accent/60" size={16} />
                </div>
                <p className="text-[9px] text-forest-muted text-right">验证成功后将自动跳转入阁</p>
              </motion.div>
            )}

            {mode !== 'magic-link' && (
              <motion.div 
                key="password-field"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1.5 overflow-hidden"
              >
                <label className="text-[11px] font-bold text-forest-muted uppercase tracking-wider flex items-center gap-2">
                  <Lock size={12} /> 通行密码
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    minLength={6}
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-3 bg-forest-bg/30 border border-forest-accent/10 rounded-xl focus:ring-2 focus:ring-forest-accent/20 transition-all outline-none text-sm"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-muted" size={16} />
                </div>
                {mode === 'password-login' && (
                  <button 
                    type="button"
                    onClick={() => setMode('reset-password')}
                    className="text-[10px] text-forest-muted hover:text-forest-accent underline decoration-dotted mt-2 block w-full text-right"
                  >
                    忘记密码或从未设置？
                  </button>
                )}
              </motion.div>
            )}

            {mode === 'reset-password' && (
              <motion.div 
                key="reset-mode"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4"
              >
                <button
                  type="button"
                  onClick={() => setMode('password-login')}
                  className="text-[10px] text-forest-accent hover:underline mb-2"
                >
                  ← 返回密码登录
                </button>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={loading}
                  className="w-full py-3 bg-forest-bg border border-forest-accent/20 text-forest-accent rounded-xl text-xs font-bold hover:bg-forest-accent/5 transition-all"
                >
                  发送重置灵钥至邮箱
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {sent && mode === 'magic-link' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 bg-forest-accent/5 rounded-xl border border-forest-accent/10 text-center"
            >
              <p className="text-xs text-forest-accent font-medium leading-relaxed">
                入阁灵钥已发送！请查收邮件并填入 6 位验证码。
              </p>
              <p className="text-[10px] text-forest-muted mt-2">若未收到，请检查垃圾邮件箱。</p>
            </motion.div>
          )}

          {hasActiveSession && !sent && (
            <button
              type="button"
              onClick={handleLogoutInAuth}
              className="w-full py-2.5 text-[10px] text-forest-muted hover:text-forest-accent border border-dashed border-forest-accent/20 rounded-xl transition-all"
            >
              当前已执印入阁。点击此处“封印离阁”以切换账号。
            </button>
          )}

          {error && (
            <div className="space-y-2">
              <p className="text-[10px] text-red-500 bg-red-50 p-2.5 rounded-lg border border-red-100 italic leading-snug">
                {error}
              </p>
              {(error.includes('rate limit') || error.includes('限流')) && (
                <button 
                  onClick={() => setMode('password-login')}
                  className="w-full py-2 text-[10px] text-forest-accent font-bold hover:underline"
                >
                  已有密码？尝试密码登录 →
                </button>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (mode === 'magic-link' && sent && countdown > 0)}
            className="group relative w-full py-3 bg-forest-accent text-white rounded-xl font-bold text-sm hover:bg-forest-accent/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-forest-accent/20"
          >
            {loading ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                <Send size={16} />
              </motion.div>
            ) : (
              <Send size={16} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            )}
            {mode === 'magic-link' 
              ? (sent ? '验证灵钥并入阁' : '发送入阁灵钥') 
              : mode === 'password-login' ? '立即入阁' : '开启研习之路'}
          </button>
        </form>

        <div className="pt-4 border-t border-forest-accent/5 space-y-3">
          <p className="text-[10px] text-forest-muted text-center leading-relaxed">
            🔐 你的数据，只属于你。我们承诺：绝不分析、绝不共享你的个人记录。
          </p>
          <p className="text-[10px] text-forest-muted text-center leading-relaxed opacity-60">
            塔罗研习阁 • 森林感性设计
          </p>
        </div>
      </motion.div>
    </div>
  );
};
