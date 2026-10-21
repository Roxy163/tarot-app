import { useState, useEffect } from 'react';
import { TAROT_CARDS } from '../constants';
import { deleteNumerologySetting, getNumerologySetting, saveNumerologySetting } from '../lib/firebaseData';
import { readJsonRecordWithBackup, writeJsonWithBackup } from '../lib/safeLocalStorage';
import { cacheNumerologySetting, clearRestoredNumerology, getLocalBackupNumerology, NUMEROLOGY_RESTORED, readRestoredNumerology } from '../lib/backupNumerology';

type LocalNumerologyValue = number | {
  numerology: number;
  meaning?: string;
  keywords?: string;
};

type LocalNumerologyMap = Record<string, LocalNumerologyValue>;

export function useCardNumerology(cardName: string, isLoggedIn: boolean, userId?: string) {
  const [numerology, setNumerology] = useState<number | null>(null);
  const [meaning, setMeaning] = useState<string>('');
  const [keywords, setKeywords] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(true);

  const cardMeta = TAROT_CARDS.find(c => c.name === cardName);
  const defaultVal = cardMeta ? cardMeta.default_numerology : 1;

  useEffect(() => {
    let active = true;
    let request = 0;
    const loadNumerology = async () => {
      const ticket = ++request;
      setLoading(true);
      if (isLoggedIn && userId) {
        try {
          const setting = readRestoredNumerology(userId)[cardName] || await getNumerologySetting(userId, cardName);
          if (!active || ticket !== request) return;
          cacheNumerologySetting(userId, cardName, setting);
          if (setting) {
            setNumerology(setting.numerology);
            setMeaning(setting.meaning || '');
            setKeywords(setting.keywords || '');
            setIsCustom(true);
          } else {
            setNumerology(defaultVal);
            setMeaning('');
            setKeywords('');
            setIsCustom(false);
          }
        } catch (error) {
          if (!active || ticket !== request) return;
          console.error('Error loading numerology:', error);
          const cached = getLocalBackupNumerology(userId)[cardName];
          setNumerology(cached?.numerology ?? defaultVal);
          setMeaning(cached?.meaning || '');
          setKeywords(cached?.keywords || '');
          setIsCustom(Boolean(cached));
        }
      } else {
        const parsed = readJsonRecordWithBackup<LocalNumerologyMap>('tarot_user_numerology');
        if (parsed?.[cardName] !== undefined) {
          const item = parsed[cardName];
          if (typeof item === 'number') {
            setNumerology(item);
            setMeaning('');
            setKeywords('');
          } else if (typeof item === 'object' && item !== null) {
            setNumerology(item.numerology);
            setMeaning(item.meaning || '');
            setKeywords(item.keywords || '');
          } else {
            setNumerology(defaultVal);
            setMeaning('');
            setKeywords('');
          }
          setIsCustom(true);
        } else {
          setNumerology(defaultVal);
          setMeaning('');
          setKeywords('');
          setIsCustom(false);
        }
      }
      if (active && ticket === request) setLoading(false);
    };

    loadNumerology();
    window.addEventListener(NUMEROLOGY_RESTORED, loadNumerology);
    return () => { active = false; window.removeEventListener(NUMEROLOGY_RESTORED, loadNumerology); };
  }, [cardName, isLoggedIn, userId, defaultVal]);

  const saveNumerology = async (value: number, customMeaning: string, customKeywords: string) => {
    if (isLoggedIn && userId) {
      try {
        await saveNumerologySetting(userId, cardName, {
          numerology: value,
          meaning: customMeaning,
          keywords: customKeywords,
        });
        if (!cacheNumerologySetting(userId, cardName, { numerology: value, meaning: customMeaning, keywords: customKeywords }).ok) return false;
        clearRestoredNumerology(userId, cardName);
      } catch (error) {
        console.error('Error saving numerology:', error);
        return false;
      }
    } else {
      const parsed = readJsonRecordWithBackup<LocalNumerologyMap>('tarot_user_numerology') || {};
      parsed[cardName] = {
        numerology: value,
        meaning: customMeaning,
        keywords: customKeywords
      };
      if (!writeJsonWithBackup('tarot_user_numerology', parsed).ok) return false;
    }
    setNumerology(value);
    setMeaning(customMeaning);
    setKeywords(customKeywords);
    setIsCustom(true);
    return true;
  };

  const restoreDefault = async () => {
    if (isLoggedIn && userId) {
      try {
        await deleteNumerologySetting(userId, cardName);
        if (!cacheNumerologySetting(userId, cardName, null).ok) return false;
        clearRestoredNumerology(userId, cardName);
      } catch (error) {
        console.error('Error deleting numerology:', error);
        return false;
      }
    } else {
      const parsed = readJsonRecordWithBackup<LocalNumerologyMap>('tarot_user_numerology');
      if (parsed) {
        delete parsed[cardName];
        if (!writeJsonWithBackup('tarot_user_numerology', parsed).ok) return false;
      }
    }
    setNumerology(defaultVal);
    setMeaning('');
    setKeywords('');
    setIsCustom(false);
    return true;
  };

  return { numerology, meaning, keywords, isCustom, loading, saveNumerology, restoreDefault };
}
