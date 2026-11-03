import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ChartNoAxesCombined,
  LockKeyhole,
  Pause,
  Play,
} from "lucide-react";
import "./auth.css";

export default function AuthFrame({
  children,
  registration = false,
  compact = false,
}: {
  children: ReactNode;
  registration?: boolean;
  compact?: boolean;
}) {
  const [motionPaused, setMotionPaused] = useState(false);
  return (
    <div
      className={`auth-page${compact ? " auth-login" : ""}`}
      data-motion-paused={motionPaused}
    >
      {compact && (
        <>
          <div className="login-atmosphere" aria-hidden="true">
            <span className="login-glow glow-mint" />
            <span className="login-glow glow-blue" />
            <span className="login-grid" />
            <span className="login-halo" />
          </div>
          <button
            className="login-motion-toggle"
            type="button"
            aria-pressed={motionPaused}
            aria-label={
              motionPaused
                ? "Resume background animation"
                : "Pause background animation"
            }
            onClick={() => setMotionPaused((v) => !v)}
          >
            {motionPaused ? (
              <Play size={14} aria-hidden="true" />
            ) : (
              <Pause size={14} aria-hidden="true" />
            )}
            <span>
              {motionPaused ? "Resume background" : "Pause background"}
            </span>
          </button>
        </>
      )}
      <a className="auth-home-link" href="/">
        <ArrowLeft size={14} />
        Back to home
      </a>
      <span className="auth-backdrop-dots" aria-hidden="true" />
      <div className={`auth-shell ${registration ? "auth-registration" : ""}`}>
        <aside className="auth-hero">
          <a className="auth-brand" href="/" aria-label="FinBiz 360 home">
            <ChartNoAxesCombined size={22} />
            <span>
              FinBiz <strong>360</strong>
            </span>
          </a>
          <div className="auth-art" aria-hidden="true">
            <span className="auth-dots dots-top" />
            <span className="auth-orbit orbit-one" />
            <span className="auth-orbit orbit-two" />
            <span className="auth-orbit orbit-three" />
            <span className="auth-sphere sphere-large" />
            <span className="auth-sphere sphere-small" />
            <span className="auth-dots dots-bottom" />
          </div>
          <div className="auth-story">
            <span className="auth-kicker">
              ONE WORKSPACE. A CLEARER PICTURE.
            </span>
            <h1>
              {registration ? (
                <>
                  Your business <br />
                  journey <br />
                  starts here.
                </>
              ) : (
                <>
                  Your next <br />
                  chapter <br />
                  starts here.
                </>
              )}
            </h1>
            <p>
              {registration
                ? "Create your company workspace and bring your finances into focus."
                : "Welcome to a more connected way to manage your business finances."}
            </p>
          </div>
          <div className="auth-hero-footer">
            <LockKeyhole size={13} />
            <span>Your records. Your decisions. Your business.</span>
          </div>
        </aside>
        <section className="auth-content">
          <div className="auth-form-wrap">
            <div className="auth-logo" aria-label="FinBiz 360">
              <ChartNoAxesCombined size={32} />
              <span className="auth-logo-dot" />
            </div>
            {children}
          </div>
        </section>
      </div>
      <p className="auth-page-footer">
        FinBiz 360 <span>·</span> Built for growing businesses in Sierra Leone
      </p>
    </div>
  );
}
