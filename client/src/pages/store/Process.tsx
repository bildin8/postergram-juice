import { useState } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Package, Cog, CheckCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { StorePurchaseItem, StoreProcessedItem } from "@shared/schema";
import { format } from "date-fns";

export default function StoreProcess() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [packDialogOpen, setPackDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StorePurchaseItem | null>(null);
  const [quantity, setQuantity] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [processedBy, setProcessedBy] = useState("");

  const { data: purchaseItems = [], isLoading: itemsLoading } = useQuery<StorePurchaseItem[]>({
    queryKey: ["/api/store-purchase-items", "pending"],
    queryFn: async () => {
      const res = await fetch("/api/store-purchase-items?status=pending");
      if (!res.ok) throw new Error("Failed to fetch items");
      return res.json();
    },
  });

  const { data: processedItems = [], isLoading: processedLoading } = useQuery<StoreProcessedItem[]>({
    queryKey: ["/api/store-processed-items"],
    queryFn: async () => {
      const res = await fetch("/api/store-processed-items");
      if (!res.ok) throw new Error("Failed to fetch processed items");
      return res.json();
    },
  });

  const processItem = useMutation({
    mutationFn: async (data: { purchaseItemId: string; quantity: string; batchNumber: string; processedBy: string }) => {
      const res = await fetch("/api/store-processed-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to process item");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Item Packed", description: "Item is ready for dispatch.", className: "bg-emerald-600 text-white border-none" });
      queryClient.invalidateQueries({ queryKey: ["/api/store-purchase-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store-processed-items"] });
      closePackDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const openPackDialog = (item: StorePurchaseItem) => {
    setSelectedItem(item);
    const remaining = Number(item.quantity) - Number(item.quantityProcessed);
    setQuantity(String(remaining));
    setBatchNumber(`BATCH-${Date.now().toString().slice(-6)}`);
    setPackDialogOpen(true);
  };

  const closePackDialog = () => {
    setPackDialogOpen(false);
    setSelectedItem(null);
    setQuantity("");
    setBatchNumber("");
    setProcessedBy("");
  };

  const handlePack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    if (!quantity || Number(quantity) <= 0) {
      toast({ title: "Invalid Quantity", description: "Please enter a valid quantity.", variant: "destructive" });
      return;
    }
    if (!processedBy.trim()) {
      toast({ title: "Missing Name", description: "Please enter your name.", variant: "destructive" });
      return;
    }
    const remaining = Number(selectedItem.quantity) - Number(selectedItem.quantityProcessed);
    if (Number(quantity) > remaining) {
      toast({ title: "Exceeds Available", description: `Maximum available: ${remaining}`, variant: "destructive" });
      return;
    }
    processItem.mutate({
      purchaseItemId: selectedItem.id,
      quantity,
      batchNumber,
      processedBy,
    });
  };

  return (
    <MobileShell theme="store" className="pb-20">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-4 border-b">
        <h1 className="text-xl font-bold tracking-tight text-primary" data-testid="text-page-title">Process</h1>
      </header>

      <main className="p-4 space-y-4">
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="pending" data-testid="tab-pending">To Process</TabsTrigger>
            <TabsTrigger value="ready" data-testid="tab-ready">Ready ({processedItems.filter(i => i.status === 'ready').length})</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-3 mt-4">
            {itemsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : purchaseItems.length === 0 ? (
              <Card className="p-8 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground">No items to process</p>
                <p className="text-xs text-muted-foreground mt-1">Record purchases to see items here</p>
              </Card>
            ) : (
              purchaseItems.map((item) => {
                const remaining = Number(item.quantity) - Number(item.quantityProcessed);
                const percentProcessed = (Number(item.quantityProcessed) / Number(item.quantity)) * 100;
                return (
                  <Card key={item.id} className="border-none shadow-sm" data-testid={`purchase-item-${item.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                            <Package className="h-5 w-5 text-orange-600" />
                          </div>
                          <div>
                            <h3 className="font-medium text-sm">{item.itemName}</h3>
                            <p className="text-xs text-muted-foreground">
                              {remaining} {item.unit} remaining
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="gap-1"
                          onClick={() => openPackDialog(item)}
                          data-testid={`button-pack-${item.id}`}
                        >
                          <Cog className="h-4 w-4" />
                          Pack
                        </Button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Processed: {item.quantityProcessed} / {item.quantity}</span>
                          <span>{percentProcessed.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-500 transition-all"
                            style={{ width: `${percentProcessed}%` }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="ready" className="space-y-3 mt-4">
            {processedLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : processedItems.filter(i => i.status === 'ready').length === 0 ? (
              <Card className="p-8 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground">No items ready for dispatch</p>
              </Card>
            ) : (
              processedItems.filter(i => i.status === 'ready').map((item) => (
                <Card key={item.id} className="border-none shadow-sm" data-testid={`processed-item-${item.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-sm">{item.itemName}</h3>
                          <p className="text-xs text-muted-foreground">
                            {item.batchNumber || "No batch"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{item.quantity} {item.unit}</p>
                        <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50">
                          Ready
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Packed by {item.processedBy} • {format(new Date(item.processedAt), "MMM d, HH:mm")}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={packDialogOpen} onOpenChange={setPackDialogOpen}>
        <DialogContent className="max-w-[350px] rounded-lg">
          <DialogHeader>
            <DialogTitle>Pack Item for Dispatch</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePack} className="space-y-4">
            {selectedItem && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="font-medium">{selectedItem.itemName}</p>
                <p className="text-sm text-muted-foreground">
                  Available: {Number(selectedItem.quantity) - Number(selectedItem.quantityProcessed)} {selectedItem.unit}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity to Pack *</Label>
              <Input
                id="quantity"
                type="number"
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                data-testid="input-pack-quantity"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batchNumber">Batch Number</Label>
              <Input
                id="batchNumber"
                placeholder="BATCH-001"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                data-testid="input-batch-number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="processedBy">Packed By *</Label>
              <Input
                id="processedBy"
                placeholder="Your name"
                value={processedBy}
                onChange={(e) => setProcessedBy(e.target.value)}
                data-testid="input-processed-by"
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" data-testid="button-cancel-pack">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={processItem.isPending} data-testid="button-confirm-pack">
                {processItem.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Pack Item
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <BottomNav role="store" />
    </MobileShell>
  );
}
