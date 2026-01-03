import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Truck, Loader2, Package, CheckCircle, Clock, Send, ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

interface SRRItem {
  id: string;
  item_name: string;
  requested_qty: number;
  approved_qty: number;
  unit: string;
}

interface SRR {
  id: string;
  status: string;
  requested_by: string;
  requested_at: string;
  approved_by: string;
  approved_at: string;
  items: SRRItem[];
}

interface DespatchRecord {
  id: string;
  destination: string;
  status: string;
  total_items: number;
  sent_by: string;
  created_at: string;
  notes?: string;
}

export default function StoreDespatch() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSRR, setSelectedSRR] = useState<SRR | null>(null);
  const [sentBy, setSentBy] = useState("");
  const [notes, setNotes] = useState("");
  const [pickedQuantities, setPickedQuantities] = useState<Record<string, number>>({});

  // Fetch Queue (Approved SRRs)
  const { data: queue = [], isLoading: queueLoading } = useQuery<SRR[]>({
    queryKey: ["/api/store/queue/to-dispatch"],
    queryFn: async () => {
      const res = await fetch("/api/store/queue/to-dispatch");
      if (!res.ok) throw new Error("Failed to fetch dispatch queue");
      return res.json();
    },
  });

  // Fetch History
  const { data: history = [], isLoading: historyLoading } = useQuery<DespatchRecord[]>({
    queryKey: ["/api/store/dispatches"],
    queryFn: async () => {
      const res = await fetch("/api/store/dispatches");
      if (!res.ok) throw new Error("Failed to fetch dispatch history");
      return res.json();
    },
  });

  const createDespatch = useMutation({
    mutationFn: async () => {
      if (!selectedSRR) throw new Error("No request selected");

      const items = selectedSRR.items.map(item => ({
        srrItemId: item.id,
        pickedQty: pickedQuantities[item.id] ?? (item.approved_qty || item.requested_qty),
      }));

      const res = await fetch("/api/store/dispatches/from-srr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          srrId: selectedSRR.id,
          sentBy,
          items,
          notes
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create despatch");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Despatch Created", description: "Items have been sent to shop.", className: "bg-emerald-600 text-white border-none" });
      queryClient.invalidateQueries({ queryKey: ["/api/store/queue/to-dispatch"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store/dispatches"] });
      setSelectedSRR(null);
      setSentBy("");
      setNotes("");
      setPickedQuantities({});
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handlePickChange = (id: string, qty: number) => {
    setPickedQuantities(prev => ({ ...prev, [id]: qty }));
  };

  const initDispatch = (srr: SRR) => {
    setSelectedSRR(srr);
    // Pre-fill picked quantities with approved amounts
    const initial: Record<string, number> = {};
    srr.items.forEach(item => {
      initial[item.id] = item.approved_qty || item.requested_qty;
    });
    setPickedQuantities(initial);
  };

  if (selectedSRR) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Button
              variant="ghost"
              className="text-slate-400 hover:text-white mb-4"
              onClick={() => setSelectedSRR(null)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Queue
            </Button>
            <h1 className="text-2xl font-bold text-white mb-2">Dispatch Order</h1>
            <p className="text-slate-400">Request from {selectedSRR.requested_by}</p>
          </div>

          <Card className="bg-slate-800/50 border-slate-700 mb-6">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-500" />
                Pick Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {selectedSRR.items.map((item) => (
                  <div key={item.id} className="p-4 rounded-lg bg-slate-900/50 border border-slate-700 flex justify-between items-center">
                    <div>
                      <p className="text-white font-medium">{item.item_name}</p>
                      <p className="text-sm text-slate-400">Approved: {item.approved_qty} {item.unit}</p>
                    </div>
                    <div className="w-32">
                      <Label className="text-xs text-slate-400 mb-1">Picked Qty</Label>
                      <Input
                        type="number"
                        className="bg-slate-800 border-slate-600 text-white"
                        value={pickedQuantities[item.id] || ''}
                        onChange={(e) => handlePickChange(item.id, parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label className="text-white">Sent By *</Label>
                <Input
                  value={sentBy}
                  onChange={(e) => setSentBy(e.target.value)}
                  placeholder="Your Name"
                  className="bg-slate-900 border-slate-600 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-white">Notes</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Seal Code, Box Count"
                  className="bg-slate-900 border-slate-600 text-white mt-1"
                />
              </div>
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 mt-4"
                disabled={!sentBy || createDespatch.isPending}
                onClick={() => createDespatch.mutate()}
              >
                {createDespatch.isPending ? "Dispatching..." : (
                  <>
                    <Truck className="h-4 w-4 mr-2" />
                    Confirm Dispatch
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
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

        <Tabs defaultValue="queue" className="w-full">
          <TabsList className="bg-slate-800 border border-slate-700 w-full justify-start p-1 h-auto">
            <TabsTrigger value="queue" className="px-6 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              To Dispatch ({queue.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="px-6 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="mt-6 space-y-4">
            {queueLoading && <div className="text-center py-12 text-slate-400">Loading...</div>}

            {!queueLoading && queue.length === 0 && (
              <Card className="bg-slate-800/30 border-slate-700">
                <CardContent className="py-12 text-center">
                  <Package className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                  <h2 className="text-xl font-bold text-white mb-2">No Items to Dispatch</h2>
                  <p className="text-slate-400">Waiting for approved replenishment requests.</p>
                </CardContent>
              </Card>
            )}

            {queue.map(srr => (
              <Card key={srr.id} className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-white font-medium text-lg">Order from {srr.requested_by}</h3>
                    <p className="text-slate-400 text-sm">
                      {srr.items?.length || 0} items • Approved {new Date(srr.approved_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button onClick={() => initDispatch(srr)} className="bg-blue-600 hover:bg-blue-700">
                    Prepare Dispatch
                  </Button>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="history" className="mt-6 space-y-4">
            {historyLoading && <div className="text-center py-12 text-slate-400">Loading...</div>}

            {history.map(d => (
              <Card key={d.id} className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-4">
                  <div className="flex justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-emerald-900/30 p-2 rounded-full"><CheckCircle className="h-4 w-4 text-emerald-400" /></div>
                      <div>
                        <p className="text-white font-medium">Despatch #{d.id.slice(0, 8)}</p>
                        <p className="text-xs text-slate-400">{format(new Date(d.created_at), "MMM d, HH:mm")} • By {d.sent_by}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-slate-600 text-slate-400">{d.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
