import { useState } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, AlertTriangle, Package, ShoppingCart, Clock, CheckCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { StoreItem, StoreReorder } from "@shared/schema";
import { format } from "date-fns";

interface ReorderItem {
  storeItemId: string;
  itemName: string;
  currentStock: number;
  minStock: number;
  suggestedQuantity: number;
  unit: string;
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case "urgent":
      return <Badge variant="destructive" className="text-xs">Urgent</Badge>;
    case "high":
      return <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">High</Badge>;
    case "normal":
      return <Badge variant="outline" className="text-xs">Normal</Badge>;
    case "low":
      return <Badge variant="outline" className="text-xs text-muted-foreground">Low</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{priority}</Badge>;
  }
}

export default function StoreReorderPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reorderDialogOpen, setReorderDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ReorderItem | null>(null);
  const [quantity, setQuantity] = useState("");
  const [priority, setPriority] = useState("normal");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [createdBy, setCreatedBy] = useState("");

  const { data: storeItems = [], isLoading: itemsLoading } = useQuery<StoreItem[]>({
    queryKey: ["/api/store-items"],
    queryFn: async () => {
      const res = await fetch("/api/store-items");
      if (!res.ok) throw new Error("Failed to fetch store items");
      return res.json();
    },
  });

  const { data: reorders = [], isLoading: reordersLoading } = useQuery<StoreReorder[]>({
    queryKey: ["/api/store-reorders"],
    queryFn: async () => {
      const res = await fetch("/api/store-reorders");
      if (!res.ok) throw new Error("Failed to fetch reorders");
      return res.json();
    },
  });

  const createReorder = useMutation({
    mutationFn: async (data: { storeItemId: string; itemName: string; currentStock: number; minStock: number; suggestedQuantity: number; unit: string; priority: string; estimatedCost?: number; createdBy: string }) => {
      const res = await fetch("/api/store-reorders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create reorder");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Reorder Created", description: "Reorder request has been logged.", className: "bg-blue-600 text-white border-none" });
      queryClient.invalidateQueries({ queryKey: ["/api/store-reorders"] });
      closeReorderDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const lowStockItems: ReorderItem[] = storeItems
    .filter(item => Number(item.currentStock) <= Number(item.minStock))
    .map(item => ({
      storeItemId: item.id,
      itemName: item.name,
      currentStock: Number(item.currentStock),
      minStock: Number(item.minStock),
      suggestedQuantity: Math.max(Number(item.minStock) * 2 - Number(item.currentStock), Number(item.minStock)),
      unit: item.unit,
    }))
    .sort((a, b) => {
      const aRatio = a.currentStock / a.minStock;
      const bRatio = b.currentStock / b.minStock;
      return aRatio - bRatio;
    });

  const openReorderDialog = (item: ReorderItem) => {
    setSelectedItem(item);
    setQuantity(String(item.suggestedQuantity));
    setPriority(item.currentStock <= item.minStock * 0.5 ? "high" : "normal");
    setReorderDialogOpen(true);
  };

  const closeReorderDialog = () => {
    setReorderDialogOpen(false);
    setSelectedItem(null);
    setQuantity("");
    setPriority("normal");
    setEstimatedCost("");
    setCreatedBy("");
  };

  const handleReorder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    if (!quantity || Number(quantity) <= 0) {
      toast({ title: "Invalid Quantity", description: "Please enter a valid quantity.", variant: "destructive" });
      return;
    }
    if (!createdBy.trim()) {
      toast({ title: "Missing Name", description: "Please enter your name.", variant: "destructive" });
      return;
    }
    createReorder.mutate({
      storeItemId: selectedItem.storeItemId,
      itemName: selectedItem.itemName,
      currentStock: selectedItem.currentStock,
      minStock: selectedItem.minStock,
      suggestedQuantity: Number(quantity),
      unit: selectedItem.unit,
      priority,
      estimatedCost: estimatedCost ? Number(estimatedCost) : undefined,
      createdBy,
    });
  };

  const getItemPriority = (item: ReorderItem): string => {
    const ratio = item.currentStock / item.minStock;
    if (ratio === 0) return "urgent";
    if (ratio <= 0.25) return "urgent";
    if (ratio <= 0.5) return "high";
    if (ratio <= 0.75) return "normal";
    return "low";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "ordered":
        return <ShoppingCart className="h-4 w-4 text-blue-600" />;
      case "received":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      default:
        return <Package className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <MobileShell theme="store" className="pb-20">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-4 border-b">
        <h1 className="text-xl font-bold tracking-tight text-primary" data-testid="text-page-title">Reorder</h1>
      </header>

      <main className="p-4 space-y-4">
        <Card className="bg-red-50 border-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-xs font-medium text-red-700">Items Below Minimum</span>
            </div>
            <p className="text-2xl font-bold text-red-900" data-testid="text-low-stock-count">{lowStockItems.length}</p>
          </CardContent>
        </Card>

        <Tabs defaultValue="needed" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="needed" data-testid="tab-needed">Needed ({lowStockItems.length})</TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="needed" className="space-y-3 mt-4">
            {itemsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : lowStockItems.length === 0 ? (
              <Card className="p-8 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-2" />
                <p className="text-muted-foreground font-medium">All items are well stocked!</p>
                <p className="text-xs text-muted-foreground mt-1">No reorders needed at this time</p>
              </Card>
            ) : (
              lowStockItems.map((item) => {
                const itemPriority = getItemPriority(item);
                return (
                  <Card key={item.storeItemId} className="border-none shadow-sm" data-testid={`reorder-item-${item.storeItemId}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                            itemPriority === "urgent" ? "bg-red-100" : 
                            itemPriority === "high" ? "bg-orange-100" : "bg-yellow-100"
                          }`}>
                            <AlertTriangle className={`h-5 w-5 ${
                              itemPriority === "urgent" ? "text-red-600" : 
                              itemPriority === "high" ? "text-orange-600" : "text-yellow-600"
                            }`} />
                          </div>
                          <div>
                            <h3 className="font-medium text-sm">{item.itemName}</h3>
                            <p className="text-xs text-muted-foreground">
                              Min: {item.minStock} {item.unit}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-red-600">{item.currentStock}</p>
                          <span className="text-xs text-muted-foreground">{item.unit}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        {getPriorityBadge(itemPriority)}
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => openReorderDialog(item)}
                          data-testid={`button-reorder-${item.storeItemId}`}
                        >
                          <ShoppingCart className="h-4 w-4" />
                          Reorder
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-3 mt-4">
            {reordersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : reorders.length === 0 ? (
              <Card className="p-8 text-center">
                <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground">No reorder history</p>
              </Card>
            ) : (
              reorders.map((reorder) => (
                <Card key={reorder.id} className="border-none shadow-sm" data-testid={`reorder-history-${reorder.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(reorder.status)}
                        <span className="font-medium text-sm">{reorder.itemName}</span>
                      </div>
                      <Badge variant="outline" className="text-xs capitalize">
                        {reorder.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Quantity: {reorder.suggestedQuantity} {reorder.unit}</p>
                      <div className="flex items-center gap-2">
                        {getPriorityBadge(reorder.priority)}
                        {reorder.estimatedCost && (
                          <span className="text-green-700">Est: KES {Number(reorder.estimatedCost).toFixed(2)}</span>
                        )}
                      </div>
                      <p>Created: {format(new Date(reorder.createdAt), "MMM d, yyyy")}</p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={reorderDialogOpen} onOpenChange={setReorderDialogOpen}>
        <DialogContent className="max-w-[350px] rounded-lg">
          <DialogHeader>
            <DialogTitle>Create Reorder</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleReorder} className="space-y-4">
            {selectedItem && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium">{selectedItem.itemName}</p>
                <p className="text-sm text-muted-foreground">
                  Current: {selectedItem.currentStock} / Min: {selectedItem.minStock} {selectedItem.unit}
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <Input
                  id="quantity"
                  type="number"
                  placeholder="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  data-testid="input-reorder-quantity"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger data-testid="select-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimatedCost">Estimated Cost (KES)</Label>
              <Input
                id="estimatedCost"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                data-testid="input-estimated-cost"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="createdBy">Requested By *</Label>
              <Input
                id="createdBy"
                placeholder="Your name"
                value={createdBy}
                onChange={(e) => setCreatedBy(e.target.value)}
                data-testid="input-created-by"
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" data-testid="button-cancel-reorder">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={createReorder.isPending} data-testid="button-confirm-reorder">
                {createReorder.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Reorder
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <BottomNav role="store" />
    </MobileShell>
  );
}
