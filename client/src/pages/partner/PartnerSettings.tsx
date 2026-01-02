import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
    Settings as SettingsIcon, Shield, DollarSign, Clock, Bell,
    Save, ArrowLeft, Users, AlertTriangle
} from 'lucide-react';
import { Link } from 'wouter';

interface Settings {
    shift_controls: {
        require_opening_count: boolean;
        require_closing_count: boolean;
        require_cash_declaration: boolean;
        require_staff_assignment: boolean;
    };
    financial_controls: {
        max_petty_cash: number;
        expense_approval_threshold: number;
        cash_variance_tolerance: number;
        receipt_required_threshold: number;
        price_alert_percent: number;
    };
    approval_limits: {
        shop_lead: number;
        store_lead: number;
        partner: number | null;
    };
    alert_settings: {
        dispatch_timeout_hours: number;
        variance_threshold_percent: number;
        critical_stock_telegram: boolean;
        auto_reorder_enabled: boolean;
        daily_summary_enabled: boolean;
    };
}

export default function PartnerSettings() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [editedSettings, setEditedSettings] = useState<Partial<Settings>>({});

    const { data: settings, isLoading } = useQuery<Settings>({
        queryKey: ['op-settings'],
        queryFn: async () => {
            const res = await fetch('/api/op/settings');
            return res.json();
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ key, value }: { key: string; value: any }) => {
            const res = await fetch(`/api/op/settings/${key}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value }),
            });
            if (!res.ok) throw new Error('Failed to update');
            return res.json();
        },
        onSuccess: () => {
            toast({ title: 'Settings Updated', description: 'Changes saved successfully.' });
            queryClient.invalidateQueries({ queryKey: ['op-settings'] });
        },
        onError: () => {
            toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' });
        },
    });

    const handleSave = (key: keyof Settings) => {
        if (editedSettings[key]) {
            updateMutation.mutate({ key, value: editedSettings[key] });
        }
    };

    const updateField = (section: keyof Settings, field: string, value: any) => {
        setEditedSettings(prev => ({
            ...prev,
            [section]: {
                ...(prev[section] || settings?.[section] || {}),
                [field]: value,
            },
        }));
    };

    const getValue = <T extends keyof Settings>(section: T, field: keyof Settings[T]): any => {
        return (editedSettings[section] as any)?.[field] ?? (settings?.[section] as any)?.[field];
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 flex items-center justify-center">
                <p className="text-slate-400">Loading settings...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <Link href="/partner">
                        <Button variant="ghost" className="text-slate-400 hover:text-white mb-4">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Partner
                        </Button>
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600">
                            <SettingsIcon className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Partner Settings</h1>
                            <p className="text-slate-400">Configure operational controls and thresholds</p>
                        </div>
                    </div>
                </div>

                <Tabs defaultValue="shift" className="w-full">
                    <TabsList className="bg-slate-800 border border-slate-700 w-full justify-start p-1 h-auto flex-wrap">
                        <TabsTrigger value="shift" className="data-[state=active]:bg-purple-600">
                            <Clock className="h-4 w-4 mr-2" />
                            Shift
                        </TabsTrigger>
                        <TabsTrigger value="financial" className="data-[state=active]:bg-emerald-600">
                            <DollarSign className="h-4 w-4 mr-2" />
                            Financial
                        </TabsTrigger>
                        <TabsTrigger value="approvals" className="data-[state=active]:bg-blue-600">
                            <Users className="h-4 w-4 mr-2" />
                            Approvals
                        </TabsTrigger>
                        <TabsTrigger value="alerts" className="data-[state=active]:bg-amber-600">
                            <Bell className="h-4 w-4 mr-2" />
                            Alerts
                        </TabsTrigger>
                    </TabsList>

                    {/* Shift Controls */}
                    <TabsContent value="shift" className="mt-6">
                        <Card className="bg-slate-800/50 border-slate-700">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-purple-400" />
                                    Shift Controls
                                </CardTitle>
                                <CardDescription className="text-slate-400">
                                    What's required to open and close shifts
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label className="text-white">Require Opening Stock Count</Label>
                                        <p className="text-sm text-slate-400">Staff must count stock before opening</p>
                                    </div>
                                    <Switch
                                        checked={getValue('shift_controls', 'require_opening_count')}
                                        onCheckedChange={(v) => updateField('shift_controls', 'require_opening_count', v)}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label className="text-white">Require Closing Stock Count</Label>
                                        <p className="text-sm text-slate-400">Staff must count stock before closing</p>
                                    </div>
                                    <Switch
                                        checked={getValue('shift_controls', 'require_closing_count')}
                                        onCheckedChange={(v) => updateField('shift_controls', 'require_closing_count', v)}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label className="text-white">Require Cash Declaration</Label>
                                        <p className="text-sm text-slate-400">Staff must declare cash before closing</p>
                                    </div>
                                    <Switch
                                        checked={getValue('shift_controls', 'require_cash_declaration')}
                                        onCheckedChange={(v) => updateField('shift_controls', 'require_cash_declaration', v)}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label className="text-white">Require Staff Assignment</Label>
                                        <p className="text-sm text-slate-400">Must assign staff on duty when opening</p>
                                    </div>
                                    <Switch
                                        checked={getValue('shift_controls', 'require_staff_assignment')}
                                        onCheckedChange={(v) => updateField('shift_controls', 'require_staff_assignment', v)}
                                    />
                                </div>
                                <Button
                                    onClick={() => handleSave('shift_controls')}
                                    className="w-full bg-purple-600 hover:bg-purple-700"
                                    disabled={updateMutation.isPending}
                                >
                                    <Save className="h-4 w-4 mr-2" />
                                    Save Shift Settings
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Financial Controls */}
                    <TabsContent value="financial" className="mt-6">
                        <Card className="bg-slate-800/50 border-slate-700">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <DollarSign className="h-5 w-5 text-emerald-400" />
                                    Financial Controls
                                </CardTitle>
                                <CardDescription className="text-slate-400">
                                    Thresholds and limits for financial operations
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-white">Max Petty Cash (KES)</Label>
                                        <Input
                                            type="number"
                                            value={getValue('financial_controls', 'max_petty_cash')}
                                            onChange={(e) => updateField('financial_controls', 'max_petty_cash', parseInt(e.target.value))}
                                            className="bg-slate-900 border-slate-600 text-white mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-white">Expense Approval Threshold (KES)</Label>
                                        <Input
                                            type="number"
                                            value={getValue('financial_controls', 'expense_approval_threshold')}
                                            onChange={(e) => updateField('financial_controls', 'expense_approval_threshold', parseInt(e.target.value))}
                                            className="bg-slate-900 border-slate-600 text-white mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-white">Cash Variance Tolerance (KES)</Label>
                                        <Input
                                            type="number"
                                            value={getValue('financial_controls', 'cash_variance_tolerance')}
                                            onChange={(e) => updateField('financial_controls', 'cash_variance_tolerance', parseInt(e.target.value))}
                                            className="bg-slate-900 border-slate-600 text-white mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-white">Receipt Required Above (KES)</Label>
                                        <Input
                                            type="number"
                                            value={getValue('financial_controls', 'receipt_required_threshold')}
                                            onChange={(e) => updateField('financial_controls', 'receipt_required_threshold', parseInt(e.target.value))}
                                            className="bg-slate-900 border-slate-600 text-white mt-1"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <Label className="text-white">Price Alert (% above average)</Label>
                                        <Input
                                            type="number"
                                            value={getValue('financial_controls', 'price_alert_percent')}
                                            onChange={(e) => updateField('financial_controls', 'price_alert_percent', parseInt(e.target.value))}
                                            className="bg-slate-900 border-slate-600 text-white mt-1"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">Alert when purchase cost exceeds historical average by this %</p>
                                    </div>
                                </div>
                                <Button
                                    onClick={() => handleSave('financial_controls')}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                                    disabled={updateMutation.isPending}
                                >
                                    <Save className="h-4 w-4 mr-2" />
                                    Save Financial Settings
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Approval Limits */}
                    <TabsContent value="approvals" className="mt-6">
                        <Card className="bg-slate-800/50 border-slate-700">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <Shield className="h-5 w-5 text-blue-400" />
                                    Approval Limits
                                </CardTitle>
                                <CardDescription className="text-slate-400">
                                    Maximum amounts each role can approve
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-4">
                                    <div className="p-4 bg-slate-900/50 rounded-lg">
                                        <div className="flex items-center justify-between mb-2">
                                            <Label className="text-white">Shop Lead Limit (KES)</Label>
                                            <Badge className="bg-orange-600">Shop</Badge>
                                        </div>
                                        <Input
                                            type="number"
                                            value={getValue('approval_limits', 'shop_lead') || 0}
                                            onChange={(e) => updateField('approval_limits', 'shop_lead', parseInt(e.target.value))}
                                            className="bg-slate-800 border-slate-600 text-white"
                                        />
                                    </div>
                                    <div className="p-4 bg-slate-900/50 rounded-lg">
                                        <div className="flex items-center justify-between mb-2">
                                            <Label className="text-white">Store Lead Limit (KES)</Label>
                                            <Badge className="bg-emerald-600">Store</Badge>
                                        </div>
                                        <Input
                                            type="number"
                                            value={getValue('approval_limits', 'store_lead') || 0}
                                            onChange={(e) => updateField('approval_limits', 'store_lead', parseInt(e.target.value))}
                                            className="bg-slate-800 border-slate-600 text-white"
                                        />
                                    </div>
                                    <div className="p-4 bg-slate-900/50 rounded-lg">
                                        <div className="flex items-center justify-between mb-2">
                                            <Label className="text-white">Partner</Label>
                                            <Badge className="bg-indigo-600">Unlimited</Badge>
                                        </div>
                                        <p className="text-sm text-slate-400">Partner can approve any amount</p>
                                    </div>
                                </div>
                                <Button
                                    onClick={() => handleSave('approval_limits')}
                                    className="w-full bg-blue-600 hover:bg-blue-700"
                                    disabled={updateMutation.isPending}
                                >
                                    <Save className="h-4 w-4 mr-2" />
                                    Save Approval Limits
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Alert Settings */}
                    <TabsContent value="alerts" className="mt-6">
                        <Card className="bg-slate-800/50 border-slate-700">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <Bell className="h-5 w-5 text-amber-400" />
                                    Alert Settings
                                </CardTitle>
                                <CardDescription className="text-slate-400">
                                    Automation and notification preferences
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-white">Dispatch Timeout (hours)</Label>
                                        <Input
                                            type="number"
                                            value={getValue('alert_settings', 'dispatch_timeout_hours')}
                                            onChange={(e) => updateField('alert_settings', 'dispatch_timeout_hours', parseInt(e.target.value))}
                                            className="bg-slate-900 border-slate-600 text-white mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-white">Variance Threshold (%)</Label>
                                        <Input
                                            type="number"
                                            value={getValue('alert_settings', 'variance_threshold_percent')}
                                            onChange={(e) => updateField('alert_settings', 'variance_threshold_percent', parseInt(e.target.value))}
                                            className="bg-slate-900 border-slate-600 text-white mt-1"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label className="text-white">Critical Stock Telegram Alert</Label>
                                            <p className="text-sm text-slate-400">Send Telegram when stock is critical</p>
                                        </div>
                                        <Switch
                                            checked={getValue('alert_settings', 'critical_stock_telegram')}
                                            onCheckedChange={(v) => updateField('alert_settings', 'critical_stock_telegram', v)}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label className="text-white">Auto-Create Reorders</Label>
                                            <p className="text-sm text-slate-400">Automatically create reorder requests when below PAR</p>
                                        </div>
                                        <Switch
                                            checked={getValue('alert_settings', 'auto_reorder_enabled')}
                                            onCheckedChange={(v) => updateField('alert_settings', 'auto_reorder_enabled', v)}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label className="text-white">Daily Summary</Label>
                                            <p className="text-sm text-slate-400">Send daily summary via Telegram</p>
                                        </div>
                                        <Switch
                                            checked={getValue('alert_settings', 'daily_summary_enabled')}
                                            onCheckedChange={(v) => updateField('alert_settings', 'daily_summary_enabled', v)}
                                        />
                                    </div>
                                </div>
                                <Button
                                    onClick={() => handleSave('alert_settings')}
                                    className="w-full bg-amber-600 hover:bg-amber-700"
                                    disabled={updateMutation.isPending}
                                >
                                    <Save className="h-4 w-4 mr-2" />
                                    Save Alert Settings
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
