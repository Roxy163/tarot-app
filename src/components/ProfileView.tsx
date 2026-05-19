import React, { useState, useRef } from 'react';
import { User, Sparkles, Edit3, Save, X, Calendar, BookOpen, Award, Check, Lock, ShieldCheck, Copy, LogOut, Camera } from 'lucide-react';
import { TarotReading, TarotCardMetadata, UserProfile } from '../types';
import { AvatarCropModal } from './AvatarCropModal';
import { uploadUserAvatar } from '../lib/firebaseData';

interface ProfileViewProps {
  authorName: string;
  readings: TarotReading[];
  publicReadings?: TarotReading[]; // Making optional as we filter locally
  cardMetadata: TarotCardMetadata[];
  onTagClick: (tag: string) => void;
  onEditReading: (reading: TarotReading) => void;
  onDeleteReading: (id: string) => void;
  onTogglePublic: (id: string) => void;
  onUpdateProfile: (updated: Partial<UserProfile>) => Promise<void>;
  profile: UserProfile | null;
  onViewAll?: () => void;
  onLogout?: () => void;
}

export function ProfileView({ 
  authorName, 
  readings, 
  cardMetadata, 
  onTagClick, 
  onEditReading, 
  onDeleteReading, 
  onTogglePublic,
  onUpdateProfile,
  profile,
  onViewAll,
  onLogout
}: ProfileViewProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [editName, setEditName] = useState(profile?.display_name || profile?.nickname || authorName);
  const [editBio, setEditBio] = useState(profile?.bio || profile?.signature || '研习覃思，洞见未来');

  const authorReadings = readings.filter(r => {
    // 阁主本人查看自己的印鉴：通过 userId 强匹配
    if (profile && r.userId === profile.id) return true;
    
    // 如果是匹配作者名（用于其他公开用户的视角）
    const nameMatch = r.authorName === authorName || (authorName === '研习阁主' && !r.authorName);
    return nameMatch;
  });
  
  const publicReadingsCount = authorReadings.filter(r => r.isPublic).length;

  const getRank = (count: number) => {
    if (count >= 50) return '通灵导师';
    if (count >= 20) return '资深研习者';
    if (count >= 10) return '执月学徒';
    return '启蒙阁友';
  };

  const rank = getRank(authorReadings.length);

  const tarotId = profile?.user_public_id || 'TAROT-PENDING';

  const handleCopyId = () => {
    navigator.clipboard.writeText(tarotId);
    // 使用应用内统一的反馈逻辑，这里暂用内置提示
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 bg-forest-ink text-white px-6 py-3 rounded-full text-sm font-bold shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-4';
    toast.innerText = '阁主编号已复制到指尖';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('图片文件请保持在 5MB 以内');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropImage(reader.result as string);
      setIsCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    // Reset input
    event.target.value = '';
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!profile) return;

    try {
      setIsUploading(true);
      const publicUrlWithCacheBust = await uploadUserAvatar(profile.id, croppedBlob);
      await onUpdateProfile({ avatar_url: publicUrlWithCacheBust });
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.message || '上传头像失败，请稍后再试');
    } finally {
      setIsUploading(false);
    }
  };

  const formatDate = () => {
    const date = new Date(profile?.createdAt || Date.now());
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const latestReading = authorReadings.length > 0 ? authorReadings[0] : null;

  return (
    <>
      <div className="space-y-12 pb-32 animate-in fade-in duration-700">
      {/* 顶部居中心空间 */}
      <div className="flex flex-col items-center text-center space-y-8 pt-8">
        {/* 头像区域 */}
        <div className="relative">
          <div 
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className="w-40 h-40 rounded-full bg-forest-bg border-8 border-white shadow-[0_20px_50px_rgba(44,54,44,0.15)] overflow-hidden cursor-pointer hover:scale-105 transition-all duration-500 relative group"
          >
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-forest-accent/5">
                <User size={64} className="text-forest-accent/20" />
              </div>
            )}
            
            <div className="absolute inset-0 bg-forest-ink/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <Camera className="text-white" size={32} />
            </div>

            {isUploading && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                <div className="w-8 h-8 border-3 border-forest-accent border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            accept="image/*" 
            className="hidden" 
          />
          
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-forest-accent text-white px-5 py-1.5 rounded-full text-xs font-bold shadow-xl border-2 border-white whitespace-nowrap">
            {rank}
          </div>
        </div>

        {/* 昵称与签名 */}
        <div className="space-y-4 w-full max-w-2xl px-6">
          {isEditingName ? (
            <div className="flex items-center gap-2 justify-center">
              <input 
                autoFocus
                className="text-4xl font-serif text-forest-ink bg-white border-b-3 border-forest-accent outline-none text-center px-4 py-1 max-w-xs"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={async () => {
                  setIsEditingName(false);
                  if (editName !== (profile?.display_name || profile?.nickname)) {
                    await onUpdateProfile({ display_name: editName });
                  }
                }}
                onKeyDown={e => e.key === 'Enter' && (e.currentTarget as any).blur()}
              />
            </div>
          ) : (
            <div className="flex items-center gap-4 justify-center group">
              <h2 className="text-4xl md:text-5xl font-serif text-forest-ink font-bold tracking-tight">
                {profile?.display_name || profile?.nickname || authorName}
              </h2>
              <button 
                onClick={() => setIsEditingName(true)}
                className="p-2 text-forest-muted opacity-0 group-hover:opacity-100 hover:text-forest-accent hover:bg-forest-accent/5 rounded-xl transition-all"
              >
                <Edit3 size={20} />
              </button>
            </div>
          )}

          <div className="relative group max-w-lg mx-auto">
            {isEditingBio ? (
              <textarea 
                className="w-full text-lg text-center text-forest-muted font-kai italic bg-white border-2 border-forest-accent/10 rounded-2xl px-6 py-4 outline-none focus:ring-8 focus:ring-forest-accent/5 resize-none h-24 shadow-inner"
                value={editBio}
                onChange={e => setEditBio(e.target.value)}
                onBlur={async () => {
                  setIsEditingBio(false);
                  if (editBio !== (profile?.bio || profile?.signature)) {
                    await onUpdateProfile({ bio: editBio });
                  }
                }}
                autoFocus
              />
            ) : (
              <div className="flex items-center justify-center gap-3">
                <p className="text-xl text-forest-muted font-kai italic opacity-80 leading-relaxed px-10">
                  “ {profile?.bio || profile?.signature || '研习覃思，洞见未来'} ”
                </p>
                <button 
                  onClick={() => setIsEditingBio(true)}
                  className="p-2 text-forest-muted opacity-0 group-hover:opacity-100 hover:text-forest-accent hover:bg-forest-accent/5 rounded-xl transition-all absolute right-0 top-0"
                >
                  <Edit3 size={18} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 阁主编号展示 */}
        <div className="flex flex-col items-center gap-4 pt-2">
          <div className="flex items-center gap-3 px-6 py-3 bg-white rounded-3xl border border-forest-border shadow-sm group hover:shadow-md transition-shadow">
            <span className="text-[10px] text-forest-muted font-bold tracking-[0.2em] uppercase opacity-60">阁主编号</span>
            <code className="text-base font-mono font-bold text-forest-accent tracking-wider">
              {tarotId}
            </code>
            <button 
              onClick={handleCopyId}
              className="text-forest-muted hover:text-forest-accent transition-colors p-1"
              title="复制编号"
            >
              <Copy size={16} />
            </button>
          </div>

          <div className="flex gap-6">
            <div className="flex items-center gap-2.5 text-xs text-forest-muted font-bold px-4 py-2 bg-forest-bg/50 rounded-full border border-forest-border/50">
              <Calendar size={14} className="text-forest-accent" />
              <span>入阁时日：{formatDate()}</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-forest-muted font-bold px-4 py-2 bg-forest-bg/50 rounded-full border border-forest-border/50">
              <BookOpen size={14} className="text-forest-accent" />
              <span>手记累积：{authorReadings.length} 条</span>
            </div>
          </div>

          {/* 登出按钮 */}
          {onLogout && (
            <button 
              onClick={onLogout}
              className="flex items-center gap-2 px-6 py-3 bg-forest-accent/10 text-forest-accent rounded-full text-sm font-bold hover:bg-forest-accent/20 transition-all"
            >
              <LogOut size={16} />
              封印离阁
            </button>
          )}
        </div>
      </div>

      {/* 数据概览 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 px-4 max-w-5xl mx-auto">
        {[
          { label: '阁中典籍', value: authorReadings.length },
          { label: '灵见手札', value: authorReadings.filter(r => r.isAiProcessed).length },
          { label: '公开案例', value: publicReadingsCount },
          { label: '研习成果', value: authorReadings.reduce((sum, r) => sum + (r.cards?.length || 0), 0) + ' 牌' }
        ].map((stat, idx) => (
          <div key={idx} className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-forest-border text-center shadow-sm hover:translate-y-[-6px] hover:shadow-2xl transition-all duration-500 group relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-forest-accent/10 group-hover:h-full transition-all duration-500 -z-10" />
            <p className="text-3xl sm:text-4xl font-serif text-forest-accent font-bold mb-2">{stat.value}</p>
            <p className="text-[10px] text-forest-muted uppercase tracking-[0.3em] font-bold">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* 底部功能组合入口 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 px-4 max-w-6xl mx-auto">
        {/* 典籍快照 */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-4">
            <h3 className="text-2xl font-serif text-forest-ink flex items-center gap-3 font-bold">
              <BookOpen size={26} className="text-forest-accent" />
              📜 最近研习
            </h3>
            {authorReadings.length > 0 && (
              <button 
                onClick={onViewAll}
                className="text-sm text-forest-accent font-bold hover:underline px-3 py-1 flex items-center gap-1 group"
              >
                查看全部 <X size={16} className="rotate-45 group-hover:scale-125 transition-transform" />
              </button>
            )}
          </div>
          
          <div className="bg-white p-10 rounded-[3rem] border border-forest-border shadow-sm min-h-[240px] flex flex-col justify-center relative overflow-hidden group hover:shadow-lg transition-all duration-500">
            <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:scale-110 transition-transform duration-700">
              <BookOpen size={160} />
            </div>

            {latestReading ? (
              <div className="space-y-6 relative z-10">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-forest-muted uppercase tracking-[0.2em] bg-forest-bg/80 px-5 py-2 rounded-full border border-forest-border/40">
                    {new Date(latestReading.date).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                  {latestReading.isAiProcessed && (
                    <div className="flex items-center gap-1.5 text-[11px] text-forest-accent font-bold">
                      <Sparkles size={14} className="animate-pulse" /> 灵见已存
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <p className="text-2xl font-serif text-forest-ink line-clamp-1 font-bold leading-tight">
                    {latestReading.question || '未命名的研习'}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {latestReading.cards.slice(0, 3).map((card, i) => (
                      <span key={i} className="text-xs text-forest-muted bg-forest-bg px-4 py-1.5 rounded-xl border border-forest-border/30">
                        {card.name}
                      </span>
                    ))}
                    {latestReading.cards.length > 3 && (
                      <span className="text-xs text-forest-muted font-bold opacity-40">+{latestReading.cards.length - 3}</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 space-y-6">
                <div className="w-24 h-24 bg-forest-bg rounded-full flex items-center justify-center mx-auto border border-forest-border group-hover:rotate-12 transition-transform duration-500">
                  <Sparkles size={40} className="text-forest-muted/20" />
                </div>
                <p className="text-sm text-forest-muted font-medium">执印入阁，留下你的第一篇手记。</p>
              </div>
            )}
          </div>
        </div>

        {/* 阁中成就（占位） */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-4">
            <h3 className="text-2xl font-serif text-forest-ink flex items-center gap-3 font-bold">
              <Award size={26} className="text-forest-accent" />
              🎖️ 研习成就
            </h3>
          </div>
          <div className="bg-white p-10 rounded-[3rem] border border-forest-border shadow-sm min-h-[240px] flex flex-col justify-center relative overflow-hidden group">
            <div className="grid grid-cols-3 gap-6 filter grayscale opacity-20 group-hover:opacity-40 transition-all duration-700">
               {[1, 2, 3].map(i => (
                 <div key={i} className="aspect-square rounded-[2rem] bg-forest-bg flex items-center justify-center border-2 border-dashed border-forest-border">
                   <Lock size={24} className="text-forest-muted/30" />
                 </div>
               ))}
            </div>
            <p className="text-center text-[10px] text-forest-muted mt-8 font-bold tracking-[0.4em] uppercase">成就系统筹备中</p>
          </div>
        </div>
      </div>
    </div>

    {cropImage && (
      <AvatarCropModal 
        image={cropImage}
        isOpen={isCropModalOpen}
        onClose={() => {
          setIsCropModalOpen(false);
          setCropImage(null);
        }}
        onCropComplete={handleCropComplete}
      />
    )}
  </>
);
}

