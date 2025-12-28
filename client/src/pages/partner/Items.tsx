import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
    ArrowLeft,
    Package,
    Plus,
    Search,
    Edit2,
    Trash2,
    RefreshCw,
    Store,
    ShoppingBag,
    CloudUpload
} from "lucide-react";
import { Link } from "wouter";

interface StoreItem {
    id: string;
    name: string;
    category: string;
    unit: string;
    min_stock: number;
    current_stock: number;
    cost_per_unit?: number;
    is_active: boolean;
    bought_by: "store" | "shop"; // Where this item is typically purchased
}

interface PosterPOSIngredient {
    ingredient_id: number;
    ingredient_name: string;
    ingredient_unit: string;
    ingredient_left?: string;
}

export default function Items() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [activeTab, setActiveTab] = useState<"store" | "posterpos" | "shopstock">("store");
    const [searchQuery, setSearchQuery] = useState("");
    const [editingItem, setEditingItem] = useState<StoreItem | null>(null);
    const [showAddDialog, setShowAddDialog] = useState(false);

    // New item form
    const [newItem, setNewItem] = useState({
        name: "",
        category: "general",
        unit: "pcs",
        min_stock: 0,
        current_stock: 0,
        cost_per_unit: 0,
        bought_by: "store" as "store" | "shop",
    });

    // Fetch store items
    const { data: storeItems, isLoading: storeLoading } = useQuery<StoreItem[]>({
        queryKey: ["/api/partner/items"],
        queryFn: async () => {
            const res = await fetch("/api/partner/items");
            if (!res.ok) return [];
            return res.json();
        },
    });

    // Fetch PosterPOS ingredients
    const { data: posIngredients, isLoading: posLoading, refetch: refetchPOS } = useQuery<PosterPOSIngredient[]>({
        queryKey: ["/api/posterpos/ingredients"],
        queryFn: async () => {
            const res = await fetch("/api/posterpos/ingredients");
            if (!res.ok) return [];
            return res.json();
        },
    });

    // Create item mutation
    const createMutation = useMutation({
        mutationFn: async (item: typeof newItem) => {
            const res = await fetch("/api/partner/items", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(item),
            });
            if (!res.ok) throw new Error("Failed to create item");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Item Created", description: "New item added successfully" });
            queryClient.invalidateQueries({ queryKey: ["/api/partner/items"] });
            setShowAddDialog(false);
            setNewItem({ name: "", category: "general", unit: "pcs", min_stock: 0, current_stock: 0, cost_per_unit: 0, bought_by: "store" });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to create item", variant: "destructive" });
        },
    });

    // Update item mutation
    const updateMutation = useMutation({
        mutationFn: async (item: StoreItem) => {
            const res = await fetch(`/api/partner/items/${item.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(item),
            });
            if (!res.ok) throw new Error("Failed to update item");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Item Updated", description: "Changes saved successfully" });
            queryClient.invalidateQueries({ queryKey: ["/api/partner/items"] });
            setEditingItem(null);
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to update item", variant: "destructive" });
        },
    });

    // Delete item mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/partner/items/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete item");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Item Deleted", description: "Item removed successfully" });
            queryClient.invalidateQueries({ queryKey: ["/api/partner/items"] });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to delete item", variant: "destructive" });
        },
    });

    // Sync from PosterPOS mutation
    const syncFromPOSMutation = useMutation({
        mutationFn: async (ingredient: PosterPOSIngredient) => {
            const res = await fetch("/api/partner/items/sync-from-pos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    posterPosId: ingredient.ingredient_id,
                    name: ingredient.ingredient_name,
                    unit: ingredient.ingredient_unit,
                    currentStock: parseFloat(ingredient.ingredient_left || "0"),
                }),
            });
            if (!res.ok) throw new Error("Failed to sync item");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Item Synced", description: "Item imported from PosterPOS" });
            queryClient.invalidateQueries({ queryKey: ["/api/partner/items"] });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to sync item", variant: "destructive" });
        },
    });

    // Push stock to PosterPOS mutation
    const pushToPOSMutation = useMutation({
        mutationFn: async (item: StoreItem) => {
            const res = await fetch("/api/posterpos/stock/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    itemId: item.id,
                    itemName: item.name,
                    quantity: item.current_stock,
                }),
            });
            if (!res.ok) throw new Error("Failed to push to POS");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Stock Pushed", description: "Stock level sent to PosterPOS" });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to push stock to POS", variant: "destructive" });
        },
    });

    const filteredStoreItems = (storeItems || []).filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredPOSItems = (posIngredients || []).filter(item =>
        item.ingredient_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const categories = ["general", "produce", "dairy", "meat", "pantry", "frozen", "beverages", "packaging"];

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-900 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <Link href="/partner">
                        <Button variant="ghost" className="text-slate-400 hover:text-white mb-4">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Partner
                        </Button>
                    </Link>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-white mb-2">Items Management</h1>
                            <p className="text-slate-400">Manage store and shop inventory items</p>
                        </div>
                        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                            <DialogTrigger asChild>
                                <Button className="bg-indigo-600 hover:bg-indigo-700">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Item
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-slate-800 border-slate-700">
                                <DialogHeader>
                                    <DialogTitle className="text-white">Add New Item</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                    <div>
                                        <Label className="text-slate-300">Item Name</Label>
                                        <Input
                                            value={newItem.name}
                                            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                                            placeholder="Item name"
                                            className="bg-slate-900 border-slate-600 text-white"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label className="text-slate-300">Category</Label>
                                            <Select value={newItem.category} onValueChange={(v) => setNewItem({ ...newItem, category: v })}>
                                                <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {categories.map(cat => (
                                                        <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label className="text-slate-300">Unit</Label>
                                            <Input
                                                value={newItem.unit}
                                                onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                                                placeholder="pcs, kg, L"
                                                className="bg-slate-900 border-slate-600 text-white"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <Label className="text-slate-300">Min Stock</Label>
                                            <Input
                                                type="number"
                                                value={newItem.min_stock || ""}
                                                onChange={(e) => setNewItem({ ...newItem, min_stock: parseFloat(e.target.value) || 0 })}
                                                className="bg-slate-900 border-slate-600 text-white"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-slate-300">Current Stock</Label>
                                            <Input
                                                type="number"
                                                value={newItem.current_stock || ""}
                                                onChange={(e) => setNewItem({ ...newItem, current_stock: parseFloat(e.target.value) || 0 })}
                                                className="bg-slate-900 border-slate-600 text-white"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-slate-300">Cost/Unit</Label>
                                            <Input
                                                type="number"
                                                value={newItem.cost_per_unit || ""}
                                                onChange={(e) => setNewItem({ ...newItem, cost_per_unit: parseFloat(e.target.value) || 0 })}
                                                className="bg-slate-900 border-slate-600 text-white"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-slate-300">Bought By</Label>
                                        <Select value={newItem.bought_by} onValueChange={(v) => setNewItem({ ...newItem, bought_by: v as "store" | "shop" })}>
                                            <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="store">
                                                    <span className="flex items-center gap-2"><Store className="h-4 w-4" /> Store (Bulk)</span>
                                                </SelectItem>
                                                <SelectItem value="shop">
                                                    <span className="flex items-center gap-2"><ShoppingBag className="h-4 w-4" /> Shop (Local)</span>
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-slate-500 mt-1">Where is this item typically purchased?</p>
                                    </div>
                                    <Button
                                        className="w-full bg-indigo-600 hover:bg-indigo-700"
                                        disabled={!newItem.name || createMutation.isPending}
                                        onClick={() => createMutation.mutate(newItem)}
                                    >
                                        {createMutation.isPending ? "Creating..." : "Create Item"}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {/* Search */}
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search items..."
                        className="pl-10 bg-slate-800 border-slate-600 text-white"
                    />
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "store" | "posterpos" | "shopstock")}>
                    <TabsList className="grid grid-cols-3 bg-slate-800 mb-6">
                        <TabsTrigger value="store" className="data-[state=active]:bg-indigo-600">
                            <Store className="h-4 w-4 mr-2" />
                            Store Items ({filteredStoreItems.length})
                        </TabsTrigger>
                        <TabsTrigger value="shopstock" className="data-[state=active]:bg-emerald-600">
                            <ShoppingBag className="h-4 w-4 mr-2" />
                            Shop Stock
                        </TabsTrigger>
                        <TabsTrigger value="posterpos" className="data-[state=active]:bg-purple-600">
                            <Package className="h-4 w-4 mr-2" />
                            PosterPOS ({filteredPOSItems.length})
                        </TabsTrigger>
                    </TabsList>

                    {/* Store Items Tab */}
                    <TabsContent value="store">
                        {storeLoading ? (
                            <div className="text-center py-12">
                                <p className="text-slate-400">Loading items...</p>
                            </div>
                        ) : filteredStoreItems.length === 0 ? (
                            <Card className="bg-slate-800/30 border-slate-700">
                                <CardContent className="py-12 text-center">
                                    <Package className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                                    <h2 className="text-xl font-bold text-white mb-2">No Items</h2>
                                    <p className="text-slate-400 mb-4">Add your first item to get started</p>
                                    <Button className="bg-indigo-600" onClick={() => setShowAddDialog(true)}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Item
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {filteredStoreItems.map((item) => (
                                    <Card key={item.id} className="bg-slate-800/50 border-slate-700">
                                        <CardContent className="pt-6">
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <h3 className="text-white font-medium">{item.name}</h3>
                                                    <div className="flex gap-2 mt-1">
                                                        <Badge variant="outline" className="border-slate-600 text-slate-400">
                                                            {item.category}
                                                        </Badge>
                                                        <Badge className={item.bought_by === 'store' ? 'bg-blue-600' : 'bg-emerald-600'}>
                                                            {item.bought_by === 'store' ? 'Store' : 'Shop'}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-slate-400 h-8 w-8 p-0"
                                                        onClick={() => setEditingItem(item)}
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-400 h-8 w-8 p-0"
                                                        onClick={() => deleteMutation.mutate(item.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                <div>
                                                    <span className="text-slate-500">Stock:</span>
                                                    <span className={`ml-2 font-medium ${item.current_stock < item.min_stock ? 'text-red-400' : 'text-emerald-400'
                                                        }`}>
                                                        {item.current_stock} {item.unit}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500">Min:</span>
                                                    <span className="ml-2 text-white">{item.min_stock} {item.unit}</span>
                                                </div>
                                            </div>
                                            {item.cost_per_unit && (
                                                <p className="text-sm text-slate-400 mt-2">
                                                    KES {item.cost_per_unit}/{item.unit}
                                                </p>
                                            )}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full mt-3 border-slate-600 text-slate-300"
                                                onClick={() => pushToPOSMutation.mutate(item)}
                                                disabled={pushToPOSMutation.isPending}
                                            >
                                                <CloudUpload className="h-4 w-4 mr-2" />
                                                Push to POS
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* PosterPOS Items Tab */}
                    <TabsContent value="posterpos">
                        <div className="flex justify-end mb-4">
                            <Button
                                variant="outline"
                                className="border-slate-600 text-slate-300"
                                onClick={() => refetchPOS()}
                            >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Refresh from POS
                            </Button>
                        </div>

                        {posLoading ? (
                            <div className="text-center py-12">
                                <p className="text-slate-400">Loading from PosterPOS...</p>
                            </div>
                        ) : filteredPOSItems.length === 0 ? (
                            <Card className="bg-slate-800/30 border-slate-700">
                                <CardContent className="py-12 text-center">
                                    <ShoppingBag className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                                    <h2 className="text-xl font-bold text-white mb-2">No POS Items</h2>
                                    <p className="text-slate-400">No ingredients found in PosterPOS</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {filteredPOSItems.map((item) => (
                                    <Card key={item.ingredient_id} className="bg-slate-800/50 border-slate-700">
                                        <CardContent className="pt-6">
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <h3 className="text-white font-medium">{item.ingredient_name}</h3>
                                                    <Badge variant="outline" className="border-purple-600 text-purple-400 mt-1">
                                                        POS #{item.ingredient_id}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div className="text-sm mb-3">
                                                <span className="text-slate-500">Stock:</span>
                                                <span className="ml-2 text-white">
                                                    {parseFloat(item.ingredient_left || "0").toFixed(1)} {item.ingredient_unit}
                                                </span>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full border-purple-600 text-purple-400"
                                                onClick={() => syncFromPOSMutation.mutate(item)}
                                                disabled={syncFromPOSMutation.isPending}
                                            >
                                                <Plus className="h-4 w-4 mr-2" />
                                                Import to System
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* Shop Stock Tab (Read-Only) */}
                    <TabsContent value="shopstock">
                        <div className="flex justify-end mb-4">
                            <Button
                                variant="outline"
                                className="border-slate-600 text-slate-300"
                                onClick={() => refetchPOS()}
                            >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Refresh Stock
                            </Button>
                        </div>

                        {posLoading ? (
                            <div className="text-center py-12">
                                <p className="text-slate-400">Loading stock levels...</p>
                            </div>
                        ) : filteredPOSItems.length === 0 ? (
                            <Card className="bg-slate-800/30 border-slate-700">
                                <CardContent className="py-12 text-center">
                                    <Package className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                                    <h2 className="text-xl font-bold text-white mb-2">No Stock Data</h2>
                                    <p className="text-slate-400">Connect to PosterPOS to view live stock</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-3">
                                {/* Summary */}
                                <div className="grid grid-cols-3 gap-4 mb-4">
                                    <Card className="bg-slate-800/50 border-slate-700">
                                        <CardContent className="pt-6 text-center">
                                            <p className="text-2xl font-bold text-white">{filteredPOSItems.length}</p>
                                            <p className="text-xs text-slate-400">Total Items</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-emerald-900/30 border-emerald-700">
                                        <CardContent className="pt-6 text-center">
                                            <p className="text-2xl font-bold text-emerald-400">
                                                {filteredPOSItems.filter(i => parseFloat(i.ingredient_left || "0") > 0).length}
                                            </p>
                                            <p className="text-xs text-slate-400">In Stock</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-red-900/30 border-red-700">
                                        <CardContent className="pt-6 text-center">
                                            <p className="text-2xl font-bold text-red-400">
                                                {filteredPOSItems.filter(i => parseFloat(i.ingredient_left || "0") <= 0).length}
                                            </p>
                                            <p className="text-xs text-slate-400">Out of Stock</p>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Stock list */}
                                {filteredPOSItems.map((item) => {
                                    const stock = parseFloat(item.ingredient_left || "0");
                                    const isLow = stock <= 0;
                                    return (
                                        <Card
                                            key={item.ingredient_id}
                                            className={`border-slate-700 ${isLow ? "bg-red-900/20 border-red-800" : "bg-slate-800/50"
                                                }`}
                                        >
                                            <CardContent className="p-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h3 className="font-medium text-white">{item.ingredient_name}</h3>
                                                        <p className="text-sm text-slate-400">{item.ingredient_unit}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className={`text-xl font-bold ${isLow ? "text-red-400" : "text-emerald-400"}`}>
                                                            {stock.toFixed(1)}
                                                        </p>
                                                        <Badge
                                                            variant="outline"
                                                            className={isLow ? "border-red-600 text-red-400" : "border-emerald-600 text-emerald-400"}
                                                        >
                                                            {isLow ? "Low" : "OK"}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                {/* Edit Dialog */}
                {editingItem && (
                    <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
                        <DialogContent className="bg-slate-800 border-slate-700">
                            <DialogHeader>
                                <DialogTitle className="text-white">Edit Item</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div>
                                    <Label className="text-slate-300">Item Name</Label>
                                    <Input
                                        value={editingItem.name}
                                        onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                                        className="bg-slate-900 border-slate-600 text-white"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-slate-300">Category</Label>
                                        <Select value={editingItem.category} onValueChange={(v) => setEditingItem({ ...editingItem, category: v })}>
                                            <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {categories.map(cat => (
                                                    <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label className="text-slate-300">Unit</Label>
                                        <Input
                                            value={editingItem.unit}
                                            onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}
                                            className="bg-slate-900 border-slate-600 text-white"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <Label className="text-slate-300">Min Stock</Label>
                                        <Input
                                            type="number"
                                            value={editingItem.min_stock || ""}
                                            onChange={(e) => setEditingItem({ ...editingItem, min_stock: parseFloat(e.target.value) || 0 })}
                                            className="bg-slate-900 border-slate-600 text-white"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-slate-300">Current Stock</Label>
                                        <Input
                                            type="number"
                                            value={editingItem.current_stock || ""}
                                            onChange={(e) => setEditingItem({ ...editingItem, current_stock: parseFloat(e.target.value) || 0 })}
                                            className="bg-slate-900 border-slate-600 text-white"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-slate-300">Cost/Unit</Label>
                                        <Input
                                            type="number"
                                            value={editingItem.cost_per_unit || ""}
                                            onChange={(e) => setEditingItem({ ...editingItem, cost_per_unit: parseFloat(e.target.value) || 0 })}
                                            className="bg-slate-900 border-slate-600 text-white"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-slate-300">Bought By</Label>
                                    <Select value={editingItem.bought_by} onValueChange={(v) => setEditingItem({ ...editingItem, bought_by: v as "store" | "shop" })}>
                                        <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="store">Store (Bulk)</SelectItem>
                                            <SelectItem value="shop">Shop (Local)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button
                                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                                    disabled={!editingItem.name || updateMutation.isPending}
                                    onClick={() => updateMutation.mutate(editingItem)}
                                >
                                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </div>
        </div>
    );
}
