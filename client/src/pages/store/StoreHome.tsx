import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    ShoppingCart,
    Package,
    ArrowRightLeft,
    Factory,
    Truck,
    AlertTriangle,
    Warehouse
} from "lucide-react";

interface QueueCounts {
    toBuy: number;
    toReceive: number;
    crossDock: number;
    production: number;
    toDispatch: number;
    exceptions: number;
}

export default function StoreHome() {
    // Fetch queue counts
    const { data: counts } = useQuery<QueueCounts>({
        queryKey: ["/api/store/queue-counts"],
        queryFn: async () => {
            // Aggregate counts from multiple endpoints
            const [buyRes, dispatchRes, productionRes, exceptionsRes] = await Promise.all([
                fetch("/api/store/queue/to-buy").then(r => r.json()),
                fetch("/api/store/queue/to-dispatch").then(r => r.json()),
                fetch("/api/store/queue/production").then(r => r.json()),
                fetch("/api/store/exceptions").then(r => r.json()),
            ]);

            return {
                toBuy: buyRes?.length || 0,
                toReceive: 0, // TODO: pending purchases to receive
                crossDock: 0, // TODO: trade goods pending
                production: productionRes?.length || 0,
                toDispatch: dispatchRes?.length || 0,
                exceptions: exceptionsRes?.length || 0,
            };
        },
        refetchInterval: 30000, // Refresh every 30 seconds
    });

    const tiles = [
        {
            title: "To Buy",
            description: "Approved purchase requests to execute",
            icon: ShoppingCart,
            count: counts?.toBuy || 0,
            href: "/store/to-buy",
            color: "bg-blue-500",
        },
        {
            title: "To Receive",
            description: "Deliveries awaiting receipt",
            icon: Package,
            count: counts?.toReceive || 0,
            href: "/store/to-buy", // Same page shows received status
            color: "bg-green-500",
        },
        {
            title: "Cross-dock",
            description: "Trade goods (receive & dispatch)",
            icon: ArrowRightLeft,
            count: counts?.crossDock || 0,
            href: "/store/despatch", // Cross-dock goes directly to dispatch
            color: "bg-purple-500",
        },
        {
            title: "Production",
            description: "Process & pack batches",
            icon: Factory,
            count: counts?.production || 0,
            href: "/store/process",
            color: "bg-orange-500",
        },
        {
            title: "To Dispatch",
            description: "Approved items to send to shop",
            icon: Truck,
            count: counts?.toDispatch || 0,
            href: "/store/despatch",
            color: "bg-teal-500",
        },
        {
            title: "Exceptions",
            description: "Issues requiring attention",
            icon: AlertTriangle,
            count: counts?.exceptions || 0,
            href: "/store", // Show on home for now
            color: counts?.exceptions ? "bg-red-500" : "bg-gray-400",
        },
        {
            title: "View Stock",
            description: "Current stock levels (read-only)",
            icon: Warehouse,
            count: null,
            href: "/store/stock",
            color: "bg-cyan-500",
        },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Store Portal</h1>
                    <p className="text-slate-400">Execution dashboard for store operations</p>
                </div>

                {/* Queue Tiles */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tiles.map((tile) => (
                        <Link key={tile.title} href={tile.href}>
                            <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-800/80 hover:border-slate-600 transition-all cursor-pointer h-full">
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-lg font-medium text-white">
                                        {tile.title}
                                    </CardTitle>
                                    <div className={`p-2 rounded-lg ${tile.color}`}>
                                        <tile.icon className="h-5 w-5 text-white" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-baseline gap-2">
                                        {tile.count !== null ? (
                                            <>
                                                <span className="text-3xl font-bold text-white">
                                                    {tile.count}
                                                </span>
                                                {tile.count > 0 && (
                                                    <Badge
                                                        variant="outline"
                                                        className={`${tile.title === "Exceptions" ? "border-red-500 text-red-400" : "border-blue-500 text-blue-400"}`}
                                                    >
                                                        pending
                                                    </Badge>
                                                )}
                                            </>
                                        ) : (
                                            <span className="text-sm text-slate-400">View →</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-400 mt-2">
                                        {tile.description}
                                    </p>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>

                {/* Quick Stats */}
                <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-slate-800/30 border-slate-700">
                        <CardContent className="pt-6">
                            <div className="text-center">
                                <p className="text-2xl font-bold text-white">
                                    {(counts?.toBuy || 0) + (counts?.toDispatch || 0)}
                                </p>
                                <p className="text-sm text-slate-400">Total Pending</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-800/30 border-slate-700">
                        <CardContent className="pt-6">
                            <div className="text-center">
                                <p className="text-2xl font-bold text-green-400">0</p>
                                <p className="text-sm text-slate-400">Completed Today</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-800/30 border-slate-700">
                        <CardContent className="pt-6">
                            <div className="text-center">
                                <p className="text-2xl font-bold text-orange-400">
                                    {counts?.production || 0}
                                </p>
                                <p className="text-sm text-slate-400">In Production</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-800/30 border-slate-700">
                        <CardContent className="pt-6">
                            <div className="text-center">
                                <p className={`text-2xl font-bold ${counts?.exceptions ? "text-red-400" : "text-green-400"}`}>
                                    {counts?.exceptions || 0}
                                </p>
                                <p className="text-sm text-slate-400">Exceptions</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
