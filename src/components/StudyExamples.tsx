import { useState } from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';
import { TAROT_CARDS, getCardImageUrl } from '../constants';
import { PageView } from './PageView';
import { TarotCardImage } from './TarotCardImage';
import { trackEvent } from '../lib/analytics';

const examples = [
  {
    id: 'quiet-study', cardName: '隐士', title: '今天怎样安排学习？',
    impression: '先看到提灯和独自站立的人，想到安静、慢一点，以及找自己的节奏。',
    interpretation: '把隐士放在“今天的学习状态”这个问题里，我想试试少看外界进度，留一段独立思考的时间。这是一个行动方向，不是对今天结果的保证。',
    review: '上午反复看别人的笔记，越看越乱。下午关掉群聊，自己整理一道题，终于找到了卡住的地方。并不是整天独处，而是需要一小段不被打断的时间。',
    note: '把“独处”具体写成“暂时减少外界输入”，下次遇见隐士时，可以比较这个理解是否还适用。',
  },
  {
    id: 'too-many-options', cardName: '圣杯七', title: '最近选课程总是拿不定主意。',
    impression: '杯子里放着不同的东西，第一反应是每个都想要，却说不清真正需要什么。',
    interpretation: '我可能在比较想象中的收益，还没确定自己的目标。今天先写下最想解决的一个问题，再看哪门课真的对应它。',
    review: '列出目标后发现，三门课里只有一门能解决眼前的问题。我还没有报名，先看了一节试听课。“做选择”也可以是缩小范围，而不是立刻下单。',
    note: '这次的圣杯七更接近“选择标准不清楚”。保留这个场景，不把它固定成每次都表示幻想。',
  },
  {
    id: 'working-together', cardName: '星币三', title: '这次合作要注意什么？',
    impression: '几个人围着同一件事交流，想到分工、讨论，以及把东西做出来。',
    interpretation: '我先把它理解为需要说清各自负责的部分，不能只默认大家已经达成一致。',
    review: '碰头时才发现，我们对“完成”的标准不同。一起看了一版草稿后，分歧变得具体，也更容易调整。有效的不只是分工，还有共同查看实际成果。',
    note: '在“合作”之外补上“用具体成果对齐理解”，并在之后的合作记录里继续观察。',
  },
];

export function StudyExamples() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = examples.find(item => item.id === selectedId);
  const picture = (name: string, large = false) => {
    const card = TAROT_CARDS.find(item => item.name === name);
    return <TarotCardImage src={getCardImageUrl(card?.id || 'ar00')} name={name} alt={`${name} · 正位`} className={`${large ? 'h-32 w-[5.5rem]' : 'h-16 w-11'} rounded-lg object-contain`} />;
  };

  return <>
    <button type="button" onClick={() => { setIsOpen(true); trackEvent('study_examples_opened', { source: 'square' }); }} className="inline-flex min-h-11 items-center gap-2 px-1 text-xs text-forest-accent hover:underline"><BookOpen size={15} />示范案例<ChevronRight size={14} /></button>
    <PageView isOpen={isOpen} onBack={() => setIsOpen(false)} title="示范案例">
      <p className="mb-4 text-xs leading-relaxed text-forest-muted">以下为虚构情境，展示从第一直觉到回看的完整记录，不是真实用户的经历或反馈。</p>
      <div className="divide-y divide-forest-accent/10">
        {examples.map(item => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className="flex min-h-24 w-full items-center gap-3 py-4 text-left transition-colors hover:bg-forest-accent/4">
          {picture(item.cardName)}
          <span className="min-w-0 flex-1"><span className="block font-serif text-base font-bold text-forest-ink">{item.title}</span><span className="mt-1 block text-xs text-forest-muted">{item.cardName} · 正位 · 含回看示例</span></span>
          <ChevronRight size={16} className="shrink-0 text-forest-accent" />
        </button>)}
      </div>
      <PageView isOpen={Boolean(selected)} onBack={() => setSelectedId(null)} title={selected ? `${selected.cardName} · 记录示范` : '记录示范'}>
        {selected && <>
          <div className="flex items-center gap-4 border-b border-forest-accent/10 pb-5">
            {picture(selected.cardName, true)}
            <div className="min-w-0"><p className="text-xs text-forest-accent">虚构情境 · 单牌正位</p><h2 className="mt-2 font-serif text-xl font-bold text-forest-ink">{selected.title}</h2></div>
          </div>
          {[
            ['第一直觉', selected.impression], ['当时的解读', selected.interpretation], ['回看示例（虚构）', selected.review], ['留下的牌义笔记', selected.note],
          ].map(([title, body]) => <section key={title} className="border-b border-forest-accent/8 py-5 last:border-0"><h3 className="font-serif text-base font-bold text-forest-ink">{title}</h3><p className="mt-2 text-sm leading-loose text-forest-muted">{body}</p></section>)}
        </>}
      </PageView>
    </PageView>
  </>;
}
