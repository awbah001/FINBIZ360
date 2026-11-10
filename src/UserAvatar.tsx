import { useState } from "react";
import "./user-avatar.css";

export default function UserAvatar({
  name,
  src,
  className = "",
}: {
  name?: string | null;
  src?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const initials = (name?.trim() || "System")
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className={`staff-avatar ${className}`} aria-hidden="true">
      {src && failed !== src ? (
        <img src={src} alt="" loading="lazy" onError={() => setFailed(src)} />
      ) : (
        initials
      )}
    </span>
  );
}

export function UserIdentity({
  name,
  src,
  detail,
}: {
  name?: string | null;
  src?: string | null;
  detail?: string;
}) {
  return (
    <span className="staff-identity">
      <UserAvatar name={name} src={src} />
      <span className="staff-identity-copy">
        <span>{name || "System"}</span>
        {detail && <small>{detail}</small>}
      </span>
    </span>
  );
}
