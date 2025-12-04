import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Download, Loader2, Package, Truck, Plus, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface DespatchLog {
  id: string;
  itemName: string;
  quantity: string;
  destination: string;
  createdBy: string;
  createdAt: string;
}

interface GoodsReceipt {
  id: string;
  receivedBy: string;
  receivedAt: string;
  status: string;
}

interface ReceiveItem {
  itemName: string;
  expectedQuantity: number;
  receivedQuantity: number;
  unit: string;
  costPerUnit?: number;
}

export function GoodsReceived() {
  const [isReceiving, setIsReceiving] = useState(false);
  const [receivedBy, setReceivedBy] = useState("");
  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([]);
  const [notes, setNotes] = useState("");
  const [selectedDespatch, setSelectedDespatch] = useState<DespatchLog | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pending = [], isLoading: loadingPending } = useQuery<DespatchLog[]>({
    queryKey: ["/api/shop/goods/pending"],
    queryFn: async () => {
      const res = await fetch("/api/shop/goods/pending");
      return res.json();
    },
  });

  const { data: receipts = [], isLoading: loadingReceipts } = useQuery<GoodsReceipt[]>({
    queryKey: ["/api/shop/goods/receipts"],
    queryFn: async () => {
      const res = await fetch("/api/shop/goods/receipts");
      return res.json();
    },
  });

  const receiveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/shop/goods/receive", {
        despatchLogId: selectedDespatch?.id,
        receivedBy,
        items: receiveItems,
        notes,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Goods received successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/shop/goods/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shop/goods/receipts"] });
      setIsReceiving(false);
      setReceiveItems([]);
      setReceivedBy("");
      setNotes("");
      setSelectedDespatch(null);

      if (data.excelPath) {
        toast({ title: "Excel file generated" });
      }
    },
    onError: () => {
      toast({ title: "Failed to receive goods", variant: "destructive" });
    },
  });

  const startReceiving = (despatch?: DespatchLog) => {
    if (despatch) {
      setSelectedDespatch(despatch);
      setReceiveItems([{
        itemName: despatch.itemName,
        expectedQuantity: Number(despatch.quantity),
        receivedQuantity: Number(despatch.quantity),
        unit: "units",
      }]);
    } else {
      setReceiveItems([{ itemName: "", expectedQuantity: 0, receivedQuantity: 0, unit: "units" }]);
    }
    setIsReceiving(true);
  };

  const addItem = () => {
    setReceiveItems([...receiveItems, { itemName: "", expectedQuantity: 0, receivedQuantity: 0, unit: "units" }]);
  };

  const removeItem = (index: number) => {
    setReceiveItems(receiveItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof ReceiveItem, value: string | number) => {
    const updated = [...receiveItems];
    updated[index] = { ...updated[index], [field]: value };
    setReceiveItems(updated);
  };

  const downloadExcel = async (receiptId: string) => {
    try {
      const response = await fetch(`/api/shop/goods/receipt/${receiptId}/excel`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `goods_receipt_${receiptId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Failed to download Excel", variant: "destructive" });
    }
  };

  if (loadingPending || loadingReceipts) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isReceiving) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Receive Goods</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="receivedBy">Received By</Label>
              <Input
                id="receivedBy"
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
                placeholder="Your name"
                data-testid="input-received-by"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Items</Label>
                <Button size="sm" variant="outline" onClick={addItem} data-testid="button-add-item">
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>

              {receiveItems.map((item, index) => (
                <Card key={index} className="p-3">
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Item name"
                        value={item.itemName}
                        onChange={(e) => updateItem(index, "itemName", e.target.value)}
                        data-testid={`input-item-name-${index}`}
                      />
                      {receiveItems.length > 1 && (
                        <Button size="icon" variant="ghost" onClick={() => removeItem(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Expected</Label>
                        <Input
                          type="number"
                          value={item.expectedQuantity}
                          onChange={(e) => updateItem(index, "expectedQuantity", Number(e.target.value))}
                          data-testid={`input-expected-${index}`}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Received</Label>
                        <Input
                          type="number"
                          value={item.receivedQuantity}
                          onChange={(e) => updateItem(index, "receivedQuantity", Number(e.target.value))}
                          data-testid={`input-received-${index}`}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Cost/Unit</Label>
                        <Input
                          type="number"
                          value={item.costPerUnit || ""}
                          onChange={(e) => updateItem(index, "costPerUnit", Number(e.target.value))}
                          placeholder="0"
                          data-testid={`input-cost-${index}`}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                data-testid="input-notes"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsReceiving(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => receiveMutation.mutate()}
                disabled={!receivedBy || receiveItems.length === 0 || receiveMutation.isPending}
                data-testid="button-confirm-receive"
              >
                {receiveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Confirm Receipt
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase">
            Pending from Store
          </h3>
          {pending.map((despatch) => (
            <Card key={despatch.id} className="border-orange-200 bg-orange-50" data-testid={`card-pending-${despatch.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Truck className="h-5 w-5 text-orange-600" />
                    <div>
                      <p className="font-medium">{despatch.itemName}</p>
                      <p className="text-sm text-muted-foreground">
                        {despatch.quantity} units • From: {despatch.createdBy}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(despatch.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => startReceiving(despatch)} data-testid={`button-receive-${despatch.id}`}>
                    Receive
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </>
      )}

      <Button
        variant="outline"
        className="w-full"
        onClick={() => startReceiving()}
        data-testid="button-manual-receive"
      >
        <Plus className="h-4 w-4 mr-2" />
        Manual Entry
      </Button>

      {receipts.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase mt-6">
            Recent Receipts
          </h3>
          {receipts.slice(0, 10).map((receipt) => (
            <Card key={receipt.id} className="border-green-200" data-testid={`card-receipt-${receipt.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">Receipt</p>
                      <p className="text-sm text-muted-foreground">
                        By: {receipt.receivedBy}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(receipt.receivedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadExcel(receipt.id)}
                    data-testid={`button-download-${receipt.id}`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </>
      )}

      {pending.length === 0 && receipts.length === 0 && (
        <Card className="p-8 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-muted-foreground">No pending deliveries</p>
          <p className="text-xs text-muted-foreground mt-1">
            Items despatched from store will appear here
          </p>
        </Card>
      )}
    </div>
  );
}
