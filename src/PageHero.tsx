import type { ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BuildingOffice as Building2,
  Check,
  FileText,
  Fingerprint,
  ArrowsCounterClockwise as GitCompareArrows,
  Bank as Landmark,
  MagnifyingGlass as Search,
  Gear as Settings,
  ShieldCheck,
  UploadSimple as Upload,
  Users,
} from "@phosphor-icons/react";
import "./page-hero.css";

// Decorative module illustrations: never financial data or status indicators.
export function HeroArt({ page }: { page: string }) {
  const paper = (
    <>
      <rect x="74" y="22" width="124" height="146" rx="12" fill="white" />
      <path d="M96 88h80M96 104h64M96 120h74M96 142h38" />
    </>
  );
  const artwork: Record<string, ReactNode> = {
    "Cash shifts": (
      <>
        <rect x="28" y="48" width="224" height="114" rx="18" fill="white" />
        <path d="M28 82h224m-170 28h52m-52 20h76m48-80v112" />
        <Landmark
          x={178}
          y={94}
          width={48}
          height={48}
          stroke="none"
          weight="duotone"
        />
      </>
    ),
    Budgets: (
      <>
        <rect x="42" y="26" width="188" height="144" rx="18" fill="white" />
        <path d="M72 142V98h24v44m20 0V76h24v66m20 0V54h24v88" />
        <path d="m62 80 44-24 38 8 48-28" />
      </>
    ),
    "Collections & payables": (
      <>
        <rect x="38" y="28" width="154" height="134" rx="14" fill="white" />
        <path d="M60 64h105m-105 26h72m-72 26h90" />
        <circle cx="210" cy="130" r="38" fill="white" />
        <path d="M210 108v24l16 8" />
      </>
    ),
    "Recurring drafts": (
      <>
        <rect x="78" y="44" width="124" height="116" rx="12" fill="white" />
        <path d="M100 76h80m-80 25h58m-58 25h74" />
        <path d="M54 104a87 87 0 0 1 160-55m-12-25 15 28-32 2M226 99a87 87 0 0 1-158 56m13 25-16-28 32-1" />
      </>
    ),
    Purchases: (
      <>
        <rect x="34" y="45" width="154" height="114" rx="14" fill="white" />
        <path d="M60 70h101m-101 26h67m-67 26h85" />
        <path d="m178 66 66 24v63l-66 24-32-16v-65Z" fill="white" />
        <path d="m146 96 66 24 32-30m-32 30v45" />
      </>
    ),
    Reminders: (
      <>
        <rect x="62" y="34" width="156" height="132" rx="20" fill="white" />
        <path d="M86 68h108m-108 28h70m-70 28h83" />
        <circle cx="213" cy="45" r="27" fill="white" />
        <path d="M213 30v19m0 9v1" />
      </>
    ),
    Security: (
      <>
        <path d="m140 20 90 33v58q0 47-90 68-90-21-90-68V53Z" fill="white" />
        <ShieldCheck
          x={99}
          y={67}
          width={82}
          height={82}
          stroke="none"
          weight="duotone"
        />
      </>
    ),
    Users: (
      <>
        <rect x="30" y="38" width="184" height="124" rx="18" fill="white" />
        <Users
          x={52}
          y={58}
          width={84}
          height={72}
          aria-hidden="true"
          focusable="false"
          stroke="none"
          weight="duotone"
        />
        <path d="M55 143h91m4-76h40m-40 18h29" />
        <path d="m207 83 42 17v31q0 29-42 45-42-16-42-45v-31Z" fill="white" />
        <ShieldCheck
          x={181}
          y={104}
          width={52}
          height={52}
          aria-hidden="true"
          focusable="false"
          stroke="none"
          weight="duotone"
        />
      </>
    ),
    Transactions: (
      <>
        <rect x="28" y="36" width="212" height="124" rx="16" fill="white" />
        <path d="M50 78h168M50 116h168M110 56h82M110 96h64M110 136h84" />
        <ArrowDownLeft
          x={56}
          y={50}
          width={26}
          height={26}
          aria-hidden="true"
          focusable="false"
          stroke="none"
          weight="duotone"
        />
        <ArrowUpRight
          x={56}
          y={90}
          width={26}
          height={26}
          aria-hidden="true"
          focusable="false"
          stroke="none"
          weight="duotone"
        />
        <ArrowDownLeft
          x={56}
          y={130}
          width={26}
          height={26}
          aria-hidden="true"
          focusable="false"
          stroke="none"
          weight="duotone"
        />
      </>
    ),
    Invoices: (
      <>
        <rect
          x="62"
          y="24"
          width="120"
          height="144"
          rx="12"
          transform="rotate(-12 122 96)"
          opacity=".2"
          fill="currentColor"
        />
        {paper}
        <FileText
          x={94}
          y={38}
          width={32}
          height={32}
          aria-hidden="true"
          focusable="false"
          className="icon-file-text"
          stroke="none"
          weight="duotone"
        />
        <circle cx="205" cy="143" r="27" fill="currentColor" />
        <Check
          x={190}
          y={128}
          width={30}
          height={30}
          color="white"
          aria-hidden="true"
          focusable="false"
          className="icon-check"
          stroke="none"
          weight="duotone"
        />
      </>
    ),
    Customers: (
      <>
        <path
          d="M60 100Q140 10 220 100M60 100Q140 180 220 100"
          strokeDasharray="5 7"
        />
        <rect x="88" y="46" width="104" height="104" rx="24" fill="white" />
        <Users
          x={112}
          y={70}
          width={56}
          height={56}
          aria-hidden="true"
          focusable="false"
          stroke="none"
          weight="duotone"
        />
        <circle cx="44" cy="102" r="27" fill="white" />
        <Users
          x={30}
          y={88}
          width={28}
          height={28}
          aria-hidden="true"
          focusable="false"
          stroke="none"
          weight="duotone"
        />
        <circle cx="236" cy="102" r="27" fill="white" />
        <Users
          x={222}
          y={88}
          width={28}
          height={28}
          aria-hidden="true"
          focusable="false"
          stroke="none"
          weight="duotone"
        />
      </>
    ),
    Suppliers: (
      <>
        <path
          d="M22 161h238M58 161V74l60-30v117M118 161V98l60-30v93"
          fill="white"
        />
        <Building2
          x={176}
          y={90}
          width={62}
          height={72}
          aria-hidden="true"
          focusable="false"
          stroke="none"
          weight="duotone"
        />
        <path d="M76 87v9m22-19v9m-22 28v9m22-19v9m38 3v9m22-19v9" />
      </>
    ),
    "Supplier bills": (
      <>
        <rect
          x="42"
          y="48"
          width="110"
          height="120"
          rx="10"
          opacity=".2"
          fill="currentColor"
        />
        {paper}
        <path d="M94 50h48m-48 14h62" />
        <rect
          x="171"
          y="111"
          width="65"
          height="52"
          rx="12"
          fill="currentColor"
        />
        <path d="M188 129h31m-31 13h19" stroke="white" />
      </>
    ),
    Accounts: (
      <>
        <ellipse
          cx="140"
          cy="158"
          rx="113"
          ry="16"
          fill="currentColor"
          opacity=".12"
        />
        <rect x="48" y="30" width="184" height="130" rx="22" fill="white" />
        <Landmark
          x={98}
          y={47}
          width={84}
          height={84}
          aria-hidden="true"
          focusable="false"
          stroke="none"
          weight="duotone"
        />
        <path d="M78 145h124" />
      </>
    ),
    Statements: (
      <>
        <rect x="41" y="34" width="104" height="129" rx="12" fill="white" />
        <path d="M62 57h62m-62 20h45m-45 20h62m-62 20h52m-52 20h33" />
        <path d="M161 87h68m-18-18 18 18-18 18" />
        <Upload
          x={174}
          y={112}
          width={48}
          height={48}
          aria-hidden="true"
          focusable="false"
          className="icon-upload"
          stroke="none"
          weight="duotone"
        />
      </>
    ),
    Reconciliation: (
      <>
        <rect x="20" y="46" width="85" height="113" rx="14" fill="white" />
        <rect x="175" y="30" width="85" height="113" rx="14" fill="white" />
        <path d="M40 72h44m-44 19h30m-30 19h40m121-54h38m-38 19h28m-28 19h38" />
        <GitCompareArrows
          x={111}
          y={68}
          width={58}
          height={58}
          aria-hidden="true"
          focusable="false"
          stroke="none"
          weight="duotone"
        />
      </>
    ),
    Exceptions: (
      <>
        <circle cx="137" cy="99" r="70" fill="white" />
        <path d="M109 49h48m-62 22h71m-71 22h56m-56 22h32" />
        <Search
          x={141}
          y={90}
          width={83}
          height={83}
          aria-hidden="true"
          focusable="false"
          stroke="none"
          weight="duotone"
        />
        <path d="M174 110v17m0 9v1" />
      </>
    ),
    Approvals: (
      <>
        <path d="m140 22 78 30v48q0 45-78 72-78-27-78-72V52Z" fill="white" />
        <ShieldCheck
          x={95}
          y={54}
          width={90}
          height={90}
          aria-hidden="true"
          focusable="false"
          stroke="none"
          weight="duotone"
        />
        <path d="m34 64 6 6 12-14m178 73 6 6 12-14" />
      </>
    ),
    Reports: (
      <>
        <rect x="37" y="32" width="206" height="131" rx="14" fill="white" />
        <path d="M60 58h67m-67 17h44M61 140h156" />
        <path d="M83 123V99m39 24V83m39 40V66m39 57V93" strokeWidth="14" />
        <path d="m186 45 13-10 13 10" />
      </>
    ),
    Analytics: (
      <>
        <circle cx="100" cy="96" r="62" fill="white" />
        <circle cx="100" cy="96" r="37" strokeWidth="17" opacity=".25" />
        <path d="M100 59a37 37 0 0 1 37 37" strokeWidth="17" />
        <rect x="159" y="77" width="103" height="86" rx="12" fill="white" />
        <path d="m174 138 18-25 18 9 33-31" />
        <path d="M231 91h12v12" />
      </>
    ),
    "Audit trail": (
      <>
        <path d="M68 25v141" strokeDasharray="4 7" />
        <rect x="95" y="34" width="141" height="39" rx="10" fill="white" />
        <rect x="95" y="84" width="120" height="32" rx="10" fill="white" />
        <rect x="95" y="127" width="141" height="32" rx="10" fill="white" />
        <circle cx="68" cy="54" r="10" fill="currentColor" />
        <circle cx="68" cy="100" r="8" fill="white" />
        <circle cx="68" cy="143" r="8" fill="white" />
        <path d="M114 54h100m-100 46h79m-79 43h100" />
      </>
    ),
    Profile: (
      <>
        <circle cx="140" cy="96" r="77" strokeDasharray="4 9" opacity=".35" />
        <rect x="76" y="33" width="128" height="132" rx="32" fill="white" />
        <Fingerprint
          x={102}
          y={50}
          width={76}
          height={76}
          aria-hidden="true"
          focusable="false"
          stroke="none"
          weight="duotone"
        />
        <path d="M112 145h56" />
      </>
    ),
    Settings: (
      <>
        <circle cx="106" cy="97" r="65" fill="white" />
        <Settings
          x={62}
          y={53}
          width={88}
          height={88}
          aria-hidden="true"
          focusable="false"
          className="icon-settings"
          stroke="none"
          weight="duotone"
        />
        <rect x="163" y="57" width="79" height="90" rx="15" fill="white" />
        <path d="M179 80h47m-47 22h47m-47 22h47" />
        <circle cx="192" cy="80" r="6" fill="currentColor" />
        <circle cx="215" cy="102" r="6" fill="currentColor" />
        <circle cx="198" cy="124" r="6" fill="currentColor" />
      </>
    ),
  };
  return (
    <svg
      className="module-hero-art"
      viewBox="0 0 280 190"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {artwork[page]}
    </svg>
  );
}

export default function PageHero({
  page,
  children,
}: {
  page: string;
  children: ReactNode;
}) {
  if (page === "Overview")
    return <div className="page-heading">{children}</div>;
  const compact = [
    "Transactions",
    "Invoices",
    "Customers",
    "Suppliers",
    "Supplier bills",
    "Accounts",
    "Statements",
    "Reconciliation",
    "Exceptions",
    "Approvals",
    "Reports",
    "Audit trail",
  ].includes(page);
  const design = page.toLowerCase().replaceAll(" ", "-");
  return (
    <section
      className={`page-heading module-hero hero-${design}${compact ? " module-hero-compact" : ""}`}
      aria-label={`${page} overview`}
    >
      {children}
      <HeroArt page={page} />
    </section>
  );
}
