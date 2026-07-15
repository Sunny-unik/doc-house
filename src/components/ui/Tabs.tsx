"use client";

import { useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export type TabItem = {
  id: string;
  label: string;
  content: React.ReactNode;
};

/**
 * Tabbed panels following the ARIA tabs pattern.
 *
 * Two details that matter:
 * - Roving tabindex: only the selected tab is in the Tab order, and Left/Right
 *   move between them. That's the expected behaviour for a tablist — arrowing,
 *   not tabbing, is how you change tabs.
 * - Inactive panels stay mounted and are hidden. Version history fetches on
 *   mount and the assistant holds its last result; unmounting would throw both
 *   away every time you switched tab.
 */
export function Tabs({ tabs, label }: { tabs: TabItem[]; label: string }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const baseId = useId();
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});

  const tabId = (id: string) => `${baseId}-tab-${id}`;
  const panelId = (id: string) => `${baseId}-panel-${id}`;

  function onKeyDown(event: React.KeyboardEvent) {
    const current = tabs.findIndex((t) => t.id === active);
    let next: number;

    switch (event.key) {
      case "ArrowRight":
        next = (current + 1) % tabs.length;
        break;
      case "ArrowLeft":
        next = (current - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = tabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const id = tabs[next].id;
    setActive(id);
    buttons.current[id]?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex flex-wrap gap-1 border-b border-line"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                buttons.current[tab.id] = el;
              }}
              type="button"
              role="tab"
              id={tabId(tab.id)}
              aria-controls={panelId(tab.id)}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.id)}
              className={cn(
                "-mb-px rounded-t-lg border-b-2 px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
                selected
                  ? "border-accent text-text"
                  : "border-transparent text-text-muted hover:text-text",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={panelId(tab.id)}
          aria-labelledby={tabId(tab.id)}
          hidden={tab.id !== active}
          tabIndex={0}
          className="pt-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
