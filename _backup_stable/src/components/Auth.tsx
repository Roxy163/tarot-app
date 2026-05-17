import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { Mail, Send, Sparkles } from 'lucide-react';

export const Auth: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: number;
    if (countdown > 0) {
      timer = window.setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
        shouldCreateUser: true,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
      setCountdown(60);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-forest-bg flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-forest-border p-8 space-y-8"
      >
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-forest-accent/10 text-forest-accent mb-2">
            <Sparkles size={32} />
          </div>
          <h1 className="text-3xl font-serif font-bold text-forest-ink">执印入阁</h1>
          <p className="text-forest-muted">输入阁主邮箱，我们将发送一枚入阁灵钥。</p>
        </div>

        <form className="space-y-6" onSubmit={handleSendMagicLink}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-forest-accent flex items-center gap-2">
              <Mail size={16} /> 阁主邮箱
            </label>
            <div className="relative">
              <input
                type="email"
                required
                disabled={sent}
                className="w-full pl-10 pr-4 py-3 bg-forest-bg/50 border border-forest-accent/10 rounded-xl focus:ring-2 focus:ring-forest-accent/20 transition-all outline-none"
                placeholder="阁主邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-muted" size={18} />
            </div>
          </div>

          {sent && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="p-4 bg-forest-accent/5 rounded-xl border border-forest-accent/10 text-center"
            >
              <p className="text-sm text-forest-accent font-medium leading-relaxed">
                灵钥已发送至阁主邮箱，请点击邮件中的链接执印入阁。
              </p>
              <p className="text-[10px] text-forest-muted mt-2">若未收到，请检查垃圾邮件箱。</p>
            </motion.div>
          )}

          {error && (
            <p className="text-xs text-red-500 bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>
          )}

          <div className="space-y-3">
            <button
              type="submit"
              disabled={loading || (sent && countdown > 0)}
              className="w-full py-3 bg-forest-pink text-white rounded-xl font-medium hover:bg-forest-pink/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-forest-pink/20"
            >
              {loading ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                  <Send size={18} />
                </motion.div>
              ) : (
                <Send size={18} />
              )}
              {sent ? (countdown > 0 ? `重新发送 (${countdown}s)` : '重新发送灵钥') : '发送入阁灵钥'}
            </button>
          </div>
        </form>

        <div className="pt-4 border-t border-forest-accent/5 space-y-3">
          <p className="text-[10px] text-forest-muted text-center leading-relaxed">
            🔐 你的数据，只属于你。我们承诺：绝不分析、绝不共享你的个人记录。所有解读内容均采用安全存储，除你之外无人可访问。
          </p>
          <p className="text-[10px] text-forest-muted text-center leading-relaxed">
            ⚠️ 娱乐与成长工具：本工具旨在辅助个人塔罗学习与自我觉察，所有AI生成内容及牌面解读仅供参考，不构成任何专业心理咨询、医疗或投资建议。
          </p>
        </div>
      </motion.div>
    </div>
  );
};
