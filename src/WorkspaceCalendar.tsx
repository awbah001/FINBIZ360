import { useEffect, useId, useState } from "react";
import {
  CaretLeft as ChevronLeft,
  CaretRight as ChevronRight,
} from "@phosphor-icons/react";

const iso = (date: Date) => date.toISOString().slice(0, 10);
const dateOf = (value: string) => new Date(`${value}T00:00:00Z`);
const shift = (value: string, days: number) => {
  const date = dateOf(value);
  date.setUTCDate(date.getUTCDate() + days);
  return iso(date);
};
export function calendarDays(anchor: string, mode: "month" | "week") {
  const date = dateOf(anchor);
  const year = date.getUTCFullYear(),
    month = date.getUTCMonth();
  const first = mode === "month" ? new Date(Date.UTC(year, month, 1)) : date;
  const offset = (first.getUTCDay() + 6) % 7;
  const start = shift(iso(first), -offset);
  const total =
    mode === "week"
      ? 7
      : Math.ceil(
          (offset + new Date(Date.UTC(year, month + 1, 0)).getUTCDate()) / 7,
        ) * 7;
  return Array.from({ length: total }, (_, index) => shift(start, index));
}
export function calendarToday() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Freetown",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (name: string) =>
    parts.find((item) => item.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export default function WorkspaceCalendar({
  selected = "",
  from = "",
  to = "",
  onSelect,
}: {
  selected?: string;
  from?: string;
  to?: string;
  onSelect?: (date: string) => void;
}) {
  const today = calendarToday();
  const [anchor, setAnchor] = useState(selected || today);
  const [mode, setMode] = useState<"month" | "week">("month");
  const heading = useId();
  useEffect(() => {
    if (selected) setAnchor(selected);
  }, [selected]);
  const dates = calendarDays(anchor, mode);
  const month = anchor.slice(0, 7);
  const move = (direction: number) => {
    if (mode === "week") return setAnchor(shift(anchor, direction * 7));
    const date = dateOf(anchor);
    setAnchor(
      iso(
        new Date(
          Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + direction, 1),
        ),
      ),
    );
  };
  const label = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(dateOf(anchor));
  return (
    <section className="workspace-calendar" aria-label="Workspace calendar">
      <div className="calendar-heading">
        <strong>Calendar</strong>
        <div className="calendar-view-toggle" aria-label="Calendar view">
          <button
            type="button"
            aria-pressed={mode === "week"}
            onClick={() => setMode("week")}
          >
            Week
          </button>
          <button
            type="button"
            aria-pressed={mode === "month"}
            onClick={() => setMode("month")}
          >
            Month
          </button>
        </div>
      </div>
      <div className="calendar-month-navigation">
        <button
          type="button"
          className="icon-button"
          aria-label={`Previous ${mode}`}
          onClick={() => move(-1)}
        >
          <ChevronLeft size={16} aria-hidden="true" focusable="false" />
        </button>
        <strong id={heading} aria-live="polite">
          {label}
        </strong>
        <button
          type="button"
          className="icon-button"
          aria-label={`Next ${mode}`}
          onClick={() => move(1)}
        >
          <ChevronRight size={16} aria-hidden="true" focusable="false" />
        </button>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">
        {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
          <span key={i}>{day}</span>
        ))}
      </div>
      <div
        className="calendar-date-grid"
        role="group"
        aria-labelledby={heading}
      >
        {dates.map((day) => {
          const range = !!from && day >= from && day <= (to || from);
          const className = `calendar-day ${day.slice(0, 7) !== month && mode === "month" ? "is-adjacent" : ""} ${day === today ? "is-today" : ""} ${range ? "is-in-range" : ""}`;
          const dayLabel = new Intl.DateTimeFormat("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(dateOf(day));
          return onSelect ? (
            <button
              key={day}
              className={className}
              type="button"
              aria-label={dayLabel}
              aria-pressed={range}
              aria-current={day === today ? "date" : undefined}
              onClick={() => onSelect(day)}
            >
              {Number(day.slice(-2))}
            </button>
          ) : (
            <span
              key={day}
              className={className}
              aria-label={dayLabel}
              aria-current={day === today ? "date" : undefined}
            >
              {Number(day.slice(-2))}
            </span>
          );
        })}
      </div>
      <div className="calendar-footer">
        <span>
          {onSelect
            ? "Select a day to filter saved records."
            : "Africa/Freetown calendar"}
        </span>
        <button
          type="button"
          className="button secondary small"
          onClick={() => setAnchor(today)}
        >
          Today
        </button>
      </div>
    </section>
  );
}
