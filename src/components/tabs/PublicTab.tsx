import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  BookOpen,
  Bookmark,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  Flag,
  Globe,
  Hash,
  Layers,
  MessageSquare,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { PublicReadingReport, PublicReadingReportReason, SpreadDefinition, TarotCardMetadata, TarotReading } from '../../types';
import { ReadingCard } from '../ReadingCard';
import { TarotCardImage } from '../TarotCardImage';
import { Modal } from '../Modal';
import { getPublicModerationSnapshot, getPublicReadings, reportPublicReading, updatePublicReadingModeration } from '../../lib/firebaseData';
import { useProgressiveList } from '../../hooks/useProgressiveList';
import { QuietEmptyState, SoftSkeleton } from '../ui/SoftUI';
import { readJsonArrayWithBackup, writeJsonWithBackup } from '../../lib/safeLocalStorage';
import { formatReadingDateTime } from '../../lib/dateFormat';
import { getCardImageUrl } from '../../constants';
import { isOfficialModerator } from '../../lib/publicModeration';
import { trackEvent } from '../../lib/analytics';
import {
  buildPublicCardExampleGroups,
  buildPublicSpreadGroups,
  buildPublicTopicChips,
  filterPublicReadings,
  isPublicReadingReviewed,
  isSpreadInLibrary,
  type PublicCardExampleGroup,
  type PublicReadingFilter,
  type PublicSpreadGroup,
} from '../../lib/publicSquare';

const PUBLIC_READINGS_CACHE_KEY = 'tarot_public_readings_cache_v1';
const PUBLIC_READING_COLLECTION_KEY = 'tarot_public_reading_collection_v1';

type PublicSquareView = 'readings' | 'cards' | 'spreads' | 'practice' | 'moderation';
type ModerationFilter = 'reported' | 'visible' | 'hidden';

interface PublicTabProps {
  readings: TarotReading[];
  cardMetadata: TarotCardMetadata[];
  spreads?: SpreadDefinition[];
  onTagClick: (tag: string) => void;
  onAuthorClick: (author: string) => void;
  onProcessAi: (id: string) => void;
  onCollectSpread?: (spread: SpreadDefinition) => void;
  onNotice?: (message: string) => void;
  onLoginRequest?: () => void;
  onPublicReadingsLoaded?: (readings: TarotReading[]) => void;
  initialPublicReadings?: TarotReading[];
  currentUserId?: string;
  currentUserEmail?: string | null;
  isModerator?: boolean;
}

const squareViews: Array<{ id: PublicSquareView; label: string; icon: React.ElementType }> = [
  { id: 'readings', label: '手记', icon: MessageSquare },
  { id: 'cards', label: '牌例', icon: BookOpen },
  { id: 'spreads', label: '牌阵', icon: Layers },
  { id: 'practice', label: '共修', icon: Sparkles },
];

const readingFilters: Array<{ id: PublicReadingFilter; label: string; icon: React.ElementType }> = [
  { id: 'all', label: '全部', icon: Globe },
  { id: 'reviewed', label: '已复盘', icon: CheckCircle2 },
  { id: 'collected', label: '收藏', icon: Bookmark },
];

const reportReasonOptions: Array<{ id: PublicReadingReportReason; label: string }> = [
  { id: 'inappropriate', label: '不适内容' },
  { id: 'privacy', label: '隐私泄露' },
  { id: 'spam', label: '广告骚扰' },
  { id: 'other', label: '其他' },
];

const moderationFilters: Array<{ id: ModerationFilter; label: string; icon: React.ElementType }> = [
  { id: 'reported', label: '有举报', icon: Flag },
  { id: 'visible', label: '公开中', icon: Eye },
  { id: 'hidden', label: '已下架', icon: EyeOff },
];

const practicePrompts = [
  {
    title: '一张牌的第一直觉',
    prompt: '抽一张牌，只写下你看到牌面后的第一句话，晚上再回来补今日回看。',
    tags: ['日运', '第一直觉', '复盘'],
  },
  {
    title: '同一张牌的不同处境',
    prompt: '找一张最近常见的牌，看它在不同问题里怎么出现。',
    tags: ['牌例', '场景', '比较'],
  },
  {
    title: '换一种问法',
    prompt: '把一个问题写得更清楚：少问结果，多问现在能看见什么。',
    tags: ['问题', '自我探索'],
  },
  {
    title: '复盘一句真实发生',
    prompt: '找一条旧手记，只补一句今天真正发生的事，不急着判断准不准。',
    tags: ['旧手记', '今日回看', '沉淀'],
  },
  {
    title: '拆一组牌阵位置',
    prompt: '选一个公开牌阵，先不解牌，只看每个位置在帮你观察什么。',
    tags: ['牌阵', '位置', '练习'],
  },
];

const getTodayPracticePrompt = () => {
  const dayIndex = Math.floor(Date.now() / 86400000);
  return practicePrompts[dayIndex % practicePrompts.length];
};

const chipButtonClass = (active: boolean) => (
  `inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border px-2 text-xs font-medium transition-all sm:shrink-0 sm:gap-1.5 sm:rounded-full sm:px-3 ${
    active
      ? 'border-forest-accent bg-forest-accent text-white shadow-sm'
      : 'border-forest-accent/9 bg-white/34 text-forest-muted hover:border-forest-accent/24 hover:text-forest-accent'
  }`
);

const softActionButtonClass = (active = false) => (
  `inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-all ${
    active
      ? 'border-forest-accent/20 bg-forest-accent/10 text-forest-accent'
      : 'border-forest-accent/8 bg-white/38 text-forest-muted hover:border-forest-accent/20 hover:text-forest-accent'
  }`
);

const getSpreadSlotSummary = (spread: PublicSpreadGroup) => {
  const visibleSlots = spread.slots.slice(0, 5).join(' · ');
  return spread.slots.length > 5 ? `${visibleSlots} · +${spread.slots.length - 5}` : visibleSlots;
};

const getReportReasonLabel = (reason: PublicReadingReportReason) => (
  reportReasonOptions.find(item => item.id === reason)?.label || '其他'
);

export const PublicTab: React.FC<PublicTabProps> = ({
  readings,
  cardMetadata,
  spreads = [],
  onTagClick: _onTagClick,
  onAuthorClick,
  onProcessAi,
  onCollectSpread,
  onNotice,
  onLoginRequest,
  onPublicReadingsLoaded,
  initialPublicReadings = [],
  currentUserId,
  currentUserEmail,
  isModerator,
}) => {
  const canModerate = isModerator ?? isOfficialModerator(currentUserEmail);
  const [cloudPublicReadings, setCloudPublicReadings] = useState<TarotReading[]>(() => (
    initialPublicReadings.length > 0
      ? initialPublicReadings
      : readJsonArrayWithBackup<TarotReading>(PUBLIC_READINGS_CACHE_KEY) || []
  ));
  const [collectedReadingIds, setCollectedReadingIds] = useState<string[]>(() => (
    readJsonArrayWithBackup<string>(PUBLIC_READING_COLLECTION_KEY) || []
  ));
  const [activeView, setActiveView] = useState<PublicSquareView>('readings');
  const [readingFilter, setReadingFilter] = useState<PublicReadingFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedCardName, setSelectedCardName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadNotice, setLoadNotice] = useState('');
  const [reportTarget, setReportTarget] = useState<TarotReading | null>(null);
  const [reportReason, setReportReason] = useState<PublicReadingReportReason>('inappropriate');
  const [reportNote, setReportNote] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [moderationReadings, setModerationReadings] = useState<TarotReading[]>([]);
  const [moderationReports, setModerationReports] = useState<PublicReadingReport[]>([]);
  const [moderationFilter, setModerationFilter] = useState<ModerationFilter>('reported');
  const [isModerationLoading, setIsModerationLoading] = useState(false);
  const [moderatingReadingId, setModeratingReadingId] = useState('');
  const [moderationNotice, setModerationNotice] = useState('');
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    let cancelled = false;

    const loadPublicReadings = async () => {
      if (cloudPublicReadings.length === 0) {
        setIsLoading(true);
      }
      try {
        const loaded = await getPublicReadings();
        if (!cancelled) {
          setCloudPublicReadings(loaded);
          writeJsonWithBackup(PUBLIC_READINGS_CACHE_KEY, loaded.filter(reading => reading.isPublic).slice(0, 50));
          setLoadNotice('');
        }
      } catch (error) {
        console.error('Failed to load public readings:', error);
        if (!cancelled) {
          setLoadNotice(cloudPublicReadings.length > 0
            ? '云端读取慢，先展示上次保存的公开手记。'
            : '广场暂时没有连上，可以稍后再看。'
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadPublicReadings();
    return () => {
      cancelled = true;
    };
  }, []);

  const publicReadings = useMemo(() => {
    const byId = new Map<string, TarotReading>();

    cloudPublicReadings.forEach(reading => {
      if (reading.isPublic && reading.moderationStatus !== 'hidden') byId.set(reading.id, reading);
    });

    readings.filter(reading => reading.isPublic).forEach(reading => {
      if (reading.moderationStatus !== 'hidden') byId.set(reading.id, reading);
    });

    return Array.from(byId.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [cloudPublicReadings, readings]);

  const topicChips = useMemo(() => buildPublicTopicChips(publicReadings), [publicReadings]);
  const cardExampleGroups = useMemo(
    () => buildPublicCardExampleGroups(publicReadings, cardMetadata),
    [cardMetadata, publicReadings],
  );
  const spreadGroups = useMemo(() => buildPublicSpreadGroups(publicReadings), [publicReadings]);
  const filteredReadings = useMemo(() => filterPublicReadings({
    readings: publicReadings,
    query: searchText,
    topic: selectedTopic,
    filter: readingFilter,
    collectedIds: collectedReadingIds,
    cardMetadata,
  }), [cardMetadata, collectedReadingIds, publicReadings, readingFilter, searchText, selectedTopic]);
  const selectedCardGroup = cardExampleGroups.find(group => group.cardName === selectedCardName) || cardExampleGroups[0];
  const reviewedCount = publicReadings.filter(isPublicReadingReviewed).length;
  const todayPrompt = useMemo(() => getTodayPracticePrompt(), []);
  const visibleSquareViews = useMemo(() => (
    canModerate
      ? [...squareViews, { id: 'moderation' as const, label: '管理', icon: ShieldCheck }]
      : squareViews
  ), [canModerate]);
  const reportsByReadingId = useMemo(() => {
    const groups = new Map<string, PublicReadingReport[]>();
    moderationReports.forEach(report => {
      const next = groups.get(report.readingId) || [];
      next.push(report);
      groups.set(report.readingId, next);
    });
    return groups;
  }, [moderationReports]);
  const filteredModerationReadings = useMemo(() => (
    moderationReadings.filter(reading => {
      const isHidden = !reading.isPublic || reading.moderationStatus === 'hidden';
      const reportCount = reportsByReadingId.get(reading.id)?.length || 0;
      if (moderationFilter === 'reported') return reportCount > 0;
      if (moderationFilter === 'hidden') return isHidden;
      return !isHidden;
    })
  ), [moderationFilter, moderationReadings, reportsByReadingId]);
  const publicGridClassName = filteredReadings.length === 1
    ? 'grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,520px)] md:justify-center'
    : 'grid grid-cols-1 gap-4 md:grid-cols-2';

  const loadModerationSnapshot = useCallback(async () => {
    if (!canModerate) return;

    setIsModerationLoading(true);
    try {
      const snapshot = await getPublicModerationSnapshot();
      setModerationReadings(snapshot.readings);
      setModerationReports(snapshot.reports);
      setModerationNotice('');
    } catch (error) {
      console.error('Failed to load public moderation snapshot:', error);
      setModerationNotice('管理数据暂时没读到，请确认已用作者账号登录，并且 Firestore 规则已发布。');
    } finally {
      setIsModerationLoading(false);
    }
  }, [canModerate]);

  const openReportDialog = (reading: TarotReading) => {
    if (!currentUserId) {
      onNotice?.('登录后可以举报公开内容。');
      onLoginRequest?.();
      return;
    }

    setReportTarget(reading);
    setReportReason('inappropriate');
    setReportNote('');
  };

  const submitReport = async () => {
    if (!reportTarget || !currentUserId || isSubmittingReport) return;

    setIsSubmittingReport(true);
    try {
      await reportPublicReading(reportTarget.id, {
        userId: currentUserId,
        reason: reportReason,
        note: reportNote,
      });
      trackEvent('public_reading_reported', { reason: reportReason });
      setReportTarget(null);
      setReportNote('');
      onNotice?.('已收到举报，作者会在后台处理。');
    } catch (error) {
      console.error('Failed to report public reading:', error);
      onNotice?.('举报暂时没送出，请稍后再试。');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const updateModerationStatus = async (reading: TarotReading, status: 'published' | 'hidden') => {
    if (!canModerate || !currentUserId || moderatingReadingId) return;

    setModeratingReadingId(reading.id);
    try {
      await updatePublicReadingModeration(reading.id, status, currentUserId);
      setModerationReadings(current => current.map(item => (
        item.id === reading.id
          ? { ...item, isPublic: status === 'published', moderationStatus: status, moderatedAt: new Date().toISOString(), moderatedBy: currentUserId }
          : item
      )));
      setCloudPublicReadings(current => {
        if (status === 'hidden') return current.filter(item => item.id !== reading.id);
        const nextReading = { ...reading, isPublic: true, moderationStatus: 'published' as const };
        const exists = current.some(item => item.id === reading.id);
        return exists
          ? current.map(item => (item.id === reading.id ? nextReading : item))
          : [nextReading, ...current];
      });
      trackEvent('public_reading_moderated', { state: status });
      onNotice?.(status === 'hidden' ? '已从广场下架。' : '已恢复到广场。');
    } catch (error) {
      console.error('Failed to update public moderation status:', error);
      onNotice?.('处理失败，请确认作者账号和 Firestore 规则。');
    } finally {
      setModeratingReadingId('');
    }
  };

  useEffect(() => {
    if (!selectedCardName && cardExampleGroups[0]) {
      setSelectedCardName(cardExampleGroups[0].cardName);
      return;
    }

    if (selectedCardName && !cardExampleGroups.some(group => group.cardName === selectedCardName)) {
      setSelectedCardName(cardExampleGroups[0]?.cardName || '');
    }
  }, [cardExampleGroups, selectedCardName]);

  useEffect(() => {
    onPublicReadingsLoaded?.(publicReadings);
  }, [onPublicReadingsLoaded, publicReadings]);

  useEffect(() => {
    if (activeView === 'moderation' && !canModerate) {
      setActiveView('readings');
    }
  }, [activeView, canModerate]);

  useEffect(() => {
    if (activeView === 'moderation' && canModerate && moderationReadings.length === 0) {
      void loadModerationSnapshot();
    }
  }, [activeView, canModerate, loadModerationSnapshot, moderationReadings.length]);

  const {
    hasMore,
    sentinelRef,
    visibleItems: visiblePublicReadings,
  } = useProgressiveList(filteredReadings);

  const toggleCollectedReading = (reading: TarotReading) => {
    setCollectedReadingIds(current => {
      const exists = current.includes(reading.id);
      const next = exists ? current.filter(id => id !== reading.id) : [...current, reading.id];
      writeJsonWithBackup(PUBLIC_READING_COLLECTION_KEY, next);
      onNotice?.(exists ? '已从广场收藏移出。' : '已收藏到本机，之后可在广场筛选查看。');
      return next;
    });
  };

  const handleTagClick = (tag: string) => {
    setActiveView('readings');
    setSelectedTopic(tag);
    setReadingFilter('all');
  };

  const handleCollectSpread = (spread: PublicSpreadGroup) => {
    if (isSpreadInLibrary(spreads, spread.definition)) {
      onNotice?.('这个牌阵已经在你的牌阵库里。');
      return;
    }

    onCollectSpread?.(spread.definition);
  };

  const renderSquareHeader = () => (
    <div className="rounded-[1.15rem] border border-forest-accent/8 bg-white/28 px-3 py-3 shadow-sm sm:px-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div>
            <h2 className="font-serif text-xl font-bold text-forest-ink sm:text-2xl">广场</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-forest-muted sm:text-sm">
              看公开手记、牌例和牌阵。
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px] font-medium text-forest-muted sm:justify-end">
          <span className="rounded-full bg-white/46 px-2.5 py-1">手记 {publicReadings.length}</span>
          <span className="rounded-full bg-white/46 px-2.5 py-1">牌例 {cardExampleGroups.length}</span>
          <span className="rounded-full bg-white/46 px-2.5 py-1">牌阵 {spreadGroups.length}</span>
          <span className="rounded-full bg-forest-accent/8 px-2.5 py-1 text-forest-accent">公开可见</span>
        </div>
      </div>
      <div className={`mt-3 grid ${canModerate ? 'grid-cols-5' : 'grid-cols-4'} gap-1.5 sm:flex sm:overflow-x-auto sm:pb-0.5 sm:no-scrollbar`} role="tablist" aria-label="广场内容">
        {visibleSquareViews.map(item => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveView(item.id)}
              className={chipButtonClass(active)}
            >
              <Icon size={14} />
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderLoadingNotice = () => (
    (isLoading || loadNotice) ? (
      <p className="inline-flex rounded-full bg-white/34 px-3 py-1 text-[10px] font-medium text-forest-muted">
        {loadNotice || '正在更新公开手记…'}
      </p>
    ) : null
  );

  const renderReadingFilters = () => (
    <div className="rounded-[1.05rem] border border-forest-accent/7 bg-white/20 p-2.5">
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-forest-accent/55" />
        <input
          type="search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="搜索牌名、问题、牌阵或标签"
          className="min-h-11 w-full rounded-full border border-forest-accent/8 bg-white/58 pl-9 pr-10 text-sm text-forest-ink outline-none transition focus:border-forest-accent/30"
        />
        {searchText && (
          <button
            type="button"
            onClick={() => setSearchText('')}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-forest-muted hover:bg-white/60 hover:text-forest-accent"
            aria-label="清空广场搜索"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
        {readingFilters.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setReadingFilter(item.id)}
              className={softActionButtonClass(readingFilter === item.id)}
            >
              <Icon size={13} />
              {item.label}
            </button>
          );
        })}
        {topicChips.length > 0 && (
          <>
            <span className="my-auto h-4 w-px shrink-0 bg-forest-accent/10" aria-hidden />
            <button
              type="button"
              onClick={() => setSelectedTopic('')}
              className={softActionButtonClass(!selectedTopic)}
            >
              <Hash size={13} />
              全部标签
            </button>
            {topicChips.map(item => (
              <button
                key={item.tag}
                type="button"
                onClick={() => setSelectedTopic(item.tag)}
                className={softActionButtonClass(selectedTopic === item.tag)}
              >
                #{item.tag}
                <span className="text-[10px] opacity-70">{item.count}</span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );

  const renderPublicReadingActions = (reading: TarotReading) => {
    const collected = collectedReadingIds.includes(reading.id);
    const spread = spreadGroups.find(item => item.name === reading.spread);
    const canCollectSpread = Boolean(spread && !isSpreadInLibrary(spreads, spread.definition));

    return (
      <div className="flex flex-wrap gap-2 px-1">
        <button
          type="button"
          onClick={() => toggleCollectedReading(reading)}
          className={softActionButtonClass(collected)}
        >
          <Bookmark size={13} fill={collected ? 'currentColor' : 'none'} />
          {collected ? '已收藏' : '收藏研习'}
        </button>
        {reading.cards?.[0]?.name && (
          <button
            type="button"
            onClick={() => {
              const matchingGroup = cardExampleGroups.find(group => (
                group.examples.some(example => example.reading.id === reading.id)
              ));
              setActiveView('cards');
              setSelectedCardName(matchingGroup?.cardName || reading.cards[0].name);
            }}
            className={softActionButtonClass(false)}
          >
            <BookOpen size={13} />
            看牌例
          </button>
        )}
        {spread && (
          <button
            type="button"
            onClick={() => handleCollectSpread(spread)}
            disabled={!canCollectSpread}
            className={`${softActionButtonClass(!canCollectSpread)} disabled:cursor-default disabled:opacity-70`}
          >
            {canCollectSpread ? <Plus size={13} /> : <CheckCircle2 size={13} />}
            {canCollectSpread ? '收进我的牌阵' : '牌阵已在库'}
          </button>
        )}
        <button
          type="button"
          onClick={() => openReportDialog(reading)}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-forest-pink/10 bg-forest-pink/5 px-3 text-xs font-medium text-forest-muted transition-all hover:border-forest-pink/22 hover:text-forest-pink"
        >
          <Flag size={13} />
          举报
        </button>
      </div>
    );
  };

  const renderReadingsView = () => {
    if (isLoading && publicReadings.length === 0) {
      return (
        <div className="space-y-2 rounded-[1.45rem] border border-forest-accent/7 bg-white/22 p-4" role="status" aria-live="polite">
          <p className="text-xs font-medium text-forest-muted">正在读取广场手记…</p>
          <SoftSkeleton rows={2} className="border-0 bg-transparent p-0" />
        </div>
      );
    }

    if (publicReadings.length === 0) {
      return (
        <QuietEmptyState
          icon={<Globe size={24} />}
          title="还没有公开手记"
          description="完成手记时勾选公开，就会出现在这里。"
          action={(
            <div className="inline-flex min-h-10 items-center gap-2 rounded-full bg-forest-accent/6 px-4 text-sm font-medium text-forest-accent">
              <Sparkles size={14} />
              <span>去记录一条</span>
            </div>
          )}
          className="sm:py-12"
        />
      );
    }

    if (filteredReadings.length === 0) {
      return (
        <QuietEmptyState
          icon={<Search size={24} />}
          title="没找到"
          description="换个牌名、标签或筛选条件试试。"
        />
      );
    }

    return (
      <div className="space-y-3">
        {renderLoadingNotice()}
        <div className={publicGridClassName}>
          {visiblePublicReadings.map(reading => (
            <article key={reading.id} className="space-y-2">
              <ReadingCard
                reading={reading}
                isPublicView
                cardMetadata={cardMetadata}
                onTagClick={handleTagClick}
                onAuthorClick={onAuthorClick}
                onProcessAi={onProcessAi}
              />
              {renderPublicReadingActions(reading)}
            </article>
          ))}
          <div ref={sentinelRef} className="col-span-full h-1" aria-hidden />
        </div>
        {hasMore && (
          <div className="flex justify-center py-2">
            <span className="rounded-full bg-white/24 px-3 py-1 text-[10px] font-medium text-forest-muted">
              继续加载公开手记…
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderCardExample = (group: PublicCardExampleGroup) => (
    <div className="rounded-[1.05rem] border border-forest-accent/7 bg-white/30 p-3">
      <div className="flex items-start gap-3">
        <div className="h-20 w-[3.25rem] shrink-0 overflow-hidden rounded-lg border border-forest-accent/10 bg-white/70 shadow-sm">
          <TarotCardImage
            src={getCardImageUrl(group.cardId || 'ar00')}
            alt={group.cardName}
            name={group.cardName}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-xl font-bold text-forest-ink">{group.cardName}</p>
          <p className="mt-1 text-xs leading-relaxed text-forest-muted">
            {group.count} 个位置 · 正位 {group.uprightCount} · 逆位 {group.reversedCount} · 已复盘 {group.reviewedCount}
          </p>
          <p className="mt-2 line-clamp-2 text-xs text-forest-ink/72">{group.latestQuestion}</p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {group.examples.slice(0, 5).map(example => (
          <button
            key={example.id}
            type="button"
            onClick={() => {
              setActiveView('readings');
              setSearchText(example.cardName);
              setSelectedTopic('');
            }}
            className="w-full rounded-xl border border-forest-accent/7 bg-white/38 px-3 py-2.5 text-left transition hover:border-forest-accent/18 hover:bg-white/56"
          >
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-forest-muted">
              <span>{formatReadingDateTime(example.reading.readingDate || example.reading.date)}</span>
              <span className="text-forest-accent/25">·</span>
              <span>{example.reading.spread}</span>
              <span className="text-forest-accent/25">·</span>
              <span>{example.slotLabel}</span>
              <span className={`rounded-full px-1.5 py-0.5 ${example.orientation === 'reversed' ? 'bg-forest-pink/10 text-forest-pink' : 'bg-forest-accent/8 text-forest-accent'}`}>
                {example.orientation === 'reversed' ? '逆位' : '正位'}
              </span>
            </div>
            <p className="mt-1 line-clamp-1 text-xs font-medium text-forest-ink">{example.reading.question || '未命名手记'}</p>
            {example.text && (
              <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-forest-ink/72">
                {example.text}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  const renderCardsView = () => {
    if (cardExampleGroups.length === 0) {
      return (
        <QuietEmptyState
          icon={<BookOpen size={24} />}
          title="还没有牌例"
          description="公开手记里有牌面和解读后，这里会自动整理。"
        />
      );
    }

    return (
      <div className="grid gap-3 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <div className="rounded-[1.05rem] border border-forest-accent/7 bg-white/20 p-2.5">
          <p className="mb-2 text-[10px] font-medium tracking-[0.14em] text-forest-muted">按牌浏览</p>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar lg:block lg:max-h-[31rem] lg:space-y-1.5 lg:overflow-y-auto lg:pb-0">
            {cardExampleGroups.slice(0, 36).map(group => (
              <button
                key={group.cardName}
                type="button"
                onClick={() => setSelectedCardName(group.cardName)}
                className={`flex min-h-11 shrink-0 items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left text-xs transition lg:w-full ${
                  selectedCardGroup?.cardName === group.cardName
                    ? 'border-forest-accent/30 bg-forest-accent/10 text-forest-accent'
                    : 'border-forest-accent/7 bg-white/36 text-forest-muted hover:border-forest-accent/18 hover:text-forest-accent'
                }`}
              >
                <span className="font-medium">{group.cardName}</span>
                <span className="rounded-full bg-white/58 px-2 py-0.5 text-[10px]">{group.count}</span>
              </button>
            ))}
          </div>
        </div>
        {selectedCardGroup && renderCardExample(selectedCardGroup)}
      </div>
    );
  };

  const renderSpreadCard = (spread: PublicSpreadGroup) => {
    const inLibrary = isSpreadInLibrary(spreads, spread.definition);

    return (
      <article key={spread.key} className="rounded-[1.05rem] border border-forest-accent/7 bg-white/30 p-3 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="font-serif text-lg font-bold leading-tight text-forest-ink">{spread.name}</h3>
              {spread.isOfficial && (
                <span className="rounded-full bg-forest-accent/8 px-2 py-0.5 text-[10px] font-medium text-forest-accent">
                  官方
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-forest-muted">
              {spread.count} 条公开案例 · 已复盘 {spread.reviewedCount}
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleCollectSpread(spread)}
            disabled={inLibrary}
            className={`${softActionButtonClass(inLibrary)} min-w-[6.4rem] disabled:cursor-default disabled:opacity-70`}
          >
            {inLibrary ? <CheckCircle2 size={13} /> : <Copy size={13} />}
            {inLibrary ? '已在库' : '收进牌阵'}
          </button>
        </div>
        <div className="mt-3 rounded-2xl border border-forest-accent/6 bg-forest-bg/22 px-3 py-2">
          <p className="text-[10px] font-medium text-forest-accent">位置</p>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-forest-ink/74">{getSpreadSlotSummary(spread)}</p>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="w-24 shrink-0 rounded-2xl border border-forest-accent/7 bg-white/42">
            <ReadingCard reading={spread.latestReading} cardMetadata={cardMetadata} isMini isPublicView />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-forest-muted">最近案例</p>
            <p className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-forest-ink">{spread.latestQuestion}</p>
          </div>
        </div>
      </article>
    );
  };

  const renderSpreadsView = () => {
    if (spreadGroups.length === 0) {
      return (
        <QuietEmptyState
          icon={<Layers size={24} />}
          title="还没有牌阵"
          description="公开手记带有牌阵位置后，这里会自动整理。"
        />
      );
    }

    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {spreadGroups.map(renderSpreadCard)}
      </div>
    );
  };

  const renderPracticeView = () => (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <div className="rounded-[1.05rem] border border-forest-accent/8 bg-white/30 p-3.5 shadow-sm">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-forest-accent/8 px-3 py-1 text-[10px] font-medium text-forest-accent">
          <Clock3 size={12} />
          今日共修
        </p>
        <h3 className="mt-2.5 font-serif text-xl font-bold text-forest-ink sm:text-2xl">{todayPrompt.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-forest-ink/78">{todayPrompt.prompt}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {todayPrompt.tags.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                setActiveView('readings');
                setSelectedTopic(tag);
              }}
              className={softActionButtonClass(false)}
            >
              #{tag}
            </button>
          ))}
        </div>
        <div className="mt-3 rounded-xl border border-forest-accent/7 bg-forest-bg/22 px-3 py-2.5">
          <p className="text-xs font-medium text-forest-accent">练习提示</p>
          <p className="mt-1 text-xs leading-relaxed text-forest-muted">
            先自己写，再看公开案例；不同理解可以留到复盘里。
          </p>
        </div>
      </div>
      <div className="rounded-[1.05rem] border border-forest-accent/8 bg-white/22 p-3.5">
        <p className="text-[10px] font-medium tracking-[0.14em] text-forest-muted">今日可参考</p>
        <div className="mt-3 space-y-2">
          {cardExampleGroups.slice(0, 3).map(group => (
            <button
              key={group.cardName}
              type="button"
              onClick={() => {
                setActiveView('cards');
                setSelectedCardName(group.cardName);
              }}
              className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-forest-accent/7 bg-white/42 px-3 py-2 text-left transition hover:border-forest-accent/18 hover:bg-white/58"
            >
              <span>
                <span className="block text-sm font-medium text-forest-ink">{group.cardName}</span>
                <span className="mt-0.5 block text-[10px] text-forest-muted">{group.count} 个公开位置</span>
              </span>
              <BookOpen size={15} className="text-forest-accent" />
            </button>
          ))}
          {spreadGroups.slice(0, 2).map(spread => (
            <button
              key={spread.key}
              type="button"
              onClick={() => setActiveView('spreads')}
              className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-forest-accent/7 bg-white/42 px-3 py-2 text-left transition hover:border-forest-accent/18 hover:bg-white/58"
            >
              <span>
                <span className="block text-sm font-medium text-forest-ink">{spread.name}</span>
                <span className="mt-0.5 block text-[10px] text-forest-muted">{spread.slots.length} 个位置 · {spread.count} 条案例</span>
              </span>
              <Layers size={15} className="text-forest-accent" />
            </button>
          ))}
          {cardExampleGroups.length === 0 && spreadGroups.length === 0 && (
            <p className="rounded-2xl bg-white/34 px-3 py-4 text-center text-xs text-forest-muted">
              有更多公开案例后，这里会显示可看的牌和牌阵。
            </p>
          )}
        </div>
      </div>
    </div>
  );

  const renderModerationView = () => {
    if (!canModerate) return null;

    return (
      <div className="space-y-3">
        <div className="rounded-[1.05rem] border border-forest-accent/8 bg-white/24 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-1.5 rounded-full bg-forest-accent/8 px-2.5 py-1 text-[10px] font-medium text-forest-accent">
                <ShieldCheck size={12} />
                作者可见
              </p>
              <p className="mt-2 text-xs leading-relaxed text-forest-muted">
                这里只处理广场公开内容；私人手记不会进入这里。
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadModerationSnapshot()}
              disabled={isModerationLoading}
              className={softActionButtonClass(false)}
            >
              <RefreshCcw size={13} className={isModerationLoading ? 'animate-spin' : ''} />
              刷新
            </button>
          </div>
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {moderationFilters.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setModerationFilter(item.id)}
                  className={softActionButtonClass(moderationFilter === item.id)}
                >
                  <Icon size={13} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {moderationNotice && (
          <p className="rounded-[1.05rem] border border-forest-pink/10 bg-forest-pink/5 px-3 py-2 text-xs leading-relaxed text-forest-muted">
            {moderationNotice}
          </p>
        )}

        {isModerationLoading && moderationReadings.length === 0 ? (
          <div className="space-y-2 rounded-[1.05rem] border border-forest-accent/7 bg-white/22 p-4" role="status" aria-live="polite">
            <p className="text-xs font-medium text-forest-muted">正在读取管理数据…</p>
            <SoftSkeleton rows={2} className="border-0 bg-transparent p-0" />
          </div>
        ) : filteredModerationReadings.length === 0 ? (
          <QuietEmptyState
            icon={<ShieldCheck size={24} />}
            title={moderationFilter === 'reported' ? '暂无举报' : '暂无内容'}
            description="有用户举报或公开内容变化后，会出现在这里。"
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filteredModerationReadings.map(reading => {
              const reports = reportsByReadingId.get(reading.id) || [];
              const isHidden = !reading.isPublic || reading.moderationStatus === 'hidden';
              return (
                <article key={reading.id} className="rounded-[1.05rem] border border-forest-accent/7 bg-white/30 p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-semibold leading-relaxed text-forest-ink">
                        {reading.question || '未命名手记'}
                      </p>
                      <p className="mt-1 text-[10px] text-forest-muted">
                        {formatReadingDateTime(reading.readingDate || reading.date)} · {reading.spread || '未命名牌阵'}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${
                      isHidden ? 'bg-forest-pink/8 text-forest-pink' : 'bg-forest-accent/8 text-forest-accent'
                    }`}>
                      {isHidden ? '已下架' : '公开中'}
                    </span>
                  </div>

                  <div className="mt-3 rounded-xl border border-forest-accent/6 bg-white/34 px-3 py-2">
                    <p className="text-[10px] font-medium text-forest-muted">
                      举报 {reports.length}
                    </p>
                    {reports.length > 0 ? (
                      <div className="mt-2 space-y-1.5">
                        {reports.slice(0, 3).map(report => (
                          <div key={`${reading.id}-${report.id}`} className="rounded-lg bg-forest-bg/35 px-2 py-1.5">
                            <p className="text-[10px] font-medium text-forest-ink">
                              {getReportReasonLabel(report.reason)}
                              <span className="ml-1 font-normal text-forest-muted">
                                {formatReadingDateTime(report.createdAt)}
                              </span>
                            </p>
                            {report.note && (
                              <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-forest-muted">
                                {report.note}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-[10px] text-forest-muted">没有收到举报。</p>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void updateModerationStatus(reading, isHidden ? 'published' : 'hidden')}
                      disabled={moderatingReadingId === reading.id}
                      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-all disabled:opacity-60 ${
                        isHidden
                          ? 'border-forest-accent/10 bg-forest-accent/8 text-forest-accent'
                          : 'border-forest-pink/12 bg-forest-pink/5 text-forest-pink'
                      }`}
                    >
                      {isHidden ? <Eye size={13} /> : <EyeOff size={13} />}
                      {isHidden ? '恢复公开' : '从广场下架'}
                    </button>
                    {!isHidden && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveView('readings');
                          setSearchText(reading.question || reading.spread || '');
                          setSelectedTopic('');
                        }}
                        className={softActionButtonClass(false)}
                      >
                        <Search size={13} />
                        看内容
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderReportModal = () => (
    <Modal
      isOpen={!!reportTarget}
      onClose={() => {
        if (!isSubmittingReport) setReportTarget(null);
      }}
      title="举报公开手记"
      icon={<Flag size={20} />}
    >
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-forest-muted">
          只会把这条公开内容和你的举报原因发给作者，不会带上你的私人手记。
        </p>
        <div className="grid grid-cols-2 gap-2">
          {reportReasonOptions.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setReportReason(item.id)}
              className={`min-h-11 rounded-xl border px-3 text-sm font-medium transition-all ${
                reportReason === item.id
                  ? 'border-forest-accent/24 bg-forest-accent/10 text-forest-accent'
                  : 'border-forest-accent/8 bg-white/46 text-forest-muted'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-forest-ink">补充说明（选填）</span>
          <textarea
            value={reportNote}
            onChange={(event) => setReportNote(event.target.value.slice(0, 300))}
            placeholder="哪里不合适？一句话就够。"
            className="min-h-24 w-full resize-none rounded-2xl border border-forest-accent/8 bg-white/58 px-3 py-2.5 text-sm text-forest-ink outline-none transition focus:border-forest-accent/28"
          />
          <span className="block text-right text-[10px] text-forest-muted">{reportNote.length}/300</span>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setReportTarget(null)}
            disabled={isSubmittingReport}
            className="min-h-11 flex-1 rounded-full border border-forest-accent/8 bg-white/46 text-sm font-medium text-forest-muted"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void submitReport()}
            disabled={isSubmittingReport}
            className="min-h-11 flex-[1.35] rounded-full bg-forest-accent px-4 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
          >
            {isSubmittingReport ? '正在提交…' : '提交举报'}
          </button>
        </div>
      </div>
    </Modal>
  );

  return (
    <>
      <motion.div
        key="public"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        className="space-y-3 sm:space-y-4"
      >
        {renderSquareHeader()}
        {activeView === 'readings' && renderReadingFilters()}
        {activeView === 'readings' && renderReadingsView()}
        {activeView === 'cards' && renderCardsView()}
        {activeView === 'spreads' && renderSpreadsView()}
        {activeView === 'practice' && renderPracticeView()}
        {activeView === 'moderation' && renderModerationView()}
        {activeView !== 'readings' && activeView !== 'moderation' && renderLoadingNotice()}
        {publicReadings.length > 0 && activeView !== 'moderation' && (
          <div className="rounded-[1.05rem] border border-forest-accent/7 bg-white/18 px-3 py-2.5 text-xs leading-relaxed text-forest-muted">
            这里显示所有用户主动公开的手记；匿名只隐藏昵称。已复盘 {reviewedCount} 条。
          </div>
        )}
      </motion.div>
      {renderReportModal()}
    </>
  );
};
