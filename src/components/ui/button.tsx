import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  [
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap outline-none",
    /* Explicit properties, not transition-all: animating `all` on a button also
       animates layout properties and costs a frame for nothing. */
    "transition-[background-color,border-color,box-shadow,transform,color] duration-150 ease-out",
    /* Press feedback that cannot move its neighbours — a transform, not margin. */
    "active:translate-y-px active:duration-75",
    "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
    "disabled:pointer-events-none disabled:opacity-50",
    "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    /* The arrow leans into the direction of travel on hover. */
    "[&_svg.lucide-arrow-right]:transition-transform [&_svg.lucide-arrow-right]:duration-150 hover:[&_svg.lucide-arrow-right]:translate-x-0.5",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 hover:shadow-md hover:shadow-primary/15",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 hover:shadow-md hover:shadow-destructive/20 focus-visible:ring-destructive/20",
        /* --hover-tint, not --accent: accent is the CTA blue in this product,
           so the stock shadcn hover filled outline buttons solid blue. */
        outline:
          "border-border text-foreground border bg-surface shadow-xs hover:border-accent/40 hover:bg-hover-tint hover:shadow-sm",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/85 hover:shadow-sm",
        ghost: "text-foreground hover:bg-hover-tint",
        link: "text-accent-text cursor-pointer underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
