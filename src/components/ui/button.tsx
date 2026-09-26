import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-xl border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap cursor-pointer transition-all duration-200 outline-none select-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/30 active:scale-[0.97] active:duration-75 disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-primary via-primary to-[color-mix(in_oklch,var(--primary),black_10%)] text-primary-foreground shadow-[0_1px_2px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.25)] hover:brightness-105 hover:shadow-md hover:shadow-primary/20 active:brightness-95",
        outline:
          "border-border/80 bg-background/60 backdrop-blur-md text-foreground shadow-2xs hover:bg-muted/80 hover:border-foreground/20 active:bg-muted dark:border-input dark:bg-input/20 dark:hover:bg-input/40",
        secondary:
          "border border-border/60 bg-secondary/80 text-secondary-foreground shadow-2xs hover:bg-secondary hover:border-border active:bg-secondary/70",
        ghost:
          "text-foreground hover:bg-muted/80 active:bg-muted/60 dark:hover:bg-muted/40",
        destructive:
          "bg-destructive/12 text-destructive border border-destructive/25 shadow-2xs hover:bg-destructive hover:text-white hover:border-transparent active:bg-destructive/90 dark:bg-destructive/20 dark:hover:bg-destructive/35",
        link: "text-primary underline-offset-4 hover:underline",
        accent:
          "bg-gradient-to-b from-emerald-600 to-emerald-700 text-white shadow-[0_1px_2px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.25)] hover:brightness-105 hover:shadow-md hover:shadow-emerald-500/20 active:brightness-95",
      },
      size: {
        default:
          "h-9 gap-2 px-3.5 has-data-[icon=inline-end]:pe-3 has-data-[icon=inline-start]:ps-3",
        xs: "h-6.5 gap-1.5 rounded-lg px-2 text-xs has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-lg px-2.5 text-[0.82rem] has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-2 rounded-xl px-4 text-base has-data-[icon=inline-end]:pe-3.5 has-data-[icon=inline-start]:ps-3.5",
        icon: "size-9 rounded-xl",
        "icon-xs":
          "size-6.5 rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-8 rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-10 rounded-xl",
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
  render,
  nativeButton,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  const isNonButtonRender =
    React.isValidElement(render) && render.type !== "button"
  const resolvedNativeButton =
    nativeButton ?? (isNonButtonRender ? false : undefined)

  return (
    <ButtonPrimitive
      data-slot="button"
      render={render}
      nativeButton={resolvedNativeButton}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

