import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export default function CardTitle({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="card-title-group">
      <span className="card-icon" aria-hidden="true">
        <Icon size={20} />
      </span>
      <div className="card-title-copy">{children}</div>
    </div>
  );
}
