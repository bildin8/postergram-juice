import { useState } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Truck, Loader2, Package, CheckCircle, Clock, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { StoreProcessedItem, StoreDespatch as StoreDespatchType } from "@shared/schema";
import { format } from "date-fns";

export default function StoreDespatch() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [sentBy, setSentBy] = useState("");
  const [notes, setNotes] = useState("");

  const { data: processedItems = [], isLoading: itemsLoading } = useQuery<StoreProcessedItem[]>({
    queryKey: ["/api/store-processed-items", "ready"],
    queryFn: async () => {
      const res = await fetch("/api/store-processed-items?status=ready");
      if (!res.ok) throw new Error("Failed to fetch processed items");
      return res.json();
    },
  });

  const { data: despatches = [], isLoading: despatchesLoading } = useQuery<StoreDespatchType[]>({
    queryKey: ["/api/store-despatches"],
    queryFn: async () => {
      const res = await fetch("/api/store-despatches");
      if (!res.ok) throw new Error("Failed to fetch despatches");
      return res.json();
    },
  });

  const createDespatch = useMutation({
    mutationFn: async (data: { itemIds: string[]; sentBy: string; notes: string }) => {
      const res = await fetch("/api/store-despatches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create despatch");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Despatch Created", description: "Items have been sent to shop.", className: "bg-emerald-600 text-white border-none" });
      queryClient.invalidateQueries({ queryKey: ["/api/store-processed-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store-despatches"] });
      setSelectedItems([]);
      setSentBy("");
      setNotes("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleItem = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedItems.length === processedItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(processedItems.map(i => i.id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0) {
      toast({ title: "No Items Selected", description: "Please select items to despatch.", variant: "destructive" });
      return;
    }
    if (!sentBy.trim()) {
      toast({ title: "Missing Name", description: "Please enter your name.", variant: "destructive" });
      return;
    }
    createDespatch.mutate({ itemIds: selectedItems, sentBy, notes });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-700">Pending</Badge>;
      case "in_transit":
        return <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">In Transit</Badge>;
      case "delivered":
        return <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50">Delivered</Badge>;
      case "confirmed":
        return <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50">Confirmed</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "in_transit":
        return <Truck className="h-4 w-4 text-blue-600" />;
      case "delivered":
      case "confirmed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      default:
        return <Package className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const readyItems = processedItems.filter(i => i.status === 'ready');

  return (
    <MobileShell theme="store" className="pb-20">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-4 border-b">
        <h1 className="text-xl font-bold tracking-tight text-primary" data-testid="text-page-title">Despatch</h1>
      </header>

      <main className="p-4 space-y-4">
        <Tabs defaultValue="send" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="send" data-testid="tab-send">Send ({readyItems.length})</TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="send" className="space-y-4 mt-4">
            {itemsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : readyItems.length === 0 ? (
              <Card className="p-8 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground">No items ready for despatch</p>
                <p className="text-xs text-muted-foreground mt-1">Pack items in Process tab first</p>
              </Card>
            ) : (
              <>
                <Card className="border-none shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <Truck className="h-4 w-4" />
                        </div>
                        <h2 className="font-semibold">Select Items to Send</h2>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={selectAll}
                        data-testid="button-select-all"
                      >
                        {selectedItems.length === readyItems.length ? "Deselect All" : "Select All"}
                      </Button>
                    </div>

                    <div className="space-y-2 mb-4">
                      {readyItems.map((item) => (
                        <div 
                          key={item.id} 
                          className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                            selectedItems.includes(item.id) 
                              ? "bg-primary/5 border-primary" 
                              : "bg-muted/30 border-transparent"
                          }`}
                          onClick={() => toggleItem(item.id)}
                          data-testid={`despatch-item-${item.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={selectedItems.includes(item.id)}
                              onCheckedChange={() => toggleItem(item.id)}
                              data-testid={`checkbox-item-${item.id}`}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{item.itemName}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.batchNumber || "No batch"} • {item.quantity} {item.unit}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">{item.quantity}</p>
                              <span className="text-xs text-muted-foreground">{item.unit}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {selectedItems.length > 0 && (
                      <div className="p-3 bg-blue-50 rounded-lg mb-4">
                        <p className="text-sm text-blue-700">
                          <span className="font-medium">{selectedItems.length}</span> item(s) selected for despatch
                        </p>
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="sentBy">Sent By *</Label>
                        <Input
                          id="sentBy"
                          placeholder="Your name"
                          value={sentBy}
                          onChange={(e) => setSentBy(e.target.value)}
                          data-testid="input-sent-by"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="notes">Notes (Optional)</Label>
                        <Input
                          id="notes"
                          placeholder="Any special instructions..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          data-testid="input-notes"
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={createDespatch.isPending || selectedItems.length === 0}
                        data-testid="button-create-despatch"
                      >
                        {createDespatch.isPending ? (
                          <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending...</>
                        ) : (
                          <><Send className="h-4 w-4 mr-2" /> Send to Shop ({selectedItems.length})</>
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-3 mt-4">
            {despatchesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : despatches.length === 0 ? (
              <Card className="p-8 text-center">
                <Truck className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground">No despatch history</p>
              </Card>
            ) : (
              despatches.map((despatch) => (
                <Card key={despatch.id} className="border-none shadow-sm" data-testid={`despatch-${despatch.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(despatch.status)}
                        <span className="font-medium text-sm">Despatch #{despatch.id.slice(-6)}</span>
                      </div>
                      {getStatusBadge(despatch.status)}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>To: {despatch.destination}</p>
                      <p>Items: {despatch.totalItems}</p>
                      <p>Sent by: {despatch.sentBy}</p>
                      <p>Date: {format(new Date(despatch.despatchDate), "MMM d, yyyy HH:mm")}</p>
                      {despatch.receivedBy && (
                        <p className="text-green-700">Received by: {despatch.receivedBy}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>

      <BottomNav role="store" />
    </MobileShell>
  );
}
