import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Truck, Loader2, Package, CheckCircle, Clock, Send, ArrowLeft } from "lucide-react";
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
        return <Badge variant="secondary" className="text-xs bg-yellow-900/30 text-yellow-400 border-yellow-700">Pending</Badge>;
      case "in_transit":
        return <Badge variant="secondary" className="text-xs bg-blue-900/30 text-blue-400 border-blue-700">In Transit</Badge>;
      case "delivered":
        return <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-600 bg-emerald-900/20">Delivered</Badge>;
      case "confirmed":
        return <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-600 bg-emerald-900/20">Confirmed</Badge>;
      default:
        return <Badge variant="outline" className="text-xs text-slate-400 border-slate-600">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "in_transit":
        return <Truck className="h-4 w-4 text-blue-500" />;
      case "delivered":
      case "confirmed":
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      default:
        return <Package className="h-4 w-4 text-slate-500" />;
    }
  };

  const readyItems = processedItems.filter(i => i.status === 'ready');

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
              <h1 className="text-2xl font-bold text-white mb-2">Despatch</h1>
              <p className="text-slate-400">Manage shipments to partner locations</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center">
              <Truck className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <Tabs defaultValue="send" className="w-full">
          <TabsList className="bg-slate-800 border border-slate-700 w-full justify-start p-1 h-auto">
            <TabsTrigger value="send" className="px-6 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Send ({readyItems.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="px-6 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="send" className="space-y-4 mt-6">
            {itemsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
              </div>
            ) : readyItems.length === 0 ? (
              <Card className="bg-slate-800/30 border-slate-700">
                <CardContent className="py-12 text-center">
                  <Package className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                  <h2 className="text-xl font-bold text-white mb-2">No Items Ready</h2>
                  <p className="text-slate-400">Pack items in Process tab first.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-blue-900/40 border border-blue-700/50 flex items-center justify-center text-blue-400">
                          <Truck className="h-4 w-4" />
                        </div>
                        <h2 className="font-semibold text-white">Select Items to Send</h2>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={selectAll}
                        className="text-blue-400 hover:text-white hover:bg-blue-900/30"
                      >
                        {selectedItems.length === readyItems.length ? "Deselect All" : "Select All"}
                      </Button>
                    </div>

                    <div className="space-y-2 mb-4">
                      {readyItems.map((item) => (
                        <div
                          key={item.id}
                          className={`p-3 rounded-lg border transition-colors cursor-pointer ${selectedItems.includes(item.id)
                            ? "bg-blue-900/20 border-blue-600"
                            : "bg-slate-900/50 border-slate-700 hover:border-slate-600"
                            }`}
                          onClick={() => toggleItem(item.id)}
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={selectedItems.includes(item.id)}
                              onCheckedChange={() => toggleItem(item.id)}
                              className="border-slate-500 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-white truncate">{item.itemName}</p>
                              <p className="text-xs text-slate-400">
                                {item.batchNumber || "No batch"} • {item.quantity} {item.unit}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-white">{item.quantity}</p>
                              <span className="text-xs text-slate-500">{item.unit}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {selectedItems.length > 0 && (
                      <div className="p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg mb-4">
                        <p className="text-sm text-blue-200">
                          <span className="font-bold text-white">{selectedItems.length}</span> item(s) selected for despatch
                        </p>
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="sentBy" className="text-slate-300">Sent By *</Label>
                        <Input
                          id="sentBy"
                          placeholder="Your name"
                          value={sentBy}
                          onChange={(e) => setSentBy(e.target.value)}
                          className="bg-slate-900 border-slate-600 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="notes" className="text-slate-300">Notes (Optional)</Label>
                        <Input
                          id="notes"
                          placeholder="Any special instructions..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="bg-slate-900 border-slate-600 text-white"
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        disabled={createDespatch.isPending || selectedItems.length === 0}
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

          <TabsContent value="history" className="space-y-3 mt-6">
            {despatchesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
              </div>
            ) : despatches.length === 0 ? (
              <Card className="bg-slate-800/30 border-slate-700">
                <CardContent className="py-12 text-center">
                  <Truck className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                  <h2 className="text-xl font-bold text-white mb-2">No Despatch History</h2>
                  <p className="text-slate-400">Completed despatches will appear here.</p>
                </CardContent>
              </Card>
            ) : (
              despatches.map((despatch) => (
                <Card key={despatch.id} className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(despatch.status)}
                        <span className="font-medium text-white text-sm">Despatch #{despatch.id.slice(-6)}</span>
                      </div>
                      {getStatusBadge(despatch.status)}
                    </div>
                    <div className="text-xs text-slate-400 space-y-1">
                      <p>To: {despatch.destination}</p>
                      <p>Items: {despatch.totalItems}</p>
                      <p>Sent by: {despatch.sentBy}</p>
                      <p>Date: {format(new Date(despatch.despatchDate), "MMM d, yyyy HH:mm")}</p>
                      {despatch.receivedBy && (
                        <p className="text-emerald-400">Received by: {despatch.receivedBy}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
