import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-ink text-white shadow-soft hover:bg-slate-700",
        amber: "bg-gradient-to-b from-amber-500 to-amber-600 text-white shadow-soft hover:from-amber-600 hover:to-amber-700",
        green: "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-soft hover:from-emerald-600 hover:to-emerald-700",
        danger: "bg-gradient-to-b from-red-500 to-red-600 text-white shadow-soft hover:from-red-600 hover:to-red-700",
        outline: "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 hover:border-slate-300",
        ghost: "text-slate-700 hover:bg-slate-100"
      },
      size: {
        sm: "min-h-9 px-3 text-xs",
        md: "min-h-11 px-4 text-sm",
        lg: "min-h-12 px-5 text-base",
        icon: "h-11 min-h-11 w-11 px-0"
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "md"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);

Button.displayName = "Button";
