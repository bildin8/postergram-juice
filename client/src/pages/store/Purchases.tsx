import { useState } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Loader2, ShoppingCart, Package, Save } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { StoreItem, StorePurchase } from "@shared/schema";
import { format } from "date-fns";

interface PurchaseRow {
  id: string;
  storeItemId: string;
  itemName: string;
  quantity: string;
  unit: string;
  costPerUnit: string;
}

export default function StorePurchases() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [supplier, setSupplier] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [rows, setRows] = useState<PurchaseRow[]>([
    { id: "1", storeItemId: "", itemName: "", quantity: "", unit: "pcs", costPerUnit: "" }
  ]);

  const { data: storeItems = [] } = useQuery<StoreItem[]>({
    queryKey: ["/api/store-items"],
    queryFn: async () => {
      const res = await fetch("/api/store-items");
      if (!res.ok) throw new Error("Failed to fetch store items");
      return res.json();
    },
  });

  const { data: purchases = [], isLoading: purchasesLoading } = useQuery<StorePurchase[]>({
    queryKey: ["/api/store-purchases"],
    queryFn: async () => {
      const res = await fetch("/api/store-purchases");
      if (!res.ok) throw new Error("Failed to fetch purchases");
      return res.json();
    },
  });

  const createPurchase = useMutation({
    mutationFn: async (data: { supplier: string; invoiceNumber: string; createdBy: string; items: PurchaseRow[] }) => {
      const res = await fetch("/api/store-purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create purchase");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Purchase Recorded", description: "Items have been added to stock.", className: "bg-emerald-600 text-white border-none" });
      queryClient.invalidateQueries({ queryKey: ["/api/store-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/store-items"] });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setSupplier("");
    setInvoiceNumber("");
    setCreatedBy("");
    setRows([{ id: "1", storeItemId: "", itemName: "", quantity: "", unit: "pcs", costPerUnit: "" }]);
  };

  const addRow = () => {
    setRows([...rows, { id: Date.now().toString(), storeItemId: "", itemName: "", quantity: "", unit: "pcs", costPerUnit: "" }]);
  };

  const removeRow = (id: string) => {
    if (rows.length === 1) return;
    setRows(rows.filter(r => r.id !== id));
  };

  const updateRow = (id: string, field: keyof PurchaseRow, value: string) => {
    setRows(rows.map(r => {
      if (r.id !== id) return r;
      if (field === "storeItemId") {
        const item = storeItems.find(i => i.id === value);
        return { ...r, storeItemId: value, itemName: item?.name || "", unit: item?.unit || "pcs" };
      }
      return { ...r, [field]: value };
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = rows.filter(r => r.itemName.trim() && r.quantity);
    if (validRows.length === 0) {
      toast({ title: "No Items", description: "Please add at least one item.", variant: "destructive" });
      return;
    }
    if (!createdBy.trim()) {
      toast({ title: "Missing Name", description: "Please enter your name.", variant: "destructive" });
      return;
    }
    createPurchase.mutate({ supplier, invoiceNumber, createdBy, items: validRows });
  };

  const totalAmount = rows.reduce((sum, row) => {
    const qty = parseFloat(row.quantity) || 0;
    const cost = parseFloat(row.costPerUnit) || 0;
    return sum + (qty * cost);
  }, 0);

  return (
    <MobileShell theme="store" className="pb-20">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-4 border-b">
        <h1 className="text-xl font-bold tracking-tight text-primary" data-testid="text-page-title">Purchases</h1>
      </header>

      <main className="p-4 space-y-4">
        <Tabs defaultValue="new" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="new" data-testid="tab-new-purchase">New Purchase</TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-4 mt-4">
            <Card className="border-none shadow-md">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <ShoppingCart className="h-4 w-4" />
                  </div>
                  <h2 className="font-semibold">Record Supplier Delivery</h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="supplier">Supplier</Label>
                      <Input
                        id="supplier"
                        placeholder="Supplier name"
                        value={supplier}
                        onChange={(e) => setSupplier(e.target.value)}
                        data-testid="input-supplier"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invoice">Invoice #</Label>
                      <Input
                        id="invoice"
                        placeholder="INV-001"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        data-testid="input-invoice"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Items</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addRow} data-testid="button-add-row">
                        <Plus className="h-4 w-4 mr-1" /> Add Row
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {rows.map((row, index) => (
                        <div key={row.id} className="p-3 bg-muted/30 rounded-lg space-y-2" data-testid={`purchase-row-${index}`}>
                          <div className="flex items-center gap-2">
                            <Select value={row.storeItemId} onValueChange={(v) => updateRow(row.id, "storeItemId", v)}>
                              <SelectTrigger className="flex-1" data-testid={`select-item-${index}`}>
                                <SelectValue placeholder="Select item..." />
                              </SelectTrigger>
                              <SelectContent>
                                {storeItems.map(item => (
                                  <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {rows.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => removeRow(row.id)}
                                data-testid={`button-remove-row-${index}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          {!row.storeItemId && (
                            <Input
                              placeholder="Or enter item name..."
                              value={row.itemName}
                              onChange={(e) => updateRow(row.id, "itemName", e.target.value)}
                              data-testid={`input-item-name-${index}`}
                            />
                          )}
                          <div className="grid grid-cols-3 gap-2">
                            <Input
                              type="number"
                              placeholder="Qty"
                              value={row.quantity}
                              onChange={(e) => updateRow(row.id, "quantity", e.target.value)}
                              data-testid={`input-qty-${index}`}
                            />
                            <Select value={row.unit} onValueChange={(v) => updateRow(row.id, "unit", v)}>
                              <SelectTrigger data-testid={`select-unit-${index}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pcs">pcs</SelectItem>
                                <SelectItem value="kg">kg</SelectItem>
                                <SelectItem value="g">g</SelectItem>
                                <SelectItem value="L">L</SelectItem>
                                <SelectItem value="ml">ml</SelectItem>
                                <SelectItem value="boxes">boxes</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Cost"
                              value={row.costPerUnit}
                              onChange={(e) => updateRow(row.id, "costPerUnit", e.target.value)}
                              data-testid={`input-cost-${index}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {totalAmount > 0 && (
                    <div className="p-3 bg-green-50 rounded-lg flex justify-between items-center">
                      <span className="text-sm font-medium text-green-700">Total Amount:</span>
                      <span className="text-lg font-bold text-green-900" data-testid="text-total-amount">
                        KES {totalAmount.toFixed(2)}
                      </span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="createdBy">Recorded By *</Label>
                    <Input
                      id="createdBy"
                      placeholder="Your name"
                      value={createdBy}
                      onChange={(e) => setCreatedBy(e.target.value)}
                      data-testid="input-created-by"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={createPurchase.isPending}
                    data-testid="button-save-purchase"
                  >
                    {createPurchase.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</>
                    ) : (
                      <><Save className="h-4 w-4 mr-2" /> Save All</>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-3 mt-4">
            {purchasesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : purchases.length === 0 ? (
              <Card className="p-8 text-center">
                <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground">No purchases recorded yet</p>
              </Card>
            ) : (
              purchases.map((purchase) => (
                <Card key={purchase.id} className="border-none shadow-sm" data-testid={`purchase-${purchase.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{purchase.supplier || "Unknown Supplier"}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {purchase.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      {purchase.invoiceNumber && <p>Invoice: {purchase.invoiceNumber}</p>}
                      <p>Date: {format(new Date(purchase.purchaseDate), "MMM d, yyyy")}</p>
                      {purchase.totalAmount && (
                        <p className="font-medium text-green-700">Total: KES {Number(purchase.totalAmount).toFixed(2)}</p>
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
