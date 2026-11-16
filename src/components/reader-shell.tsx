"use client";

import { useEffect, useRef, useState } from "react";
import { Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveReadingProgress } from "@/actions/reading";
import type { ReadingStatus } from "@/db/schema";

const STORAGE_KEY = "blippy.reader";
const SAVE_DELAY_MS = 800;

const sizes = [
  ["sm", "Small"],
  ["md", "Medium"],
  ["lg", "Large"],
  ["xl", "Extra large"],
] as const;
const widths = [
  ["narrow", "Narrow"],
  ["medium", "Medium"],
  ["wide", "Wide"],
] as const;
const themes = [
  ["auto", "Match app"],
  ["light", "Light"],
  ["sepia", "Sepia"],
  ["dark", "Dark"],
] as const;

type Settings = {
  size: (typeof sizes)[number][0];
  width: (typeof widths)[number][0];
  theme: (typeof themes)[number][0];
};
const DEFAULTS: Settings = { size: "md", width: "medium", theme: "auto" };

function readSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return {
      size: sizes.some(([v]) => v === raw.size) ? raw.size : DEFAULTS.size,
      width: widths.some(([v]) => v === raw.width) ? raw.width : DEFAULTS.width,
      theme: themes.some(([v]) => v === raw.theme) ? raw.theme : DEFAULTS.theme,
    };
  } catch {
    return DEFAULTS;
  }
}

function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground w-12 text-xs">{label}</span>
      {options.map(([v, text]) => (
        <Button
          key={v}
          type="button"
          size="sm"
          variant={value === v ? "default" : "outline"}
          aria-pressed={value === v}
          onClick={() => onChange(v)}
        >
          {text}
        </Button>
      ))}
    </div>
  );
}

/**
 * Wraps the reader page: display settings (size, width, theme; kept in this
 * browser) and scroll position (saved to the item, restored on reopen). The
 * app scrolls inside <main>, so progress is measured on that element.
 */
export function ReaderShell({
  itemId,
  status,
  initialPct,
  children,
}: {
  itemId: string;
  status: ReadingStatus;
  initialPct: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [panelOpen, setPanelOpen] = useState(false);
  const tracking = status === "unread" || status === "reading";

  useEffect(() => {
    // localStorage is only readable on the client, so settings load after the first paint.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(readSettings());
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // private mode: the setting just lasts for this visit
    }
  }

  useEffect(() => {
    const scroller = ref.current?.closest("main");
    if (!scroller || !tracking) return;
    const el: HTMLElement = scroller;
    const range = () => Math.max(1, el.scrollHeight - el.clientHeight);

    // Restore after layout settles (images load and shift the page); stop as soon as the reader scrolls.
    let interacted = false;
    const stop = () => {
      interacted = true;
    };
    const events = ["wheel", "touchstart", "keydown", "mousedown"] as const;
    events.forEach((e) => el.addEventListener(e, stop, { passive: true }));
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (initialPct > 0) {
      for (const delay of [0, 300, 900, 2000]) {
        timers.push(
          setTimeout(() => {
            if (!interacted) el.scrollTop = initialPct * range();
          }, delay)
        );
      }
    }

    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    let lastSent = initialPct;
    const flush = () => {
      const pct = Math.min(1, el.scrollTop / range());
      if (!interacted || Math.abs(pct - lastSent) < 0.005) return;
      lastSent = pct;
      void saveReadingProgress(itemId, pct);
    };
    const onScroll = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(flush, SAVE_DELAY_MS);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);

    return () => {
      clearTimeout(saveTimer);
      timers.forEach(clearTimeout);
      flush();
      el.removeEventListener("scroll", onScroll);
      events.forEach((e) => el.removeEventListener(e, stop));
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [itemId, tracking, initialPct]);

  return (
    <div
      ref={ref}
      className="reader-shell"
      data-size={settings.size}
      data-width={settings.width}
      data-theme={settings.theme}
    >
      <div className="mb-4 flex flex-col items-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen((o) => !o)}
        >
          <Type className="size-4" />
          Display
        </Button>
        {panelOpen && (
          <div className="bg-card w-full space-y-2 rounded-lg border p-3 sm:w-auto">
            <Choice label="Text" options={sizes} value={settings.size} onChange={(v) => update("size", v)} />
            <Choice label="Width" options={widths} value={settings.width} onChange={(v) => update("width", v)} />
            <Choice label="Theme" options={themes} value={settings.theme} onChange={(v) => update("theme", v)} />
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
