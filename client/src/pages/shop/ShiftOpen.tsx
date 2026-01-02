import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Play, Users } from "lucide-react";
import { Link } from "wouter";

interface Staff {
    id: string;
    name: string;
}

export default function ShiftOpen() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();

    const [openedBy, setOpenedBy] = useState("");
    const [openingFloat, setOpeningFloat] = useState("");
    const [selectedStaff, setSelectedStaff] = useState<string[]>([]);

    // Fetch shop staff
    const { data: staffList } = useQuery<Staff[]>({
        queryKey: ["/api/shop/staff"],
        queryFn: async () => {
            const res = await fetch("/api/shop/staff");
            return res.json();
        },
    });

    const openShiftMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/shop/shifts/open", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    openedBy,
                    openingFloat: parseFloat(openingFloat),
                    staffOnDuty: selectedStaff,
                }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to open shift");
            }

            return res.json();
        },
        onSuccess: () => {
            toast({
                title: "Shift Opened",
                description: "Your shift has been started successfully.",
            });
            setLocation("/shop");
        },
        onError: (error: Error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!openedBy.trim()) {
            toast({ title: "Error", description: "Please enter your name", variant: "destructive" });
            return;
        }

        if (!openingFloat || parseFloat(openingFloat) < 0) {
            toast({ title: "Error", description: "Please enter a valid opening float", variant: "destructive" });
            return;
        }

        openShiftMutation.mutate();
    };

    const toggleStaff = (name: string) => {
        setSelectedStaff((prev) =>
            prev.includes(name)
                ? prev.filter((s) => s !== name)
                : [...prev, name]
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-900 p-6">
            <div className="max-w-lg mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <Link href="/shop">
                        <Button variant="ghost" className="text-slate-400 hover:text-white mb-4">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Shop
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold text-white mb-2">Open Shift</h1>
                    <p className="text-slate-400">Start your day by opening a new shift</p>
                </div>

                {/* Form */}
                <Card className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <Play className="h-5 w-5 text-emerald-500" />
                            Shift Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Opened By */}
                            <div className="space-y-2">
                                <Label htmlFor="openedBy" className="text-slate-300">
                                    Your Name *
                                </Label>
                                <Input
                                    id="openedBy"
                                    value={openedBy}
                                    onChange={(e) => setOpenedBy(e.target.value)}
                                    placeholder="Enter your name"
                                    className="bg-slate-900 border-slate-600 text-white"
                                />
                            </div>

                            {/* Opening Float */}
                            <div className="space-y-2">
                                <Label htmlFor="openingFloat" className="text-slate-300">
                                    Opening Float (KES) *
                                </Label>
                                <Input
                                    id="openingFloat"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={openingFloat}
                                    onChange={(e) => setOpeningFloat(e.target.value)}
                                    placeholder="e.g. 5000"
                                    className="bg-slate-900 border-slate-600 text-white"
                                />
                                <p className="text-xs text-slate-500">
                                    This is the starting cash in the till
                                </p>
                            </div>

                            {/* Staff on Duty */}
                            <div className="space-y-3">
                                <Label className="text-slate-300 flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    Staff on Duty
                                </Label>

                                {staffList && staffList.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        {staffList.map((staff) => (
                                            <div
                                                key={staff.id}
                                                className={`
                          flex items-center gap-2 p-3 rounded-lg border cursor-pointer
                          transition-all
                          ${selectedStaff.includes(staff.name)
                                                        ? "bg-emerald-900/30 border-emerald-600"
                                                        : "bg-slate-900/50 border-slate-700 hover:border-slate-600"
                                                    }
                        `}
                                                onClick={() => toggleStaff(staff.name)}
                                            >
                                                <Checkbox
                                                    checked={selectedStaff.includes(staff.name)}
                                                    onCheckedChange={() => toggleStaff(staff.name)}
                                                />
                                                <span className="text-white text-sm">{staff.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Input
                                            placeholder="Enter staff names (comma-separated)"
                                            onChange={(e) => setSelectedStaff(
                                                e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                                            )}
                                            className="bg-slate-900 border-slate-600 text-white"
                                        />
                                        <p className="text-xs text-slate-500">
                                            e.g. "John, Mary, Peter"
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Submit */}
                            <Button
                                type="submit"
                                disabled={openShiftMutation.isPending}
                                className="w-full bg-emerald-600 hover:bg-emerald-700"
                            >
                                {openShiftMutation.isPending ? (
                                    "Opening..."
                                ) : (
                                    <>
                                        <Play className="h-4 w-4 mr-2" />
                                        Open Shift
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
