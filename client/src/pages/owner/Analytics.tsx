import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Bar, BarChart, CartesianGrid, XAxis, ResponsiveContainer, Tooltip, Legend, Line, ComposedChart } from "recharts";

const data = [
  { name: "Mon", sales: 4000, stock: 2400 },
  { name: "Tue", sales: 3000, stock: 2210 },
  { name: "Wed", sales: 2000, stock: 2290 },
  { name: "Thu", sales: 2780, stock: 2000 },
  { name: "Fri", sales: 1890, stock: 2181 },
  { name: "Sat", sales: 2390, stock: 2500 },
  { name: "Sun", sales: 3490, stock: 2100 },
];

const categoryData = [
  { name: "Coffee", sales: 65, stock: 40 },
  { name: "Food", sales: 25, stock: 30 },
  { name: "Merch", sales: 10, stock: 30 },
];

export default function OwnerAnalytics() {
  return (
    <MobileShell theme="owner" className="pb-20">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-4 border-b">
        <h1 className="text-xl font-bold tracking-tight text-primary">Analytics</h1>
      </header>

      <main className="p-4 space-y-6">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="overview">Sales vs Stock</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4 mt-4">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Weekly Performance</CardTitle>
              </CardHeader>
              <CardContent className="p-0 h-[300px] pb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
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
                    <Legend />
                    <Bar dataKey="sales" name="Sales ($)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={20} />
                    <Line type="monotone" dataKey="stock" name="Stock Level" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <div className="grid grid-cols-2 gap-4">
               <Card className="bg-blue-50 border-none">
                 <CardContent className="p-4">
                   <div className="text-xs text-blue-600 font-medium uppercase">Turnover Rate</div>
                   <div className="text-2xl font-bold text-blue-900 mt-1">4.2x</div>
                   <div className="text-xs text-blue-600/80 mt-1">High efficiency</div>
                 </CardContent>
               </Card>
               <Card className="bg-orange-50 border-none">
                 <CardContent className="p-4">
                   <div className="text-xs text-orange-600 font-medium uppercase">Low Stock Alerts</div>
                   <div className="text-2xl font-bold text-orange-900 mt-1">3</div>
                   <div className="text-xs text-orange-600/80 mt-1">Action needed</div>
                 </CardContent>
               </Card>
            </div>
          </TabsContent>

          <TabsContent value="categories" className="mt-4">
             <Card className="border-none shadow-sm">
               <CardHeader>
                 <CardTitle className="text-sm font-medium">Sales Distribution</CardTitle>
               </CardHeader>
               <CardContent className="space-y-4">
                 {categoryData.map((cat) => (
                   <div key={cat.name} className="space-y-1">
                     <div className="flex items-center justify-between text-sm">
                       <span className="font-medium">{cat.name}</span>
                       <span className="text-muted-foreground">{cat.sales}% of sales</span>
                     </div>
                     <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                       <div 
                         className="h-full bg-primary" 
                         style={{ width: `${cat.sales}%` }}
                       />
                     </div>
                     <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                        <span>Stock Coverage</span>
                        <span className={cat.stock < 20 ? "text-red-500 font-bold" : "text-green-600"}>
                          {cat.stock < 20 ? "Low" : "Healthy"}
                        </span>
                     </div>
                   </div>
                 ))}
               </CardContent>
             </Card>
          </TabsContent>
        </Tabs>
      </main>
      <BottomNav role="owner" />
    </MobileShell>
  );
}
