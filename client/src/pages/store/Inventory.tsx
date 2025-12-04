import { useState } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Package, AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { InventoryItem } from "@shared/schema";

function getStatus(item: InventoryItem): "good" | "low" | "critical" {
  const stock = Number(item.currentStock);
  const min = Number(item.minStock);
  if (stock <= min * 0.5) return "critical";
  if (stock <= min) return "low";
  return "good";
}

export default function StoreInventory() {
  const [search, setSearch] = useState("");
  
  const { data: inventory = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
    queryFn: async () => {
      const res = await fetch("/api/inventory");
      if (!res.ok) throw new Error("Failed to fetch inventory");
      return res.json();
    },
  });

  const filteredInventory = inventory.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase())
  );

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
          <Input 
            placeholder="Search inventory..." 
            className="pl-9 bg-secondary/50 border-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </header>

      <main className="p-4 space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-foreground">Current Stock</h2>
          <Link href="/store/despatch">
            <Button variant="link" className="h-auto p-0 text-primary text-xs">View Despatch Log</Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredInventory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mb-2 opacity-50" />
            <p className="text-sm">No inventory items found</p>
            <Link href="/settings">
              <Button variant="link" className="text-primary mt-2">Sync from PosterPOS</Button>
            </Link>
          </div>
        ) : (
          filteredInventory.map((item) => {
            const status = getStatus(item);
            return (
              <Card key={item.id} className="overflow-hidden border-none shadow-sm ring-1 ring-border/50">
                <CardContent className="p-0 flex items-center justify-between">
                  <div className="p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-secondary">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm">{item.name}</h3>
                      <p className="text-xs text-muted-foreground">Min: {item.minStock} {item.unit}</p>
                    </div>
                  </div>
                  
                  <div className="pr-4 flex flex-col items-end gap-1">
                    <span className="font-bold font-mono text-lg">{item.currentStock}</span>
                    {status === "low" && <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Low</Badge>}
                    {status === "critical" && <Badge variant="destructive" className="text-xs">Critical</Badge>}
                    {status === "good" && <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50">OK</Badge>}
                  </div>
                </CardContent>
                
                {(status === "low" || status === "critical") && (
                   <Link href="/store/reorder" className="bg-red-50 px-4 py-2 flex items-center justify-between hover:bg-red-100 transition-colors">
                     <div className="flex items-center gap-2 text-xs text-red-700">
                       <AlertTriangle className="h-3 w-3" />
                       <span>Reorder recommended</span>
                     </div>
                     <ArrowRight className="h-3 w-3 text-red-700" />
                   </Link>
                )}
              </Card>
            );
          })
        )}
      </main>
      <BottomNav role="store" />
    </MobileShell>
  );
}
