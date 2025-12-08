import { useState } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Package, AlertTriangle, Loader2, Pencil } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { StoreItem } from "@shared/schema";

function getStockStatus(item: StoreItem): "good" | "low" | "critical" {
  const current = Number(item.currentStock);
  const min = Number(item.minStock);
  if (current <= min * 0.5) return "critical";
  if (current <= min) return "low";
  return "good";
}

export default function StoreStock() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    category: "general",
    unit: "pcs",
    minStock: "",
    currentStock: "",
    costPerUnit: "",
  });

  const { data: items = [], isLoading } = useQuery<StoreItem[]>({
    queryKey: ["/api/store-items"],
    queryFn: async () => {
      const res = await fetch("/api/store-items");
      if (!res.ok) throw new Error("Failed to fetch store items");
      return res.json();
    },
  });

  const createItem = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/store-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create item");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Item Added", description: "New item has been added to stock." });
      queryClient.invalidateQueries({ queryKey: ["/api/store-items"] });
      setAddDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const res = await fetch(`/api/store-items/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update item");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Item Updated", description: "Item has been updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/store-items"] });
      setEditDialogOpen(false);
      setSelectedItem(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      category: "general",
      unit: "pcs",
      minStock: "",
      currentStock: "",
      costPerUnit: "",
    });
  };

  const openEditDialog = (item: StoreItem) => {
    setSelectedItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      unit: item.unit,
      minStock: String(item.minStock),
      currentStock: String(item.currentStock),
      costPerUnit: item.costPerUnit ? String(item.costPerUnit) : "",
    });
    setEditDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: "Missing Name", description: "Please enter an item name.", variant: "destructive" });
      return;
    }
    createItem.mutate(formData);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !formData.name.trim()) return;
    updateItem.mutate({ id: selectedItem.id, data: formData });
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalItems = items.length;
  const lowStockCount = items.filter(item => {
    const status = getStockStatus(item);
    return status === "low" || status === "critical";
  }).length;

  const ItemForm = ({ onSubmit, isEdit = false }: { onSubmit: (e: React.FormEvent) => void; isEdit?: boolean }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Item Name *</Label>
        <Input
          id="name"
          placeholder="e.g. Sugar, Coffee Beans"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          data-testid="input-item-name"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
            <SelectTrigger data-testid="select-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="ingredients">Ingredients</SelectItem>
              <SelectItem value="packaging">Packaging</SelectItem>
              <SelectItem value="supplies">Supplies</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit">Unit</Label>
          <Select value={formData.unit} onValueChange={(v) => setFormData({ ...formData, unit: v })}>
            <SelectTrigger data-testid="select-unit">
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
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="currentStock">Current Stock</Label>
          <Input
            id="currentStock"
            type="number"
            placeholder="0"
            value={formData.currentStock}
            onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })}
            data-testid="input-current-stock"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="minStock">Min Stock</Label>
          <Input
            id="minStock"
            type="number"
            placeholder="0"
            value={formData.minStock}
            onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
            data-testid="input-min-stock"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="costPerUnit">Cost per Unit</Label>
        <Input
          id="costPerUnit"
          type="number"
          step="0.01"
          placeholder="0.00"
          value={formData.costPerUnit}
          onChange={(e) => setFormData({ ...formData, costPerUnit: e.target.value })}
          data-testid="input-cost-per-unit"
        />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" data-testid="button-cancel">Cancel</Button>
        </DialogClose>
        <Button 
          type="submit" 
          disabled={createItem.isPending || updateItem.isPending}
          data-testid={isEdit ? "button-update-item" : "button-add-item"}
        >
          {(createItem.isPending || updateItem.isPending) ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          {isEdit ? "Update Item" : "Add Item"}
        </Button>
      </DialogFooter>
    </form>
  );

  return (
    <MobileShell theme="store" className="pb-20">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold tracking-tight text-primary" data-testid="text-page-title">Stock</h1>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" data-testid="button-add-new-item">
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[350px] rounded-lg">
              <DialogHeader>
                <DialogTitle>Add New Item</DialogTitle>
              </DialogHeader>
              <ItemForm onSubmit={handleSubmit} />
            </DialogContent>
          </Dialog>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            className="pl-9 bg-secondary/50 border-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search"
          />
        </div>
      </header>

      <main className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-blue-50 border-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-700">Total Items</span>
              </div>
              <p className="text-2xl font-bold text-blue-900" data-testid="text-total-items">{totalItems}</p>
            </CardContent>
          </Card>
          <Card className="bg-orange-50 border-none">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <span className="text-xs font-medium text-orange-700">Low Stock</span>
              </div>
              <p className="text-2xl font-bold text-orange-900" data-testid="text-low-stock-count">{lowStockCount}</p>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mb-2 opacity-50" />
            <p className="text-sm">No items found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => {
              const status = getStockStatus(item);
              return (
                <Card key={item.id} className="border-none shadow-sm" data-testid={`stock-item-${item.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="font-medium text-sm">{item.name}</h3>
                          <p className="text-xs text-muted-foreground">Min: {item.minStock} {item.unit}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="font-bold text-lg" data-testid={`text-stock-${item.id}`}>
                            {item.currentStock}
                          </p>
                          <span className="text-xs text-muted-foreground">{item.unit}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(item)}
                          data-testid={`button-edit-${item.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end">
                      {status === "critical" && (
                        <Badge variant="destructive" className="text-xs">Critical</Badge>
                      )}
                      {status === "low" && (
                        <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-700">Low</Badge>
                      )}
                      {status === "good" && (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50">OK</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-[350px] rounded-lg">
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
          </DialogHeader>
          <ItemForm onSubmit={handleUpdate} isEdit />
        </DialogContent>
      </Dialog>

      <BottomNav role="store" />
    </MobileShell>
  );
}
