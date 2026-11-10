import type { ReactNode } from "react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import SystemIcon from "./SystemIcon";

export default function CardTitle({
  icon: Icon,
  children,
}: {
  icon: PhosphorIcon;
  children: ReactNode;
}) {
  return (
    <div className="card-title-group">
      <SystemIcon icon={Icon} className="card-icon" />
      <div className="card-title-copy">{children}</div>
    </div>
  );
}
