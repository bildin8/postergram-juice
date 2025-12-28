import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    Trash2,
    Phone,
    MessageCircle,
    X
} from "lucide-react";
import { Link } from "wouter";

interface Staff {
    id: string;
    name: string;
    role: string;
    telegram_user_id?: string;
    phone?: string;
    is_active: boolean;
    created_at: string;
}

export default function StaffManagement() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [showForm, setShowForm] = useState(false);
    const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        role: "shop",
        phone: "",
        telegram_user_id: "",
    });

    // Fetch staff
    const { data: staff, isLoading } = useQuery<Staff[]>({
        queryKey: ["/api/partner/staff"],
        queryFn: async () => {
            const res = await fetch("/api/partner/staff");
            return res.json();
        },
    });

    // Create/Update mutation
    const saveMutation = useMutation({
        mutationFn: async (data: typeof formData & { id?: string }) => {
            const url = data.id
                ? `/api/partner/staff/${data.id}`
                : "/api/partner/staff";
            const method = data.id ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to save staff");
            }

            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Saved", description: "Staff member saved successfully." });
            queryClient.invalidateQueries({ queryKey: ["/api/partner/staff"] });
            resetForm();
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/partner/staff/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Deleted", description: "Staff member removed." });
            queryClient.invalidateQueries({ queryKey: ["/api/partner/staff"] });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const resetForm = () => {
        setShowForm(false);
        setEditingStaff(null);
        setFormData({ name: "", role: "shop", phone: "", telegram_user_id: "" });
    };

    const handleEdit = (s: Staff) => {
        setEditingStaff(s);
        setFormData({
            name: s.name,
            role: s.role,
            phone: s.phone || "",
            telegram_user_id: s.telegram_user_id || "",
        });
        setShowForm(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast({ title: "Error", description: "Name is required", variant: "destructive" });
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
                        <h1 className="text-2xl font-bold text-white mb-2">Staff Management</h1>
                        <p className="text-slate-400">{staff?.length || 0} team members</p>
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
                    <Card className="bg-slate-800/50 border-slate-700 mb-6">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-white">
                                    {editingStaff ? "Edit Staff" : "Add New Staff"}
                                </CardTitle>
                                <Button variant="ghost" size="sm" onClick={resetForm}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-slate-300">Name *</Label>
                                        <Input
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Staff name"
                                            className="bg-slate-900 border-slate-600 text-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-300">Role *</Label>
                                        <Select
                                            value={formData.role}
                                            onValueChange={(v) => setFormData({ ...formData, role: v })}
                                        >
                                            <SelectTrigger className="bg-slate-900 border-slate-600 text-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="shop">Shop Staff</SelectItem>
                                                <SelectItem value="store">Store Staff</SelectItem>
                                                <SelectItem value="partner">Partner</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-300">Phone</Label>
                                        <Input
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            placeholder="+254..."
                                            className="bg-slate-900 border-slate-600 text-white"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-300">Telegram ID</Label>
                                        <Input
                                            value={formData.telegram_user_id}
                                            onChange={(e) => setFormData({ ...formData, telegram_user_id: e.target.value })}
                                            placeholder="For notifications"
                                            className="bg-slate-900 border-slate-600 text-white"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <Button
                                        type="submit"
                                        className="bg-emerald-600 hover:bg-emerald-700"
                                        disabled={saveMutation.isPending}
                                    >
                                        {saveMutation.isPending ? "Saving..." : "Save Staff"}
                                    </Button>
                                    <Button type="button" variant="outline" onClick={resetForm}>
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
                        <p className="text-slate-400">Loading staff...</p>
                    </div>
                )}

                {/* Staff by Role */}
                {Object.entries(groupedStaff).map(([role, members]) => (
                    members.length > 0 && (
                        <div key={role} className="mb-6">
                            <h2 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                                <Badge className={getRoleColor(role)}>{getRoleLabel(role)}</Badge>
                                <span className="text-slate-400 text-sm">({members.length})</span>
                            </h2>
                            <div className="space-y-3">
                                {members.map((s) => (
                                    <Card key={s.id} className="bg-slate-800/50 border-slate-700">
                                        <CardContent className="py-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getRoleColor(s.role)}`}>
                                                        <span className="text-white font-bold text-lg">
                                                            {s.name.charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="text-white font-medium">{s.name}</p>
                                                        <div className="flex items-center gap-3 text-sm text-slate-400">
                                                            {s.phone && (
                                                                <span className="flex items-center gap-1">
                                                                    <Phone className="h-3 w-3" /> {s.phone}
                                                                </span>
                                                            )}
                                                            {s.telegram_user_id && (
                                                                <span className="flex items-center gap-1">
                                                                    <MessageCircle className="h-3 w-3" /> Linked
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {!s.is_active && (
                                                        <Badge variant="outline" className="border-red-600 text-red-400">
                                                            Inactive
                                                        </Badge>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleEdit(s)}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-400 hover:text-red-300"
                                                        onClick={() => {
                                                            if (confirm(`Delete ${s.name}?`)) {
                                                                deleteMutation.mutate(s.id);
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
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
                    <Card className="bg-slate-800/30 border-slate-700">
                        <CardContent className="py-12 text-center">
                            <Users className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-white mb-2">No Staff Yet</h2>
                            <p className="text-slate-400 mb-4">Add your team members to get started.</p>
                            <Button
                                className="bg-indigo-600 hover:bg-indigo-700"
                                onClick={() => setShowForm(true)}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add First Staff Member
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
