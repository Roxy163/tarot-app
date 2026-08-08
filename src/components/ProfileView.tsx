import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle,
  Edit3,
  Home,
  LogIn,
  LogOut,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { TarotReading, TarotCardMetadata, UserProfile } from '../types';
import { MysticWatermark } from './MysticWatermark';
import { AutoResizeTextarea } from './ui/AutoResizeTextarea';

interface ProfileViewProps {
  authorName: string;
  readings: TarotReading[];
  cardMetadata: TarotCardMetadata[];
  onUpdateProfile: (updated: Partial<UserProfile>) => Promise<void>;
  profile: UserProfile | null;
  email?: string | null;
  isLoggedIn?: boolean;
  isEmailVerified?: boolean;
  onLogin?: () => void;
  onLogout?: () => void;
  onOpenSecurity?: () => void;
  onBackHome?: () => void;
}

const AccountStat = ({ label, value }: { label: string; value: number | string }) => (
  <div className="rounded-2xl border border-forest-accent/7 bg-white/34 px-3 py-3 text-center">
    <p className="font-serif text-xl font-semibold text-forest-accent">{value}</p>
    <p className="mt-0.5 text-[10px] font-medium text-forest-muted">{label}</p>
  </div>
);

export function ProfileView({
  authorName,
  readings,
  cardMetadata,
  onUpdateProfile,
  profile,
  email,
  isLoggedIn = !!profile,
  isEmailVerified = false,
  onLogin,
  onLogout,
  onOpenSecurity,
  onBackHome,
}: ProfileViewProps) {
  const [displayName, setDisplayName] = useState(profile?.display_name || profile?.nickname || authorName || '研习阁主');
  const [bio, setBio] = useState(profile?.bio || profile?.signature || '观牌，也观心');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name || profile?.nickname || authorName || '研习阁主');
  }, [authorName, profile?.display_name, profile?.nickname]);

  useEffect(() => {
    setBio(profile?.bio || profile?.signature || '观牌，也观心');
  }, [profile?.bio, profile?.signature]);

  const realReadings = useMemo(() => readings.filter(reading => !reading.isExample), [readings]);
  const reviewedCount = useMemo(
    () => realReadings.filter(reading => Boolean(reading.userFeedback?.trim())).length,
    [realReadings],
  );
  const cardAnnotationCount = useMemo(
    () => cardMetadata.filter(item => item.meaning || item.reversedMeaning || item.keywords?.length).length,
    [cardMetadata],
  );
  const accountEmail = email || '尚未登录';

  const saveProfile = async () => {
    if (!profile || isSaving) return;

    const nextName = displayName.trim() || '研习阁主';
    const nextBio = bio.trim() || '观牌，也观心';
    const previousName = profile.display_name || profile.nickname || authorName || '研习阁主';
    const previousBio = profile.bio || profile.signature || '观牌，也观心';

    if (nextName === previousName && nextBio === previousBio) return;

    setIsSaving(true);
    try {
      await onUpdateProfile({ display_name: nextName, bio: nextBio });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 pb-24" data-testid="account-settings-page">
        <section className="relative overflow-hidden rounded-[1.6rem] border border-forest-accent/7 bg-white/46 p-5 shadow-[0_16px_52px_-46px_rgba(62,58,54,0.48)] backdrop-blur-sm">
          <MysticWatermark variant="star" className="-right-8 -top-10 h-40 w-40 text-forest-accent opacity-[0.035]" />
          <div className="relative flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-forest-accent/10 text-forest-accent">
              <UserRound size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-forest-muted">账号</p>
              <h2 className="mt-1 font-serif text-2xl font-bold text-forest-ink">登录与同步</h2>
              <p className="mt-2 text-sm leading-relaxed text-forest-muted">
                当前是访客模式。登录后，手记、日运和牌义注疏会同步到云端。
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={onLogin}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-forest-accent px-4 text-sm font-medium text-white transition-all hover:bg-forest-accent/92 active:scale-[0.98]"
            >
              <LogIn size={17} />
              登录并开启同步
            </button>
            <button
              type="button"
              onClick={onBackHome}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-forest-accent/8 bg-white/42 px-4 text-sm font-medium text-forest-accent transition-all hover:bg-white/70 active:scale-[0.98]"
            >
              <Home size={17} />
              先回研习台
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24" data-testid="account-settings-page">
      <section className="relative overflow-hidden rounded-[1.6rem] border border-forest-accent/7 bg-white/46 p-5 shadow-[0_16px_52px_-46px_rgba(62,58,54,0.48)] backdrop-blur-sm" data-testid="account-profile-card">
        <MysticWatermark variant="quill" className="-right-7 -top-9 h-40 w-40 text-forest-accent opacity-[0.035]" />
        <div className="relative flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-forest-accent/10 text-forest-accent">
            <UserRound size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-forest-muted">账号设置</p>
            <h2 className="mt-1 font-serif text-2xl font-bold text-forest-ink">管理登录与名称</h2>
            <p className="mt-2 text-sm leading-relaxed text-forest-muted">
              这里仅保留账号必需功能。研习记录与复盘入口仍在典籍里。
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          <label className="space-y-1.5">
            <span className="flex items-center gap-1.5 text-xs font-medium text-forest-muted">
              <Edit3 size={14} />
              显示名称
            </span>
            <input
              value={displayName}
              onChange={event => setDisplayName(event.target.value)}
              className="min-h-12 w-full rounded-2xl border border-forest-accent/8 bg-white/58 px-4 text-sm font-semibold text-forest-ink outline-none transition-all focus:ring-4 focus:ring-forest-accent/10"
              placeholder="给自己起一个好记的名字"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-medium text-forest-muted">一句介绍</span>
            <AutoResizeTextarea
              minRows={1.5}
              maxRows={4}
              value={bio}
              onChange={event => setBio(event.target.value)}
              className="w-full rounded-2xl border border-forest-accent/10 bg-white/62 px-4 py-2.5 text-sm leading-relaxed text-forest-ink outline-none transition-all focus:ring-4 focus:ring-forest-accent/10"
              placeholder="例如：观牌，也观心"
            />
          </label>

          <button
            type="button"
            onClick={() => void saveProfile()}
            disabled={!profile || isSaving}
            className="min-h-12 rounded-2xl bg-forest-accent px-4 text-sm font-medium text-white transition-all hover:bg-forest-accent/92 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? '保存中…' : '保存账号资料'}
          </button>
        </div>
      </section>

      <section className="rounded-[1.6rem] border border-forest-accent/7 bg-white/36 p-4 shadow-none">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-forest-muted">同步概况</p>
            <h3 className="mt-1 font-serif text-xl font-bold text-forest-ink">云端数据</h3>
          </div>
          <BookOpen size={20} className="text-forest-accent" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <AccountStat label="手记" value={realReadings.length} />
          <AccountStat label="已复盘" value={reviewedCount} />
          <AccountStat label="牌义注疏" value={cardAnnotationCount} />
        </div>
      </section>

      <section className="rounded-[1.6rem] border border-forest-accent/7 bg-white/36 p-4 shadow-none">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-forest-muted">账号安全</p>
            <h3 className="mt-1 font-serif text-xl font-bold text-forest-ink">登录信息</h3>
          </div>
          {isEmailVerified ? (
            <CheckCircle size={20} className="text-forest-accent" />
          ) : (
            <ShieldCheck size={20} className="text-forest-accent" />
          )}
        </div>

        <div className="space-y-2">
          <div className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-forest-accent/8 bg-white/42 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <Mail size={16} className="shrink-0 text-forest-accent" />
              <span className="truncate text-sm font-semibold text-forest-ink">{accountEmail}</span>
            </div>
            <span className="shrink-0 rounded-full bg-forest-accent/8 px-2.5 py-1 text-[10px] font-medium text-forest-accent">
              {isEmailVerified ? '已验证' : '待验证'}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenSecurity}
            className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-forest-accent/8 bg-white/42 px-4 text-sm font-medium text-forest-accent transition-all hover:bg-white/68 active:scale-[0.98]"
          >
            邮箱与密码管理
            <ArrowRight size={16} />
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white/38 px-4 text-sm font-medium text-forest-muted transition-all hover:bg-white/62 hover:text-forest-accent active:scale-[0.98]"
            >
              <LogOut size={16} />
              退出登录
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
