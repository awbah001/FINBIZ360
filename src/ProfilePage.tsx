import {
  Building2,
  FileText,
  LockKeyhole,
  Mail,
  Pencil,
  ShieldCheck,
  User,
} from "lucide-react";
import CardTitle from "./CardTitle";
import "./profile.css";

export default function ProfilePage({
  user,
  role,
  company,
  demo,
  canApprove,
  onEdit,
  onPassword,
}: {
  user: { id: string; name: string; email: string; role: string };
  role: string;
  company: string;
  demo: boolean;
  canApprove: boolean;
  onEdit: () => void;
  onPassword: () => void;
}) {
  const financial = ["manager", "finance"].includes(user.role);
  const access = [
    [
      "Record transactions",
      financial
        ? "Receipts and payments"
        : user.role === "cashier"
          ? "Own receipts only"
          : user.role === "admin"
            ? "No financial recording access"
            : "Read-only financial access",
    ],
    [
      "Financial visibility",
      user.role === "cashier"
        ? "Your own receipts"
        : user.role === "admin"
          ? "System activity and staff access only"
          : "Company-wide records and reports",
    ],
    [
      "Payment approvals",
      canApprove
        ? "Independent review; cannot approve your own payments"
        : "Not assigned to your account",
    ],
    [
      "User administration",
      user.role === "admin"
        ? "Create and manage staff in Users"
        : "Managed by your administrator",
    ],
  ];
  return (
    <div className="profile-layout">
      <aside className="panel profile-identity" aria-label="Your account">
        <div className="profile-cover" aria-hidden="true" />
        <div className="profile-identity-body">
          <div className="profile-avatar" aria-hidden="true">
            {user.name
              .trim()
              .split(/\s+/)
              .map((word) => word[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
          <h2>{user.name}</h2>
          <span className="profile-role">
            <ShieldCheck size={14} aria-hidden="true" />
            {role}
          </span>
          <p className="profile-email">{user.email}</p>
          <div className="profile-company">
            <Building2 size={17} aria-hidden="true" />
            <span>{company}</span>
          </div>
          <button className="button secondary small" onClick={onEdit}>
            <Pencil size={15} />
            Edit profile
          </button>
        </div>
        <p className="profile-identity-note">
          Your profile identifies you across workspace records and activity.
        </p>
      </aside>
      <div className="profile-sections">
        <section className="panel" aria-labelledby="profile-details-title">
          <header className="panel-header">
            <CardTitle icon={User}>
              <h2 id="profile-details-title">Personal details</h2>
              <p>Your account information in this workspace.</p>
            </CardTitle>
            <button className="button secondary small" onClick={onEdit}>
              <Pencil size={14} />
              Edit
            </button>
          </header>
          <dl className="profile-details">
            <div>
              <dt>Full name</dt>
              <dd>{user.name}</dd>
            </div>
            <div>
              <dt>
                <Mail size={14} aria-hidden="true" />
                Sign-in email
              </dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Organisation</dt>
              <dd>{company}</dd>
            </div>
            <div>
              <dt>Assigned role</dt>
              <dd>{role}</dd>
            </div>
          </dl>
          <p className="profile-note">
            Your sign-in email and role are managed by your organisation and
            cannot be changed here.
          </p>
        </section>
        <section className="panel" aria-labelledby="profile-security-title">
          <header className="panel-header">
            <CardTitle icon={LockKeyhole}>
              <h2 id="profile-security-title">Account security</h2>
              <p>Manage the password you use to sign in.</p>
            </CardTitle>
          </header>
          <div className="profile-security-row">
            <div>
              <h3>Password</h3>
              <p>
                Use at least 12 characters. Changing your password signs out all
                sessions, including this one.
              </p>
            </div>
            <button className="button secondary small" onClick={onPassword}>
              <LockKeyhole size={15} />
              Change password
            </button>
          </div>
        </section>
        <section className="panel" aria-labelledby="profile-access-title">
          <header className="panel-header">
            <CardTitle icon={ShieldCheck}>
              <h2 id="profile-access-title">Your workspace access</h2>
              <p>Access follows your assigned role and approval permissions.</p>
            </CardTitle>
          </header>
          <dl className="profile-access-list">
            {access.map(([label, description]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{description}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="panel" aria-labelledby="profile-workspace-title">
          <header className="panel-header">
            <CardTitle icon={FileText}>
              <h2 id="profile-workspace-title">Workspace details</h2>
              <p>Shared settings used for financial records.</p>
            </CardTitle>
          </header>
          <dl className="profile-details">
            <div>
              <dt>Currency</dt>
              <dd>SLE · Sierra Leone leone</dd>
            </div>
            <div>
              <dt>Timezone</dt>
              <dd>Africa/Freetown</dd>
            </div>
            <div>
              <dt>Environment</dt>
              <dd>{demo ? "Demo · synthetic records" : "Company workspace"}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
