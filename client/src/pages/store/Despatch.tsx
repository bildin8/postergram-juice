import { useState, useMemo } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpRight, Truck, Loader2, Plus, X, Search, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { DespatchLog, InventoryItem } from "@shared/schema";

interface DespatchItem {
  inventoryItemId: string;
  itemName: string;
  quantity: string;
  unit: string;
}

export default function StoreDespatch() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [items, setItems] = useState<DespatchItem[]>([]);
  const [destination, setDestination] = useState("shop");
  const [createdBy, setCreatedBy] = useState("");

  const { data: inventory = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
    queryFn: async () => {
      const res = await fetch("/api/inventory", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch inventory");
      return res.json();
    },
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery<DespatchLog[]>({
    queryKey: ["/api/despatch"],
    queryFn: async () => {
      const res = await fetch("/api/despatch", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch despatch logs");
      return res.json();
    },
  });

  const filteredInventory = useMemo(() => {
    if (!searchQuery.trim()) return inventory;
    const query = searchQuery.toLowerCase();
    return inventory.filter(item => 
      item.name.toLowerCase().includes(query)
    );
  }, [inventory, searchQuery]);

  const createDespatch = useMutation({
    mutationFn: async (data: { items: DespatchItem[]; destination: string; createdBy: string }) => {
      const res = await fetch("/api/despatch/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to log despatch");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Despatch Recorded",
        description: `${items.length} item(s) sent to ${destination}`,
        className: "bg-emerald-600 text-white border-none"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/despatch"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      setItems([]);
      setCreatedBy("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSelectItem = (item: InventoryItem) => {
    const existing = items.find(i => i.inventoryItemId === item.id);
    if (existing) {
      toast({ title: "Item already added", variant: "destructive" });
      return;
    }
    setItems([...items, {
      inventoryItemId: item.id,
      itemName: item.name,
      quantity: "",
      unit: item.unit,
    }]);
    setSearchQuery("");
    setShowSearch(false);
  };

  const updateItemQuantity = (index: number, quantity: string) => {
    const updated = [...items];
    updated[index].quantity = quantity;
    setItems(updated);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast({ title: "No items added", description: "Please add at least one item.", variant: "destructive" });
      return;
    }
    const invalidItems = items.filter(i => !i.quantity || Number(i.quantity) <= 0);
    if (invalidItems.length > 0) {
      toast({ title: "Missing quantities", description: "Please enter quantity for all items.", variant: "destructive" });
      return;
    }
    if (!createdBy.trim()) {
      toast({ title: "Missing name", description: "Please enter your name.", variant: "destructive" });
      return;
    }
    createDespatch.mutate({ items, destination, createdBy });
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
        <Card className="border-none shadow-md">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Truck className="h-4 w-4" />
              </div>
              <h2 className="font-semibold">Log Outgoing Stock</h2>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Search & Add Items</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Type to search items..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowSearch(true);
                    }}
                    onFocus={() => setShowSearch(true)}
                    className="pl-10"
                    data-testid="input-search-items"
                  />
                </div>
                
                {showSearch && searchQuery && (
                  <div className="border rounded-lg max-h-48 overflow-y-auto bg-white shadow-lg">
                    {filteredInventory.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">No items found</p>
                    ) : (
                      filteredInventory.slice(0, 10).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectItem(item)}
                          className="w-full text-left p-3 hover:bg-muted/50 border-b last:border-b-0 flex items-center justify-between"
                          data-testid={`item-option-${item.id}`}
                        >
                          <span className="font-medium">{item.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {item.currentStock} {item.unit}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {items.length > 0 && (
                <div className="space-y-2">
                  <Label>Items to Despatch ({items.length})</Label>
                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <div
                        key={item.inventoryItemId}
                        className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg"
                        data-testid={`despatch-item-${item.inventoryItemId}`}
                      >
                        <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.itemName}</p>
                        </div>
                        <Input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => updateItemQuantity(index, e.target.value)}
                          className="w-20 h-8 text-center"
                          data-testid={`input-qty-${index}`}
                        />
                        <span className="text-xs text-muted-foreground w-8">{item.unit}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => removeItem(index)}
                          data-testid={`button-remove-${index}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {items.length === 0 && !showSearch && (
                <div className="text-center py-6 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Search and add items above</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="dest">Destination</Label>
                  <Select value={destination} onValueChange={setDestination}>
                    <SelectTrigger data-testid="select-destination">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shop">Shop Floor</SelectItem>
                      <SelectItem value="waste">Waste/Spoilage</SelectItem>
                      <SelectItem value="return">Return to Vendor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="createdBy">Your Name</Label>
                  <Input
                    id="createdBy"
                    placeholder="Staff name"
                    value={createdBy}
                    onChange={(e) => setCreatedBy(e.target.value)}
                    data-testid="input-created-by"
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90 text-white mt-2"
                disabled={createDespatch.isPending || items.length === 0}
                data-testid="button-confirm-despatch"
              >
                {createDespatch.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                ) : (
                  <>Confirm Despatch ({items.length} item{items.length !== 1 ? 's' : ''})</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

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
              <div key={log.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-border/50 shadow-sm" data-testid={`log-${log.id}`}>
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
