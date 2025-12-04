import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownLeft, TrendingUp, Users, DollarSign } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, ResponsiveContainer, Tooltip } from "recharts";

const data = [
  { name: "Mon", sales: 4000 },
  { name: "Tue", sales: 3000 },
  { name: "Wed", sales: 2000 },
  { name: "Thu", sales: 2780 },
  { name: "Fri", sales: 1890 },
  { name: "Sat", sales: 2390 },
  { name: "Sun", sales: 3490 },
];

export default function OwnerDashboard() {
  return (
    <MobileShell theme="owner" className="pb-20">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-background/80 backdrop-blur-md px-6 py-4 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Owner</h1>
          <p className="text-sm text-muted-foreground">Good afternoon, Boss</p>
        </div>
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
          JD
        </div>
      </header>

      <main className="p-4 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-primary text-primary-foreground border-none shadow-lg">
            <CardContent className="p-4">
              <p className="text-primary-foreground/80 text-xs font-medium uppercase tracking-wider">Today's Sales</p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold">$1,240</span>
                <span className="text-xs opacity-80">+12%</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Expenses</p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground">$320</span>
                <span className="text-xs text-red-500">-4%</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Revenue Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
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
          </CardContent>
        </Card>

        {/* Recent Actions */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 hover:border-primary/50 hover:bg-primary/5">
              <Users className="h-6 w-6 text-primary" />
              <span className="text-xs">Staff Management</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 hover:border-primary/50 hover:bg-primary/5">
              <DollarSign className="h-6 w-6 text-primary" />
              <span className="text-xs">Payouts</span>
            </Button>
          </div>
        </div>
      </main>
      <BottomNav role="owner" />
    </MobileShell>
  );
}
