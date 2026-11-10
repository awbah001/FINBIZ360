import "./brand-logo.css";

export default function BrandLogo({
  label = "",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <img
      className={`system-brand-logo ${className}`}
      src="/finbiz-logo.png"
      alt={label}
      width={1254}
      height={1254}
      decoding="async"
    />
  );
}
