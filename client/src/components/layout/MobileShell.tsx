import React from "react";
import { cn } from "@/lib/utils";

interface MobileShellProps {
  children: React.ReactNode;
  className?: string;
  theme?: "owner" | "store" | "shop";
}

export function MobileShell({ children, className, theme = "owner" }: MobileShellProps) {
  return (
    <div className={cn(
      "min-h-screen w-full bg-background font-sans text-foreground antialiased sm:max-w-md sm:mx-auto sm:border-x sm:border-border",
      theme === "store" && "theme-store",
      theme === "shop" && "theme-shop",
      className
    )}>
      {children}
    </div>
  );
}
