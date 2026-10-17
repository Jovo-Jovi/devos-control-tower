export const locales = ["en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

const directionByLocale: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
};

export function directionOf(locale: Locale): "ltr" | "rtl" {
  return directionByLocale[locale];
}
