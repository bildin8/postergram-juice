import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Package, AlertTriangle, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";

const inventory = [
  { id: 1, name: "Espresso Beans (1kg)", stock: 45, min: 10, status: "good" },
  { id: 2, name: "Oat Milk (1L)", stock: 8, min: 12, status: "low" },
  { id: 3, name: "Paper Cups (12oz)", stock: 120, min: 50, status: "good" },
  { id: 4, name: "Vanilla Syrup", stock: 2, min: 5, status: "critical" },
  { id: 5, name: "Croissants (Frozen)", stock: 24, min: 20, status: "warning" },
];

export default function StoreInventory() {
  return (
    <MobileShell theme="store" className="pb-20">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-4 border-b space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-primary">Store</h1>
          <Link href="/store/reorder">
            <Button size="icon" className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="h-5 w-5" />
            </Button>
          </Link>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search inventory..." className="pl-9 bg-secondary/50 border-none" />
        </div>
      </header>

      <main className="p-4 space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-foreground">Current Stock</h2>
          <Button variant="link" className="h-auto p-0 text-primary text-xs">View History</Button>
        </div>

        {inventory.map((item) => (
          <Card key={item.id} className="overflow-hidden border-none shadow-sm ring-1 ring-border/50">
            <CardContent className="p-0 flex items-center justify-between">
              <div className="p-4 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center bg-secondary`}>
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">{item.name}</h3>
                  <p className="text-xs text-muted-foreground">Min: {item.min} units</p>
                </div>
              </div>
              
              <div className="pr-4 flex flex-col items-end gap-1">
                <span className="font-bold font-mono text-lg">{item.stock}</span>
                {item.status === "low" && <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Low</Badge>}
                {item.status === "critical" && <Badge variant="destructive" className="text-xs">Critical</Badge>}
                {item.status === "good" && <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50">OK</Badge>}
              </div>
            </CardContent>
            
            {(item.status === "low" || item.status === "critical") && (
               <div className="bg-red-50 px-4 py-2 flex items-center justify-between">
                 <div className="flex items-center gap-2 text-xs text-red-700">
                   <AlertTriangle className="h-3 w-3" />
                   <span>Reorder recommended</span>
                 </div>
                 <ArrowRight className="h-3 w-3 text-red-700" />
               </div>
            )}
          </Card>
        ))}
      </main>
      <BottomNav role="store" />
    </MobileShell>
  );
}
