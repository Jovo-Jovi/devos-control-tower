"use client";

import { useSyncExternalStore } from "react";
import styles from "./ThemeSwitch.module.css";

type ThemeChoice = "auto" | "light" | "dark";

const choices: ThemeChoice[] = ["auto", "light", "dark"];

function subscribe(onStoreChange: () => void): () => void {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function readTheme(): ThemeChoice {
  const value = document.documentElement.getAttribute("data-theme");
  if (value === "light" || value === "dark") return value;
  return "auto";
}

function serverTheme(): ThemeChoice {
  return "auto";
}

function applyTheme(theme: ThemeChoice): void {
  const root = document.documentElement;
  if (theme === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export function ThemeSwitch({
  label,
  auto,
  light,
  dark,
}: {
  label: string;
  auto: string;
  light: string;
  dark: string;
}) {
  const theme = useSyncExternalStore(subscribe, readTheme, serverTheme);
  const labels: Record<ThemeChoice, string> = { auto, light, dark };

  return (
    <div role="group" aria-label={label} className={styles.group} data-pressed={theme}>
      <span className={styles.wash} aria-hidden="true" />
      {choices.map((choice) => (
        <button
          key={choice}
          type="button"
          className={styles.option}
          data-theme-option={choice}
          aria-pressed={theme === choice}
          onClick={() => applyTheme(choice)}
        >
          {labels[choice]}
        </button>
      ))}
    </div>
  );
}
