import { useState } from "react";
import { MobileShell } from "@/components/layout/MobileShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, XCircle, Smartphone, RefreshCw, Search, Send } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";

type PaymentStatus = 'idle' | 'sending' | 'waiting' | 'success' | 'failed' | 'cancelled' | 'verifying';

interface StkPushResponse {
    success: boolean;
    checkoutRequestId?: string;
    customerMessage?: string;
    error?: string;
}

interface TransactionStatusResponse {
    status: 'pending' | 'success' | 'failed' | 'cancelled';
    result?: {
        mpesaReceiptNumber?: string;
        amount?: number;
    };
    source: string;
}

interface VerifyResponse {
    verified: boolean;
    transaction?: any;
    message: string;
}

export default function MpesaPaymentPage() {
    const [phoneNumber, setPhoneNumber] = useState("");
    const [amount, setAmount] = useState("100");
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
    const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
    const [receiptNumber, setReceiptNumber] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [pollingStopped, setPollingStopped] = useState(false);

    // Check M-Pesa config status
    const { data: configStatus } = useQuery({
        queryKey: ["/api/mpesa/config-status"],
        queryFn: async () => {
            const res = await fetch("/api/mpesa/config-status");
            return res.json();
        },
    });

    // STK Push mutation
    const stkPushMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/mpesa/stk-push", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phoneNumber,
                    amount: parseFloat(amount),
                    orderRef: `POS-${Date.now()}`,
                }),
            });
            return res.json() as Promise<StkPushResponse>;
        },
        onSuccess: (data) => {
            if (data.success && data.checkoutRequestId) {
                setCheckoutRequestId(data.checkoutRequestId);
                setPaymentStatus('waiting');
                setPollingStopped(false);
                pollStatus(data.checkoutRequestId);
            } else {
                setPaymentStatus('failed');
                setErrorMessage(data.error || "Failed to initiate payment");
            }
        },
        onError: (error: Error) => {
            setPaymentStatus('failed');
            setErrorMessage(error.message);
        },
    });

    // Verify payment mutation
    const verifyMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/mpesa/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phoneNumber,
                    amount: parseFloat(amount),
                }),
            });
            return res.json() as Promise<VerifyResponse>;
        },
        onSuccess: (data) => {
            if (data.verified && data.transaction) {
                setPaymentStatus('success');
                setReceiptNumber(data.transaction.mpesa_receipt_number);
            } else {
                setPaymentStatus('failed');
                setErrorMessage(data.message || "No matching payment found");
            }
        },
        onError: (error: Error) => {
            setPaymentStatus('failed');
            setErrorMessage(error.message);
        },
    });

    // Poll for transaction status
    const pollStatus = async (requestId: string) => {
        let attempts = 0;
        const maxAttempts = 60; // 60 attempts * 2 seconds = 120 seconds max

        const poll = async () => {
            if (attempts >= maxAttempts || pollingStopped) {
                if (!pollingStopped) {
                    setPaymentStatus('failed');
                    setErrorMessage("Payment timed out. Click 'Resend' or 'Verify Payment'.");
                }
                return;
            }

            try {
                const res = await fetch(`/api/mpesa/status/${requestId}`);
                const data: TransactionStatusResponse = await res.json();

                if (data.status === 'success') {
                    setPaymentStatus('success');
                    setReceiptNumber(data.result?.mpesaReceiptNumber || null);
                    return;
                } else if (data.status === 'failed') {
                    setPaymentStatus('failed');
                    setErrorMessage("Payment failed. You can resend or verify.");
                    return;
                } else if (data.status === 'cancelled') {
                    setPaymentStatus('cancelled');
                    setErrorMessage("Payment was cancelled");
                    return;
                }

                // Still pending, poll again
                attempts++;
                setTimeout(poll, 2000);
            } catch (error) {
                attempts++;
                setTimeout(poll, 2000);
            }
        };

        poll();
    };

    const handleSubmit = () => {
        if (!phoneNumber || !amount) return;
        setPaymentStatus('sending');
        setErrorMessage(null);
        setReceiptNumber(null);
        setPollingStopped(false);
        stkPushMutation.mutate();
    };

    const handleResend = () => {
        setPollingStopped(true);
        setPaymentStatus('sending');
        setErrorMessage(null);
        stkPushMutation.mutate();
    };

    const handleVerify = () => {
        setPollingStopped(true);
        setPaymentStatus('verifying');
        setErrorMessage(null);
        verifyMutation.mutate();
    };

    const handleReset = () => {
        setPaymentStatus('idle');
        setCheckoutRequestId(null);
        setReceiptNumber(null);
        setErrorMessage(null);
        setPollingStopped(false);
    };

    const getStatusIcon = () => {
        switch (paymentStatus) {
            case 'sending':
            case 'waiting':
            case 'verifying':
                return <Loader2 className="h-16 w-16 animate-spin text-blue-500" />;
            case 'success':
                return <CheckCircle2 className="h-16 w-16 text-green-500" />;
            case 'failed':
            case 'cancelled':
                return <XCircle className="h-16 w-16 text-red-500" />;
            default:
                return <Smartphone className="h-16 w-16 text-green-600" />;
        }
    };

    const getStatusMessage = () => {
        switch (paymentStatus) {
            case 'sending':
                return "Sending payment request...";
            case 'waiting':
                return "Check your phone for M-Pesa prompt. Enter your PIN to complete payment.";
            case 'verifying':
                return "Checking for your payment...";
            case 'success':
                return `Payment successful!${receiptNumber ? ` Receipt: ${receiptNumber}` : ''}`;
            case 'failed':
                return errorMessage || "Payment failed";
            case 'cancelled':
                return "Payment was cancelled";
            default:
                return "Enter your phone number to pay with M-Pesa";
        }
    };

    return (
        <MobileShell theme="owner" className="pb-20">
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-6 py-4 border-b">
                <h1 className="text-xl font-bold tracking-tight text-primary">M-Pesa Payment</h1>
                <p className="text-sm text-muted-foreground">
                    {configStatus?.configured ? (
                        <span className="text-green-600">● Connected ({configStatus.environment})</span>
                    ) : (
                        <span className="text-red-600">● Not configured</span>
                    )}
                </p>
            </header>

            <main className="p-4 space-y-6">
                <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
                    <CardHeader className="text-center pb-2">
                        {getStatusIcon()}
                        <CardTitle className="text-lg mt-4">{getStatusMessage()}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {paymentStatus === 'idle' && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone Number</Label>
                                    <Input
                                        id="phone"
                                        type="tel"
                                        placeholder="0712345678"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                        className="text-lg"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Enter your M-Pesa registered phone number
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="amount">Amount (KES)</Label>
                                    <Input
                                        id="amount"
                                        type="number"
                                        placeholder="100"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="text-lg"
                                    />
                                </div>

                                <Button
                                    onClick={handleSubmit}
                                    disabled={!phoneNumber || !amount || !configStatus?.configured}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-lg"
                                >
                                    <Smartphone className="mr-2 h-5 w-5" />
                                    Send M-Pesa Request
                                </Button>
                            </>
                        )}

                        {(paymentStatus === 'sending' || paymentStatus === 'waiting' || paymentStatus === 'verifying') && (
                            <div className="text-center py-4">
                                <p className="text-sm text-muted-foreground mb-4">
                                    Amount: <strong>KES {amount}</strong>
                                </p>
                                <p className="text-sm text-muted-foreground mb-6">
                                    Phone: <strong>{phoneNumber}</strong>
                                </p>

                                {paymentStatus === 'waiting' && (
                                    <div className="space-y-3">
                                        <p className="text-xs text-muted-foreground">
                                            Didn't receive the prompt?
                                        </p>
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={handleResend}
                                                variant="outline"
                                                className="flex-1"
                                                disabled={stkPushMutation.isPending}
                                            >
                                                <Send className="mr-2 h-4 w-4" />
                                                Resend STK
                                            </Button>
                                            <Button
                                                onClick={handleVerify}
                                                variant="outline"
                                                className="flex-1"
                                                disabled={verifyMutation.isPending}
                                            >
                                                <Search className="mr-2 h-4 w-4" />
                                                Verify Payment
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {(paymentStatus === 'failed' || paymentStatus === 'cancelled') && (
                            <div className="space-y-3">
                                <div className="flex gap-2">
                                    <Button
                                        onClick={handleResend}
                                        variant="outline"
                                        className="flex-1"
                                        disabled={stkPushMutation.isPending}
                                    >
                                        <Send className="mr-2 h-4 w-4" />
                                        Resend STK
                                    </Button>
                                    <Button
                                        onClick={handleVerify}
                                        variant="outline"
                                        className="flex-1"
                                        disabled={verifyMutation.isPending}
                                    >
                                        <Search className="mr-2 h-4 w-4" />
                                        Verify Payment
                                    </Button>
                                </div>
                                <Button
                                    onClick={handleReset}
                                    variant="ghost"
                                    className="w-full"
                                >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Start Over
                                </Button>
                            </div>
                        )}

                        {paymentStatus === 'success' && (
                            <Button
                                onClick={handleReset}
                                variant="outline"
                                className="w-full py-6"
                            >
                                <RefreshCw className="mr-2 h-5 w-5" />
                                Make Another Payment
                            </Button>
                        )}
                    </CardContent>
                </Card>

                {/* Instructions */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">How it works</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground space-y-2">
                        <p>1. Enter your M-Pesa registered phone number</p>
                        <p>2. Enter the amount to pay</p>
                        <p>3. Click "Send M-Pesa Request"</p>
                        <p>4. You'll receive a prompt on your phone</p>
                        <p>5. Enter your M-Pesa PIN to complete payment</p>
                        <p className="pt-2 text-xs italic">
                            💡 If the prompt doesn't arrive, click "Resend STK" or "Verify Payment" if you already paid manually.
                        </p>
                    </CardContent>
                </Card>
            </main>

            <BottomNav role="owner" />
        </MobileShell>
    );
}
