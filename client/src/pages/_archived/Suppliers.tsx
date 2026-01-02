import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
    ArrowLeft,
    Plus,
    Search,
    Truck,
    LineChart,
    Phone,
    Mail
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { secureFetch } from "@/lib/api";

interface Supplier {
    id: string;
    name: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    is_active: boolean;
}

export default function Suppliers() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newSupplier, setNewSupplier] = useState({ name: "", contactPerson: "", phone: "", email: "" });

    const { data: suppliers, isLoading } = useQuery<Supplier[]>({
        queryKey: ["/api/partner/suppliers"],
        queryFn: async () => {
            const res = await secureFetch("/api/partner/suppliers");
            return res.json();
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data: typeof newSupplier) => {
            const res = await secureFetch("/api/partner/suppliers", {
                method: "POST",
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Failed to create supplier");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Supplier Created" });
            queryClient.invalidateQueries({ queryKey: ["/api/partner/suppliers"] });
            setIsAddOpen(false);
            setNewSupplier({ name: "", contactPerson: "", phone: "", email: "" });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to create supplier", variant: "destructive" });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate(newSupplier);
    };

    const filteredSuppliers = suppliers?.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-900 p-6">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <Link href="/partner">
                        <Button variant="ghost" className="text-slate-400 hover:text-white mb-4">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Partner
                        </Button>
                    </Link>
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">Supplier Management</h1>
                            <p className="text-slate-400">Manage supplier database and contacts</p>
                        </div>
                        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-emerald-600 hover:bg-emerald-700">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Supplier
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-slate-800 border-slate-700 text-white">
                                <DialogHeader>
                                    <DialogTitle>Add New Supplier</DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                                    <div className="space-y-2">
                                        <Label>Company Name</Label>
                                        <Input
                                            value={newSupplier.name}
                                            onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })}
                                            className="bg-slate-900 border-slate-600"
                                            required
                                            placeholder="e.g. Fresh Fruits Ltd"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Contact Person</Label>
                                        <Input
                                            value={newSupplier.contactPerson}
                                            onChange={e => setNewSupplier({ ...newSupplier, contactPerson: e.target.value })}
                                            className="bg-slate-900 border-slate-600"
                                            placeholder="e.g. John Doe"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Phone</Label>
                                            <Input
                                                value={newSupplier.phone}
                                                onChange={e => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                                                className="bg-slate-900 border-slate-600"
                                                placeholder="+254..."
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Email</Label>
                                            <Input
                                                value={newSupplier.email}
                                                onChange={e => setNewSupplier({ ...newSupplier, email: e.target.value })}
                                                className="bg-slate-900 border-slate-600"
                                                type="email"
                                                placeholder="john@example.com"
                                            />
                                        </div>
                                    </div>
                                    <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={createMutation.isPending}>
                                        {createMutation.isPending ? "Creating..." : "Create Supplier"}
                                    </Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                <div className="mb-6 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search suppliers..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 bg-slate-800/50 border-slate-700 text-white"
                    />
                </div>

                {isLoading ? (
                    <div className="text-center py-12 text-slate-400">Loading suppliers...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredSuppliers.map((supplier) => (
                            <Card key={supplier.id} className="bg-slate-800/50 border-slate-700 hover:border-slate-600 transition-all group">
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-blue-900/50 text-blue-400">
                                            <Truck className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg text-white group-hover:text-blue-400 transition-colors">
                                                {supplier.name}
                                            </CardTitle>
                                            <p className="text-sm text-slate-400">{supplier.contact_person || 'No contact person'}</p>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3 mb-4">
                                        {supplier.phone && (
                                            <div className="flex items-center gap-2 text-sm text-slate-300">
                                                <Phone className="h-4 w-4 text-slate-500" />
                                                {supplier.phone}
                                            </div>
                                        )}
                                        {supplier.email && (
                                            <div className="flex items-center gap-2 text-sm text-slate-300">
                                                <Mail className="h-4 w-4 text-slate-500" />
                                                {supplier.email}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2">
                                        <Link href={`/partner/suppliers/${supplier.id}/analytics`}>
                                            <Button variant="outline" size="sm" className="w-full border-slate-600 hover:bg-slate-700 text-slate-300">
                                                <LineChart className="h-4 w-4 mr-2" />
                                                View Analytics
                                            </Button>
                                        </Link>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
