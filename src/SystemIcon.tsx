import {
  Pulse as Activity,
  ArrowDownLeft,
  ArrowsLeftRight as ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Money as Banknote,
  BuildingOffice as Building2,
  ChartLineUp as ChartNoAxesCombined,
  WarningCircle as CircleAlert,
  Clock as Clock3,
  DownloadSimple as Download,
  FileText,
  ArrowsCounterClockwise as GitCompareArrows,
  ClipboardText as History,
  Bank as Landmark,
  House as LayoutDashboard,
  LockKey as LockKeyhole,
  MagnifyingGlass as Search,
  Gear as Settings,
  ShieldCheck,
  DeviceMobile as Smartphone,
  UploadSimple as Upload,
  User,
  Users,
  UserMinus as UserX,
  Wallet,
  type Icon as PhosphorIcon,
  type IconWeight,
} from "@phosphor-icons/react";

const themes = new Map<PhosphorIcon, string>([
  [LayoutDashboard, "teal"],
  [Activity, "cyan"],
  [ArrowDownLeft, "green"],
  [ArrowUpRight, "orange"],
  [ArrowLeftRight, "blue"],
  [ArrowRight, "blue"],
  [Banknote, "green"],
  [Building2, "orange"],
  [ChartNoAxesCombined, "purple"],
  [CircleAlert, "rose"],
  [Clock3, "amber"],
  [Download, "blue"],
  [FileText, "purple"],
  [GitCompareArrows, "green"],
  [History, "slate"],
  [Landmark, "blue"],
  [LockKeyhole, "purple"],
  [Search, "cyan"],
  [Settings, "slate"],
  [ShieldCheck, "amber"],
  [Smartphone, "cyan"],
  [Upload, "cyan"],
  [User, "purple"],
  [Users, "cyan"],
  [UserX, "rose"],
  [Wallet, "green"],
]);

export default function SystemIcon({
  icon: Icon,
  tone,
  size = 20,
  className = "",
  variant = "section",
  active = false,
  weight,
}: {
  icon: PhosphorIcon;
  active?: boolean;
  weight?: IconWeight;
  tone?: string;
  size?: number;
  className?: string;
  variant?: "section" | "navigation" | "hero" | "metric" | "shortcut";
}) {
  return (
    <span
      className={`system-icon system-icon-${variant} ${active ? "is-active" : ""} tone-${tone || themes.get(Icon) || "teal"} ${className}`}
      aria-hidden="true"
    >
      {variant !== "navigation" && (
        <svg
          className="system-icon-underlay"
          viewBox="0 0 40 40"
          fill="none"
          focusable="false"
        >
          <rect
            x="7"
            y="8"
            width="27"
            height="27"
            rx="9"
            fill="currentColor"
            opacity=".11"
            transform="rotate(-9 20 20)"
          />
          <path
            d="M28 5h5a3 3 0 0 1 3 3v5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            opacity=".35"
          />
        </svg>
      )}
      <Icon
        className="system-icon-glyph"
        size={size}
        weight={
          weight ??
          (active
            ? "fill"
            : variant === "hero" || variant === "metric"
              ? "duotone"
              : variant === "shortcut"
                ? "bold"
                : "regular")
        }
        aria-hidden="true"
        focusable="false"
      />
    </span>
  );
}
