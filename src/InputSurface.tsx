import type { ReactNode } from "react";
import "./inputs.css";

export default function InputSurface({ children }: { children: ReactNode }) {
  return (
    <span className="input-container">
      {children}
      <span className="highlight" aria-hidden="true" />
    </span>
  );
}
