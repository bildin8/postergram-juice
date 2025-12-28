import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Play,
    Receipt,
    Package,
    ClipboardList,
    ShoppingBag,
    Square,
    Clock,
    CheckCircle2,
    Circle
} from "lucide-react";

interface Shift {
    id: string;
    status: string;
    opened_at: string;
    opened_by: string;
    opening_float: number;
    staff_on_duty: string[];
}

interface ChecklistItem {
    id: string;
    title: string;
    description: string;
    icon: any;
    href: string;
    completed: boolean;
    requiresShift: boolean;
    count?: number;
}

export default function ShopHome() {
    // Get current shift
    const { data: currentShift, isLoading: shiftLoading } = useQuery<Shift | null>({
        queryKey: ["/api/shop-portal/shifts/current"],
        queryFn: async () => {
            const res = await fetch("/api/shop-portal/shifts/current");
            if (!res.ok) return null;
            return res.json();
        },
        refetchInterval: 30000,
    });

    // Get pending dispatches
    const { data: pendingDispatches } = useQuery({
        queryKey: ["/api/shop-portal/pending-dispatches"],
        queryFn: async () => {
            const res = await fetch("/api/shop-portal/pending-dispatches");
            return res.json();
        },
    });

    // Get local buy tasks
    const { data: localBuyTasks } = useQuery({
        queryKey: ["/api/shop-portal/local-buy-tasks"],
        queryFn: async () => {
            const res = await fetch("/api/shop-portal/local-buy-tasks");
            return res.json();
        },
    });

    const isShiftOpen = currentShift?.status === "open";

    const checklistItems: ChecklistItem[] = [
        {
            id: "open-shift",
            title: "Open Shift",
            description: isShiftOpen
                ? `Opened by ${currentShift?.opened_by} at ${new Date(currentShift?.opened_at || "").toLocaleTimeString()}`
                : "Start your day by opening a shift",
            icon: Play,
            href: "/shop/shift-open",
            completed: isShiftOpen,
            requiresShift: false,
        },
        {
            id: "expenses",
            title: "Log Expenses",
            description: "Record supermarket or petty cash expenses",
            icon: Receipt,
            href: "/shop/expenses",
            completed: false,
            requiresShift: true,
        },
        {
            id: "receive",
            title: "Receive Dispatch",
            description: "Confirm items received from store",
            icon: Package,
            href: "/shop/receive",
            completed: false,
            requiresShift: true,
            count: pendingDispatches?.length || 0,
        },
        {
            id: "stock",
            title: "Stock Counts",
            description: "Record opening or closing stock",
            icon: ClipboardList,
            href: "/shop/stock",
            completed: false,
            requiresShift: true,
        },
        {
            id: "local-buys",
            title: "Local Buy Tasks",
            description: "Execute authorized supermarket purchases",
            icon: ShoppingBag,
            href: "/shop/local-buys",
            completed: false,
            requiresShift: true,
            count: localBuyTasks?.length || 0,
        },
        {
            id: "close-shift",
            title: "Close Shift",
            description: "End of day - record closing cash",
            icon: Square,
            href: "/shop/shift-close",
            completed: false,
            requiresShift: true,
        },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-900 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Shop Portal</h1>
                    <p className="text-slate-400">Daily operations checklist</p>
                </div>

                {/* Shift Status Banner */}
                <Card className={`mb-6 border-2 ${isShiftOpen ? "bg-emerald-900/30 border-emerald-600" : "bg-amber-900/30 border-amber-600"}`}>
                    <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${isShiftOpen ? "bg-emerald-500" : "bg-amber-500"}`}>
                                    <Clock className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <p className="text-white font-medium">
                                        {shiftLoading
                                            ? "Loading..."
                                            : isShiftOpen
                                                ? "Shift Open"
                                                : "No Active Shift"}
                                    </p>
                                    {isShiftOpen && currentShift && (
                                        <p className="text-sm text-slate-400">
                                            Float: KES {currentShift.opening_float?.toLocaleString()} •
                                            Staff: {currentShift.staff_on_duty?.join(", ") || "N/A"}
                                        </p>
                                    )}
                                </div>
                            </div>
                            {!isShiftOpen && (
                                <Link href="/shop/shift-open">
                                    <Button className="bg-emerald-600 hover:bg-emerald-700">
                                        <Play className="h-4 w-4 mr-2" />
                                        Open Shift
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Checklist */}
                <div className="space-y-3">
                    {checklistItems.map((item, index) => {
                        const isDisabled = item.requiresShift && !isShiftOpen;
                        const ItemIcon = item.icon;

                        return (
                            <Link
                                key={item.id}
                                href={isDisabled ? "#" : item.href}
                                onClick={(e) => isDisabled && e.preventDefault()}
                            >
                                <Card
                                    className={`
                    border transition-all cursor-pointer
                    ${isDisabled
                                            ? "bg-slate-800/30 border-slate-700 opacity-50 cursor-not-allowed"
                                            : item.completed
                                                ? "bg-emerald-900/20 border-emerald-700 hover:border-emerald-600"
                                                : "bg-slate-800/50 border-slate-700 hover:bg-slate-800/80 hover:border-slate-600"
                                        }
                  `}
                                >
                                    <CardContent className="py-4">
                                        <div className="flex items-center gap-4">
                                            {/* Step Number / Status */}
                                            <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center
                        ${item.completed
                                                    ? "bg-emerald-500"
                                                    : isDisabled
                                                        ? "bg-slate-700"
                                                        : "bg-slate-600"
                                                }
                      `}>
                                                {item.completed ? (
                                                    <CheckCircle2 className="h-5 w-5 text-white" />
                                                ) : (
                                                    <span className="text-white font-medium">{index + 1}</span>
                                                )}
                                            </div>

                                            {/* Icon */}
                                            <div className={`
                        p-2 rounded-lg
                        ${item.completed
                                                    ? "bg-emerald-600"
                                                    : isDisabled
                                                        ? "bg-slate-700"
                                                        : "bg-slate-600"
                                                }
                      `}>
                                                <ItemIcon className="h-5 w-5 text-white" />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-white font-medium">{item.title}</p>
                                                    {item.count !== undefined && item.count > 0 && (
                                                        <Badge className="bg-blue-600 text-white">
                                                            {item.count}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm text-slate-400">{item.description}</p>
                                            </div>

                                            {/* Indicator */}
                                            {item.completed && (
                                                <Badge className="bg-emerald-600 text-white">Done</Badge>
                                            )}
                                            {isDisabled && !item.completed && (
                                                <Badge variant="outline" className="border-slate-600 text-slate-500">
                                                    Requires Shift
                                                </Badge>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        );
                    })}
                </div>

                {/* Today's Summary */}
                <Card className="mt-8 bg-slate-800/30 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-white text-lg">Today's Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="text-2xl font-bold text-white">0</p>
                                <p className="text-sm text-slate-400">Expenses</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-emerald-400">
                                    {pendingDispatches?.length || 0}
                                </p>
                                <p className="text-sm text-slate-400">Pending Receipts</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-blue-400">
                                    {localBuyTasks?.length || 0}
                                </p>
                                <p className="text-sm text-slate-400">Buy Tasks</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
