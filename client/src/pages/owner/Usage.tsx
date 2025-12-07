import { useState } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Package, TrendingDown, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

type DateRange = "today" | "yesterday" | "week" | "month";

interface UsageItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  totalCost: number;
}

interface UsageResponse {
  usage: UsageItem[];
  summary: {
    totalCost: number;
    totalItems: number;
    from: string;
    to: string;
  };
}

export default function OwnerUsage() {
  const [dateRange, setDateRange] = useState<DateRange>("today");

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
  
  const { data, isLoading } = useQuery<UsageResponse>({
    queryKey: ["/api/usage", params.from, params.to],
    queryFn: async () => {
      const res = await fetch(`/api/usage?from=${params.from}&to=${params.to}`);
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

  return (
    <MobileShell theme="owner" className="pb-20">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-4 border-b">
        <h1 className="text-xl font-bold tracking-tight text-primary" data-testid="text-page-title">
          Ingredient Usage
        </h1>
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
                    <span className="text-3xl font-bold" data-testid="text-total-cost">
                      KES {(data?.summary?.totalCost ?? 0).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <TrendingDown className="h-8 w-8 opacity-50" />
                <p className="text-sm opacity-80 mt-1" data-testid="text-item-count">
                  {data?.summary?.totalItems ?? 0} ingredients
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1 flex items-center gap-2">
            <Package className="h-4 w-4" />
            Ingredients Used
          </h3>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !data?.usage.length ? (
            <Card className="p-8 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-muted-foreground">No ingredient usage in this period</p>
            </Card>
          ) : (
            data.usage.map((item) => (
              <Card key={item.id} className="border-none shadow-sm" data-testid={`card-usage-${item.id}`}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-sm" data-testid={`text-ingredient-name-${item.id}`}>
                        {item.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity.toFixed(2)} {item.unit} used
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold" data-testid={`text-ingredient-cost-${item.id}`}>
                      KES {item.totalCost.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      @ KES {item.costPerUnit.toFixed(2)}/unit
                    </p>
                  </div>
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
