import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Package, Cog, CheckCircle, ArrowLeft, Factory } from "lucide-react";
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href="/store">
            <Button variant="ghost" className="text-slate-400 hover:text-white mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Store
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Production Process</h1>
              <p className="text-slate-400">Pack and label items for dispatch</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-orange-600 flex items-center justify-center">
              <Factory className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="bg-slate-800 border border-slate-700 w-full justify-start p-1 h-auto">
            <TabsTrigger value="pending" className="px-6 data-[state=active]:bg-orange-600 data-[state=active]:text-white">
              To Process
            </TabsTrigger>
            <TabsTrigger value="ready" className="px-6 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              Ready ({processedItems.filter(i => i.status === 'ready').length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-3 mt-6">
            {itemsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
              </div>
            ) : purchaseItems.length === 0 ? (
              <Card className="bg-slate-800/30 border-slate-700">
                <CardContent className="py-12 text-center">
                  <Package className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                  <h2 className="text-xl font-bold text-white mb-2">No Items to Process</h2>
                  <p className="text-slate-400">Record purchases to populate this queue.</p>
                </CardContent>
              </Card>
            ) : (
              purchaseItems.map((item) => {
                const remaining = Number(item.quantity) - Number(item.quantityProcessed);
                const percentProcessed = (Number(item.quantityProcessed) / Number(item.quantity)) * 100;
                return (
                  <Card key={item.id} className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-orange-900/40 border border-orange-700/50 flex items-center justify-center">
                            <Package className="h-5 w-5 text-orange-400" />
                          </div>
                          <div>
                            <h3 className="font-medium text-white text-lg">{item.itemName}</h3>
                            <p className="text-sm text-slate-400">
                              {remaining} {item.unit} remaining
                            </p>
                          </div>
                        </div>
                        <Button
                          className="gap-2 bg-orange-600 hover:bg-orange-700"
                          onClick={() => openPackDialog(item)}
                        >
                          <Cog className="h-4 w-4" />
                          Pack
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-slate-400">
                          <span>Processed: {item.quantityProcessed} / {item.quantity}</span>
                          <span>{percentProcessed.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
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

          <TabsContent value="ready" className="space-y-3 mt-6">
            {processedLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
              </div>
            ) : processedItems.filter(i => i.status === 'ready').length === 0 ? (
              <Card className="bg-slate-800/30 border-slate-700">
                <CardContent className="py-12 text-center">
                  <CheckCircle className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                  <h2 className="text-xl font-bold text-white mb-2">No Ready Items</h2>
                  <p className="text-slate-400">Pack items to see them here.</p>
                </CardContent>
              </Card>
            ) : (
              processedItems.filter(i => i.status === 'ready').map((item) => (
                <Card key={item.id} className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-emerald-900/40 border border-emerald-700/50 flex items-center justify-center">
                          <CheckCircle className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                          <h3 className="font-medium text-white text-lg">{item.itemName}</h3>
                          <p className="text-sm text-slate-400">
                            {item.batchNumber || "No batch"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-white text-lg">{item.quantity} {item.unit}</p>
                        <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-600 bg-emerald-900/20">
                          Ready for Dispatch
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-700/50 flex justify-between items-center text-xs text-slate-500">
                      <span>Packed by {item.processedBy}</span>
                      <span>{format(new Date(item.processedAt), "MMM d, HH:mm")}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={packDialogOpen} onOpenChange={setPackDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-white">Pack Item for Dispatch</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePack} className="space-y-4">
            {selectedItem && (
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <p className="font-medium text-white">{selectedItem.itemName}</p>
                <div className="flex justify-between mt-2 text-sm">
                  <span className="text-slate-400">Available to pack:</span>
                  <span className="text-white font-bold">{Number(selectedItem.quantity) - Number(selectedItem.quantityProcessed)} {selectedItem.unit}</span>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="quantity" className="text-slate-300">Quantity to Pack *</Label>
              <Input
                id="quantity"
                type="number"
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batchNumber" className="text-slate-300">Batch Number</Label>
              <Input
                id="batchNumber"
                placeholder="BATCH-001"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="processedBy" className="text-slate-300">Packed By *</Label>
              <Input
                id="processedBy"
                placeholder="Your name"
                value={processedBy}
                onChange={(e) => setProcessedBy(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="ghost" onClick={closePackDialog} className="text-slate-400 hover:text-white hover:bg-slate-800">Cancel</Button>
              <Button type="submit" disabled={processItem.isPending} className="bg-orange-600 hover:bg-orange-700 text-white">
                {processItem.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Package className="h-4 w-4 mr-2" />}
                Pack Item
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
