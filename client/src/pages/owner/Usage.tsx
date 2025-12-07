import { useState } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Package, Loader2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { subDays, startOfDay, endOfDay } from "date-fns";

type DateRange = "today" | "yesterday" | "week" | "month";

interface ProductUsage {
  name: string;
  count: number;
}

interface UsageItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  products: ProductUsage[];
}

interface UsageResponse {
  usage: UsageItem[];
  summary: {
    totalIngredients: number;
    totalTransactions: number;
    totalProductsSold: number;
    from: string;
    to: string;
  };
}

export default function OwnerUsage() {
  const [dateRange, setDateRange] = useState<DateRange>("today");
  const [isSyncing, setIsSyncing] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["/api/realtime-usage"] });
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const getDateParams = () => {
    const now = new Date();
    switch (dateRange) {
      case "today":
        return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
      case "yesterday":
        const yesterday = subDays(now, 1);
        return { from: startOfDay(yesterday).toISOString(), to: endOfDay(yesterday).toISOString() };
      case "week":
        return { from: startOfDay(subDays(now, 7)).toISOString(), to: endOfDay(now).toISOString() };
      case "month":
        return { from: startOfDay(subDays(now, 30)).toISOString(), to: endOfDay(now).toISOString() };
    }
  };

  const params = getDateParams();
  
  const { data, isLoading, isFetching } = useQuery<UsageResponse>({
    queryKey: ["/api/realtime-usage", params.from, params.to],
    queryFn: async () => {
      const res = await fetch(`/api/realtime-usage?from=${params.from}&to=${params.to}`);
      if (!res.ok) throw new Error("Failed to fetch usage");
      return res.json();
    },
  });

  const getDateLabel = () => {
    switch (dateRange) {
      case "today": return "Today's Usage";
      case "yesterday": return "Yesterday's Usage";
      case "week": return "Last 7 Days";
      case "month": return "Last 30 Days";
    }
  };

  const formatQuantity = (quantity: number, unit: string) => {
    if (unit === 'kg' || unit === 'l') {
      return `${quantity.toFixed(3)} ${unit}`;
    }
    return `${quantity.toFixed(2)} ${unit || 'units'}`;
  };

  return (
    <MobileShell theme="owner" className="pb-20">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-4 border-b">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-primary" data-testid="text-page-title">
            Ingredient Usage
          </h1>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleSync}
            disabled={isSyncing || isLoading || isFetching}
            data-testid="button-sync"
          >
            <RefreshCw className={`h-5 w-5 ${(isSyncing || isFetching) ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      <main className="p-4 space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {[
            { key: "today", label: "Today" },
            { key: "yesterday", label: "Yesterday" },
            { key: "week", label: "7 Days" },
            { key: "month", label: "30 Days" },
          ].map(({ key, label }) => (
            <Button
              key={key}
              variant={dateRange === key ? "default" : "outline"}
              size="sm"
              className="shrink-0"
              onClick={() => setDateRange(key as DateRange)}
              data-testid={`button-range-${key}`}
            >
              {label}
            </Button>
          ))}
        </div>

        <Card className="bg-primary text-primary-foreground border-none">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">{getDateLabel()}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  {isLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <span className="text-3xl font-bold" data-testid="text-total-ingredients">
                      {data?.summary?.totalIngredients ?? 0}
                    </span>
                  )}
                  <span className="text-sm opacity-80">ingredients used</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold" data-testid="text-total-products">
                  {data?.summary?.totalProductsSold ?? 0}
                </p>
                <p className="text-sm opacity-80">
                  products sold
                </p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-primary-foreground/20">
              <p className="text-sm opacity-80" data-testid="text-transaction-count">
                From {data?.summary?.totalTransactions ?? 0} transactions
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1 flex items-center gap-2">
            <Package className="h-4 w-4" />
            Ingredients Consumed
          </h3>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !data?.usage?.length ? (
            <Card className="p-8 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-muted-foreground">No ingredient usage in this period</p>
            </Card>
          ) : (
            data.usage.map((item) => (
              <Card 
                key={item.id} 
                className="border-none shadow-sm overflow-hidden" 
                data-testid={`card-usage-${item.id}`}
              >
                <CardContent 
                  className="p-4 cursor-pointer"
                  onClick={() => toggleExpand(item.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                        <Package className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-sm" data-testid={`text-ingredient-name-${item.id}`}>
                          {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Used in {item.products.length} product{item.products.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="font-bold" data-testid={`text-ingredient-qty-${item.id}`}>
                          {formatQuantity(item.quantity, item.unit)}
                        </p>
                      </div>
                      {item.products.length > 0 && (
                        expandedItems.has(item.id) ? 
                          <ChevronUp className="h-4 w-4 text-muted-foreground" /> : 
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  
                  {expandedItems.has(item.id) && item.products.length > 0 && (
                    <div className="mt-3 pt-3 border-t space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase">Used in:</p>
                      {item.products.map((product, idx) => (
                        <div key={idx} className="flex justify-between text-sm pl-2">
                          <span className="text-muted-foreground">{product.name}</span>
                          <span className="font-medium">x{product.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
      <BottomNav role="owner" />
    </MobileShell>
  );
}
