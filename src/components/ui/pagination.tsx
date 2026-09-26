"use client";

import * as React from "react";
import type { VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import {
  paginationVariants,
  paginationItemVariants,
  paginationNavVariants,
} from "~/components/ui/pagination-variants";

export interface PaginationProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof paginationVariants> {}

export interface PaginationItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof paginationItemVariants> {
  isActive?: boolean;
}

export interface PaginationNavProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof paginationNavVariants> {}

export type PaginationEllipsisProps = React.HTMLAttributes<HTMLSpanElement>;

const Pagination = React.forwardRef<HTMLElement, PaginationProps>(
  ({ className, variant, ...props }, ref) => (
    <nav
      role="navigation"
      aria-label="pagination"
      className={cn(paginationVariants({ variant, className }))}
      ref={ref}
      {...props}
    />
  ),
);
Pagination.displayName = "Pagination";

const PaginationItem = React.forwardRef<HTMLButtonElement, PaginationItemProps>(
  ({ className, variant, size, state, isActive, ...props }, ref) => (
    <button
      className={cn(
        paginationItemVariants({
          variant,
          size,
          state: isActive ? "active" : state,
          className,
        }),
      )}
      ref={ref}
      aria-current={isActive ? "page" : undefined}
      {...props}
    />
  ),
);
PaginationItem.displayName = "PaginationItem";

const PaginationPrevious = React.forwardRef<HTMLButtonElement, PaginationNavProps>(
  ({ className, size, children, ...props }, ref) => (
    <button className={cn(paginationNavVariants({ size, className }))} ref={ref} {...props}>
      <ChevronLeft className="h-4 w-4" />
      {children ?? "Previous"}
    </button>
  ),
);
PaginationPrevious.displayName = "PaginationPrevious";

const PaginationNext = React.forwardRef<HTMLButtonElement, PaginationNavProps>(
  ({ className, size, children, ...props }, ref) => (
    <button className={cn(paginationNavVariants({ size, className }))} ref={ref} {...props}>
      {children ?? "Next"}
      <ChevronRight className="h-4 w-4" />
    </button>
  ),
);
PaginationNext.displayName = "PaginationNext";

const PaginationEllipsis = React.forwardRef<HTMLSpanElement, PaginationEllipsisProps>(
  ({ className, ...props }, ref) => (
    <span
      className={cn(
        "inline-flex items-center justify-center h-9 w-9 text-muted-foreground",
        className,
      )}
      ref={ref}
      {...props}
    >
      <MoreHorizontal className="h-4 w-4" />
      <span className="sr-only">More pages</span>
    </span>
  ),
);
PaginationEllipsis.displayName = "PaginationEllipsis";

export {
  Pagination,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
  paginationVariants,
  paginationItemVariants,
  paginationNavVariants,
};
