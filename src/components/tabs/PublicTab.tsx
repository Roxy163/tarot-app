import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Globe, Sparkles } from 'lucide-react';
import { TarotReading, TarotCardMetadata } from '../../types';
import { ReadingCard } from '../ReadingCard';
import { getPublicReadings } from '../../lib/firebaseData';
import { useProgressiveList } from '../../hooks/useProgressiveList';
import { QuietEmptyState, SoftSkeleton } from '../ui/SoftUI';
import { readJsonArrayWithBackup, writeJsonWithBackup } from '../../lib/safeLocalStorage';

const PUBLIC_READINGS_CACHE_KEY = 'tarot_public_readings_cache_v1';

interface PublicTabProps {
  readings: TarotReading[];
  cardMetadata: TarotCardMetadata[];
  onTagClick: (tag: string) => void;
  onAuthorClick: (author: string) => void;
  onProcessAi: (id: string) => void;
  onPublicReadingsLoaded?: (readings: TarotReading[]) => void;
  initialPublicReadings?: TarotReading[];
}

export const PublicTab: React.FC<PublicTabProps> = ({
  readings,
  cardMetadata,
  onTagClick,
  onAuthorClick,
  onProcessAi,
  onPublicReadingsLoaded,
  initialPublicReadings = []
}) => {
  const [cloudPublicReadings, setCloudPublicReadings] = useState<TarotReading[]>(() => (
    initialPublicReadings.length > 0
      ? initialPublicReadings
      : readJsonArrayWithBackup<TarotReading>(PUBLIC_READINGS_CACHE_KEY) || []
  ));
  const [isLoading, setIsLoading] = useState(true);
  const [loadNotice, setLoadNotice] = useState('');
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
      if (reading.isPublic) byId.set(reading.id, reading);
    });

    readings.filter(reading => reading.isPublic).forEach(reading => {
      byId.set(reading.id, reading);
    });

    return Array.from(byId.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [cloudPublicReadings, readings]);
  const publicGridClassName = publicReadings.length === 1
    ? 'grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,520px)] md:justify-center'
    : 'grid grid-cols-1 gap-4 md:grid-cols-2';

  useEffect(() => {
    onPublicReadingsLoaded?.(publicReadings);
  }, [onPublicReadingsLoaded, publicReadings]);

  const {
    hasMore,
    sentinelRef,
    visibleItems: visiblePublicReadings,
  } = useProgressiveList(publicReadings);

  return (
    <motion.div 
      key="public" 
      initial={{ opacity: 0, x: -20 }} 
      animate={{ opacity: 1, x: 0 }} 
      exit={{ opacity: 0, x: 20 }} 
      className="space-y-4 sm:space-y-5"
    >
      {isLoading && publicReadings.length === 0 ? (
        <div className="space-y-2 rounded-[1.45rem] border border-forest-accent/7 bg-white/22 p-4" role="status" aria-live="polite">
          <p className="text-xs font-medium text-forest-muted">正在读取广场手记…</p>
          <SoftSkeleton rows={2} className="border-0 bg-transparent p-0" />
        </div>
      ) : publicReadings.length === 0 ? (
        <QuietEmptyState
          icon={<Globe size={24} />}
          title="广场暂时安静"
          description="公开手记会在这里汇成交流空间。完成占卜后，可选择分享给同好回看。"
          action={(
            <div className="inline-flex min-h-10 items-center gap-2 rounded-full bg-forest-accent/6 px-4 text-sm font-medium text-forest-accent">
            <Sparkles size={14} />
            <span>成为第一个分享者</span>
            </div>
          )}
          className="sm:py-12"
        />
      ) : (
        <div className="space-y-3">
          {(isLoading || loadNotice) && (
            <p className="inline-flex rounded-full bg-white/34 px-3 py-1 text-[10px] font-medium text-forest-muted">
              {loadNotice || '正在更新广场手记…'}
            </p>
          )}
          <div className={publicGridClassName}>
          {visiblePublicReadings.map(reading => (
            <ReadingCard 
              key={reading.id} 
              reading={reading} 
              isPublicView 
              cardMetadata={cardMetadata}
              onTagClick={onTagClick}
              onAuthorClick={onAuthorClick}
              onProcessAi={onProcessAi}
            />
          ))}
          <div ref={sentinelRef} className="col-span-full h-1" aria-hidden />
          </div>
        </div>
      )}
      {hasMore && (
        <div className="flex justify-center py-2">
          <span className="rounded-full bg-white/24 px-3 py-1 text-[10px] font-medium text-forest-muted">
            正在继续展开广场手记…
          </span>
        </div>
      )}
    </motion.div>
  );
};
