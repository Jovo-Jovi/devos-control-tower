"use client";

import { useEffect } from "react";
import { confirmTarget } from "./confirm-target";

export function ConfirmRedirect() {
  useEffect(() => {
    window.location.replace(confirmTarget(window.location.search));
  }, []);
  return null;
}
