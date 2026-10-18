import { defaultLocale } from "@/i18n/config";

const countFormat = new Intl.NumberFormat(defaultLocale);

export function formatCount(value: number): string {
  return countFormat.format(value);
}
