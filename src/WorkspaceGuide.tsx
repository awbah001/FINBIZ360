import { FileText } from "@phosphor-icons/react";
import CardTitle from "./CardTitle";
import { Table } from "./WorkspacePages";
import { workspaceCatalogue } from "./workspaceCatalogue";
import { roleWorkspaces } from "./roleWorkspace";

export default function WorkspaceGuide(props: {
  role: string;
  navigate: (page: string) => void;
  pages?: string[];
}) {
  const rows = workspaceCatalogue
    .filter((entry) => entry.role === props.role)
    .map((entry) => ({ ...entry, id: `${entry.role}-${entry.number}` }));
  return (
    <section className="panel">
      <div className="panel-header">
        <CardTitle icon={FileText}>
          <h2>Your workspace guide</h2>
          <p>
            Find each responsibility in the tools assigned to your role.
            Existing views are reused for related workflows.
          </p>
        </CardTitle>
      </div>
      <details className="operations-guide" open>
        <summary>New operational workflows</summary>
        {[
          [
            "Cash shifts",
            "Open a cash shift before sales, submit the physical count, and obtain independent manager review.",
          ],
          [
            "Budgets",
            "Review monthly category spending; managers can set and revise limits with an audit reason.",
          ],
          [
            "Collections & payables",
            "Review overdue balances, assign a responsible person and record promised payment dates.",
          ],
          [
            "Recurring drafts",
            "Schedule recurring items, review automatically prepared drafts, then create a draft invoice or pending expense.",
          ],
          [
            "Purchases",
            "Request a purchase, obtain another manager's approval, create an order and link its supplier bill.",
          ],
          [
            "Reminders",
            "Open due work or snooze a reminder for your own queue.",
          ],
          [
            "Security",
            "Enable an authenticator after verifying your password; keep the one-use recovery codes somewhere safe.",
          ],
          [
            "System maintenance",
            "Configure encrypted backup scheduling after the operator configures the server encryption key.",
          ],
        ]
          .filter(([page]) =>
            (props.pages || roleWorkspaces[props.role]?.pages || []).includes(
              page,
            ),
          )
          .map(([page, description]) => (
            <div className="panel-note" key={page}>
              <h3>{page}</h3>
              <p>{description}</p>
              <button
                className="button secondary small"
                onClick={() => props.navigate(page)}
              >
                Open {page}
              </button>
            </div>
          ))}
      </details>
      <Table
        title="Role responsibilities"
        rows={rows}
        headings={[
          "Responsibility",
          "Available workflow",
          "Status",
          "Open workspace",
        ]}
        render={(entry) => (
          <tr key={entry.id}>
            <td>{entry.title}</td>
            <td className="workflow-description">{entry.workflow}</td>
            <td>{entry.state}</td>
            <td>
              {entry.page ? (
                <button
                  className="button secondary small"
                  onClick={() => props.navigate(entry.page)}
                >
                  Open {entry.page}
                </button>
              ) : (
                "Use Sign out in the sidebar"
              )}
            </td>
          </tr>
        )}
      />
    </section>
  );
}
