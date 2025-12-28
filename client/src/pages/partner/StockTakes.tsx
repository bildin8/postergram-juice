import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
    ArrowLeft,
    ClipboardList,
    Sun,
    Moon,
    Calendar,
    Search,
    Eye,
    AlertTriangle,
    CheckCircle,
    Settings
} from "lucide-react";
import { Link } from "wouter";

interface StockSession {
    id: string;
    session_type: string;
    status: string;
    staff_name: string;
    started_at: string;
    completed_at?: string;
    total_items: number;
    counted_items: number;
    date?: string;
}

interface StockEntry {
    id: string;
    session_id: string;
    item_name: string;
    quantity: number;
    unit: string;
    notes?: string;
    counted_at: string;
}

export default function StockTakes() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [searchQuery, setSearchQuery] = useState("");
    const [configSearch, setConfigSearch] = useState("");
    const [viewingSession, setViewingSession] = useState<StockSession | null>(null);

    // Fetch all stock sessions
    const { data: sessions, isLoading: sessionsLoading } = useQuery<StockSession[]>({
        queryKey: ["/api/partner/stock/sessions", selectedDate],
        queryFn: async () => {
            const res = await fetch(`/api/partner/stock/sessions?date=${selectedDate}`);
            if (!res.ok) return [];
            return res.json();
        },
    });

    // Fetch entries for selected session
    const { data: entries, isLoading: entriesLoading } = useQuery<StockEntry[]>({
        queryKey: ["/api/partner/stock/entries", viewingSession?.id],
        queryFn: async () => {
            if (!viewingSession) return [];
            const res = await fetch(`/api/partner/stock/entries/${viewingSession.id}`);
            if (!res.ok) return [];
            return res.json();
        },
        enabled: !!viewingSession,
    });

    // Fetch comparison data
    const { data: comparison } = useQuery({
        queryKey: ["/api/partner/stock/comparison", selectedDate],
        queryFn: async () => {
            const res = await fetch(`/api/partner/stock/comparison?date=${selectedDate}`);
            if (!res.ok) return null;
            return res.json();
        },
    });

    // Fetch all items for configuration
    const { data: allItems } = useQuery<any[]>({
        queryKey: ["/api/partner/items"],
        queryFn: async () => {
            const res = await fetch("/api/partner/items");
            if (!res.ok) return [];
            return res.json();
        },
    });

    // Toggle counting requirement mutation
    const toggleCountingMutation = useMutation({
        mutationFn: async ({ id, requiresCounting }: { id: string; requiresCounting: boolean }) => {
            const res = await fetch(`/api/partner/items/${id}/counting`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requiresCounting }),
            });
            if (!res.ok) throw new Error("Failed to update");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/partner/items"] });
            toast({ title: "Updated", description: "Item counting requirement updated" });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to update item", variant: "destructive" });
        },
    });

    const openingSessions = (sessions || []).filter(s => s.session_type === "opening");
    const closingSessions = (sessions || []).filter(s => s.session_type === "closing");

    const filteredEntries = (entries || []).filter(entry =>
        entry.item_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredConfigItems = (allItems || []).filter(item =>
        item.name.toLowerCase().includes(configSearch.toLowerCase())
    );

    const countableItems = (allItems || []).filter(item => item.requires_counting !== false);
    const nonCountableItems = (allItems || []).filter(item => item.requires_counting === false);

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
                            <h1 className="text-2xl font-bold text-white mb-2">Stock Takes</h1>
                            <p className="text-slate-400">View and analyze stock count sessions</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-slate-400" />
                                <Input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="bg-slate-800 border-slate-600 text-white w-40"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    <Card className="bg-amber-900/30 border-amber-600">
                        <CardContent className="pt-6 text-center">
                            <Sun className="h-6 w-6 text-amber-400 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-amber-400">{openingSessions.length}</p>
                            <p className="text-sm text-amber-300">Opening Sessions</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-indigo-900/30 border-indigo-600">
                        <CardContent className="pt-6 text-center">
                            <Moon className="h-6 w-6 text-indigo-400 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-indigo-400">{closingSessions.length}</p>
                            <p className="text-sm text-indigo-300">Closing Sessions</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-emerald-900/30 border-emerald-600">
                        <CardContent className="pt-6 text-center">
                            <CheckCircle className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-emerald-400">
                                {comparison?.matchedItems || 0}
                            </p>
                            <p className="text-sm text-emerald-300">Matched Items</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-red-900/30 border-red-600">
                        <CardContent className="pt-6 text-center">
                            <AlertTriangle className="h-6 w-6 text-red-400 mx-auto mb-2" />
                            <p className="text-2xl font-bold text-red-400">
                                {comparison?.varianceItems || 0}
                            </p>
                            <p className="text-sm text-red-300">Variance Items</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Sessions Tabs */}
                <Tabs defaultValue="all" className="mb-6">
                    <TabsList className="bg-slate-800">
                        <TabsTrigger value="all">All Sessions</TabsTrigger>
                        <TabsTrigger value="opening">Opening</TabsTrigger>
                        <TabsTrigger value="closing">Closing</TabsTrigger>
                        <TabsTrigger value="comparison">Comparison</TabsTrigger>
                        <TabsTrigger value="configure">
                            <Settings className="h-4 w-4 mr-1" />
                            Configure
                        </TabsTrigger>
                    </TabsList>

                    {/* All Sessions */}
                    <TabsContent value="all">
                        {sessionsLoading ? (
                            <div className="text-center py-12">
                                <p className="text-slate-400">Loading sessions...</p>
                            </div>
                        ) : !sessions || sessions.length === 0 ? (
                            <Card className="bg-slate-800/30 border-slate-700">
                                <CardContent className="py-12 text-center">
                                    <ClipboardList className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                                    <h2 className="text-xl font-bold text-white mb-2">No Stock Sessions</h2>
                                    <p className="text-slate-400">No stock counts recorded for this date</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2">
                                {sessions.map((session) => (
                                    <Card key={session.id} className="bg-slate-800/50 border-slate-700">
                                        <CardContent className="pt-6">
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    {session.session_type === "opening" ? (
                                                        <div className="p-2 rounded-lg bg-amber-600">
                                                            <Sun className="h-5 w-5 text-white" />
                                                        </div>
                                                    ) : (
                                                        <div className="p-2 rounded-lg bg-indigo-600">
                                                            <Moon className="h-5 w-5 text-white" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <h3 className="text-white font-medium capitalize">
                                                            {session.session_type} Stock
                                                        </h3>
                                                        <p className="text-sm text-slate-400">
                                                            By {session.staff_name}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Badge className={session.status === "completed" ? "bg-emerald-600" : "bg-amber-600"}>
                                                    {session.status}
                                                </Badge>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                                <div>
                                                    <span className="text-slate-500">Items Counted:</span>
                                                    <span className="ml-2 text-white">{session.counted_items}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-500">Time:</span>
                                                    <span className="ml-2 text-white">
                                                        {new Date(session.started_at).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                            </div>
                                            <Button
                                                variant="outline"
                                                className="w-full border-slate-600 text-slate-300"
                                                onClick={() => setViewingSession(session)}
                                            >
                                                <Eye className="h-4 w-4 mr-2" />
                                                View Entries
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* Opening Sessions */}
                    <TabsContent value="opening">
                        <div className="grid gap-4 md:grid-cols-2">
                            {openingSessions.map((session) => (
                                <Card key={session.id} className="bg-slate-800/50 border-slate-700">
                                    <CardContent className="pt-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <Sun className="h-6 w-6 text-amber-500" />
                                            <div>
                                                <h3 className="text-white font-medium">Opening Stock</h3>
                                                <p className="text-sm text-slate-400">By {session.staff_name}</p>
                                            </div>
                                        </div>
                                        <p className="text-slate-300 mb-4">
                                            {session.counted_items} items counted at {new Date(session.started_at).toLocaleTimeString()}
                                        </p>
                                        <Button
                                            variant="outline"
                                            className="w-full border-slate-600"
                                            onClick={() => setViewingSession(session)}
                                        >
                                            View Details
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                            {openingSessions.length === 0 && (
                                <p className="text-slate-400 col-span-2 text-center py-8">No opening sessions for this date</p>
                            )}
                        </div>
                    </TabsContent>

                    {/* Closing Sessions */}
                    <TabsContent value="closing">
                        <div className="grid gap-4 md:grid-cols-2">
                            {closingSessions.map((session) => (
                                <Card key={session.id} className="bg-slate-800/50 border-slate-700">
                                    <CardContent className="pt-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <Moon className="h-6 w-6 text-indigo-500" />
                                            <div>
                                                <h3 className="text-white font-medium">Closing Stock</h3>
                                                <p className="text-sm text-slate-400">By {session.staff_name}</p>
                                            </div>
                                        </div>
                                        <p className="text-slate-300 mb-4">
                                            {session.counted_items} items counted at {new Date(session.started_at).toLocaleTimeString()}
                                        </p>
                                        <Button
                                            variant="outline"
                                            className="w-full border-slate-600"
                                            onClick={() => setViewingSession(session)}
                                        >
                                            View Details
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                            {closingSessions.length === 0 && (
                                <p className="text-slate-400 col-span-2 text-center py-8">No closing sessions for this date</p>
                            )}
                        </div>
                    </TabsContent>

                    {/* Comparison Tab */}
                    <TabsContent value="comparison">
                        <Card className="bg-slate-800/50 border-slate-700">
                            <CardHeader>
                                <CardTitle className="text-white">Opening vs Closing Comparison</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {comparison?.items && comparison.items.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-slate-700">
                                                    <th className="text-left py-3 px-4 text-slate-400">Item</th>
                                                    <th className="text-right py-3 px-4 text-amber-400">Opening</th>
                                                    <th className="text-right py-3 px-4 text-indigo-400">Closing</th>
                                                    <th className="text-right py-3 px-4 text-slate-400">Variance</th>
                                                    <th className="text-center py-3 px-4 text-slate-400">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {comparison.items.map((item: any, idx: number) => (
                                                    <tr key={idx} className="border-b border-slate-800">
                                                        <td className="py-3 px-4 text-white">{item.name}</td>
                                                        <td className="py-3 px-4 text-right text-amber-300">
                                                            {item.openingQty} {item.unit}
                                                        </td>
                                                        <td className="py-3 px-4 text-right text-indigo-300">
                                                            {item.closingQty} {item.unit}
                                                        </td>
                                                        <td className={`py-3 px-4 text-right ${item.variance < 0 ? 'text-red-400' :
                                                            item.variance > 0 ? 'text-emerald-400' : 'text-slate-400'
                                                            }`}>
                                                            {item.variance > 0 ? '+' : ''}{item.variance}
                                                        </td>
                                                        <td className="py-3 px-4 text-center">
                                                            {item.variance === 0 ? (
                                                                <Badge className="bg-emerald-600">OK</Badge>
                                                            ) : item.variance < -5 ? (
                                                                <Badge className="bg-red-600">High Variance</Badge>
                                                            ) : (
                                                                <Badge className="bg-amber-600">Check</Badge>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <AlertTriangle className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                                        <p className="text-slate-400">
                                            Need both opening and closing stock to compare.
                                            {openingSessions.length === 0 && " No opening session found."}
                                            {closingSessions.length === 0 && " No closing session found."}
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Configure Tab */}
                    <TabsContent value="configure">
                        <Card className="bg-slate-800/50 border-slate-700">
                            <CardHeader>
                                <CardTitle className="text-white">Configure Count List</CardTitle>
                                <p className="text-slate-400 text-sm">
                                    Select which items should appear in the stock count list. Items toggled OFF will be hidden from Shop staff during stock takes.
                                </p>
                            </CardHeader>
                            <CardContent>
                                <div className="mb-6">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input
                                            value={configSearch}
                                            onChange={(e) => setConfigSearch(e.target.value)}
                                            placeholder="Search items to configure..."
                                            className="pl-10 bg-slate-900 border-slate-600 text-white"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    {/* Countable Items */}
                                    <div>
                                        <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                                            Required to Count ({countableItems.length})
                                        </h3>
                                        <div className="bg-slate-900/50 rounded-lg border border-slate-700 divide-y divide-slate-700">
                                            {filteredConfigItems
                                                .filter(item => item.requires_counting !== false)
                                                .map(item => (
                                                    <div key={item.id} className="flex items-center justify-between p-3">
                                                        <div>
                                                            <p className="text-white">{item.name}</p>
                                                            <Badge variant="outline" className="border-slate-600 text-slate-500 text-xs">
                                                                {item.category}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-sm text-emerald-400">Included</span>
                                                            <Switch
                                                                checked={true}
                                                                onCheckedChange={() => toggleCountingMutation.mutate({
                                                                    id: item.id,
                                                                    requiresCounting: false
                                                                })}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            {filteredConfigItems.filter(item => item.requires_counting !== false).length === 0 && (
                                                <p className="text-slate-500 p-4 text-center text-sm">No items found</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Excluded Items */}
                                    <div>
                                        <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                                            <AlertTriangle className="h-4 w-4 text-slate-500" />
                                            Excluded from Count ({nonCountableItems.length})
                                        </h3>
                                        <div className="bg-slate-900/50 rounded-lg border border-slate-700 divide-y divide-slate-700">
                                            {filteredConfigItems
                                                .filter(item => item.requires_counting === false)
                                                .map(item => (
                                                    <div key={item.id} className="flex items-center justify-between p-3 bg-slate-800/20">
                                                        <div>
                                                            <p className="text-slate-400">{item.name}</p>
                                                            <Badge variant="outline" className="border-slate-600 text-slate-600 text-xs">
                                                                {item.category}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-sm text-slate-500">Excluded</span>
                                                            <Switch
                                                                checked={false}
                                                                onCheckedChange={() => toggleCountingMutation.mutate({
                                                                    id: item.id,
                                                                    requiresCounting: true
                                                                })}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            {filteredConfigItems.filter(item => item.requires_counting === false).length === 0 && (
                                                <p className="text-slate-500 p-4 text-center text-sm">No excluded items</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* View Entries Dialog */}
                {viewingSession && (
                    <Dialog open={!!viewingSession} onOpenChange={() => setViewingSession(null)}>
                        <DialogContent className="bg-slate-800 border-slate-700 max-w-3xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle className="text-white flex items-center gap-2">
                                    {viewingSession.session_type === "opening" ? (
                                        <Sun className="h-5 w-5 text-amber-500" />
                                    ) : (
                                        <Moon className="h-5 w-5 text-indigo-500" />
                                    )}
                                    {viewingSession.session_type} Stock Entries
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between text-sm text-slate-400">
                                    <span>By: {viewingSession.staff_name}</span>
                                    <span>{new Date(viewingSession.started_at).toLocaleString()}</span>
                                </div>

                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search items..."
                                        className="pl-10 bg-slate-900 border-slate-600 text-white"
                                    />
                                </div>

                                {entriesLoading ? (
                                    <p className="text-slate-400 text-center py-4">Loading entries...</p>
                                ) : filteredEntries.length === 0 ? (
                                    <p className="text-slate-400 text-center py-4">No entries found</p>
                                ) : (
                                    <div className="space-y-2 max-h-96 overflow-y-auto">
                                        {filteredEntries.map((entry) => (
                                            <div
                                                key={entry.id}
                                                className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50"
                                            >
                                                <span className="text-white">{entry.item_name}</span>
                                                <Badge variant="outline" className="border-slate-600 text-slate-300">
                                                    {entry.quantity} {entry.unit}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="pt-4 border-t border-slate-700 text-center">
                                    <p className="text-slate-400">
                                        Total: <span className="text-white font-medium">{filteredEntries.length} items</span>
                                    </p>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </div>
        </div>
    );
}
