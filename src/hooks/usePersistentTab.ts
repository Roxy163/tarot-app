import { useEffect, useState } from 'react';

export const usePersistentTab = <T extends string>(
  storageKey: string,
  fallbackTab: T,
  isValidTab: (value: string | null) => value is T,
) => {
  const [activeTab, setActiveTab] = useState<T>(() => {
    const saved = localStorage.getItem(storageKey);
    return isValidTab(saved) ? saved : fallbackTab;
  });

  useEffect(() => {
    localStorage.setItem(storageKey, activeTab);
  }, [activeTab, storageKey]);

  return [activeTab, setActiveTab] as const;
};
