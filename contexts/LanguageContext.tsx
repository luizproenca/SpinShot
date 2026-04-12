import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import translations, { SupportedLanguage, Translations } from '../constants/translations';

const STORAGE_KEY = '@spinshot:language';
const DEFAULT_LANG: SupportedLanguage = 'pt';

interface LanguageContextType {
  language: SupportedLanguage;
  t: Translations;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLangState] = useState<SupportedLanguage>(DEFAULT_LANG);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(stored => {
      if (stored === 'pt' || stored === 'en' || stored === 'es') {
        setLangState(stored);
      }
    });
  }, []);

  const setLanguage = useCallback(async (lang: SupportedLanguage) => {
    setLangState(lang);
    await AsyncStorage.setItem(STORAGE_KEY, lang);
  }, []);

  const t = translations[language] as Translations;

  return (
    <LanguageContext.Provider value={{ language, t, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export { LanguageContext };
