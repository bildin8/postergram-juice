import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
    ArrowLeft,
    Users,
    Plus,
    Pencil,
    Key,
    Shield,
    MessageCircle,
    X,
    Lock
} from "lucide-react";
import { Link } from "wouter";

interface Staff {
    id: string;
    name: string;
    role: "partner" | "store" | "shop";
    passphrase: string;
    is_active: boolean;
    can_approve: boolean;
    approval_limit: number;
    telegram_chat_id?: string;
    last_login_at?: string;
    created_at: string;
}

export default function StaffManagement() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [showForm, setShowForm] = useState(false);
    const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        role: "shop" as "partner" | "store" | "shop",
        passphrase: "",
        canApprove: false,
        approvalLimit: 0,
        telegram_chat_id: "",
    });

    // Fetch staff from new op endpoint
    const { data: staff, isLoading } = useQuery<Staff[]>({
        queryKey: ["/api/op/staff"],
        queryFn: async () => {
            const res = await fetch("/api/op/staff");
            return res.json();
        },
    });

    // Create/Update mutation using new op endpoints
    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            const url = data.id
                ? `/api/op/staff/${data.id}`
                : "/api/op/staff";
            const method = data.id ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || "Failed to save staff");
            }

            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Saved", description: "Staff member saved successfully." });
            queryClient.invalidateQueries({ queryKey: ["/api/op/staff"] });
            resetForm();
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const resetForm = () => {
        setShowForm(false);
        setEditingStaff(null);
        setFormData({
            name: "",
            role: "shop",
            passphrase: "",
            canApprove: false,
            approvalLimit: 0,
            telegram_chat_id: ""
        });
    };

    const handleEdit = (s: Staff) => {
        setEditingStaff(s);
        setFormData({
            name: s.name,
            role: s.role,
            passphrase: s.passphrase || "",
            canApprove: s.can_approve,
            approvalLimit: s.approval_limit || 0,
            telegram_chat_id: s.telegram_chat_id || "",
        });
        setShowForm(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast({ title: "Error", description: "Name is required", variant: "destructive" });
            return;
        }
        if (!formData.passphrase.trim()) {
            toast({ title: "Error", description: "Passphrase is required", variant: "destructive" });
            return;
        }
        saveMutation.mutate({ ...formData, id: editingStaff?.id });
    };

    const getRoleColor = (role: string) => {
        switch (role) {
            case "partner": return "bg-indigo-600";
            case "store": return "bg-emerald-600";
            case "shop": return "bg-orange-600";
            default: return "bg-slate-600";
        }
    };

    const getRoleLabel = (role: string) => {
        switch (role) {
            case "partner": return "Partner";
            case "store": return "Store Staff";
            case "shop": return "Shop Staff";
            default: return role;
        }
    };

    const groupedStaff = {
        partner: staff?.filter(s => s.role === "partner") || [],
        store: staff?.filter(s => s.role === "store") || [],
        shop: staff?.filter(s => s.role === "shop") || [],
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-900 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <Link href="/partner">
                            <Button variant="ghost" className="text-slate-400 hover:text-white mb-4">
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back to Partner
                            </Button>
                        </Link>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-white">Staff & Access</h1>
                            <Badge variant="outline" className="border-indigo-500 text-indigo-400">
                                Passphrase Auth Active
                            </Badge>
                        </div>
                        <p className="text-slate-400">{staff?.length || 0} secure access accounts</p>
                    </div>
                    <Button
                        className="bg-indigo-600 hover:bg-indigo-700"
                        onClick={() => setShowForm(true)}
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Staff
                    </Button>
                </div>

                {/* Add/Edit Form */}
                {showForm && (
                    <Card className="bg-slate-800/50 border-slate-700 mb-6 shadow-xl">
                        <CardHeader className="border-b border-slate-700/50">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-white flex items-center gap-2">
                                    <Lock className="h-5 w-5 text-indigo-400" />
                                    {editingStaff ? "Edit Staff Access" : "Create Secure Access"}
                                </CardTitle>
                                <Button variant="ghost" size="sm" onClick={resetForm} className="text-slate-400">
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-slate-300">Display Name *</Label>
                                        <Input
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Staff name"
                                            className="bg-slate-900 border-slate-600 text-white focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-300">Operational Role *</Label>
                                        <Select
                                            value={formData.role}
                                            onValueChange={(v: any) => setFormData({ ...formData, role: v })}
                                        >
                                            <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-slate-800 border-slate-700 text-white">
                                                <SelectItem value="shop">Shop (Daily Operations)</SelectItem>
                                                <SelectItem value="store">Store (Inventory Mgmt)</SelectItem>
                                                <SelectItem value="partner">Partner (Full Control)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-300 flex items-center gap-2">
                                            <Key className="h-3 w-3" /> Login Passphrase *
                                        </Label>
                                        <Input
                                            value={formData.passphrase}
                                            onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })}
                                            placeholder="e.g. mango-sunrise-2024"
                                            className="bg-slate-900 border-slate-600 text-white font-mono"
                                        />
                                        <p className="text-[10px] text-slate-500">Staff will type this to login. Keep it unique.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-300">Telegram Chat ID (Optional)</Label>
                                        <Input
                                            value={formData.telegram_chat_id}
                                            onChange={(e) => setFormData({ ...formData, telegram_chat_id: e.target.value })}
                                            placeholder="For direct alerts"
                                            className="bg-slate-900 border-slate-600 text-white"
                                        />
                                    </div>
                                </div>

                                <div className="p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-lg space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Shield className="h-4 w-4 text-indigo-400" />
                                            <div>
                                                <Label className="text-white">Approval Authority</Label>
                                                <p className="text-xs text-slate-400">Can this staff approve requests?</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={formData.canApprove}
                                            onCheckedChange={(v) => setFormData({ ...formData, canApprove: v })}
                                        />
                                    </div>

                                    {formData.canApprove && (
                                        <div className="pt-2">
                                            <Label className="text-slate-300 mb-1 block">Max Approval Limit (KES)</Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-2.5 text-slate-500 text-sm">KES</span>
                                                <Input
                                                    type="number"
                                                    value={formData.approvalLimit}
                                                    onChange={(e) => setFormData({ ...formData, approvalLimit: parseInt(e.target.value) || 0 })}
                                                    className="bg-slate-900 border-slate-600 text-white pl-12"
                                                />
                                            </div>
                                            <p className="text-[10px] text-slate-500 mt-1">Leave 0 or empty for Role-based defaults.</p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <Button
                                        type="submit"
                                        className="bg-indigo-600 hover:bg-indigo-700 flex-1"
                                        disabled={saveMutation.isPending}
                                    >
                                        {saveMutation.isPending ? "Saving..." : "Grant Access"}
                                    </Button>
                                    <Button type="button" variant="outline" onClick={resetForm} className="border-slate-600 text-slate-300 hover:bg-slate-700">
                                        Cancel
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {/* Loading */}
                {isLoading && (
                    <div className="text-center py-12">
                        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p className="text-slate-400">Validating operational team...</p>
                    </div>
                )}

                {/* Staff by Role */}
                {Object.entries(groupedStaff).map(([role, members]) => (
                    members.length > 0 && (
                        <div key={role} className="mb-8">
                            <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                                <Badge className={`${getRoleColor(role)} px-3 py-1`}>{getRoleLabel(role)}</Badge>
                                <span className="text-slate-500 text-sm font-normal">| {members.length} member(s)</span>
                            </h2>
                            <div className="grid grid-cols-1 gap-4">
                                {members.map((s) => (
                                    <Card key={s.id} className="bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/60 transition-colors">
                                        <CardContent className="py-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getRoleColor(s.role)} shadow-lg`}>
                                                        <span className="text-white font-bold text-xl">
                                                            {s.name.charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-white font-semibold text-lg">{s.name}</p>
                                                            {s.can_approve && (
                                                                <Badge variant="outline" className="text-[10px] h-5 border-emerald-500/50 text-emerald-400 bg-emerald-500/5">
                                                                    Approver
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                                                            <span className="flex items-center gap-1 font-mono text-indigo-400">
                                                                <Key className="h-3 w-3" /> {s.passphrase}
                                                            </span>
                                                            {s.approval_limit > 0 && (
                                                                <span className="flex items-center gap-1 border-l border-slate-700 pl-4">
                                                                    Up to KES {s.approval_limit.toLocaleString()}
                                                                </span>
                                                            )}
                                                            {s.last_login_at && (
                                                                <span className="flex items-center gap-1 border-l border-slate-700 pl-4">
                                                                    Last seen {new Date(s.last_login_at).toLocaleDateString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-9 w-9 text-slate-400 hover:text-white hover:bg-slate-700/50"
                                                        onClick={() => handleEdit(s)}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-9 w-9 text-red-400/70 hover:text-red-400 hover:bg-red-400/10"
                                                        onClick={() => {
                                                            if (confirm(`Revoke access for ${s.name}?`)) {
                                                                // Note: We don't have a specific DELETE endpoint in opRoutes yet
                                                                // but we can de-activate or use existing partner portal delete if shared
                                                                toast({ title: "Note", description: "Use Edit to deactivate staff." });
                                                            }
                                                        }}
                                                    >
                                                        <Shield className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )
                ))}

                {/* Empty State */}
                {!isLoading && (!staff || staff.length === 0) && (
                    <Card className="bg-slate-800/30 border-slate-700 border-dashed border-2">
                        <CardContent className="py-16 text-center">
                            <Lock className="h-20 w-20 text-slate-700 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-white mb-2">Secure Your Operation</h2>
                            <p className="text-slate-400 mb-8 max-w-sm mx-auto">Create staff profiles with specific passphrases to enable tracking and approvals.</p>
                            <Button
                                className="bg-indigo-600 hover:bg-indigo-700 h-12 px-8 text-lg font-semibold"
                                onClick={() => setShowForm(true)}
                            >
                                <Plus className="h-5 w-5 mr-2" />
                                Create First Access Account
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
