import React, { useState } from 'react';
import { User, Sparkles, Edit3, Save, X, Calendar, BookOpen, Award } from 'lucide-react';
import { TarotReading, TarotCardMetadata, UserProfile } from '../types';
import { ReadingCard } from './ReadingCard';

interface ProfileViewProps {
  authorName: string;
  profile: UserProfile | null;
  onUpdateProfile: (updated: Partial<UserProfile>) => Promise<void>;
  readings: TarotReading[];
  cardMetadata: TarotCardMetadata[];
  onTagClick: (tag: string) => void;
  onEditReading: (reading: TarotReading) => void;
  onDeleteReading: (id: string) => void;
  onTogglePublic: (id: string) => void;
}

export function ProfileView({ 
  authorName, 
  profile,
  onUpdateProfile,
  readings, 
  cardMetadata,
  onTagClick, 
  onEditReading, 
  onDeleteReading, 
  onTogglePublic 
}: ProfileViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    nickname: profile?.nickname || '',
    signature: profile?.signature || ''
  });

  const authorReadings = readings.filter(r => 
    r.authorName === authorName || (authorName === '研习阁主' && !r.authorName)
  );
  
  const publicReadings = authorReadings.filter(r => r.isPublic || authorName === '研习阁主');

  const getRank = (count: number) => {
    if (count <= 10) return '见习阁主';
    if (count <= 50) return '初窥门径';
    if (count <= 100) return '灵见者';
    if (count <= 500) return '解义人';
    return '大阁主';
  };

  const rank = getRank(authorReadings.length);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '未知';
    const date = new Date(dateStr);
    return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月${String(date.getDate()).padStart(2, '0')}日`;
  };

  const handleSave = async () => {
    if (editData.signature.length > 50) return;
    await onUpdateProfile(editData);
    setIsEditing(false);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="ancient-book-bg p-8 rounded-[2rem] border border-forest-border shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4">
          <Award size={64} className="text-forest-accent/5 -rotate-12" />
        </div>
        
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8 relative z-10">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full bg-forest-accent flex items-center justify-center text-forest-card text-4xl font-serif shadow-2xl border-4 border-forest-card">
              {profile?.nickname?.[0] || authorName[0]}
            </div>
            <div className="absolute -bottom-2 -right-2 bg-white px-3 py-1 rounded-full shadow-md border border-forest-accent/10 flex items-center gap-1">
              <Award size={12} className="text-forest-accent" />
              <span className="text-[10px] font-bold text-forest-accent">{rank}</span>
            </div>
          </div>

          <div className="flex-1 text-center md:text-left space-y-4">
            {isEditing ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-forest-muted font-bold uppercase tracking-wider">阁主名号</label>
                  <input 
                    className="text-xl font-serif text-forest-accent bg-white border border-forest-accent/20 rounded-xl px-4 py-2 w-full max-w-xs focus:ring-2 focus:ring-forest-accent/20 outline-none transition-all"
                    value={editData.nickname}
                    onChange={e => setEditData({...editData, nickname: e.target.value})}
                    placeholder="请输入阁主名号"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center max-w-md">
                    <label className="text-[10px] text-forest-muted font-bold uppercase tracking-wider">研习签印</label>
                    <span className={`text-[10px] ${editData.signature.length > 50 ? 'text-red-500' : 'text-forest-muted'}`}>
                      {editData.signature.length} / 50
                    </span>
                  </div>
                  <textarea 
                    className="text-sm text-forest-muted bg-white border border-forest-accent/20 rounded-xl px-4 py-3 w-full max-w-md h-24 focus:ring-2 focus:ring-forest-accent/20 outline-none transition-all resize-none"
                    value={editData.signature}
                    onChange={e => setEditData({...editData, signature: e.target.value})}
                    placeholder="研习签印（最多50字）"
                  />
                </div>
                <div className="flex justify-center md:justify-start gap-3">
                  <button 
                    onClick={handleSave} 
                    disabled={editData.signature.length > 50}
                    className="flex items-center gap-2 px-6 py-2 bg-forest-pink text-white rounded-full text-sm font-bold shadow-lg shadow-forest-pink/20 hover:bg-forest-pink/90 transition-all disabled:opacity-50"
                  >
                    <Save size={16} /> 钤印存证
                  </button>
                  <button onClick={() => setIsEditing(false)} className="flex items-center gap-2 px-6 py-2 bg-forest-bg text-forest-muted rounded-full text-sm font-bold border border-forest-accent/10 hover:bg-forest-accent/5 transition-all">
                    <X size={16} /> 取消
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-center md:justify-start gap-3">
                  <h2 className="text-3xl font-serif text-forest-ink">{profile?.nickname || authorName}</h2>
                  {profile && (
                    <button onClick={() => {
                      setEditData({ nickname: profile.nickname, signature: profile.signature });
                      setIsEditing(true);
                    }} className="p-2 bg-forest-accent/5 text-forest-accent rounded-full hover:bg-forest-accent/10 transition-all">
                      <Edit3 size={16} />
                    </button>
                  )}
                </div>
                <p className="text-base text-forest-muted font-kai italic max-w-md leading-relaxed">
                  “ {profile?.signature || '研精覃思，洞见未来'} ”
                </p>
                
                <div className="flex flex-wrap justify-center md:justify-start gap-6 pt-4">
                  <div className="flex items-center gap-2 text-xs text-forest-muted bg-forest-accent/5 px-3 py-1.5 rounded-full">
                    <Calendar size={14} className="text-forest-accent" />
                    <span>入阁时日：{formatDate(profile?.createdAt || '')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-forest-muted bg-forest-accent/5 px-3 py-1.5 rounded-full">
                    <BookOpen size={14} className="text-forest-accent" />
                    <span>手记累积：{authorReadings.length} 条</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-forest-border text-center shadow-sm">
          <p className="text-3xl font-serif text-forest-accent">{authorReadings.length}</p>
          <p className="text-[10px] text-forest-muted uppercase tracking-widest mt-1">阁中典籍</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-forest-border text-center shadow-sm">
          <p className="text-3xl font-serif text-forest-accent">{publicReadings.length}</p>
          <p className="text-[10px] text-forest-muted uppercase tracking-widest mt-1">公开案例</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-forest-border text-center shadow-sm">
          <p className="text-3xl font-serif text-forest-accent">{authorReadings.filter(r => r.isAiProcessed).length}</p>
          <p className="text-[10px] text-forest-muted uppercase tracking-widest mt-1">灵见手帖</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-forest-border text-center shadow-sm">
          <p className="text-3xl font-serif text-forest-accent">12</p>
          <p className="text-[10px] text-forest-muted uppercase tracking-widest mt-1">获赞总数</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xl font-serif text-forest-ink flex items-center gap-2">
            <Sparkles size={20} className="text-forest-accent" />
            典籍展示
          </h3>
        </div>
        
        {publicReadings.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[2rem] border border-forest-border space-y-4 shadow-inner">
            <User size={48} className="mx-auto mb-4 opacity-10 text-forest-accent" />
            <p className="text-forest-ink font-medium">阁中尚无公开典籍</p>
            {authorName === '研习阁主' && (
              <p className="text-xs text-forest-muted max-w-xs mx-auto">
                提示：您可以在“阁中典籍”中将您的研习笔记设为“公开到研习广场”，这样它们就会出现在您的阁主印鉴中。
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {publicReadings.map(reading => (
              <ReadingCard 
                key={reading.id} 
                reading={reading} 
                isPublicView={authorName !== '研习阁主'} 
                onTogglePublic={() => onTogglePublic(reading.id)}
                onDelete={() => onDeleteReading(reading.id)}
                onEdit={() => onEditReading(reading)}
                onTagClick={onTagClick}
                cardMetadata={cardMetadata}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
