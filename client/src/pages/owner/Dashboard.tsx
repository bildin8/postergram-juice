import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Users, DollarSign, Loader2, Package, Receipt } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

export default function OwnerDashboard() {
  const { data: todaysSales, isLoading: loadingSales } = useQuery<{ total: number; count: number }>({
    queryKey: ["/api/sales/today"],
    queryFn: async () => {
      const res = await fetch("/api/sales/today");
      if (!res.ok) throw new Error("Failed to fetch sales");
      return res.json();
    },
  });

  const { data: weeklyData = [] } = useQuery<{ name: string; sales: number }[]>({
    queryKey: ["/api/analytics/weekly"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/weekly");
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
  });

  const { data: lowStock = [] } = useQuery<any[]>({
    queryKey: ["/api/inventory/low-stock"],
    queryFn: async () => {
      const res = await fetch("/api/inventory/low-stock");
      if (!res.ok) throw new Error("Failed to fetch low stock");
      return res.json();
    },
  });

  const { data: pendingRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/requests", "pending"],
    queryFn: async () => {
      const res = await fetch("/api/requests?status=pending");
      if (!res.ok) throw new Error("Failed to fetch requests");
      return res.json();
    },
  });

  return (
    <MobileShell theme="owner" className="pb-20">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-background/80 backdrop-blur-md px-6 py-4 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Owner</h1>
          <p className="text-sm text-muted-foreground">Good afternoon, Boss</p>
        </div>
        <Link href="/settings" className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
          JD
        </Link>
      </header>

      <main className="p-4 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-primary text-primary-foreground border-none shadow-lg">
            <CardContent className="p-4">
              <p className="text-primary-foreground/80 text-xs font-medium uppercase tracking-wider">Today's Sales</p>
              <div className="mt-2 flex items-baseline gap-1">
                {loadingSales ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <span className="text-2xl font-bold">${todaysSales?.total?.toFixed(2) || "0.00"}</span>
                    <span className="text-xs opacity-80">{todaysSales?.count || 0} txns</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Pending Actions</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">{pendingRequests.length}</span>
                <span className="text-xs text-muted-foreground">requests</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Low Stock Alert */}
        {lowStock.length > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-orange-700 mb-2">
                <Package className="h-4 w-4" />
                <span className="font-medium text-sm">{lowStock.length} items need restock</span>
              </div>
              <div className="text-xs text-orange-600">
                {lowStock.slice(0, 3).map(item => item.name).join(", ")}
                {lowStock.length > 3 && ` +${lowStock.length - 3} more`}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Chart */}
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[200px]">
            {weeklyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 10}} 
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="sales" 
                    stroke="hsl(var(--primary))" 
                    fillOpacity={1} 
                    fill="url(#colorSales)" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <p className="text-sm">No sales data yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Quick Actions</h3>
          <div className="grid grid-cols-3 gap-3">
            <Link href="/owner/sales">
              <Button variant="outline" className="h-auto py-4 w-full flex flex-col gap-2 hover:border-primary/50 hover:bg-primary/5" data-testid="link-sales">
                <Receipt className="h-6 w-6 text-primary" />
                <span className="text-xs">Sales</span>
              </Button>
            </Link>
            <Link href="/owner/requests">
              <Button variant="outline" className="h-auto py-4 w-full flex flex-col gap-2 hover:border-primary/50 hover:bg-primary/5" data-testid="link-requests">
                <Users className="h-6 w-6 text-primary" />
                <span className="text-xs">Requests</span>
              </Button>
            </Link>
            <Link href="/owner/analytics">
              <Button variant="outline" className="h-auto py-4 w-full flex flex-col gap-2 hover:border-primary/50 hover:bg-primary/5" data-testid="link-analytics">
                <DollarSign className="h-6 w-6 text-primary" />
                <span className="text-xs">Analytics</span>
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <BottomNav role="owner" />
    </MobileShell>
  );
}
