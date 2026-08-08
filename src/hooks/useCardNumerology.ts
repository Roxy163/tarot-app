import { useState, useEffect } from 'react';
import { TAROT_CARDS } from '../constants';
import { deleteNumerologySetting, getNumerologySetting, saveNumerologySetting } from '../lib/firebaseData';
import { readJsonRecordWithBackup, writeJsonWithBackup } from '../lib/safeLocalStorage';

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
    const loadNumerology = async () => {
      setLoading(true);
      if (isLoggedIn && userId) {
        try {
          const setting = await getNumerologySetting(userId, cardName);
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
          console.error('Error loading numerology:', error);
          setNumerology(defaultVal);
          setMeaning('');
          setKeywords('');
          setIsCustom(false);
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
      setLoading(false);
    };

    loadNumerology();
  }, [cardName, isLoggedIn, userId, defaultVal]);

  const saveNumerology = async (value: number, customMeaning: string, customKeywords: string) => {
    if (isLoggedIn && userId) {
      try {
        await saveNumerologySetting(userId, cardName, {
          numerology: value,
          meaning: customMeaning,
          keywords: customKeywords,
        });
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
      writeJsonWithBackup('tarot_user_numerology', parsed);
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
      } catch (error) {
        console.error('Error deleting numerology:', error);
        return false;
      }
    } else {
      const parsed = readJsonRecordWithBackup<LocalNumerologyMap>('tarot_user_numerology');
      if (parsed) {
        delete parsed[cardName];
        writeJsonWithBackup('tarot_user_numerology', parsed);
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
