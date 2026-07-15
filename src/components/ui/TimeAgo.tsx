"use client";

import { useEffect, useState } from "react";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function label(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const diff = then - Date.now();
  const ago = Math.abs(diff);

  if (ago < MINUTE) return "just now";
  if (ago < HOUR) return relative.format(Math.round(diff / MINUTE), "minute");
  if (ago < DAY) return relative.format(Math.round(diff / HOUR), "hour");
  if (ago < WEEK) return relative.format(Math.round(diff / DAY), "day");

  // Past a week, a calendar date reads better than "5 weeks ago".
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Renders a timestamp relative to now ("2 hours ago").
 *
 * Both the text and the tooltip stay empty on the server and through the first
 * client render, then the effect fills them in. That's deliberate: each depends
 * on the reader's clock and timezone, neither of which the server shares, so
 * rendering them during SSR would mismatch on hydration for every row.
 */
export function TimeAgo({
  iso,
  prefix,
  className,
}: {
  iso: string;
  prefix?: string;
  className?: string;
}) {
  const [{ text, title }, setState] = useState({ text: "", title: "" });

  useEffect(() => {
    const update = () =>
      setState({ text: label(iso), title: new Date(iso).toLocaleString() });
    update();
    // Keep "just now" from going stale while the tab sits open.
    const timer = setInterval(update, MINUTE);
    return () => clearInterval(timer);
  }, [iso]);

  return (
    <time dateTime={iso} title={title || undefined} className={className}>
      {text && prefix ? `${prefix} ${text}` : text}
    </time>
  );
}
