"use client";

import { useEffect } from "react";

export function SceneRuntime() {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-scene-ready", "");

    const sync = () => {
      if (document.visibilityState === "hidden") root.setAttribute("data-scene-paused", "");
      else root.removeAttribute("data-scene-paused");
    };

    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  return null;
}
