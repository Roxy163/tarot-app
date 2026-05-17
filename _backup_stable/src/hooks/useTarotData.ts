import { useState, useEffect, useMemo } from 'react';
import { TarotReading, SpreadDefinition } from '../types';
import { INITIAL_READINGS } from '../constants';
import { extractKeywords, recognizeCards } from '../services/geminiService';

export function useTarotData() {
  const [spreads, setSpreads] = useState<SpreadDefinition[]>(() => {
    const saved = localStorage.getItem('tarot_spreads');
    const initialSpreads: SpreadDefinition[] = [
      { name: '单牌阵', layout: 'horizontal', slots: ['主牌'], slotPositions: ['col-start-3 row-start-2'] },
      { name: '无牌阵三张', layout: 'horizontal', slots: ['第一张', '第二张', '第三张'], slotPositions: ['col-start-2 row-start-2', 'col-start-3 row-start-2', 'col-start-4 row-start-2'] },
      { name: '时间流牌阵', layout: 'horizontal', slots: ['过去', '现在', '未来'], slotPositions: ['col-start-2 row-start-2', 'col-start-3 row-start-2', 'col-start-4 row-start-2'] },
      { 
        name: '圣三角牌阵', 
        layout: 'triangle', 
        slots: ['现状/行动', '阻碍/情感', '结果/灵性'],
        slotPositions: ['col-start-3 row-start-2', 'col-start-2 row-start-1', 'col-start-4 row-start-1']
      },
      { 
        name: '选择牌阵', 
        layout: 'choice', 
        slots: ['现状', '选项A-1', '选项B-1', '选项A-2', '选项B-2'],
        slotPositions: ['col-start-3 row-start-3', 'col-start-2 row-start-2', 'col-start-4 row-start-2', 'col-start-1 row-start-1', 'col-start-5 row-start-1']
      },
      { 
        name: '十字牌阵', 
        layout: 'cross', 
        slots: ['中心', '左侧', '右侧', '上方', '下方'],
        slotPositions: ['col-start-3 row-start-2', 'col-start-2 row-start-2', 'col-start-4 row-start-2', 'col-start-3 row-start-1', 'col-start-3 row-start-3']
      },
      { 
        name: '四季牌阵', 
        layout: 'seasons', 
        slots: ['大牌（核心课题）', '权杖牌组（火）', '星币牌组（土）', '宝剑牌组（风）', '圣杯牌组（水）'],
        slotPositions: ['col-start-3 row-start-2', 'col-start-3 row-start-1', 'col-start-4 row-start-2', 'col-start-3 row-start-3', 'col-start-2 row-start-2']
      },
      { 
        name: '凯尔特十字牌阵', 
        layout: 'celtic', 
        slots: ['现状', '挑战', '目标', '基础', '过去', '未来', '自我', '环境', '希望/恐惧', '结果'],
        slotPositions: [
          'col-start-2 row-start-2', 'col-start-2 row-start-2', 'col-start-2 row-start-1', 'col-start-2 row-start-3', 
          'col-start-1 row-start-2', 'col-start-3 row-start-2', 'col-start-5 row-start-4', 'col-start-5 row-start-3', 
          'col-start-5 row-start-2', 'col-start-5 row-start-1'
        ]
      }
    ];

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const officialNames = initialSpreads.map(s => s.name);
        const customSpreads = parsed.filter((s: any) => !officialNames.includes(s.name));
        return [...initialSpreads, ...customSpreads];
      } catch (e) { /* Fallback */ }
    }
    return initialSpreads;
  });

  const [readings, setReadings] = useState<TarotReading[]>(() => {
    const saved = localStorage.getItem('tarot_readings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((r: any) => ({
          ...r,
          cards: Array.isArray(r.cards) && typeof r.cards[0] === 'string' 
            ? r.cards.map((c: string) => ({ name: c, isReversed: false }))
            : r.cards
        }));
      } catch (e) { return INITIAL_READINGS; }
    }
    return INITIAL_READINGS;
  });

  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => { localStorage.setItem('tarot_readings', JSON.stringify(readings)); }, [readings]);
  useEffect(() => { localStorage.setItem('tarot_spreads', JSON.stringify(spreads)); }, [spreads]);

  const handleAddReading = async (newReading: any) => {
    setIsProcessing(true);
    try {
      let recognizedCards = newReading.cards || [];
      if (recognizedCards.length === 0 && newReading.cardInput) {
        recognizedCards = await recognizeCards(newReading.cardInput);
      }
      const fullText = `${newReading.interpretation.singleCard} ${newReading.interpretation.combination} ${newReading.interpretation.summary}`;
      const keywords = await extractKeywords(fullText);
      
      const reading: TarotReading = {
        id: Math.random().toString(36).substr(2, 9),
        userId: 'user1',
        date: new Date().toISOString(),
        ...newReading,
        cards: recognizedCards,
        keywords,
        authorName: '研习阁主'
      };
      setReadings([reading, ...readings]);
      return true;
    } catch (error) {
      console.error("Error adding reading:", error);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const togglePublic = (id: string) => {
    setReadings(readings.map(r => r.id === id ? { ...r, isPublic: !r.isPublic } : r));
  };

  return {
    spreads,
    setSpreads,
    readings,
    setReadings,
    isProcessing,
    handleAddReading,
    togglePublic
  };
}
