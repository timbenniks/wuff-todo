import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        default:
          "border border-border bg-white text-foreground hover:bg-accent",
        outline: "border border-border bg-white hover:bg-accent",
        ghost: "hover:bg-accent text-foreground",
        destructive: "bg-red-700 text-white hover:bg-red-800",
      },
      size: { default: "h-11 px-4", sm: "h-9 px-3", icon: "h-11 w-11" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
