import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadAppLocale, saveAppLocale } from '../i18n/appLocale';
import { t as translate, type AppLocale, type TStringKey } from '../i18n/strings';

interface LocaleContextValue {
  locale: AppLocale;
  setLocale: (next: AppLocale) => void;
  t: (key: TStringKey) => string;
  ready: boolean;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>('ru');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadAppLocale().then(l => {
      setLocaleState(l);
      setReady(true);
    });
  }, []);

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next);
    void saveAppLocale(next);
  }, []);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: (key: TStringKey) => translate(locale, key),
      ready,
    }),
    [locale, setLocale, ready],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}
