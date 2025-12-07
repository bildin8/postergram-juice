import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LayoutGrid, ShoppingCart, Package, Settings, ArrowLeft, TrendingDown, Beaker } from "lucide-react";

interface BottomNavProps {
  role: "owner" | "store" | "shop";
}

export function BottomNav({ role }: BottomNavProps) {
  const [location] = useLocation();

  const links = {
    owner: [
      { href: "/owner", icon: LayoutGrid, label: "Overview" },
      { href: "/owner/analytics", icon: ShoppingCart, label: "Analytics" },
      { href: "/owner/usage", icon: Beaker, label: "Usage" },
      { href: "/owner/requests", icon: Settings, label: "Requests" },
    ],
    store: [
      { href: "/store", icon: Package, label: "Stock" },
      { href: "/store/usage", icon: TrendingDown, label: "Usage" },
      { href: "/store/despatch", icon: ArrowLeft, label: "Despatch" },
      { href: "/store/reorder", icon: LayoutGrid, label: "Order" },
    ],
    shop: [
      { href: "/shop", icon: Package, label: "Stock" },
    ]
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/80 backdrop-blur-lg sm:max-w-md sm:mx-auto sm:left-auto sm:right-auto">
      <div className="flex h-16 items-center justify-around px-2">
        {links[role].map((link) => {
          const isActive = location === link.href;
          return (
            <Link 
              key={link.href} 
              href={link.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <link.icon className={cn("h-5 w-5", isActive && "fill-current opacity-20")} />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
