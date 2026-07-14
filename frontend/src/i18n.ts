import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import translationEN from './locales/en/translation.json';
import translationES from './locales/es/translation.json';
import translationFR from './locales/fr/translation.json';
import translationPT from './locales/pt/translation.json';

const resources = {
  en: { translation: translationEN },
  es: { translation: translationES },
  fr: { translation: translationFR },
  pt: { translation: translationPT },
};

export const supportedLngs = ['en', 'es', 'fr', 'pt'] as const;
export type SupportedLanguage = (typeof supportedLngs)[number];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs,
    debug: process.env.NODE_ENV !== 'production',
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'nova-verify-language',
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
