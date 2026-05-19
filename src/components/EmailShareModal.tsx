import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { emailService } from '../services/emailService';
import { ReadingSlotData } from '../types';

interface EmailShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: string;
  cardSlots: ReadingSlotData[];
  interpretation: string;
}

export const EmailShareModal: React.FC<EmailShareModalProps> = ({
  isOpen,
  onClose,
  question,
  cardSlots,
  interpretation
}) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus('sending');
    setErrorMessage('');
    const content = emailService.generateReadingReport(question, cardSlots, interpretation);
    
    try {
      await emailService.sendReadingToEmail(email, content);
      setStatus('success');
      setTimeout(() => {
        onClose();
        setStatus('idle');
        setEmail('');
      }, 2000);
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || '发送失败，请稍后重试');
      setStatus('error');
    }
  };

  const handleRetry = () => {
    setStatus('idle');
    setErrorMessage('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="发送占卜报告至邮箱">
      <div className="p-1 space-y-4">
        <AnimatePresence mode="wait">
          {status === 'success' ? (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              className="flex flex-col items-center justify-center py-6 space-y-3 text-green-600"
            >
              <CheckCircle2 size={48} className="animate-bounce" />
              <p className="font-bold">邮件已成功投递！</p>
            </motion.div>
          ) : status === 'error' ? (
            <motion.div 
              key="error"
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              className="flex flex-col items-center justify-center py-6 space-y-3 text-red-600"
            >
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center"
              >
                <X size={32} />
              </motion.div>
              <p className="font-bold">投递失败</p>
              <p className="text-xs text-center px-4">{errorMessage}</p>
              <button
                onClick={handleRetry}
                className="mt-2 px-4 py-2 bg-forest-accent text-white text-sm rounded-full hover:bg-forest-accent/90 transition-colors"
              >
                重试
              </button>
            </motion.div>
          ) : (
            <motion.form 
              key="form"
              onSubmit={handleSend} 
              className="space-y-4"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
            >
              <div className="space-y-2">
                <label className="text-xs font-bold text-forest-muted uppercase tracking-wider flex items-center gap-2">
                  <Mail size={14} /> 收件人邮箱
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-forest-accent/5 border border-forest-accent/10 rounded-xl focus:ring-2 focus:ring-forest-accent/20 text-sm outline-none transition-all"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-muted">
                    <Mail size={18} />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <p className="text-[10px] text-amber-700 leading-relaxed italic">
                  提示：我们将把当前占卜的问题、阵列以及您的灵见注疏整理成精美的报告发送给您。
                </p>
              </div>

              <button
                type="submit"
                disabled={status === 'sending'}
                className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
                  status === 'sending' 
                    ? 'bg-forest-muted text-white cursor-not-allowed' 
                    : 'bg-forest-accent text-white hover:bg-forest-accent/90 active:scale-[0.98]'
                }`}
              >
                {status === 'sending' ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>正在投递...</span>
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    <span>立即发送</span>
                  </>
                )}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
};
