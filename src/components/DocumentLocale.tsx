"use client";

import { useEffect } from "react";
import { defaultLocale, directionOf } from "@/i18n/config";

export function DocumentLocale() {
  useEffect(() => {
    document.documentElement.lang = defaultLocale;
    document.documentElement.dir = directionOf(defaultLocale);
  }, []);
  return null;
}
