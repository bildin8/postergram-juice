import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft,
    Bell,
    AlertTriangle,
    Package,
    Clock,
    Shield,
    TrendingDown,
    Truck,
    CheckCircle
} from "lucide-react";
import { Link } from "wouter";

interface Alert {
    id: string;
    type: string;
    severity: "info" | "warning" | "error" | "critical";
    message: string;
    details?: string;
    createdAt: string;
    actionUrl?: string;
}

export default function Alerts() {
    // Fetch alerts
    const { data: alerts, isLoading } = useQuery<Alert[]>({
        queryKey: ["/api/partner/alerts"],
        queryFn: async () => {
            const res = await fetch("/api/partner/alerts");
            return res.json();
        },
        refetchInterval: 60000, // Refresh every minute
    });

    const getAlertIcon = (type: string) => {
        switch (type) {
            case "overdue_dispatch":
                return <Truck className="h-5 w-5" />;
            case "flagged_shift":
                return <Shield className="h-5 w-5" />;
            case "low_stock":
                return <TrendingDown className="h-5 w-5" />;
            case "pending_approval":
                return <Clock className="h-5 w-5" />;
            case "short_buy":
                return <Package className="h-5 w-5" />;
            default:
                return <AlertTriangle className="h-5 w-5" />;
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case "critical":
                return "bg-red-600";
            case "error":
                return "bg-red-500";
            case "warning":
                return "bg-amber-500";
            default:
                return "bg-blue-500";
        }
    };

    const getSeverityBg = (severity: string) => {
        switch (severity) {
            case "critical":
                return "bg-red-900/30 border-red-700";
            case "error":
                return "bg-red-900/20 border-red-800";
            case "warning":
                return "bg-amber-900/30 border-amber-700";
            default:
                return "bg-slate-800/50 border-slate-700";
        }
    };

    const formatAlertType = (type: string) => {
        return type.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    };

    const groupedAlerts = {
        critical: alerts?.filter(a => a.severity === "critical") || [],
        error: alerts?.filter(a => a.severity === "error") || [],
        warning: alerts?.filter(a => a.severity === "warning") || [],
        info: alerts?.filter(a => a.severity === "info") || [],
    };

    const totalAlerts = alerts?.length || 0;
    const criticalCount = groupedAlerts.critical.length;
    const warningCount = groupedAlerts.warning.length + groupedAlerts.error.length;

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
                            <h1 className="text-2xl font-bold text-white mb-2">Alerts</h1>
                            <p className="text-slate-400">
                                {totalAlerts} active alert{totalAlerts !== 1 ? "s" : ""}
                            </p>
                        </div>
                        <Bell className={`h-10 w-10 ${totalAlerts > 0 ? "text-amber-500" : "text-slate-500"}`} />
                    </div>
                </div>

                {/* Loading */}
                {isLoading && (
                    <div className="text-center py-12">
                        <p className="text-slate-400">Loading alerts...</p>
                    </div>
                )}

                {/* Summary Stats */}
                {!isLoading && totalAlerts > 0 && (
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <Card className="bg-red-900/30 border-red-700">
                            <CardContent className="pt-6 text-center">
                                <p className="text-3xl font-bold text-red-400">{criticalCount}</p>
                                <p className="text-sm text-red-300/70">Critical</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-amber-900/30 border-amber-700">
                            <CardContent className="pt-6 text-center">
                                <p className="text-3xl font-bold text-amber-400">{warningCount}</p>
                                <p className="text-sm text-amber-300/70">Warnings</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-blue-900/30 border-blue-700">
                            <CardContent className="pt-6 text-center">
                                <p className="text-3xl font-bold text-blue-400">{groupedAlerts.info.length}</p>
                                <p className="text-sm text-blue-300/70">Info</p>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* All Clear State */}
                {!isLoading && totalAlerts === 0 && (
                    <Card className="bg-emerald-900/20 border-emerald-700">
                        <CardContent className="py-12 text-center">
                            <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-white mb-2">All Clear!</h2>
                            <p className="text-emerald-300/80">No issues requiring attention right now.</p>
                        </CardContent>
                    </Card>
                )}

                {/* Critical Alerts */}
                {groupedAlerts.critical.length > 0 && (
                    <Card className="bg-red-900/30 border-red-600 border-2 mb-6">
                        <CardHeader>
                            <CardTitle className="text-red-400 flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5" />
                                Critical Alerts
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {groupedAlerts.critical.map((alert, idx) => (
                                    <div
                                        key={alert.id || idx}
                                        className="p-4 rounded-lg bg-red-900/50 flex items-start gap-4"
                                    >
                                        <div className="p-2 rounded-full bg-red-600">
                                            {getAlertIcon(alert.type)}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-white font-medium">{alert.message}</p>
                                            {alert.details && (
                                                <p className="text-sm text-red-200/70 mt-1">{alert.details}</p>
                                            )}
                                            <p className="text-xs text-red-300/50 mt-2">
                                                {formatAlertType(alert.type)}
                                            </p>
                                        </div>
                                        {alert.actionUrl && (
                                            <Link href={alert.actionUrl}>
                                                <Button size="sm" className="bg-red-600 hover:bg-red-700">
                                                    View
                                                </Button>
                                            </Link>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Warning & Error Alerts */}
                {(groupedAlerts.warning.length > 0 || groupedAlerts.error.length > 0) && (
                    <Card className="bg-amber-900/30 border-amber-700 mb-6">
                        <CardHeader>
                            <CardTitle className="text-amber-400 flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5" />
                                Warnings
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {[...groupedAlerts.error, ...groupedAlerts.warning].map((alert, idx) => (
                                    <div
                                        key={alert.id || idx}
                                        className="p-4 rounded-lg bg-amber-900/30 flex items-start gap-4"
                                    >
                                        <div className={`p-2 rounded-full ${getSeverityColor(alert.severity)}`}>
                                            {getAlertIcon(alert.type)}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-white font-medium">{alert.message}</p>
                                            {alert.details && (
                                                <p className="text-sm text-amber-200/70 mt-1">{alert.details}</p>
                                            )}
                                            <p className="text-xs text-amber-300/50 mt-2">
                                                {formatAlertType(alert.type)}
                                            </p>
                                        </div>
                                        {alert.actionUrl && (
                                            <Link href={alert.actionUrl}>
                                                <Button size="sm" variant="outline" className="border-amber-600 text-amber-400">
                                                    View
                                                </Button>
                                            </Link>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Info Alerts */}
                {groupedAlerts.info.length > 0 && (
                    <Card className="bg-slate-800/50 border-slate-700">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Bell className="h-5 w-5 text-blue-400" />
                                Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {groupedAlerts.info.map((alert, idx) => (
                                    <div
                                        key={alert.id || idx}
                                        className="p-4 rounded-lg bg-slate-900/50 flex items-start gap-4"
                                    >
                                        <div className="p-2 rounded-full bg-blue-600">
                                            {getAlertIcon(alert.type)}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-white">{alert.message}</p>
                                            {alert.details && (
                                                <p className="text-sm text-slate-400 mt-1">{alert.details}</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
