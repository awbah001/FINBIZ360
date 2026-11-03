import { useId, useState } from "react";

export type MatchingRecord = {
  id: string;
  account_id: string;
  account_name: string;
  date: string;
  reference?: string;
  description?: string;
  amount: string;
  remaining_minor?: string;
  direction: string;
};

export function selectedSummary(rows: MatchingRecord[], ids: string[]) {
  const selected = rows.filter((row) => ids.includes(row.id));
  return {
    count: selected.length,
    accounts: [...new Set(selected.map((row) => row.account_id))],
    total: selected.reduce(
      (sum, row) =>
        sum +
        BigInt(row.remaining_minor ?? row.amount) *
          (row.direction === "out" ? -1n : 1n),
      0n,
    ),
  };
}

export default function RecordPicker({
  name,
  title,
  rows,
  selected,
  onSelect,
  limit,
  money,
}: {
  name: string;
  title: string;
  rows: MatchingRecord[];
  selected: string[];
  onSelect: (ids: string[]) => void;
  limit: number;
  money: (amount: string) => string;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const visible = rows.filter((row) =>
    `${row.account_name} ${row.reference || ""} ${row.description || ""} ${row.date}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <fieldset className="record-picker">
      <legend>{title}</legend>
      <label htmlFor={id}>Search account, reference or date</label>
      <input
        id={id}
        type="search"
        placeholder="Find records to compare"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <p className="field-help" aria-live="polite">
        {selected.length} of {limit} selected · {visible.length} results
      </p>
      <div className="record-picker-list" role="group" aria-label={title}>
        {visible.map((row) => (
          <label
            key={row.id}
            className={`record-picker-row ${selected.includes(row.id) ? "selected" : ""}`}
          >
            <input
              type="checkbox"
              name={name}
              value={row.id}
              checked={selected.includes(row.id)}
              disabled={!selected.includes(row.id) && selected.length >= limit}
              onChange={(event) =>
                onSelect(
                  event.target.checked
                    ? [...selected, row.id]
                    : selected.filter((value) => value !== row.id),
                )
              }
            />
            <span>
              <strong>
                {row.reference || row.description || "No reference"}
              </strong>
              <small>
                {row.account_name} · {row.date}
              </small>
            </span>
            <span className="record-picker-amount">
              {row.direction === "out" ? "−" : "+"} SLE{" "}
              {money(row.remaining_minor ?? row.amount)}
              <small>
                Available · {row.direction === "out" ? "Outflow" : "Inflow"}
              </small>
            </span>
          </label>
        ))}
        {!visible.length && (
          <p className="enhancement-empty">
            No matching records. Try another search.
          </p>
        )}
      </div>
      {selected
        .filter((value) => !visible.some((row) => row.id === value))
        .map((value) => (
          <input key={value} type="hidden" name={name} value={value} />
        ))}
      {selected.length > 0 && (
        <button
          className="button secondary small"
          type="button"
          onClick={() => onSelect([])}
        >
          Clear selection
        </button>
      )}
    </fieldset>
  );
}
