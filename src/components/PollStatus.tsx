"use client";

import { createContext, useContext, useMemo, useState } from "react";

export type PollStatus = "idle" | "live" | "offline";

const PollStatusContext = createContext<{
  status: PollStatus;
  setStatus: (status: PollStatus) => void;
} | null>(null);

export function PollStatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<PollStatus>("idle");
  const value = useMemo(() => ({ status, setStatus }), [status]);
  return <PollStatusContext.Provider value={value}>{children}</PollStatusContext.Provider>;
}

export function usePollStatus(): PollStatus {
  const value = useContext(PollStatusContext);
  if (!value) return "idle";
  return value.status;
}

export function useSetPollStatus(): (status: PollStatus) => void {
  const value = useContext(PollStatusContext);
  if (!value) return () => undefined;
  return value.setStatus;
}
