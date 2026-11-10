import { useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  BuildingOffice as Building2,
  Envelope as Mail,
  UserCircle as UserRound,
  LockKey as LockKeyhole,
  ShieldCheck,
  Check,
} from "@phosphor-icons/react";
import AuthFrame from "./AuthFrame";
import { FormInput } from "./PasswordInput";

export default function Setup({
  tokenRequired,
  onComplete,
}: {
  tokenRequired: boolean;
  onComplete: (values: Record<string, FormDataEntryValue>) => Promise<void>;
}) {
  const [step, setStep] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<Record<string, string>>({
    organisation: "",
    owner_name: "",
    owner_email: "",
    owner_password: "",
    owner_confirm: "",
    admin_name: "",
    admin_email: "",
    admin_password: "",
    admin_confirm: "",
    setup_token: "",
  });
  const field = (
    name: string,
    label: string,
    type = "text",
    placeholder = "",
  ) => {
    const Icon =
      type === "email"
        ? Mail
        : type === "password"
          ? LockKeyhole
          : name === "organisation"
            ? Building2
            : UserRound;
    return (
      <div className="auth-field" key={name}>
        <label htmlFor={`setup-${name}`}>{label}</label>
        <div className="auth-input input-container">
          <Icon size={18} aria-hidden="true" focusable="false" />
          <FormInput
            className="input"
            id={`setup-${name}`}
            name={name}
            type={type}
            visibilityLabel={
              name === "setup_token" ? "setup token" : label.toLowerCase()
            }
            placeholder={placeholder || `Enter ${label.toLowerCase()}`}
            required
            aria-describedby={
              type === "password" && name !== "setup_token"
                ? `setup-${name}-help`
                : undefined
            }
            minLength={
              type === "password" && name !== "setup_token" ? 12 : undefined
            }
            maxLength={type === "password" ? 256 : 200}
            autoComplete={
              name === "setup_token"
                ? "off"
                : type === "password"
                  ? "new-password"
                  : type === "email"
                    ? "email"
                    : name.endsWith("name")
                      ? "name"
                      : "organization"
            }
            value={values[name]}
            onChange={(e) =>
              setValues((v) => ({ ...v, [name]: e.target.value }))
            }
          />
          <span className="highlight" aria-hidden="true" />
        </div>
        {type === "password" && name !== "setup_token" && (
          <p className="field-help" id={`setup-${name}-help`}>
            Use at least 12 characters. Keep your password private.
          </p>
        )}
      </div>
    );
  };
  const changeStep = (next: number) => {
    setStep(next);
    setError("");
    requestAnimationFrame(() =>
      formRef.current?.querySelector("input")?.focus(),
    );
  };
  return (
    <AuthFrame registration>
      <header className="auth-heading">
        <span className="auth-product">FINBIZ 360</span>
        <h2>{step === 1 ? "Create your workspace" : "Set up administrator"}</h2>
        <p>
          {step === 1
            ? "Start with your company and owner account."
            : "Give your team a dedicated access administrator."}
        </p>
      </header>
      <ol className="auth-steps" aria-label="Registration progress">
        <li
          aria-current={step === 1 ? "step" : undefined}
          className={step === 1 ? "current" : "done"}
        >
          <span>
            {step === 1 ? (
              "1"
            ) : (
              <Check
                size={12}
                aria-hidden="true"
                focusable="false"
                className="icon-check"
              />
            )}
          </span>
          Company & owner
        </li>
        <li
          aria-current={step === 2 ? "step" : undefined}
          className={step === 2 ? "current" : ""}
        >
          <span>2</span>Administrator
        </li>
      </ol>
      <form
        ref={formRef}
        className="auth-form auth-setup-form finbiz-form finbiz-form-auth"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          if (step === 1) {
            if (values.owner_password !== values.owner_confirm) {
              setError("Owner passwords do not match.");
              return;
            }
            changeStep(2);
            return;
          }
          if (values.admin_password !== values.admin_confirm) {
            setError("Administrator passwords do not match.");
            return;
          }
          if (
            values.owner_email.trim().toLowerCase() ===
            values.admin_email.trim().toLowerCase()
          ) {
            setError(
              "Use different email addresses for the owner and administrator.",
            );
            return;
          }
          setBusy(true);
          try {
            await onComplete(values);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="auth-step-content" key={step}>
          {step === 1 ? (
            <>
              {field(
                "organisation",
                "Company name",
                "text",
                "Your registered business name",
              )}
              <div className="auth-field-grid">
                {field(
                  "owner_name",
                  "Owner / manager name",
                  "text",
                  "Full name",
                )}
                {field(
                  "owner_email",
                  "Email address",
                  "email",
                  "you@company.com",
                )}
              </div>
              <div className="auth-field-grid">
                {field(
                  "owner_password",
                  "Password",
                  "password",
                  "At least 12 characters",
                )}
                {field(
                  "owner_confirm",
                  "Confirm password",
                  "password",
                  "Re-enter your password",
                )}
              </div>
            </>
          ) : (
            <>
              <div className="auth-role-note">
                <ShieldCheck size={18} aria-hidden="true" focusable="false" />
                <p>
                  The administrator manages users and settings. Financial
                  approvals stay with the manager.
                </p>
              </div>
              {field("admin_name", "Administrator name", "text", "Full name")}
              {field(
                "admin_email",
                "Administrator email",
                "email",
                "admin@company.com",
              )}
              <div className="auth-field-grid">
                {field(
                  "admin_password",
                  "Password",
                  "password",
                  "At least 12 characters",
                )}
                {field(
                  "admin_confirm",
                  "Confirm password",
                  "password",
                  "Re-enter the password",
                )}
              </div>
              {tokenRequired &&
                field(
                  "setup_token",
                  "Server setup token",
                  "password",
                  "Provided by your server operator",
                )}
            </>
          )}
        </div>
        <div className="auth-form-options">
          <span>
            <LockKeyhole size={12} aria-hidden="true" focusable="false" />
            12+ characters per password
          </span>
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <div className="auth-register-actions">
          {step === 2 && (
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => changeStep(1)}
            >
              <ArrowLeft size={15} aria-hidden="true" focusable="false" />
              Back
            </button>
          )}
          <button className="button auth-submit" disabled={busy}>
            {busy
              ? "Creating workspace…"
              : step === 1
                ? "Continue"
                : "Create workspace"}
            <ArrowRight size={15} aria-hidden="true" focusable="false" />
          </button>
        </div>
      </form>
      <p className="auth-registration-footnote">
        {step === 1
          ? "Your workspace starts empty. Add your own accounts and financial records after setup."
          : "Company setup happens once. You can add staff accounts from Settings after signing in."}
      </p>
    </AuthFrame>
  );
}
