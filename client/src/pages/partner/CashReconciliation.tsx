import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft,
    Wallet,
    Clock,
    CreditCard,
    Banknote,
    AlertTriangle,
    CheckCircle
} from "lucide-react";
import { Link } from "wouter";

interface CashReconciliationData {
    date: string;
    pos: {
        total: number;
        cash: number;
        card: number;
        transactions: number;
    };
    declared: number;
    openingFloat: number;
    closingCash: number;
    variance: {
        amount: number;
        percent: number;
        status: "ok" | "warning" | "critical";
    };
    shifts: Array<{
        id: string;
        staffName: string;
        openedAt: string;
        closedAt: string;
        openingFloat: number;
        closingCash: number;
        posSales: number;
        variance: number;
    }>;
}

export default function CashReconciliation() {
    // Fetch cash reconciliation
    const { data, isLoading } = useQuery<CashReconciliationData>({
        queryKey: ["/api/partner/reconciliation/cash"],
        queryFn: async () => {
            const res = await fetch("/api/partner/reconciliation/cash");
            return res.json();
        },
    });

    const varianceAmount = data?.variance?.amount || 0;
    const varianceStatus = data?.variance?.status || "ok";

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-900 p-6">
            <div className="max-w-4xl mx-auto">
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
                            <h1 className="text-2xl font-bold text-white mb-2">Cash Reconciliation</h1>
                            <p className="text-slate-400 flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Today's Summary
                            </p>
                        </div>
                        <Wallet className="h-10 w-10 text-emerald-500" />
                    </div>
                </div>

                {/* Loading */}
                {isLoading && (
                    <div className="text-center py-12">
                        <p className="text-slate-400">Loading...</p>
                    </div>
                )}

                {/* Main Variance Card */}
                {data && (
                    <>
                        <Card className={`mb-6 ${varianceStatus === "critical" ? "bg-red-900/30 border-red-600 border-2" :
                                varianceStatus === "warning" ? "bg-amber-900/30 border-amber-600 border-2" :
                                    "bg-emerald-900/30 border-emerald-600 border-2"
                            }`}>
                            <CardContent className="py-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        {varianceStatus === "ok" ? (
                                            <CheckCircle className="h-12 w-12 text-emerald-400" />
                                        ) : (
                                            <AlertTriangle className={`h-12 w-12 ${varianceStatus === "critical" ? "text-red-400" : "text-amber-400"
                                                }`} />
                                        )}
                                        <div>
                                            <p className="text-white text-lg font-medium">
                                                {varianceStatus === "ok" ? "Cash Balanced" : "Variance Detected"}
                                            </p>
                                            <p className={`text-sm ${varianceStatus === "ok" ? "text-emerald-300/80" :
                                                    varianceStatus === "critical" ? "text-red-300/80" : "text-amber-300/80"
                                                }`}>
                                                {varianceStatus === "ok"
                                                    ? "No significant discrepancy"
                                                    : varianceAmount > 0 ? "Cash over" : "Cash short"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-4xl font-bold ${varianceAmount > 0 ? "text-emerald-400" :
                                                varianceAmount < 0 ? "text-red-400" : "text-white"
                                            }`}>
                                            {varianceAmount > 0 ? "+" : ""}KES {varianceAmount.toLocaleString()}
                                        </p>
                                        {data.variance?.percent !== 0 && (
                                            <p className="text-sm text-slate-400">
                                                {Math.abs(data.variance?.percent || 0)}% variance
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Summary Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <Card className="bg-slate-800/50 border-slate-700">
                                <CardContent className="pt-6 text-center">
                                    <div className="flex justify-center mb-2">
                                        <CreditCard className="h-8 w-8 text-blue-400" />
                                    </div>
                                    <p className="text-2xl font-bold text-white">
                                        KES {(data.pos?.total || 0).toLocaleString()}
                                    </p>
                                    <p className="text-sm text-slate-400">POS Total</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-slate-800/50 border-slate-700">
                                <CardContent className="pt-6 text-center">
                                    <div className="flex justify-center mb-2">
                                        <Banknote className="h-8 w-8 text-emerald-400" />
                                    </div>
                                    <p className="text-2xl font-bold text-emerald-400">
                                        KES {(data.pos?.cash || 0).toLocaleString()}
                                    </p>
                                    <p className="text-sm text-slate-400">Cash Sales</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-slate-800/50 border-slate-700">
                                <CardContent className="pt-6 text-center">
                                    <div className="flex justify-center mb-2">
                                        <Wallet className="h-8 w-8 text-purple-400" />
                                    </div>
                                    <p className="text-2xl font-bold text-white">
                                        KES {(data.declared || 0).toLocaleString()}
                                    </p>
                                    <p className="text-sm text-slate-400">Declared Cash</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-slate-800/50 border-slate-700">
                                <CardContent className="pt-6 text-center">
                                    <p className="text-2xl font-bold text-white">
                                        {data.pos?.transactions || 0}
                                    </p>
                                    <p className="text-sm text-slate-400">Transactions</p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Cash Flow Breakdown */}
                        <Card className="bg-slate-800/50 border-slate-700 mb-6">
                            <CardHeader>
                                <CardTitle className="text-white">Cash Flow</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between py-2 border-b border-slate-700">
                                        <span className="text-slate-400">Opening Float</span>
                                        <span className="text-white font-medium">
                                            KES {(data.openingFloat || 0).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between py-2 border-b border-slate-700">
                                        <span className="text-emerald-400">+ Cash Sales</span>
                                        <span className="text-emerald-400 font-medium">
                                            + KES {(data.pos?.cash || 0).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between py-2 border-b border-slate-700">
                                        <span className="text-slate-400">Expected in Drawer</span>
                                        <span className="text-white font-medium">
                                            KES {((data.openingFloat || 0) + (data.pos?.cash || 0)).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between py-2 border-b border-slate-700">
                                        <span className="text-slate-400">Actual Count (Closing)</span>
                                        <span className="text-white font-medium">
                                            KES {(data.closingCash || data.declared || 0).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between py-2">
                                        <span className="text-white font-medium">Variance</span>
                                        <span className={`font-bold text-lg ${varianceAmount > 0 ? "text-emerald-400" :
                                                varianceAmount < 0 ? "text-red-400" : "text-white"
                                            }`}>
                                            {varianceAmount > 0 ? "+" : ""}KES {varianceAmount.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Shift Breakdown */}
                        {data.shifts && data.shifts.length > 0 && (
                            <Card className="bg-slate-800/50 border-slate-700">
                                <CardHeader>
                                    <CardTitle className="text-white">Shifts Today</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {data.shifts.map((shift) => (
                                            <div
                                                key={shift.id}
                                                className="p-4 rounded-lg bg-slate-900/50 flex items-center justify-between"
                                            >
                                                <div>
                                                    <p className="text-white font-medium">{shift.staffName}</p>
                                                    <p className="text-sm text-slate-400">
                                                        {new Date(shift.openedAt).toLocaleTimeString()} -
                                                        {shift.closedAt ? new Date(shift.closedAt).toLocaleTimeString() : "Open"}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <Badge className={
                                                        shift.variance > 0 ? "bg-emerald-600" :
                                                            shift.variance < 0 ? "bg-red-600" : "bg-slate-600"
                                                    }>
                                                        {shift.variance > 0 ? "+" : ""}KES {shift.variance.toLocaleString()}
                                                    </Badge>
                                                    <p className="text-sm text-slate-400 mt-1">
                                                        Sales: KES {shift.posSales.toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
