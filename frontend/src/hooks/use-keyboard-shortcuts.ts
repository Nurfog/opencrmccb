"use client";

import { useEffect, useCallback, useRef } from "react";

type KeyCombo = string;
type ShortcutHandler = (e: KeyboardEvent) => void;
type ShortcutMap = Record<KeyCombo, ShortcutHandler>;

function normalizeKey(key: string): string {
  return key.toLowerCase();
}

function parseCombo(combo: string): { ctrl: boolean; meta: boolean; alt: boolean; shift: boolean; key: string } {
  const parts = combo.split("+").map(normalizeKey);
  return {
    ctrl: parts.includes("ctrl"),
    meta: parts.includes("meta"),
    alt: parts.includes("alt"),
    shift: parts.includes("shift"),
    key: parts.filter((p) => !["ctrl", "meta", "alt", "shift"].includes(p)).join("+"),
  };
}

function matchCombo(e: KeyboardEvent, combo: string): boolean {
  const parsed = parseCombo(combo);
  const pressedKey = normalizeKey(e.key);

  const ctrlMatch = parsed.ctrl === e.ctrlKey;
  const metaMatch = parsed.meta === e.metaKey;
  const altMatch = parsed.alt === e.altKey;
  const shiftMatch = parsed.shift === e.shiftKey;

  if (!ctrlMatch || !metaMatch || !altMatch || !shiftMatch) return false;

  if (parsed.key === "escape" && pressedKey === "escape") return true;
  if (parsed.key === "enter" && pressedKey === "enter") return true;
  if (parsed.key === "tab" && pressedKey === "tab") return true;
  if (parsed.key === "space" && pressedKey === " ") return true;
  if (parsed.key === "delete" && (pressedKey === "delete" || pressedKey === "del")) return true;
  if (parsed.key === "backspace" && pressedKey === "backspace") return true;
  if (parsed.key === pressedKey) return true;
  if (parsed.key.length === 1 && pressedKey.length === 1) return true;

  return false;
}

export function useKeyboardShortcuts(
  shortcuts: ShortcutMap,
  options?: { enabled?: boolean; preventDefault?: boolean }
): void {
  const enabled = options?.enabled ?? true;
  const preventDefault = options?.preventDefault ?? true;
  const shortcutsRef = useRef<ShortcutMap>(shortcuts);

  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const source = e.target as HTMLElement;
      const tag = source.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        source.isContentEditable
      ) {
        const combo = Object.keys(shortcutsRef.current).find((combo) => {
          const lower = combo.toLowerCase();
          return (
            lower.includes("escape") ||
            lower.includes("enter") ||
            lower.includes("tab")
          );
        });
        if (!combo || !matchCombo(e, combo)) return;
      }

      for (const [combo, callback] of Object.entries(shortcutsRef.current)) {
        if (matchCombo(e, combo)) {
          if (preventDefault) {
            e.preventDefault();
            e.stopPropagation();
          }
          callback(e);
          return;
        }
      }
    },
    [enabled, preventDefault]
  );

  useEffect(() => {
    if (!enabled) return;
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [enabled, handler]);
}
