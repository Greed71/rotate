import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en.json";
import it from "../locales/it.json";

export const LOCALE_STORAGE_KEY = "rotate.locale";

function detectLng(): string {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved === "it" || saved === "en") return saved;
  } catch {
    /* private mode */
  }
  if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("it")) {
    return "it";
  }
  return "en";
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    it: { translation: it },
  },
  lng: detectLng(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lng) => {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng;
  }
  try {
    if (lng === "it" || lng === "en") {
      localStorage.setItem(LOCALE_STORAGE_KEY, lng);
    }
  } catch {
    /* ignore */
  }
});

if (typeof document !== "undefined") {
  document.documentElement.lang = i18n.language;
}

export { i18n };
