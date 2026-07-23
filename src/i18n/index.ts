import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./en.json";
import ro from "./ro.json";

export const SUPPORTED_LANGS = [
  { code: "en", label: "English" },
  { code: "ro", label: "Română" },
] as const;

export type LangCode = (typeof SUPPORTED_LANGS)[number]["code"];

if (!i18n.isInitialized) {
  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        ro: { translation: ro },
      },
      fallbackLng: "en",
      supportedLngs: ["en", "ro"],
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator"],
        lookupLocalStorage: "ember:lang",
        caches: ["localStorage"],
      },
    });
}

export default i18n;
