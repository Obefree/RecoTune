import React, { createContext, useContext, useMemo, useState } from 'react';

type TabBarVisibilityValue = {
  tabBarHidden: boolean;
  setTabBarHidden: (v: boolean) => void;
  /** Media tab segment bar (ЗАПИСЬ / ПЛЕЕР / ВИДЕО) — hide during video fullscreen */
  mediaSegHidden: boolean;
  setMediaSegHidden: (v: boolean) => void;
};

const TabBarVisibilityContext = createContext<TabBarVisibilityValue | null>(null);

export function TabBarVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [tabBarHidden, setTabBarHidden] = useState(false);
  const [mediaSegHidden, setMediaSegHidden] = useState(false);
  const value = useMemo(
    () => ({ tabBarHidden, setTabBarHidden, mediaSegHidden, setMediaSegHidden }),
    [tabBarHidden, mediaSegHidden],
  );
  return <TabBarVisibilityContext.Provider value={value}>{children}</TabBarVisibilityContext.Provider>;
}

export function useTabBarVisibility() {
  const ctx = useContext(TabBarVisibilityContext);
  if (!ctx) {
    throw new Error('useTabBarVisibility must be used within TabBarVisibilityProvider');
  }
  return ctx;
}
