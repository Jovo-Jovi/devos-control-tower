"use client";

import { useEffect, useRef, useState } from "react";
import type { LinkState } from "@/lib/portfolio/aggregate";
import { SLOTS, slotGeometry } from "./geometry";
import styles from "./BladeField.module.css";

export type BladeModel = {
  slot: number;
  linkState: LinkState;
  dimmed?: "filter" | "panel";
};

export type BladeSignal = {
  slot: number;
  order: number;
};

const SOLID = new Set<LinkState>(["active", "steady", "revise"]);

function particleCount(state: LinkState): number {
  if (state === "active") return 3;
  if (state === "steady") return 2;
  if (state === "revise" || state === "waiting") return 1;
  return 0;
}

let ignitedOnce = false;

export function BladeField({
  blades,
  live,
  offline,
  signals,
}: {
  blades: BladeModel[];
  live: boolean;
  offline: boolean;
  signals: BladeSignal[];
}) {
  const [ignite, setIgnite] = useState<Record<number, number>>({});
  const previous = useRef<Record<number, LinkState>>({});

  useEffect(() => {
    const next: Record<number, number> = {};
    let play = false;
    for (const blade of blades) {
      const was = previous.current[blade.slot];
      const isSolid = SOLID.has(blade.linkState);
      const becameSolid = isSolid && was !== undefined && !SOLID.has(was);
      if (isSolid && (!ignitedOnce || becameSolid)) {
        next[blade.slot] = (ignite[blade.slot] ?? 0) + 1;
        play = true;
      }
      previous.current[blade.slot] = blade.linkState;
    }
    if (!play) return;
    ignitedOnce = true;
    const id = window.requestAnimationFrame(() => {
      setIgnite((current) => ({ ...current, ...next }));
    });
    return () => window.cancelAnimationFrame(id);
  }, [blades, ignite]);

  const bySlot = new Map(blades.map((blade) => [blade.slot, blade]));

  return (
    <svg className={styles.field} viewBox="0 0 1200 660" aria-hidden="true" data-offline={offline ? "" : undefined}>
      <defs>
        <filter id="blade-glow" x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      {SLOTS.map((slot) => {
        const blade = bySlot.get(slot.slot);
        if (!blade) return null;
        const geometry = slotGeometry(slot.slot);
        const solid = SOLID.has(blade.linkState);
        const signal = signals.find((item) => item.slot === slot.slot);
        const particles = live && !offline ? particleCount(blade.linkState) : 0;
        return (
          <g
            key={slot.slot}
            className={styles.blade}
            data-link-state={blade.linkState}
            data-dimmed={blade.dimmed}
            data-slot={slot.slot}
          >
            {solid || blade.linkState === "waiting" || blade.linkState === "gate" ? (
              <path
                className={
                  blade.linkState === "waiting" ? styles.pulse : solid ? styles.hum : styles.glow
                }
                d={geometry.d}
                fill="none"
                strokeLinecap="round"
                filter="url(#blade-glow)"
                data-link-state={blade.linkState}
              />
            ) : null}
            <path
              key={ignite[slot.slot] ?? 0}
              className={styles.edge}
              d={geometry.d}
              fill="none"
              strokeLinecap="round"
              data-link-state={blade.linkState}
              data-ignite={solid && ignite[slot.slot] ? "" : undefined}
            />
            {solid ? (
              <path
                key={`core-${ignite[slot.slot] ?? 0}`}
                className={styles.core}
                d={geometry.d}
                fill="none"
                strokeLinecap="round"
                data-ignite={ignite[slot.slot] ? "" : undefined}
              />
            ) : null}
            {Array.from({ length: particles }, (_item, index) => (
              <circle
                key={index}
                className={`${styles.particle} ${styles[`slot${slot.slot}`] ?? ""}`}
                data-kind={blade.linkState}
                data-index={index}
                r="2.3"
              />
            ))}
            {signal && live && !offline ? (
              <circle
                className={`${styles.signal} ${styles[`slot${slot.slot}`] ?? ""}`}
                data-signal=""
                data-order={signal.order}
                r="4.4"
              />
            ) : null}
            <circle
              className={styles.port}
              data-link-state={blade.linkState}
              cx={geometry.portX}
              cy={geometry.portY}
              r="3.6"
            />
          </g>
        );
      })}
    </svg>
  );
}
