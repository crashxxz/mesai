import Image from "next/image";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

export type BrandTone = keyof typeof brand.marks;

interface BrandMarkProps {
  className?: string;
  decorative?: boolean;
  tone?: BrandTone;
}

export function BrandMark({ className, decorative = false }: BrandMarkProps) {
  return (
    <span
      className={cn("inline-grid h-11 w-11 shrink-0 place-items-center", className)}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : brand.name}
      role={decorative ? undefined : "img"}
    >
      <Image src="/icon-192.png?v=6" alt="" width={192} height={192} className="h-full w-full rounded-[22%] object-cover" priority />
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
