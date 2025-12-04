import { useState } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpRight, Truck, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { DespatchLog, InventoryItem } from "@shared/schema";

export default function StoreDespatch() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    inventoryItemId: "",
    itemName: "",
    quantity: "",
    destination: "shop",
    createdBy: "Store Staff",
  });

  const { data: inventory = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
    queryFn: async () => {
      const res = await fetch("/api/inventory");
      if (!res.ok) throw new Error("Failed to fetch inventory");
      return res.json();
    },
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery<DespatchLog[]>({
    queryKey: ["/api/despatch"],
    queryFn: async () => {
      const res = await fetch("/api/despatch");
      if (!res.ok) throw new Error("Failed to fetch despatch logs");
      return res.json();
    },
  });

  const createDespatch = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/despatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to log despatch");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Despatch Recorded",
        description: "Inventory has been updated successfully.",
        className: "bg-emerald-600 text-white border-none"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/despatch"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      setFormData({
        inventoryItemId: "",
        itemName: "",
        quantity: "",
        destination: "shop",
        createdBy: "Store Staff",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.itemName || !formData.quantity) {
      toast({
        title: "Missing Fields",
        description: "Please select an item and quantity.",
        variant: "destructive",
      });
      return;
    }
    createDespatch.mutate(formData);
  };

  const handleItemSelect = (itemId: string) => {
    const item = inventory.find(i => i.id === itemId);
    if (item) {
      setFormData(prev => ({ 
        ...prev, 
        inventoryItemId: itemId,
        itemName: item.name 
      }));
    }
  };

  const formatTime = (date: Date | string) => {
    return new Date(date).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <MobileShell theme="store" className="pb-20">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-4 border-b">
        <h1 className="text-xl font-bold tracking-tight text-primary">Despatch</h1>
      </header>

      <main className="p-4 space-y-6">
        {/* New Despatch Form */}
        <Card className="border-none shadow-md">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Truck className="h-4 w-4" />
              </div>
              <h2 className="font-semibold">Log Outgoing Stock</h2>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="item">Item</Label>
                <Select value={formData.inventoryItemId} onValueChange={handleItemSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select item..." />
                  </SelectTrigger>
                  <SelectContent>
                    {inventory.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.currentStock} {item.unit})
                      </SelectItem>
                    ))}
                    {inventory.length === 0 && (
                      <SelectItem value="none" disabled>No inventory items</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="qty">Quantity</Label>
                  <Input 
                    id="qty" 
                    type="number" 
                    placeholder="0" 
                    value={formData.quantity}
                    onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dest">Destination</Label>
                  <Select value={formData.destination} onValueChange={(v) => setFormData(prev => ({ ...prev, destination: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shop">Shop Floor</SelectItem>
                      <SelectItem value="waste">Waste/Spoilage</SelectItem>
                      <SelectItem value="return">Return to Vendor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90 text-white mt-2"
                disabled={createDespatch.isPending}
              >
                {createDespatch.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                ) : "Confirm Despatch"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Recent Movements Log */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Recent Movements</h3>
          
          {logsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No despatch logs yet</p>
          ) : (
            logs.slice(0, 10).map((log) => (
              <div key={log.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-border/50 shadow-sm">
                 <div className="flex items-center gap-3">
                   <div className="bg-orange-100 p-2 rounded-full text-orange-600">
                     <ArrowUpRight className="h-4 w-4" />
                   </div>
                   <div>
                     <p className="font-medium text-sm">{log.itemName}</p>
                     <p className="text-xs text-muted-foreground">To: {log.destination}</p>
                   </div>
                 </div>
                 <div className="text-right">
                   <p className="font-bold text-sm">-{log.quantity}</p>
                   <p className="text-xs text-muted-foreground">{formatTime(log.createdAt)}</p>
                 </div>
              </div>
            ))
          )}
        </div>
      </main>
      <BottomNav role="store" />
    </MobileShell>
  );
}
