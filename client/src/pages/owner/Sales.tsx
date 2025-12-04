import { useState } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Receipt, TrendingUp, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

type DateRange = "today" | "yesterday" | "week" | "month" | "custom";

export default function OwnerSales() {
  const [dateRange, setDateRange] = useState<DateRange>("today");
  const [customFrom, setCustomFrom] = useState<Date>(subDays(new Date(), 7));
  const [customTo, setCustomTo] = useState<Date>(new Date());

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
      case "custom":
        return { from: startOfDay(customFrom).toISOString(), to: endOfDay(customTo).toISOString() };
    }
  };

  const params = getDateParams();
  
  const { data, isLoading } = useQuery<{ 
    sales: any[]; 
    summary: { total: number; count: number; from: string; to: string } 
  }>({
    queryKey: ["/api/sales/range", params.from, params.to],
    queryFn: async () => {
      const res = await fetch(`/api/sales/range?from=${params.from}&to=${params.to}`);
      if (!res.ok) throw new Error("Failed to fetch sales");
      return res.json();
    },
  });

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <MobileShell theme="owner" className="pb-20">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-4 border-b">
        <h1 className="text-xl font-bold tracking-tight text-primary">Sales</h1>
      </header>

      <main className="p-4 space-y-4">
        {/* Date Range Selector */}
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
                  {dateRange === "today" ? "Today's Sales" : 
                   dateRange === "yesterday" ? "Yesterday's Sales" :
                   dateRange === "week" ? "Last 7 Days" : "Last 30 Days"}
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  {isLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <span className="text-3xl font-bold">
                        KES {data?.summary.total.toFixed(2) || "0.00"}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right">
                <TrendingUp className="h-8 w-8 opacity-50" />
                <p className="text-sm opacity-80 mt-1">
                  {data?.summary.count || 0} receipts
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sales List */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1 flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Transactions
          </h3>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !data?.sales.length ? (
            <Card className="p-8 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-muted-foreground">No sales in this period</p>
            </Card>
          ) : (
            data.sales.map((sale, idx) => (
              <Card key={sale.id || idx} className="border-none shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                      <Receipt className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{sale.itemName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(sale.timestamp)} at {formatTime(sale.timestamp)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">KES {Number(sale.amount).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">x{sale.quantity}</p>
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
