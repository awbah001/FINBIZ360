export function dateScopeLabel(from = "", to = "") {
  if (from && to) return from === to ? from : `${from} to ${to}`;
  if (from) return `From ${from}`;
  if (to) return `Through ${to}`;
  return "All recorded dates";
}

export function financialScopeLabel({
  accounts = [],
  account = "",
  from = "",
  to = "",
  query = "",
  extra = {},
}: {
  accounts?: { id: string; name: string }[];
  account?: string;
  from?: string;
  to?: string;
  query?: string;
  extra?: Record<string, string>;
}) {
  const labels: Record<string, string> = {
    channel: "Channel",
    category: "Category",
    approval: "Approval",
    status: "Reconciliation",
    sort: "Order",
  };
  return [
    accounts.find((item) => item.id === account)?.name ||
      (account ? "Selected account" : "All accounts"),
    dateScopeLabel(from, to),
    ...(query ? [`Search: ${query}`] : []),
    ...Object.entries(extra)
      .filter(([, value]) => value)
      .map(
        ([key, value]) =>
          `${labels[key] || key}: ${String(value).replaceAll("_", " ")}`,
      ),
  ].join(" · ");
}

const eventNames: Record<string, string> = {
  "auth.login": "Signed in",
  "auth.logout": "Signed out",
  "auth.password": "Password changed",
  "auth.password_reset": "Password reset",
  "user.password_reset": "Staff password reset",
  "user.create": "Staff account created",
  "user.update": "Staff account updated",
  "user.profile": "Profile updated",
  "user.access_role": "Staff role updated",
  "system.session_revoked": "Session revoked",
  "system.access_role_updated": "Role permissions updated",
  "settings.update": "Organisation settings updated",
  "backup.export": "Database backup downloaded",
  "approval.delegate": "Approval delegation updated",
  "transaction.create": "Transaction recorded",
  "transaction.approved": "Payment approved",
  "transaction.rejected": "Payment rejected",
  "invoice.create": "Invoice created",
  "invoice.allocate": "Receipt allocated to invoice",
  "statement.preview": "Statement previewed",
  "statement.commit": "Statement imported",
  "reconciliation.confirm": "Reconciliation confirmed",
  "reconciliation.undo": "Reconciliation undone",
  "report.export": "Report exported",
};
export function auditActionLabel(action: string) {
  return (
    eventNames[action] || action.replaceAll(".", " · ").replaceAll("_", " ")
  );
}
