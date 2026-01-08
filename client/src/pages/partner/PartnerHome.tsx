import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { secureFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    CheckCircle,
    Scale,
    Wallet,
    Users,
    Bell,
    Settings,
    TrendingUp,
    ArrowRight,
    ArrowLeft,
    AlertTriangle,
    Package,
    Boxes,
    ClipboardList,
    PieChart,
    Truck,
    Factory
} from "lucide-react";



interface ApprovalSummary {
    purchaseRequests: number;
    replenishmentRequests: number;
    total: number;
}

interface Alert {
    type: string;
    severity: string;
    message: string;
}

interface CashVariance {
    amount: number;
    status: string;
}

export default function PartnerHome() {
    // Fetch approvals
    const { data: approvals } = useQuery({
        queryKey: ["/api/partner/approvals"],
        queryFn: async () => {
            const res = await secureFetch("/api/partner/approvals");
            return res.json();
        },
        refetchInterval: 60000,
    });

    // Fetch alerts
    const { data: alerts } = useQuery<Alert[]>({
        queryKey: ["/api/partner/alerts"],
        queryFn: async () => {
            const res = await secureFetch("/api/partner/alerts");
            return res.json();
        },
        refetchInterval: 60000,
    });

    // Fetch cash reconciliation
    const { data: cashRecon } = useQuery({
        queryKey: ["/api/partner/reconciliation/cash"],
        queryFn: async () => {
            const res = await secureFetch("/api/partner/reconciliation/cash");
            return res.json();
        },
    });

    // Fetch flagged shifts
    const { data: flaggedShifts } = useQuery({
        queryKey: ["/api/partner/shifts/flagged"],
        queryFn: async () => {
            const res = await secureFetch("/api/partner/shifts/flagged");
            return res.json();
        },
    });

    // Fetch Audit Stream
    const { data: auditStream } = useQuery({
        queryKey: ["/api/partner/audit-stream"],
        queryFn: async () => {
            const res = await secureFetch("/api/partner/audit-stream");
            return res.json();
        },
        refetchInterval: 30000,
    });

    const approvalCount = approvals?.length || 0;
    const alertCount = alerts?.length || 0;
    const flaggedCount = flaggedShifts?.length || 0;
    const cashVariance = cashRecon?.variance?.amount || 0;


    const modules = [
        {
            title: "⚡ Power Dashboard",
            description: "Live sales, consumption, and stock analytics",
            icon: TrendingUp,
            href: "/partner/power",
            color: "bg-gradient-to-br from-yellow-500 to-orange-600",
            featured: true,
        },
        {
            title: "Analytics & Reports",
            description: "Custom insights & performance metrics",
            icon: PieChart,
            href: "/partner/reports",
            color: "bg-purple-600",
        },
        {
            title: "Partner Settings",
            description: "Configure controls & preferences",
            icon: Settings,
            href: "/partner/settings",
            color: "bg-slate-600",
        },
        {
            title: "Approvals Inbox",
            description: "Purchase & replenishment requests",
            icon: CheckCircle,
            href: "/partner/approvals",
            count: approvalCount,
            highlight: approvalCount > 0,
            color: "bg-blue-600",
        },
        {
            title: "Stock Reconciliation",
            description: "Opening vs closing variances",
            icon: Scale,
            href: "/partner/stock-recon",
            color: "bg-purple-600",
        },
        {
            title: "Cash Reconciliation",
            description: "POS totals vs declared cash",
            icon: Wallet,
            href: "/partner/cash-recon",
            badge: cashVariance !== 0
                ? { text: `KES ${Math.abs(cashVariance).toLocaleString()}`, variant: cashVariance < 0 ? "destructive" : "default" }
                : null,
            color: "bg-emerald-600",
        },
        {
            title: "Stock Takes",
            description: "View stock sessions & configure",
            icon: ClipboardList,
            href: "/partner/stock-takes",
            color: "bg-teal-600",
        },
        {
            title: "Staff",
            description: "Manage team & view activity",
            icon: Users,
            href: "/partner/staff",
            color: "bg-orange-600",
        },
        {
            title: "Items Management",
            description: "Manage shop & store items",
            icon: Boxes,
            href: "/partner/items",
            color: "bg-pink-600",
        },
        {
            title: "Local Buys",
            description: "Track petty cash & local purchases",
            icon: Truck,
            href: "/partner/local-buys",
            color: "bg-indigo-600",
        },
        {
            title: "Purchase Requests",
            description: "Initiate supplier purchases",
            icon: Factory,
            href: "/partner/purchases",
            color: "bg-cyan-700",
        },
        {
            title: "Dispatch Orders",
            description: "Initiate Store → Shop transfers",
            icon: Truck,
            href: "/partner/dispatches",
            color: "bg-violet-600",
        },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-900 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <Link href="/">
                        <Button variant="ghost" className="text-slate-400 hover:text-white mb-4">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Home
                        </Button>
                    </Link>
                    <h1 className="text-3xl font-bold text-white mb-2">Partner Portal</h1>
                    <p className="text-slate-400">Full visibility & control dashboard</p>
                </div>

                {/* Priority Alerts Banner */}
                {(approvalCount > 0 || flaggedCount > 0) && (
                    <Card className="mb-6 bg-amber-900/30 border-amber-600 border-2">
                        <CardContent className="py-4">
                            <div className="flex items-center gap-4">
                                <AlertTriangle className="h-6 w-6 text-amber-400" />
                                <div className="flex-1">
                                    <p className="text-white font-medium">Items Need Attention</p>
                                    <p className="text-sm text-amber-200/80">
                                        {approvalCount > 0 && `${approvalCount} pending approvals`}
                                        {approvalCount > 0 && flaggedCount > 0 && " • "}
                                        {flaggedCount > 0 && `${flaggedCount} flagged shifts`}
                                    </p>
                                </div>
                                <Link href="/partner/approvals">
                                    <Badge className="bg-amber-600 hover:bg-amber-700 cursor-pointer">
                                        Review Now <ArrowRight className="h-3 w-3 ml-1" />
                                    </Badge>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Today's Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardContent className="pt-6">
                            <div className="text-center">
                                <p className="text-3xl font-bold text-white">
                                    {cashRecon?.pos?.total?.toLocaleString() || "0"}
                                </p>
                                <p className="text-sm text-slate-400 mt-1">POS Total (KES)</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardContent className="pt-6">
                            <div className="text-center">
                                <p className="text-3xl font-bold text-emerald-400">
                                    {cashRecon?.pos?.cash?.toLocaleString() || "0"}
                                </p>
                                <p className="text-sm text-slate-400 mt-1">Cash Sales (KES)</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardContent className="pt-6">
                            <div className="text-center">
                                <p className="text-3xl font-bold text-blue-400">
                                    {cashRecon?.pos?.card?.toLocaleString() || "0"}
                                </p>
                                <p className="text-sm text-slate-400 mt-1">Card/M-Pesa (KES)</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardContent className="pt-6">
                            <div className="text-center">
                                <p className={`text-3xl font-bold ${cashVariance > 0 ? "text-emerald-400" :
                                    cashVariance < 0 ? "text-red-400" : "text-white"
                                    }`}>
                                    {cashVariance > 0 ? "+" : ""}{cashVariance.toLocaleString()}
                                </p>
                                <p className="text-sm text-slate-400 mt-1">Cash Variance</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Module Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {modules.map((module) => (
                        <Link key={module.title} href={module.href}>
                            <Card className={`
                bg-slate-800/50 border-slate-700 hover:bg-slate-800/80 
                hover:border-slate-600 transition-all cursor-pointer h-full
                ${module.highlight ? "ring-2 ring-amber-500/50" : ""}
              `}>
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-lg font-medium text-white">
                                        {module.title}
                                    </CardTitle>
                                    <div className={`p-2 rounded-lg ${module.color}`}>
                                        <module.icon className="h-5 w-5 text-white" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center gap-2">
                                        {module.count !== undefined && (
                                            <span className="text-3xl font-bold text-white">
                                                {module.count}
                                            </span>
                                        )}
                                        {module.badge && (
                                            <Badge
                                                variant={module.badge.variant as any}
                                                className={module.badge.variant === "destructive" ? "" : "bg-emerald-600"}
                                            >
                                                {module.badge.text}
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-400 mt-2">
                                        {module.description}
                                    </p>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>

                {/* Audit Stream & Alerts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                    {/* Alerts Column */}
                    <Card className="bg-slate-800/30 border-slate-700 h-full">
                        <CardHeader>
                            <CardTitle className="text-white text-lg flex items-center gap-2">
                                <Bell className="h-5 w-5" />
                                Recent Alerts
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {!alerts || alerts.length === 0 ? (
                                <p className="text-slate-500 text-sm">No active alerts</p>
                            ) : (
                                <div className="space-y-3">
                                    {alerts.slice(0, 5).map((alert, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50"
                                        >
                                            <div className={`
                          p-2 rounded-full
                          ${alert.severity === "warning" ? "bg-amber-600" :
                                                    alert.severity === "error" ? "bg-red-600" : "bg-blue-600"}
                        `}>
                                                {alert.type === "overdue_dispatch" ? (
                                                    <Package className="h-4 w-4 text-white" />
                                                ) : alert.type === "flagged_shift" ? (
                                                    <AlertTriangle className="h-4 w-4 text-white" />
                                                ) : (
                                                    <Bell className="h-4 w-4 text-white" />
                                                )}
                                            </div>
                                            <p className="text-sm text-white flex-1">{alert.message}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Audit Stream Column */}
                    <Card className="bg-slate-800/30 border-slate-700 h-full">
                        <CardHeader>
                            <CardTitle className="text-white text-lg flex items-center gap-2">
                                <ClipboardList className="h-5 w-5" />
                                Audit Stream
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {auditStream?.map((event: any) => (
                                    <div key={event.id} className="flex gap-3 border-l-2 border-slate-700 pl-4 py-1 relative">
                                        <div className={`absolute -left-[9px] top-2 w-4 h-4 rounded-full border-4 border-slate-900 
                                            ${event.type === 'approval' ? 'bg-green-500' :
                                                event.type === 'expense' ? 'bg-amber-500' : 'bg-blue-500'}`}
                                        />
                                        <div>
                                            <p className="text-sm text-slate-200">{event.message}</p>
                                            <p className="text-xs text-slate-500">
                                                {new Date(event.timestamp).toLocaleTimeString()} • {new Date(event.timestamp).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                {!auditStream?.length && <p className="text-slate-500 text-sm">No activity recorded</p>}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
