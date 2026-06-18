import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

export type BrandTone = keyof typeof brand.marks;

interface BrandMarkProps {
  className?: string;
  decorative?: boolean;
  tone?: BrandTone;
}

export function BrandMark({ className, decorative = false, tone = "dark" }: BrandMarkProps) {
  const colors = brand.marks[tone];

  return (
    <span
      className={cn("inline-grid h-11 w-11 shrink-0 place-items-center", className)}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : brand.name}
      role={decorative ? undefined : "img"}
    >
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
        <rect x="2" y="2" width="60" height="60" rx="16" fill={colors.background} />
        <path
          d="M27 10h10M27 54h10M10 27v10M54 27v10"
          fill="none"
          stroke={colors.table}
          strokeWidth="4"
          strokeLinecap="round"
        />
        <rect x="16" y="16" width="32" height="32" rx="9" fill="none" stroke={colors.table} strokeWidth="4" />
        <path
          d="M21 39V26l11 9 7-6"
          fill="none"
          stroke={colors.monogram}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="m37 37 5 5 9-12"
          fill="none"
          stroke={colors.confirmation}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function BrandName({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("font-black leading-none tracking-[-0.045em]", inverted ? "text-white" : "text-slate-950", className)} aria-label={brand.name}>
      <span aria-hidden="true">{brand.name.slice(0, -1)}</span>
      <span className="text-amber-500" aria-hidden="true">{brand.name.slice(-1)}</span>
    </span>
  );
}

interface BrandLogoProps {
  className?: string;
  inverted?: boolean;
  markClassName?: string;
  markTone?: BrandTone;
  showSlogan?: boolean;
}

export function BrandLogo({
  className,
  inverted = false,
  markClassName,
  markTone = "dark",
  showSlogan = false
}: BrandLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <BrandMark className={markClassName} decorative tone={markTone} />
      <span className="min-w-0">
        <BrandName className="block text-xl" inverted={inverted} />
        {showSlogan ? (
          <span className={cn("mt-1 block text-xs font-semibold leading-tight", inverted ? "text-slate-300" : "text-slate-500")}>
            {brand.slogan}
          </span>
        ) : null}
      </span>
    </span>
  );
}
