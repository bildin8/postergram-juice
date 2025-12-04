import { useState } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, Package, Loader2, Calendar, TrendingDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";

type DateRange = "today" | "yesterday" | "week";

interface IngredientMovement {
  ingredient_id: string;
  ingredient_name: string;
  cost_start: number;
  cost_end: number;
  start: number;
  income: number;
  write_offs: number;
  end: number;
}

interface MovementsResponse {
  movements: IngredientMovement[];
  withUsage: IngredientMovement[];
  summary: {
    totalItems: number;
    itemsWithUsage: number;
    totalUsage: number;
    totalCost: string;
    dateFrom: string;
    dateTo: string;
  };
}

export default function StoreUsage() {
  const [dateRange, setDateRange] = useState<DateRange>("today");

  const getDateParams = () => {
    const now = new Date();
    switch (dateRange) {
      case "today":
        return { from: format(now, "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
      case "yesterday":
        const yesterday = subDays(now, 1);
        return { from: format(yesterday, "yyyy-MM-dd"), to: format(yesterday, "yyyy-MM-dd") };
      case "week":
        return { from: format(subDays(now, 7), "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
    }
  };

  const params = getDateParams();

  const { data, isLoading, refetch } = useQuery<MovementsResponse>({
    queryKey: ["/api/posterpos/movements", params.from, params.to],
    queryFn: async () => {
      const res = await fetch(`/api/posterpos/movements?from=${params.from}&to=${params.to}`);
      if (!res.ok) throw new Error("Failed to fetch movements");
      return res.json();
    },
  });

  const sortedMovements = data?.movements
    ?.filter(m => m.write_offs > 0)
    .sort((a, b) => b.write_offs - a.write_offs) || [];

  return (
    <MobileShell theme="store" className="pb-20">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-4 border-b">
        <h1 className="text-xl font-bold tracking-tight text-primary">Inventory Usage</h1>
        <p className="text-sm text-muted-foreground">Ingredient consumption from sales</p>
      </header>

      <main className="p-4 space-y-4">
        {/* Date Range Selector */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { key: "today", label: "Today" },
            { key: "yesterday", label: "Yesterday" },
            { key: "week", label: "7 Days" },
          ].map(({ key, label }) => (
            <Button
              key={key}
              variant={dateRange === key ? "default" : "outline"}
              size="sm"
              className="shrink-0"
              onClick={() => setDateRange(key as DateRange)}
              data-testid={`button-date-${key}`}
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Summary Card */}
        <Card className="bg-primary text-primary-foreground border-none">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">
                  {dateRange === "today" ? "Today's Usage" : 
                   dateRange === "yesterday" ? "Yesterday's Usage" : "Last 7 Days"}
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  {isLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <span className="text-3xl font-bold" data-testid="text-items-used">
                        {data?.summary.itemsWithUsage || 0}
                      </span>
                      <span className="text-sm opacity-80">items used</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right">
                <TrendingDown className="h-8 w-8 opacity-50" />
                {data?.summary.totalCost && (
                  <p className="text-sm opacity-80 mt-1">
                    KES {data.summary.totalCost} cost
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Usage List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Package className="h-4 w-4" />
              Ingredient Movements
            </h3>
            <Button variant="ghost" size="sm" onClick={() => refetch()} data-testid="button-refresh">
              Refresh
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : sortedMovements.length === 0 ? (
            <Card className="p-8 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-muted-foreground">No ingredient usage recorded</p>
              <p className="text-xs text-muted-foreground mt-1">
                Usage appears when sales are made through PosterPOS
              </p>
            </Card>
          ) : (
            sortedMovements.map((movement) => (
              <Card key={movement.ingredient_id} className="border-none shadow-sm" data-testid={`card-movement-${movement.ingredient_id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                        <ArrowDown className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{movement.ingredient_name}</p>
                        <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            Start: {movement.start.toFixed(1)}
                          </span>
                          <span className="flex items-center gap-1">
                            End: {movement.end.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600">-{movement.write_offs.toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground">
                        KES {(movement.write_offs * movement.cost_end).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Stock level indicator */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Remaining Stock</span>
                      <span>{movement.end.toFixed(1)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${
                          movement.end < movement.start * 0.2 ? 'bg-red-500' :
                          movement.end < movement.start * 0.4 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(100, (movement.end / Math.max(movement.start, 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Income section for restocks */}
        {data?.movements.some(m => m.income > 0) && (
          <div className="space-y-3 mt-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1 flex items-center gap-2">
              <ArrowUp className="h-4 w-4" />
              Restocks / Supplies
            </h3>
            
            {data.movements
              .filter(m => m.income > 0)
              .map((movement) => (
                <Card key={`income-${movement.ingredient_id}`} className="border-none shadow-sm">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                        <ArrowUp className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{movement.ingredient_name}</p>
                        <p className="text-xs text-muted-foreground">Restocked</p>
                      </div>
                    </div>
                    <p className="font-bold text-green-600">+{movement.income.toFixed(1)}</p>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
      </main>
      <BottomNav role="store" />
    </MobileShell>
  );
}
