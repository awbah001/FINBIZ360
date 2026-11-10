import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Envelope as Mail,
  LockKey as LockKeyhole,
  ShieldCheck,
  CircleNotch as LoaderCircle,
} from "@phosphor-icons/react";
import AuthFrame from "./AuthFrame";
import PasswordInput from "./PasswordInput";

export default function Login({
  demo,
  onAuthenticate,
}: {
  demo: boolean;
  onAuthenticate: (values: Record<string, FormDataEntryValue>) => Promise<void>;
}) {
  const submitting = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [capsLock, setCapsLock] = useState(false),
    [help, setHelp] = useState<"password" | "account" | null>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  return (
    <AuthFrame compact>
      <header className="auth-heading">
        <span className="login-eyebrow">YOUR FINANCIAL WORKSPACE</span>
        <h2 id="login-title">Welcome back</h2>
        <p id="login-description">Sign in to your financial workspace.</p>
      </header>
      <form
        className="auth-form finbiz-form finbiz-form-auth"
        aria-labelledby="login-title"
        aria-describedby="login-description"
        aria-busy={busy}
        onSubmit={async (e) => {
          e.preventDefault();
          if (submitting.current) return;
          submitting.current = true;
          const values = Object.fromEntries(new FormData(e.currentTarget));
          setBusy(true);
          setError("");
          try {
            await onAuthenticate(values);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            submitting.current = false;
            setBusy(false);
          }
        }}
      >
        <label htmlFor="login-email">Email address</label>
        <div className="auth-input input-container">
          <Mail size={18} aria-hidden="true" focusable="false" />
          <input
            className="input"
            autoFocus
            id="login-email"
            type="email"
            name="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            readOnly={busy}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "login-error" : undefined}
            placeholder="you@company.com"
            maxLength={200}
            required
          />
          <span className="highlight" aria-hidden="true" />
        </div>
        <label htmlFor="login-password">Password</label>
        <div className="auth-input input-container">
          <LockKeyhole size={18} aria-hidden="true" focusable="false" />
          <PasswordInput
            className="input"
            id="login-password"
            name="password"
            autoComplete="current-password"
            readOnly={busy}
            aria-invalid={error ? true : undefined}
            aria-describedby={
              [error && "login-error", capsLock && "login-caps-lock"]
                .filter(Boolean)
                .join(" ") || undefined
            }
            onKeyDown={(event) =>
              setCapsLock(event.getModifierState("CapsLock"))
            }
            onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}
            onBlur={() => setCapsLock(false)}
            placeholder="Enter your password"
            maxLength={256}
            required
          />
          <span className="highlight" aria-hidden="true" />
        </div>
        {capsLock && (
          <p className="login-caps-lock" id="login-caps-lock" role="status">
            Caps Lock is on.
          </p>
        )}
        <details className="login-mfa">
          <summary>Authenticator or recovery code (if enabled)</summary>
          <label htmlFor="login-code">Sign-in code</label>
          <input
            id="login-code"
            name="code"
            autoComplete="one-time-code"
            maxLength={30}
            placeholder="Authenticator or recovery code"
            readOnly={busy}
          />
        </details>
        <div className="auth-form-options">
          <span>
            <ShieldCheck size={14} aria-hidden="true" focusable="false" />
            Secure sign-in
          </span>
          <button
            type="button"
            aria-expanded={help === "password"}
            aria-controls="auth-help"
            onClick={() => setHelp(help === "password" ? null : "password")}
          >
            Password help
          </button>
        </div>
        {error && (
          <div
            ref={errorRef}
            className="error"
            role="alert"
            id="login-error"
            tabIndex={-1}
          >
            {error}
          </div>
        )}
        <button className="button auth-submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
          {busy ? (
            <LoaderCircle
              className="auth-spinner"
              size={18}
              aria-hidden="true"
              focusable="false"
            />
          ) : (
            <ArrowRight size={18} aria-hidden="true" focusable="false" />
          )}
        </button>
      </form>
      <p className="auth-account-link">
        Need an account?{" "}
        <button
          type="button"
          aria-expanded={help === "account"}
          aria-controls="auth-help"
          onClick={() => setHelp(help === "account" ? null : "account")}
        >
          Account access
        </button>
      </p>
      {help && (
        <div className="auth-help" id="auth-help" role="status">
          {help === "password" ? (
            <>
              If you can sign in, change your password under Settings. If you
              cannot sign in, contact your company administrator for assistance.
              Self-service email reset is not available yet.
            </>
          ) : (
            <>
              <a href="/register">Open company registration</a>. For an existing
              company, ask your administrator to create your staff account under
              Settings → Create user.
            </>
          )}
        </div>
      )}
      {demo && (
        <p className="auth-demo">
          Demo workspace · Use your generated demo credentials. All activity
          here is synthetic.
        </p>
      )}
    </AuthFrame>
  );
}
