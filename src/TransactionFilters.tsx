import { MagnifyingGlass } from "@phosphor-icons/react";
import InputSurface from "./InputSurface";

type Filters = Record<string, string>;
type Props = {
  accounts: { id: string; name: string }[];
  categories: { name: string }[];
  query: string;
  account: string;
  from: string;
  to: string;
  extra: Filters;
  onQuery: (value: string) => void;
  onAccount: (value: string) => void;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onExtra: (value: Filters) => void;
  onReset: () => void;
};

export default function TransactionFilters(props: Props) {
  const { accounts, categories, query, account, from, to, extra } = props;
  const advanced = [
    {
      name: "channel",
      label: "Payment channel",
      options: [
        ["cash", "Cash"],
        ["mobile", "Mobile money"],
        ["bank", "Bank"],
      ],
    },
    {
      name: "category",
      label: "Category",
      options: categories.map((item) => [item.name, item.name]),
    },
    {
      name: "approval",
      label: "Approval status",
      options: ["not_required", "pending", "approved", "rejected"].map(
        (value) => [value, value.replaceAll("_", " ")],
      ),
    },
    {
      name: "status",
      label: "Reconciliation status",
      options: [
        ["unmatched", "Unmatched"],
        ["partially_matched", "Partially matched"],
        ["reconciled", "Reconciled"],
      ],
    },
    {
      name: "sort",
      label: "Sort transactions",
      options: [
        ["date_desc", "Newest first"],
        ["date_asc", "Oldest first"],
        ["amount_desc", "Largest amount first"],
        ["amount_asc", "Smallest amount first"],
      ],
    },
  ];
  const activeCount = advanced.filter((field) => extra[field.name]).length;
  const filtered = !!(
    query ||
    account ||
    from ||
    to ||
    Object.values(extra).some(Boolean)
  );
  return (
    <section
      className="filter-bar transaction-filters"
      aria-label="Transaction filters"
    >
      <div className="transaction-filter-primary">
        <label className="transaction-search">
          <span>Search transactions</span>
          <InputSurface>
            <MagnifyingGlass size={17} aria-hidden="true" focusable="false" />
            <input
              className="input"
              type="search"
              placeholder="Description or reference"
              value={query}
              onChange={(event) => props.onQuery(event.target.value)}
            />
          </InputSurface>
        </label>
        <label>
          <span>Account</span>
          <InputSurface>
            <select
              className="input"
              value={account}
              onChange={(event) => props.onAccount(event.target.value)}
            >
              <option value="">All accounts</option>
              {accounts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </InputSurface>
        </label>
        <label>
          <span>From</span>
          <InputSurface>
            <input
              className="input"
              type="date"
              value={from}
              onChange={(event) => props.onFrom(event.target.value)}
            />
          </InputSurface>
        </label>
        <label>
          <span>To</span>
          <InputSurface>
            <input
              className="input"
              type="date"
              value={to}
              onChange={(event) => props.onTo(event.target.value)}
            />
          </InputSurface>
        </label>
      </div>
      <details className="transaction-filter-advanced">
        <summary>
          More filters
          {activeCount > 0 && (
            <span className="count-label">{activeCount} active</span>
          )}
        </summary>
        <div className="transaction-filter-options">
          {advanced.map((field) => (
            <label key={field.name}>
              <span>{field.label}</span>
              <InputSurface>
                <select
                  className="input"
                  value={extra[field.name] || ""}
                  onChange={(event) =>
                    props.onExtra({
                      ...extra,
                      [field.name]: event.target.value,
                    })
                  }
                >
                  <option value="">
                    {field.name === "sort" ? "Default order" : "All"}
                  </option>
                  {field.options.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </InputSurface>
            </label>
          ))}
        </div>
      </details>
      <div className="transaction-filter-scope">
        <p>
          <strong>Showing:</strong>{" "}
          {accounts.find((item) => item.id === account)?.name ||
            (account ? "Selected account" : "All accounts")}
          {" · "}
          {from && to
            ? `${from} to ${to}`
            : from
              ? `From ${from}`
              : to
                ? `Through ${to}`
                : "All recorded dates"}
        </p>
        {filtered && (
          <button
            type="button"
            className="button secondary small"
            onClick={props.onReset}
          >
            Clear all filters
          </button>
        )}
      </div>
    </section>
  );
}
