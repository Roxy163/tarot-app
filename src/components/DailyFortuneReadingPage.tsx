import { DailyFortune } from '../types';
import { getDailyReflectionParts } from '../lib/dailyFortuneReflection';
import { DailyReflectionCard } from './DailyReflectionCard';
import { PageView } from './PageView';

interface DailyFortuneReadingPageProps {
  fortune: DailyFortune;
  isOpen: boolean;
  onBack: () => void;
}

export function DailyFortuneReadingPage({ fortune, isOpen, onBack }: DailyFortuneReadingPageProps) {
  const parts = getDailyReflectionParts(fortune);
  const source = fortune.source === 'physical-draw' ? '实体抽牌' : '应用抽牌';
  const blocks = [
    { label: '第一直觉', value: parts.initialImpression, empty: '还没有写第一眼感受。' },
    { label: '今日回看', value: parts.dailyReview, empty: '还没有记录今天的回看。' },
  ];

  return (
    <PageView isOpen={isOpen} onBack={onBack} title={`${fortune.date} 日运记录`}>
      <div className="space-y-4 font-sans">
        <DailyReflectionCard fortune={fortune} description={`${fortune.date} · ${source}`} />
        {fortune.savedToCardAnnotationAt && (
          <p className="text-xs text-forest-accent">已归入牌义注疏 · 日运例证</p>
        )}
        {fortune.interpretation && (
          <section className="rounded-2xl border border-forest-accent/8 bg-white/38 p-4">
            <h2 className="font-serif font-bold text-forest-ink">牌面提示</h2>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-forest-muted">{fortune.interpretation}</p>
          </section>
        )}
        {blocks.map(block => (
          <section key={block.label} className="rounded-2xl border border-forest-accent/8 bg-white/38 p-4">
            <h2 className="font-serif font-bold text-forest-ink">{block.label}</h2>
            <p className={`mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed ${block.value ? 'text-forest-ink' : 'text-forest-muted'}`}>
              {block.value || block.empty}
            </p>
          </section>
        ))}
      </div>
    </PageView>
  );
}
