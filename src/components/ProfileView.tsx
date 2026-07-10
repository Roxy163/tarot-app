import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Sparkles, Edit3, Calendar, BookOpen, Award, Copy, LogOut, Camera, HelpCircle } from 'lucide-react';
import { FeatureGuide } from './FeatureGuide';
import { TarotReading, TarotCardMetadata, UserProfile } from '../types';
import { AvatarCropModal } from './AvatarCropModal';

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

const DefaultTarotAvatar = () => (
  <div
    role="img"
    aria-label="默认塔罗花纹头像"
    className="relative h-full w-full overflow-hidden bg-gradient-to-br from-forest-bg via-white to-forest-accent/12"
  >
    <div className="absolute -inset-6 rounded-full bg-[radial-gradient(circle_at_35%_25%,rgba(220,190,120,0.28),transparent_34%),radial-gradient(circle_at_70%_72%,rgba(68,111,82,0.18),transparent_38%)]" />
    <div className="absolute inset-5 rounded-full border border-forest-accent/20" />
    <div className="absolute inset-8 rounded-full border border-dashed border-forest-accent/18" />
    <svg className="absolute inset-0 h-full w-full text-forest-accent/50" viewBox="0 0 160 160" aria-hidden="true">
      <path d="M52 116c-14-20-14-52 0-72" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M108 116c14-20 14-52 0-72" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M80 38l7.5 22 22 7.5-22 7.5L80 97l-7.5-22-22-7.5 22-7.5L80 38z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
      <path d="M103 35a20 20 0 1 1-18 29 22 22 0 0 0 26-26 19 19 0 0 1-8-3z" fill="currentColor" opacity="0.18" />
      <circle cx="47" cy="42" r="3" fill="currentColor" opacity="0.45" />
      <circle cx="116" cy="112" r="3" fill="currentColor" opacity="0.4" />
      <path d="M42 111c12-9 24-14 38-14s26 5 38 14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
    </svg>
    <div className="absolute left-1/2 top-7 flex -translate-x-1/2 items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full bg-forest-accent/25" />
      <span className="h-2 w-2 rounded-full bg-forest-accent/40" />
      <span className="h-3 w-3 rounded-full border border-forest-accent/45 bg-white/50" />
      <span className="h-2 w-2 rounded-full bg-forest-accent/40" />
      <span className="h-1.5 w-1.5 rounded-full bg-forest-accent/25" />
    </div>
  </div>
);

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
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const canEditProfile = !!profile;

  const [editName, setEditName] = useState(profile?.display_name || profile?.nickname || authorName);
  const [editBio, setEditBio] = useState(profile?.bio || profile?.signature || '研习覃思，洞见未来');

  const authorReadings = useMemo(() => readings.filter(r => {
    // 阁主本人查看自己的印鉴：通过 userId 强匹配
    if (profile && r.userId === profile.id) return true;

    // 如果是匹配作者名（用于其他公开用户的视角）
    const nameMatch = r.authorName === authorName || (authorName === '研习阁主' && !r.authorName);
    return nameMatch;
  }), [authorName, profile, readings]);

  const publicReadingsCount = authorReadings.filter(r => r.isPublic).length;

  const getRank = (count: number) => {
    if (count >= 50) return '通灵导师';
    if (count >= 20) return '资深研习者';
    if (count >= 10) return '执月学徒';
    return '启蒙阁友';
  };

  const rank = getRank(authorReadings.length);

  const tarotId = profile?.user_public_id || 'TAROT-PENDING';

  useEffect(() => () => {
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
  }, []);

  const showNotice = (message: string, duration = 2600) => {
    setNotice(message);
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice('');
      noticeTimerRef.current = null;
    }, duration);
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(tarotId);
    showNotice('阁主编号已复制到指尖');
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showNotice('图片文件请保持在 5MB 以内');
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
      const { uploadUserAvatar } = await import('../lib/firebaseData');
      const publicUrlWithCacheBust = await uploadUserAvatar(profile.id, croppedBlob);
      await onUpdateProfile({ avatar_url: publicUrlWithCacheBust });
    } catch (error: any) {
      console.error('Upload error:', error);
      showNotice(error.message || '上传头像失败，请稍后再试', 4200);
    } finally {
      setIsUploading(false);
    }
  };

  const formatDate = () => {
    const date = new Date(profile?.createdAt || Date.now());
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const sortedAuthorReadings = useMemo(() => (
    [...authorReadings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  ), [authorReadings]);

  const latestReading = sortedAuthorReadings.length > 0 ? sortedAuthorReadings[0] : null;
  const displayName = profile?.display_name || profile?.nickname || authorName;
  const displayBio = profile?.bio || profile?.signature || '研习覃思，洞见未来';
  const totalCards = authorReadings.reduce((sum, reading) => sum + (reading.cards?.length || 0), 0);
  const aiReadingsCount = authorReadings.filter(r => r.isAiProcessed).length;
  const stats = [
    { label: '阁中典籍', value: authorReadings.length, hint: '已保存手记' },
    { label: '灵见手札', value: aiReadingsCount, hint: '参与 AI 解析' },
    { label: '公开案例', value: publicReadingsCount, hint: '分享至广场' },
    { label: '研习成果', value: `${totalCards} 牌`, hint: '累计记录牌面' }
  ];

  return (
    <>
      <div className="space-y-5 pb-28 animate-in fade-in duration-700" data-testid="profile-dashboard">
        <section
          className="relative overflow-hidden rounded-[2rem] border border-forest-border bg-white/90 p-4 shadow-sm sm:p-5"
          data-testid="profile-dashboard-card"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(121,162,127,0.12),transparent_34%),radial-gradient(circle_at_92%_10%,rgba(222,197,135,0.18),transparent_30%)]" />
          <div className="relative grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <div
                  onClick={() => canEditProfile && !isUploading && fileInputRef.current?.click()}
                  onKeyDown={(event) => {
                    if (!canEditProfile || isUploading) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  role={canEditProfile ? 'button' : undefined}
                  tabIndex={canEditProfile ? 0 : undefined}
                  aria-label={canEditProfile ? '头像区域，点击更换头像' : undefined}
                  className={`relative h-20 w-20 overflow-hidden rounded-full border-4 border-white bg-forest-bg shadow-[0_12px_28px_rgba(44,54,44,0.14)] transition-all duration-300 sm:h-24 sm:w-24 ${canEditProfile ? 'cursor-pointer hover:scale-[1.03]' : ''}`}
                >
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="阁主头像" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <DefaultTarotAvatar />
                  )}

                  {canEditProfile && (
                    <div className="absolute inset-0 hidden items-center justify-center bg-forest-ink/35 opacity-0 transition-opacity duration-300 hover:opacity-100 sm:flex">
                      <Camera className="text-white" size={24} />
                    </div>
                  )}

                  {isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
                      <div className="h-7 w-7 animate-spin rounded-full border-3 border-forest-accent border-t-transparent" />
                    </div>
                  )}
                </div>

                {canEditProfile && (
                  <button
                    type="button"
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-forest-accent text-white shadow-lg transition-transform active:scale-95"
                    aria-label="更换头像"
                  >
                    <Camera size={15} />
                  </button>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <span className="inline-flex min-h-[28px] items-center rounded-full bg-forest-accent/10 px-3 text-xs font-bold text-forest-accent">
                  {rank}
                </span>
                {isEditingName && canEditProfile ? (
                  <input
                    autoFocus
                    className="w-full max-w-sm rounded-2xl border border-forest-accent/20 bg-white px-3 py-2 font-serif text-2xl font-bold text-forest-ink outline-none focus:ring-4 focus:ring-forest-accent/10"
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
                ) : (
                  <div className="group flex min-w-0 items-center gap-2">
                    <h2 className="truncate font-serif text-2xl font-bold tracking-tight text-forest-ink sm:text-3xl">
                      {displayName}
                    </h2>
                    {canEditProfile && (
                      <button
                        onClick={() => setIsEditingName(true)}
                        aria-label="编辑昵称"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-forest-muted transition-all hover:bg-forest-accent/10 hover:text-forest-accent"
                      >
                        <Edit3 size={17} />
                      </button>
                    )}
                  </div>
                )}

                <div className="group relative max-w-2xl">
                  {isEditingBio && canEditProfile ? (
                    <textarea
                      className="h-20 w-full resize-none rounded-2xl border border-forest-accent/15 bg-white px-4 py-3 text-sm leading-relaxed text-forest-muted outline-none focus:ring-4 focus:ring-forest-accent/10"
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
                    <div className="flex items-start gap-2">
                      <p className="line-clamp-2 text-sm leading-relaxed text-forest-muted">
                        {displayBio}
                      </p>
                      {canEditProfile && (
                        <button
                          onClick={() => setIsEditingBio(true)}
                          aria-label="编辑签名"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-forest-muted transition-all hover:bg-forest-accent/10 hover:text-forest-accent"
                        >
                          <Edit3 size={15} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {canEditProfile && (
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                className="hidden"
              />
            )}

            <div className="grid gap-2 sm:grid-cols-2 lg:w-64 lg:grid-cols-1">
              {canEditProfile && (
                <div className="flex min-h-[44px] items-center justify-between gap-3 rounded-2xl border border-forest-border bg-white/75 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-forest-muted/70">阁主编号</p>
                    <code className="block truncate font-mono text-sm font-bold tracking-wide text-forest-accent">
                      {tarotId}
                    </code>
                  </div>
                  <button
                    onClick={handleCopyId}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-forest-muted transition-colors hover:bg-forest-accent/10 hover:text-forest-accent"
                    title="复制编号"
                    aria-label="复制阁主编号"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="flex min-h-[44px] items-center gap-2 rounded-2xl border border-forest-border/60 bg-forest-bg/45 px-3 py-2 text-xs font-bold text-forest-muted">
                  <Calendar size={15} className="shrink-0 text-forest-accent" />
                  <span className="truncate">{formatDate()}</span>
                </div>
                <div className="flex min-h-[44px] items-center gap-2 rounded-2xl border border-forest-border/60 bg-forest-bg/45 px-3 py-2 text-xs font-bold text-forest-muted">
                  <BookOpen size={15} className="shrink-0 text-forest-accent" />
                  <span>{authorReadings.length} 条手记</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setIsGuideOpen(true)}
                  className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-forest-border/70 bg-white/70 px-3 py-2 text-sm font-bold text-forest-accent transition-all hover:bg-forest-accent/10"
                >
                  <HelpCircle size={16} />
                  功能介绍
                </button>

                {onLogout && canEditProfile && (
                  <button
                    onClick={onLogout}
                    className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-forest-accent/10 px-3 py-2 text-sm font-bold text-forest-accent transition-all hover:bg-forest-accent/20"
                  >
                    <LogOut size={16} />
                    封印离阁
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <FeatureGuide isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

      {notice && (
        <div className="fixed bottom-24 left-1/2 z-[520] -translate-x-1/2 bg-forest-ink text-white px-6 py-3 rounded-full text-sm font-bold shadow-2xl">
          {notice}
        </div>
      )}

      {/* 数据概览 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="group relative overflow-hidden rounded-2xl border border-forest-border bg-white/85 p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
            <div className="absolute right-3 top-3 h-8 w-8 rounded-full bg-forest-accent/8 transition-transform duration-300 group-hover:scale-125" />
            <p className="relative mb-1 font-serif text-2xl font-bold text-forest-accent sm:text-3xl">{stat.value}</p>
            <p className="relative text-xs font-bold text-forest-ink">{stat.label}</p>
            <p className="relative mt-1 text-[11px] text-forest-muted">{stat.hint}</p>
          </div>
        ))}
      </div>

      {/* 底部功能组合入口 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        {/* 典籍快照 */}
        <section className="rounded-[2rem] border border-forest-border bg-white/88 p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 font-serif text-xl font-bold text-forest-ink">
              <BookOpen size={22} className="text-forest-accent" />
              最近研习
            </h3>
            {authorReadings.length > 0 && (
              <button
                onClick={onViewAll}
                className="min-h-[40px] rounded-full bg-forest-accent/10 px-4 text-sm font-bold text-forest-accent transition-colors hover:bg-forest-accent/15"
              >
                查看全部
              </button>
            )}
          </div>

          <div className="relative min-h-[168px] overflow-hidden rounded-3xl border border-forest-border/70 bg-forest-bg/35 p-4 transition-all duration-300 hover:bg-forest-bg/45 sm:p-5">
            <div className="pointer-events-none absolute -right-5 -top-8 opacity-[0.05]">
              <BookOpen size={140} />
            </div>

            {latestReading ? (
              <div className="relative z-10 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-forest-border/50 bg-white/70 px-3 py-1.5 text-[11px] font-bold text-forest-muted">
                    {new Date(latestReading.date).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                  {latestReading.isAiProcessed && (
                    <span className="flex items-center gap-1.5 rounded-full bg-forest-accent/10 px-3 py-1.5 text-[11px] font-bold text-forest-accent">
                      <Sparkles size={14} className="animate-pulse" /> 灵见已存
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  <p className="line-clamp-2 font-serif text-2xl font-bold leading-tight text-forest-ink">
                    {latestReading.question || '未命名的研习'}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {latestReading.cards.slice(0, 3).map((card, i) => (
                      <span key={i} className="rounded-xl border border-forest-border/40 bg-white/80 px-3 py-1.5 text-xs text-forest-muted">
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
              <div className="flex min-h-[132px] items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-forest-border bg-white/70">
                  <Sparkles size={26} className="text-forest-muted/25" />
                </div>
                <div className="space-y-1">
                  <p className="font-serif text-xl font-bold text-forest-ink">还没有手记</p>
                  <p className="text-sm text-forest-muted">执印入阁，留下你的第一篇研习。</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 阁中成就（占位） */}
        <section className="rounded-[2rem] border border-forest-border bg-white/88 p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 font-serif text-xl font-bold text-forest-ink">
              <Award size={22} className="text-forest-accent" />
              研习成就
            </h3>
          </div>
          <div className="space-y-3 rounded-3xl border border-forest-border/70 bg-forest-bg/35 p-4">
            <div className="flex items-center gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex h-14 flex-1 items-center justify-center rounded-2xl border border-dashed border-forest-border bg-white/55">
                  <Award size={18} className="text-forest-muted/25" />
                </div>
              ))}
            </div>
            <div className="rounded-2xl bg-white/65 px-4 py-3">
              <p className="text-sm font-bold text-forest-ink">成就系统筹备中</p>
              <p className="mt-1 text-xs leading-relaxed text-forest-muted">
                未来会根据手记、复盘和注疏积累点亮成就。
              </p>
            </div>
          </div>
        </section>
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
