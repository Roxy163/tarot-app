import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TAROT_CARDS } from '../constants';

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
        const { data, error } = await supabase
          .from('user_numerology_settings')
          .select('custom_numerology, custom_meaning, custom_keywords')
          .eq('user_id', userId)
          .eq('card_name', cardName)
          .single();

        if (data) {
          setNumerology(data.custom_numerology);
          setMeaning(data.custom_meaning || '');
          setKeywords(data.custom_keywords || '');
          setIsCustom(true);
        } else {
          setNumerology(defaultVal);
          setMeaning('');
          setKeywords('');
          setIsCustom(false);
        }
      } else {
        const saved = localStorage.getItem('tarot_user_numerology');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed[cardName] !== undefined) {
              const item = parsed[cardName];
              if (typeof item === 'object') {
                setNumerology(item.numerology);
                setMeaning(item.meaning || '');
                setKeywords(item.keywords || '');
              } else {
                setNumerology(item);
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
          } catch (e) {
            setNumerology(defaultVal);
            setMeaning('');
            setKeywords('');
            setIsCustom(false);
          }
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
      const { error } = await supabase
        .from('user_numerology_settings')
        .upsert({
          user_id: userId,
          card_name: cardName,
          custom_numerology: value,
          custom_meaning: customMeaning,
          custom_keywords: customKeywords
        }, { onConflict: 'user_id,card_name' });
      
      if (error) {
        console.error('Error saving numerology:', error);
        return false;
      }
    } else {
      const saved = localStorage.getItem('tarot_user_numerology') || '{}';
      const parsed = JSON.parse(saved);
      parsed[cardName] = {
        numerology: value,
        meaning: customMeaning,
        keywords: customKeywords
      };
      localStorage.setItem('tarot_user_numerology', JSON.stringify(parsed));
    }
    setNumerology(value);
    setMeaning(customMeaning);
    setKeywords(customKeywords);
    setIsCustom(true);
    return true;
  };

  const restoreDefault = async () => {
    if (isLoggedIn && userId) {
      const { error } = await supabase
        .from('user_numerology_settings')
        .delete()
        .eq('user_id', userId)
        .eq('card_name', cardName);
      
      if (error) {
        console.error('Error deleting numerology:', error);
        return false;
      }
    } else {
      const saved = localStorage.getItem('tarot_user_numerology');
      if (saved) {
        const parsed = JSON.parse(saved);
        delete parsed[cardName];
        localStorage.setItem('tarot_user_numerology', JSON.stringify(parsed));
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
