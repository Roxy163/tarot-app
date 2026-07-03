import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { BookOpen, ChevronRight, Moon, PenLine, Settings, Sparkles, Sun, X } from 'lucide-react';
import { getCardImageUrl } from '../../constants';
import { useOnboarding } from '../../context/OnboardingContext';
import { FIRST_ENTRY_STEPS } from './guideContent';

type GuidePreviewKind = 'overview' | 'home' | 'reading' | 'workspace' | 'library';

const PreviewShell: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <div className="relative w-full max-w-[460px] mx-auto">
    <div className="relative overflow-hidden rounded-2xl border border-forest-accent/10 bg-white/90 shadow-2xl shadow-forest-accent/10">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -right-12 -top-16 h-36 w-36 rounded-full border border-forest-accent/10" />
        <div className="absolute -right-6 -top-10 h-24 w-24 rounded-full border border-forest-pink/10" />
        <div className="absolute bottom-8 left-8 h-1.5 w-1.5 rounded-full bg-forest-accent/25" />
        <div className="absolute bottom-16 left-20 h-1 w-1 rounded-full bg-forest-pink/25" />
        <div className="absolute bottom-12 left-32 h-1.5 w-1.5 rounded-full bg-forest-accent/20" />
        <svg className="absolute bottom-10 left-9 h-12 w-28 text-forest-accent/15" viewBox="0 0 112 48" aria-hidden="true">
          <path d="M6 32 L34 16 L68 26 L104 8" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 5" />
          <circle cx="6" cy="32" r="2" fill="currentColor" />
          <circle cx="34" cy="16" r="2" fill="currentColor" />
          <circle cx="68" cy="26" r="2" fill="currentColor" />
          <circle cx="104" cy="8" r="2" fill="currentColor" />
        </svg>
      </div>
      <div className="relative flex h-9 items-center gap-2 border-b border-forest-accent/10 bg-forest-bg/70 px-4">
        <span className="h-2.5 w-2.5 rounded-full bg-forest-pink/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-forest-accent/35" />
        <span className="h-2.5 w-2.5 rounded-full bg-forest-accent/55" />
        <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.2em] text-forest-muted">{label}</span>
      </div>
      <div className="relative p-4 sm:p-5">{children}</div>
    </div>
  </div>
);

const MiniCard: React.FC<{
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
}> = ({ title, subtitle, icon }) => (
  <div className="rounded-lg border border-forest-accent/10 bg-forest-bg/60 p-3">
    <div className="flex items-center gap-2">
      {icon && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-forest-accent">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-bold text-forest-ink">{title}</p>
        <p className="truncate text-[10px] text-forest-muted">{subtitle}</p>
      </div>
    </div>
  </div>
);

const CardBackPreview = ({ className = '' }: { className?: string }) => (
  <div
    data-testid="guide-card-back"
    role="img"
    aria-label="未揭晓的塔罗牌"
    className={`relative aspect-[2/3] rounded-lg border border-forest-accent/25 bg-gradient-to-br from-white via-forest-bg/80 to-forest-pink/20 shadow-lg shadow-forest-accent/10 ${className}`}
  >
    <div className="absolute -inset-1.5 rounded-xl bg-gradient-to-br from-forest-accent/18 via-white/0 to-amber-200/25 blur-md" />
    <div className="absolute inset-0 rounded-lg border border-white/80" />
    <div className="absolute inset-1 rounded-md border border-forest-accent/20" />
    <div className="absolute inset-2 rounded-[0.35rem] border border-dashed border-forest-accent/18" />

    <div className="absolute left-1.5 top-1.5 h-1 w-1 rounded-full bg-forest-accent/40" />
    <div className="absolute right-1.5 top-1.5 h-1 w-1 rounded-full bg-forest-accent/40" />
    <div className="absolute bottom-1.5 left-1.5 h-1 w-1 rounded-full bg-forest-accent/40" />
    <div className="absolute bottom-1.5 right-1.5 h-1 w-1 rounded-full bg-forest-accent/40" />

    <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1">
      <span className="h-1 w-1 rounded-full bg-forest-accent/25" />
      <span className="h-1.5 w-1.5 rounded-full bg-forest-accent/40" />
      <span className="h-2 w-2 rounded-full border border-forest-accent/40 bg-white/50" />
      <span className="h-1.5 w-1.5 rounded-full bg-forest-accent/40" />
      <span className="h-1 w-1 rounded-full bg-forest-accent/25" />
    </div>

    <svg className="absolute inset-x-0 top-1/2 mx-auto h-12 w-12 -translate-y-1/2 text-forest-accent/55" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M20 47c-4-6-4-17 0-23" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M44 47c4-6 4-17 0-23" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 15l2.9 8.1 8.1 2.9-8.1 2.9L32 37l-2.9-8.1L21 26l8.1-2.9L32 15z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M40 14a8 8 0 1 1-7.2 11.5 9 9 0 0 0 10.7-10.7A7.9 7.9 0 0 1 40 14z" fill="currentColor" opacity="0.18" />
      <circle cx="18" cy="18" r="1.5" fill="currentColor" opacity="0.5" />
      <circle cx="47" cy="44" r="1.5" fill="currentColor" opacity="0.45" />
    </svg>

    <div className="absolute bottom-3 left-1/2 h-px w-8 -translate-x-1/2 bg-gradient-to-r from-transparent via-forest-accent/35 to-transparent" />
  </div>
);

const TarotFacePreview: React.FC<{
  cardId: string;
  name: string;
  english: string;
  className?: string;
}> = ({ cardId, name, english, className = '' }) => {
  const [hasImageError, setHasImageError] = useState(false);

  if (hasImageError) {
    return <CardBackPreview className={className} />;
  }

  return (
    <div className={`relative aspect-[2/3] ${className}`}>
      <div className="absolute -inset-2 rounded-xl bg-gradient-to-br from-forest-accent/20 via-white/0 to-forest-pink/20 blur-md" />
      <img
        src={getCardImageUrl(cardId)}
        alt={`${name} ${english}`}
        className="relative h-full w-full rounded-lg border border-forest-accent/20 bg-forest-bg object-contain shadow-lg shadow-forest-accent/10"
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setHasImageError(true)}
      />
    </div>
  );
};

const OverviewPreview = () => (
  <PreviewShell label="Guide Map">
    <div className="grid gap-4 sm:grid-cols-[0.9fr_1.1fr] sm:items-center">
      <div className="mx-auto w-full max-w-[180px] rounded-2xl border border-forest-accent/10 bg-forest-bg p-3 shadow-inner">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-forest-accent">Daily</p>
            <p className="text-xs font-serif font-bold text-forest-ink">今日手记</p>
          </div>
          <Sun size={18} className="text-forest-accent" />
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <CardBackPreview className="-rotate-3" />
          <CardBackPreview className="translate-y-3 shadow-xl shadow-forest-accent/15" />
          <CardBackPreview className="rotate-3" />
        </div>
        <div className="mt-5 h-2 rounded-full bg-white" />
        <div className="mt-2 h-2 w-2/3 rounded-full bg-white" />
      </div>
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-forest-accent">导览路线</p>
        {[
          ['每日抽牌', '从一个问题开始'],
          ['抽牌手记', '写下直觉和复盘'],
          ['自由牌阵', '保存自己的结构'],
          ['个人典籍', '沉淀长期理解'],
        ].map(([title, subtitle], index) => (
          <div key={title} className="flex items-center gap-3 rounded-lg border border-forest-accent/10 bg-white/70 p-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest-accent/10 text-[10px] font-bold text-forest-accent">
              {index + 1}
            </span>
            <div>
              <p className="text-xs font-bold text-forest-ink">{title}</p>
              <p className="text-[10px] text-forest-muted">{subtitle}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </PreviewShell>
);

const HomePreview = () => (
  <PreviewShell label="Home">
    <div className="space-y-3">
      <div className="rounded-xl border border-forest-accent/10 bg-gradient-to-br from-forest-accent/10 to-forest-pink/10 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-forest-accent">Daily Reading</p>
            <p className="text-xs font-bold text-forest-muted">日运练习</p>
            <p className="text-base font-serif font-bold text-forest-ink">开启今日手记</p>
          </div>
          <Sparkles size={22} className="text-forest-accent" />
        </div>
        <div className="grid grid-cols-[72px_1fr] gap-3">
          <CardBackPreview className="shadow-xl shadow-forest-accent/15" />
          <div className="space-y-2">
            <div className="h-2.5 rounded-full bg-white" />
            <div className="h-2.5 w-4/5 rounded-full bg-white" />
            <div className="mt-4 rounded-lg bg-white/70 px-3 py-2 text-[10px] font-bold text-forest-accent">开始洗牌</div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MiniCard title="本周手记" subtitle="0 条" icon={<PenLine size={14} />} />
        <MiniCard title="连续记录" subtitle="0 天" icon={<Sun size={14} />} />
        <MiniCard title="牌意小考" subtitle="练习牌义" icon={<BookOpen size={14} />} />
      </div>
    </div>
  </PreviewShell>
);

const ReadingPreview = () => (
  <PreviewShell label="Reading">
    <div className="space-y-3">
      <div className="rounded-lg border border-forest-accent/10 bg-forest-bg/60 p-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-forest-muted">这次想问什么？</p>
        <div className="rounded-lg bg-white px-3 py-2 text-xs text-forest-ink">我现在最需要看清的一件事是什么？</div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: '过去', id: 'ar02', name: '女祭司', english: 'The High Priestess' },
          { label: '现在', id: 'ar09', name: '隐士', english: 'The Hermit' },
          { label: '建议', id: 'pepa', name: '星币侍从', english: 'Page of Pentacles' },
        ].map((card, index) => (
          <div key={card.id} className="rounded-lg border border-forest-accent/10 bg-white p-2 text-center">
            <TarotFacePreview cardId={card.id} name={card.name} english={card.english} className="mx-auto w-12" />
            <p className="mt-2 text-[10px] font-bold text-forest-ink">{index + 1}. {card.label}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-forest-accent/10 bg-forest-bg/60 p-3">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold text-forest-accent">
          <PenLine size={13} />
          直觉与复盘
        </div>
        <div className="space-y-1.5">
          <div className="h-2 rounded-full bg-white" />
          <div className="h-2 w-5/6 rounded-full bg-white" />
        </div>
      </div>
    </div>
  </PreviewShell>
);

const WorkspacePreview = () => (
  <PreviewShell label="Canvas">
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border border-forest-accent/10 bg-forest-bg/60 px-3 py-2">
        <div className="flex items-center gap-2 text-[10px] font-bold text-forest-ink">
          <Settings size={14} className="text-forest-accent" />
          个人牌阵
        </div>
        <div className="rounded-full bg-white px-2 py-1 text-[9px] font-bold text-forest-accent">自由画布</div>
      </div>
      <div className="relative h-52 overflow-hidden rounded-xl border border-dashed border-forest-accent/20 bg-[linear-gradient(90deg,rgba(129,161,132,0.10)_1px,transparent_1px),linear-gradient(rgba(129,161,132,0.10)_1px,transparent_1px)] bg-[size:28px_28px]">
        {[
          ['1', '核心', 'left-[42%] top-[36%]'],
          ['2', '阻碍', 'left-[20%] top-[45%] rotate-[-8deg]'],
          ['3', '建议', 'left-[64%] top-[45%] rotate-[8deg]'],
          ['4', '结果', 'left-[42%] top-[8%]'],
        ].map(([number, label, position]) => (
          <div key={number} className={`absolute w-16 rounded-lg border border-forest-accent/20 bg-white/90 p-1.5 text-center shadow-sm ${position}`}>
            <div className="mx-auto flex aspect-[2/3] w-8 items-center justify-center rounded-md border border-forest-accent/15 bg-forest-accent/5 text-[10px] font-bold text-forest-accent">{number}</div>
            <p className="mt-1 truncate text-[9px] font-bold text-forest-ink">{label}</p>
          </div>
        ))}
        <div className="absolute bottom-3 left-3 right-3 flex justify-center gap-2">
          {['对齐', '镜像', '保存'].map(label => (
            <span key={label} className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold text-forest-accent shadow-sm">{label}</span>
          ))}
        </div>
      </div>
    </div>
  </PreviewShell>
);

const LibraryPreview = () => (
  <PreviewShell label="Archive">
    <div className="grid gap-3 sm:grid-cols-[0.85fr_1.15fr] sm:items-stretch">
      <div className="rounded-xl border border-forest-accent/10 bg-forest-bg/60 p-3 text-center">
        <TarotFacePreview cardId="pepa" name="星币侍从" english="Page of Pentacles" className="mx-auto w-16" />
        <p className="mt-3 text-sm font-serif font-bold text-forest-ink">星币侍从</p>
        <p className="text-[10px] text-forest-muted">Page of Pentacles</p>
        <div className="mt-3 rounded-full bg-white px-3 py-1 text-[10px] font-bold text-forest-accent">出现 3 次</div>
      </div>
      <div className="space-y-2">
        <MiniCard title="个人关键词" subtitle="学习、耐心、现实落地" icon={<BookOpen size={14} />} />
        <MiniCard title="最近复盘" subtitle="从问题里提炼长期模式" icon={<PenLine size={14} />} />
        <div className="rounded-lg border border-forest-accent/10 bg-white/70 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-forest-muted">我的牌义</p>
          <div className="space-y-1.5">
            <div className="h-2 rounded-full bg-forest-bg" />
            <div className="h-2 w-3/4 rounded-full bg-forest-bg" />
            <div className="h-2 w-5/6 rounded-full bg-forest-bg" />
          </div>
        </div>
      </div>
    </div>
  </PreviewShell>
);

const StepPreview = ({ kind }: { kind: GuidePreviewKind }) => {
  switch (kind) {
    case 'home':
      return <HomePreview />;
    case 'reading':
      return <ReadingPreview />;
    case 'workspace':
      return <WorkspacePreview />;
    case 'library':
      return <LibraryPreview />;
    case 'overview':
    default:
      return <OverviewPreview />;
  }
};

export const FirstEntryGuide: React.FC = () => {
  const { state, nextStep, completeFirstEntry, skipFirstEntry } = useOnboarding();
  const currentStep = FIRST_ENTRY_STEPS[state.currentStep];
  const dialogRef = useRef<HTMLDivElement>(null);
  const isLastStep = state.currentStep === FIRST_ENTRY_STEPS.length - 1;

  useEffect(() => {
    if (!currentStep) completeFirstEntry();
  }, [completeFirstEntry, currentStep]);

  const handleAction = () => {
    if (isLastStep) {
      completeFirstEntry();
    } else {
      nextStep();
    }
  };

  useEffect(() => {
    if (!currentStep) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusFirstControl = () => {
      const firstControl = dialogRef.current?.querySelector<HTMLElement>(focusableSelector);
      firstControl?.focus();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        skipFirstEntry();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector))
        .filter(element => !element.hasAttribute('disabled'));

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const focusTimer = window.setTimeout(focusFirstControl, 0);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentStep, skipFirstEntry]);

  if (!currentStep) return null;

  const StepIcon = currentStep.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] overflow-y-auto bg-forest-bg text-forest-text"
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-entry-guide-title"
        aria-describedby="first-entry-guide-description"
        initial={{ y: 16 }}
        animate={{ y: 0 }}
        exit={{ y: 16 }}
        className="relative min-h-[100dvh] w-full overflow-hidden"
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-forest-accent/0 via-forest-accent/40 to-forest-pink/0" />
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-forest-pink/0 via-forest-pink/35 to-forest-accent/0" />

        {currentStep.showSkip && (
          <button
            onClick={skipFirstEntry}
            aria-label="跳过新手导览"
            className="absolute top-4 right-4 z-10 w-11 h-11 flex items-center justify-center text-forest-muted hover:text-forest-accent transition-colors rounded-full hover:bg-white/70"
          >
            <X size={20} />
          </button>
        )}

        <div className="min-h-[100dvh] max-w-6xl mx-auto px-4 py-4 pb-32 sm:px-8 sm:py-6 sm:pb-28 flex flex-col">
          <div className="flex items-center gap-2 pr-14">
            {FIRST_ENTRY_STEPS.map((_, index) => (
              <motion.div
                key={index}
                initial={{ width: 10 }}
                animate={{ width: index === state.currentStep ? 44 : 10 }}
                transition={{ duration: 0.3 }}
                className={`h-1.5 rounded-full ${
                  index === state.currentStep ? 'bg-forest-accent' : 'bg-forest-border'
                }`}
              />
            ))}
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] items-center gap-5 sm:gap-8 py-5 sm:py-7">
            <div className="space-y-4 sm:space-y-5 text-left">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 border border-forest-accent/10 text-[10px] font-bold tracking-[0.24em] uppercase text-forest-accent"
              >
                <StepIcon size={14} />
                入阁导览
              </motion.div>

              <div className="space-y-3 sm:space-y-4">
                <motion.h2
                  id="first-entry-guide-title"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold text-forest-accent leading-tight"
                >
                  {currentStep.title}
                </motion.h2>
                <motion.p
                  id="first-entry-guide-description"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-lg sm:text-xl text-forest-ink font-serif font-bold"
                >
                  {currentStep.subtitle}
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="max-w-2xl text-sm sm:text-base text-forest-text/80 leading-7 font-serif"
                >
                  {currentStep.content}
                </motion.p>
              </div>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-[11px] sm:text-xs text-forest-muted leading-relaxed"
              >
                只需点击下一步，就能依次看完核心功能；之后可在个人页的功能介绍中回看。
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25, type: 'spring' }}
              className="relative flex items-center justify-center"
            >
              <StepPreview kind={currentStep.preview as GuidePreviewKind} />
            </motion.div>
          </div>

          <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-forest-bg via-forest-bg/95 to-transparent px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-4 sm:px-8">
            <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-forest-muted sm:w-40">
                第 {state.currentStep + 1} / {FIRST_ENTRY_STEPS.length} 步
              </div>
              <motion.button
                data-testid="first-entry-primary-action"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                onClick={handleAction}
                className="w-full min-h-12 px-8 py-3 bg-forest-pink text-white rounded-xl font-bold text-base hover:bg-forest-pink/90 transition-all shadow-xl shadow-forest-pink/25 flex items-center justify-center gap-2 sm:flex-1"
              >
                <span>{currentStep.action}</span>
                {!isLastStep && <ChevronRight size={20} />}
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
