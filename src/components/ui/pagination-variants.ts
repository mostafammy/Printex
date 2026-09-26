// Plain (non "use client") module: the `cva` variant functions from
// ~/components/ui/pagination, split out so Server Components (e.g.
// ~/components/pagination-bar) can call them directly. A "use client"
// module's exports can only cross the server/client boundary as rendered
// JSX, not as plain function calls — calling `paginationNavVariants()`
// from a Server Component while it lived in pagination.tsx threw
// "Attempted to call ... from the server but ... is on the client".

import { cva } from "class-variance-authority";

export const paginationVariants = cva("flex items-center justify-center", {
  variants: {
    variant: {
      default: "gap-1",
      compact: "gap-0.5",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export const paginationItemVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ",
  {
    variants: {
      variant: {
        default:
          "rounded-lg h-9 w-9 text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring",
        outline:
          "rounded-lg h-9 w-9 border border-border text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring",
        ghost:
          "rounded-lg h-9 w-9 text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring",
      },
      size: {
        default: "h-9 w-9",
        sm: "h-8 w-8 text-xs",
        lg: "h-10 w-10",
      },
      state: {
        default: "",
        active:
          "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground focus-visible:ring-ring",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      state: "default",
    },
  },
);

export const paginationNavVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 rounded-lg px-3 text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring",
  {
    variants: {
      size: {
        default: "h-9",
        sm: "h-8 text-xs px-2",
        lg: "h-10 px-4",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);
