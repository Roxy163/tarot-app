import { useEffect, useRef, useState } from 'react';
import { BookOpen, Check, ChevronDown, LayoutGrid, PencilLine, Save } from 'lucide-react';
import type { TarotReading } from '../types';
import { TAROT_CARDS, getCardImageUrl } from '../constants';
import { formatReadingDateTime } from '../lib/dateFormat';
import { isReadingIncomplete } from '../lib/readingCompletion';
import { getReadingOverview } from '../lib/readingThoughts';
import { readLocalDraft, useLocalDraft } from '../hooks/useLocalDraft';
import { PageView } from './PageView';
import { AutoResizeTextarea } from './ui/AutoResizeTextarea';
import { FoldableSection } from './FoldableSection';
import { TarotCardImage } from './TarotCardImage';
import { ConfirmDialog } from './ConfirmDialog';
import { ReadingReviewSpread } from './ReadingReviewSpread';

interface ReadingReviewPageProps {
  reading: TarotReading;
  ownerScope?: string;
  onClose: () => void;
  onEdit?: (reading: TarotReading) => void;
  onSaveFeedback?: (id: string, text: string) => boolean | Promise<boolean>;
}

export function ReadingReviewPage({ reading, ownerScope = 'guest', onClose, onEdit, onSaveFeedback }: ReadingReviewPageProps) {
  const draftKey = `tarot_reading_review_draft_${ownerScope}_${reading.id}`;
  const [restoredDraft] = useState(() => {
    const saved = readLocalDraft<{ text?: unknown }>(draftKey);
    return typeof saved?.text === 'string' ? { text: saved.text } : null;
  });
  const [savedFeedback, setSavedFeedback] = useState(reading.userFeedback || '');
  const [text, setText] = useState(restoredDraft?.text ?? reading.userFeedback ?? '');
  const [isEditing, setIsEditing] = useState(Boolean(restoredDraft));
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [leaveAction, setLeaveAction] = useState<'close' | 'edit' | null>(null);
  const [showCards, setShowCards] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [showAllThoughts, setShowAllThoughts] = useState(false);
  const [discardChanges, setDiscardChanges] = useState(false);
  const spreadRef = useRef<HTMLElement>(null);
  const thoughtsRef = useRef<HTMLElement>(null);
  const feedbackRef = useRef<HTMLElement>(null);
  const active = useRef(true);
  const saving = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { setSavedFeedback(reading.userFeedback || ''); }, [reading.userFeedback]);
  const hasChanges = text.trim() !== savedFeedback.trim();
  const draft = useLocalDraft(draftKey, { text }, isEditing);
  const jumpTo = (element: HTMLElement | null) => element?.scrollIntoView?.({ behavior: 'auto', block: 'start' });
  const startEditing = () => {
    if (!isEditing) { setText(savedFeedback); setIsEditing(true); setNotice(''); }
    // Only a deliberate action moves the page. Restoring a draft never scrolls.
    requestAnimationFrame(() => jumpTo(feedbackRef.current));
  };
  const cancelEditing = () => {
    draft.clear(); setText(savedFeedback); setIsEditing(false); setDiscardChanges(false); setNotice('');
  };
  const requestLeave = (action: 'close' | 'edit') => {
    if (saving.current) return;
    if (hasChanges && !draft.durable) { setLeaveAction(action); return; }
    if (!hasChanges) draft.clear();
    if (action === 'edit') onEdit?.(reading);
    else onClose();
  };
  const saveFeedback = async () => {
    if (saving.current || !onSaveFeedback || !hasChanges) return;
    saving.current = true;
    setIsSaving(true);
    setNotice('');
    const submitted = text.trim();
    try {
      const saved = await onSaveFeedback(reading.id, submitted);
      if (!active.current) return;
      if (!saved) { setNotice('本机保存失败，文字已保留，请稍后重试。'); return; }
      draft.clear();
      setSavedFeedback(submitted);
      setText(submitted);
      setIsEditing(false);
      setNotice('已保存。');
    } catch {
      if (active.current) setNotice('保存失败，文字已保留，可以重试。');
    } finally {
      saving.current = false;
      if (active.current) setIsSaving(false);
    }
  };
  const overview = getReadingOverview(reading);
  const firstNoteIndex = reading.cardInterpretations?.findIndex(value => Boolean(value?.trim())) ?? -1;
  const firstNote = firstNoteIndex >= 0 ? reading.cardInterpretations![firstNoteIndex].trim() : '';
  const influenceNotes = [
    { label: '灵数影响', value: reading.interpretation?.numerologyInfluence },
    { label: '行星星座影响', value: reading.interpretation?.astrologyInfluence },
    { label: '宫位影响', value: reading.interpretation?.houseInfluence },
    { label: '元素影响', value: reading.interpretation?.elementInfluence },
  ].filter(item => item.value?.trim());
  const otherThoughts = [reading.interpretation?.singleCard, reading.interpretation?.combination, reading.interpretation?.summary].filter((value, index, all) => value?.trim() && value.trim() !== overview && all.indexOf(value) === index);

  return <PageView isOpen onBack={() => requestLeave('close')} title="手记回看" width="wide" backDisabled={isSaving}>
    <div className="space-y-5 text-forest-ink">
      <nav aria-label="回看快捷操作" className="sticky -top-5 z-40 -mx-4 flex min-h-14 items-center gap-1 border-b border-forest-accent/8 bg-forest-bg/95 px-4 py-1 backdrop-blur-sm sm:-top-7 sm:-mx-6 sm:px-6">
        <button type="button" onClick={() => jumpTo(spreadRef.current)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs text-forest-accent hover:bg-forest-accent/5"><LayoutGrid size={15} />看牌阵</button>
        {(overview || firstNote) && <button type="button" onClick={() => jumpTo(thoughtsRef.current)} className="min-h-11 rounded-lg px-2 text-xs text-forest-muted hover:bg-forest-accent/5">当时想法</button>}
        {onSaveFeedback && <button type="button" disabled={isSaving} onClick={startEditing} className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs text-forest-accent hover:bg-forest-accent/5 disabled:opacity-50"><PencilLine size={15} />{isEditing ? '继续写复盘' : '写复盘'}</button>}
      </nav>
      <header className="space-y-2 border-b border-forest-accent/8 pb-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 break-words font-serif text-xl font-bold">{reading.question}</h2>
          {onEdit && <button type="button" aria-label="编辑手记" title="编辑手记" disabled={isSaving} onClick={() => requestLeave('edit')} className="flex h-11 w-11 shrink-0 items-center justify-center text-forest-accent disabled:opacity-50"><PencilLine size={19} /></button>}
        </div>
        <p className="text-xs text-forest-muted">{formatReadingDateTime(reading.readingDate || reading.date)} · {reading.spread} · {reading.cards.length}张牌</p>
        {reading.isForClient && <p className="text-xs text-forest-muted">客户：{reading.clientName?.trim() || '未命名客户'}</p>}
        {isReadingIncomplete(reading) && <p className="text-xs text-forest-muted">牌面 {reading.cards.filter(card => card.name?.trim()).length}/{reading.cards.length}</p>}
      </header>

      <section ref={spreadRef} className="scroll-mt-16" aria-label="原牌阵"><ReadingReviewSpread reading={reading} /></section>

      {(overview || firstNote) && <section ref={thoughtsRef} className="scroll-mt-16 space-y-2" aria-label="当时的想法">
        <h3 className="font-serif text-sm font-bold text-forest-accent">当时的想法</h3>
        {!overview && <p className="text-xs text-forest-muted">{reading.slotLabels?.[firstNoteIndex] || `第 ${firstNoteIndex + 1} 张`} · {reading.cards[firstNoteIndex]?.name}</p>}
        <p className={`whitespace-pre-wrap break-words text-sm leading-relaxed ${!showAllThoughts && (overview || firstNote).length > 260 ? 'line-clamp-6' : ''}`}>{overview || firstNote}</p>
        {(overview || firstNote).length > 260 && <button type="button" aria-expanded={showAllThoughts} onClick={() => setShowAllThoughts(previous => !previous)} className="min-h-11 text-xs text-forest-accent">{showAllThoughts ? '收起原解读' : '展开完整原解读'}</button>}
      </section>}

      {(onSaveFeedback || savedFeedback.trim()) && <section ref={feedbackRef} className="scroll-mt-16 space-y-2 border-t border-forest-accent/8 pt-4" aria-label="后来的经历">
        <div className="flex min-h-11 items-center justify-between gap-2">
          <h3 className="font-serif text-sm font-bold text-forest-accent">后来的经历</h3>
          {!isEditing && onSaveFeedback && <button type="button" onClick={startEditing} className="inline-flex min-h-11 items-center gap-1.5 text-xs text-forest-accent"><PencilLine size={15} />{savedFeedback.trim() ? '补写复盘' : '添加复盘'}</button>}
        </div>
        {isEditing ? <div className="space-y-2">
          <AutoResizeTextarea aria-label="后来发生了什么" minRows={3} maxRows={12} value={text} disabled={isSaving} onChange={event => { setText(event.target.value); setNotice(''); }} placeholder="后来发生了什么？记下一点就好。" className="w-full rounded-lg border border-forest-accent/10 bg-white/60 px-3 py-2.5 text-base leading-relaxed focus:ring-2 focus:ring-forest-accent/15 sm:text-sm" />
          {!draft.durable && <p role="status" className="text-xs text-forest-muted">草稿暂存失败，请先不要关闭页面。</p>}
          <div className="flex items-center justify-end gap-3">
            <button type="button" disabled={isSaving} onClick={() => hasChanges ? setDiscardChanges(true) : cancelEditing()} className="min-h-11 px-2 text-xs text-forest-muted disabled:opacity-50">取消修改</button>
            <button type="button" disabled={isSaving} onClick={() => requestLeave('close')} className="min-h-11 px-2 text-xs text-forest-muted disabled:opacity-50">稍后继续</button>
            <button type="button" disabled={isSaving || !hasChanges} onClick={saveFeedback} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-forest-accent px-4 text-sm text-white disabled:opacity-50"><Save size={16} />{isSaving ? '保存中...' : '保存复盘'}</button>
          </div>
        </div> : savedFeedback.trim() ? <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{savedFeedback}</p> : null}
        {notice && <p role="status" className="flex items-center gap-1.5 text-xs text-forest-muted">{notice === '已保存。' && <Check size={14} />}{notice}</p>}
      </section>}

      <div className="space-y-3 border-t border-forest-accent/8 pt-4">
        <FoldableSection icon={BookOpen} title={`牌面与逐牌解读（${reading.cards.length}）`} isOpen={showCards} onToggle={() => setShowCards(previous => !previous)}>
          <div className="divide-y divide-forest-accent/8">
            {reading.cards.map((card, index) => {
              const cardData = TAROT_CARDS.find(item => [item.name, item.english, item.id].includes(card.name));
              const note = reading.cardInterpretations?.[index]?.trim();
              const question = reading.cardQuestions?.[index]?.trim();
              return <article key={index} className="flex gap-3 py-3">
                {card.name?.trim() && <div className="h-24 w-16 shrink-0"><TarotCardImage src={getCardImageUrl(cardData?.id || 'ar00')} alt={card.name} name={card.name} className={`h-full w-full object-contain ${card.isReversed ? 'rotate-180' : ''}`} /></div>}
                <div className="min-w-0 space-y-1.5">
                  <p className="break-words text-xs text-forest-muted">{reading.slotLabels?.[index] || `第 ${index + 1} 张`} · {cardData?.name || card.name || '待选牌'}{card.name?.trim() ? `（${card.isReversed ? '逆位' : '正位'}）` : ''}</p>
                  {note && note !== overview && <p className="whitespace-pre-wrap break-words text-sm">{note}</p>}
                  {question && <p className="whitespace-pre-wrap break-words text-xs text-forest-muted">疑问：{question}</p>}
                </div>
              </article>;
            })}
          </div>
        </FoldableSection>
        {reading.aiAnswer?.trim() && <FoldableSection icon={BookOpen} title="AI 参照" isOpen={showAi} onToggle={() => setShowAi(previous => !previous)}><p className="mb-2 text-xs text-forest-muted">{reading.aiAnswerMode === 'consultant' ? '咨询解牌' : '导师复盘'}</p><p className="whitespace-pre-wrap break-words text-sm">{reading.aiAnswer}</p></FoldableSection>}
        {(influenceNotes.length > 0 || otherThoughts.length > 0 || reading.clientFeedback?.trim()) && <FoldableSection icon={ChevronDown} title="补充记录" isOpen={showExtra} onToggle={() => setShowExtra(previous => !previous)}>
          <div className="space-y-3">
            {otherThoughts.map((value, index) => <p key={index} className="whitespace-pre-wrap break-words text-sm">{value}</p>)}
            {influenceNotes.map(item => <section key={item.label}><h4 className="mb-1 text-xs font-medium text-forest-accent">{item.label}</h4><p className="whitespace-pre-wrap break-words text-sm">{item.value}</p></section>)}
            {reading.clientFeedback?.trim() && <section><h4 className="mb-1 text-xs font-medium text-forest-accent">客户反馈</h4><p className="whitespace-pre-wrap break-words text-sm">{reading.clientFeedback}</p></section>}
          </div>
        </FoldableSection>}
      </div>
    </div>
    <ConfirmDialog isOpen={discardChanges} title="放弃这次修改？" message="已保存的复盘会保留，本次尚未保存的修改将被清除。" confirmText="放弃修改" cancelText="继续填写" onConfirm={cancelEditing} onClose={() => setDiscardChanges(false)} />
    <ConfirmDialog isOpen={Boolean(leaveAction)} title="草稿尚未保存" message="当前浏览器无法暂存这段修改，离开会丢失未保存的文字。" confirmText="离开" cancelText="继续填写" onConfirm={() => { if (leaveAction === 'edit') onEdit?.(reading); else onClose(); }} onClose={() => setLeaveAction(null)} />
  </PageView>;
}
