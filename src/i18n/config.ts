import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import bg from './locales/bg.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      bg: { translation: bg }
    },
    lng: 'bg', // Bulgarian as default for Bulgarian market
    fallbackLng: 'bg',
    interpolation: {
      escapeValue: false // React already escapes
    },
    detection: {
      // Only check localStorage (user preference) and querystring, ignore browser language
      order: ['querystring', 'localStorage'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage']
    }
  });

export default i18n;
