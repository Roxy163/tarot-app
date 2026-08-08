import { useEffect, useState } from 'react';

export const usePersistentTab = <T extends string>(
  storageKey: string,
  fallbackTab: T,
  isValidTab: (value: string | null) => value is T,
) => {
  const [activeTab, setActiveTab] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return isValidTab(saved) ? saved : fallbackTab;
    } catch {
      return fallbackTab;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, activeTab);
    } catch {
      // 存储不可用时只影响“记住上次页面”，不影响当前使用。
    }
  }, [activeTab, storageKey]);

  return [activeTab, setActiveTab] as const;
};
