import { useState, useEffect } from 'react';

// API URL - your Railway backend
const API_URL = import.meta.env.VITE_API_URL || 'https://postergram-juice-production.up.railway.app';

// PosterPOS SDK types (injected by Poster)
declare global {
    interface Window {
        Poster?: {
            interface: {
                popup: (options: { width: string; height: string; title: string }) => void;
                closePopup: () => void;
            };
            orders: {
                getActive: () => Promise<any>;
                closeOrder: (orderId: string, paymentMethod: string) => Promise<any>;
            };
            on: (event: string, callback: (data: any) => void) => void;
        };
    }
}

type Status = 'idle' | 'sending' | 'waiting' | 'success' | 'failed';

interface OrderInfo {
    id: string;
    total: number;
    customerPhone?: string;
}

export default function MpesaPaymentWidget() {
    const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [status, setStatus] = useState<Status>('idle');
    const [receiptNumber, setReceiptNumber] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);

    // Load order info from Poster on mount
    useEffect(() => {
        loadOrderInfo();
    }, []);

    const loadOrderInfo = async () => {
        try {
            // Check if running inside PosterPOS
            if (window.Poster?.orders) {
                const order = await window.Poster.orders.getActive();
                if (order) {
                    setOrderInfo({
                        id: order.id,
                        total: order.total / 100, // Poster stores amounts in cents
                        customerPhone: order.customerPhone,
                    });
                    if (order.customerPhone) {
                        setPhoneNumber(order.customerPhone);
                    }
                }
            } else {
                // Running standalone (for testing)
                console.log('Not running inside PosterPOS, using test mode');
            }
        } catch (err) {
            console.error('Failed to load order:', err);
        }
    };

    const handleSendPayment = async () => {
        if (!phoneNumber) {
            setError('Please enter phone number');
            return;
        }

        const amount = orderInfo?.total || 100;

        setStatus('sending');
        setError(null);

        try {
            const response = await fetch(`${API_URL}/api/mpesa/stk-push`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phoneNumber,
                    amount,
                    orderRef: orderInfo?.id || `POS-${Date.now()}`,
                }),
            });

            const data = await response.json();

            if (data.success && data.checkoutRequestId) {
                setCheckoutRequestId(data.checkoutRequestId);
                setStatus('waiting');
                pollForResult(data.checkoutRequestId);
            } else {
                setStatus('failed');
                setError(data.error || 'Failed to send payment request');
            }
        } catch (err: any) {
            setStatus('failed');
            setError(err.message || 'Network error');
        }
    };

    const pollForResult = async (requestId: string) => {
        let attempts = 0;
        const maxAttempts = 60;

        const poll = async () => {
            if (attempts >= maxAttempts) {
                setStatus('failed');
                setError('Payment timed out. Check your M-Pesa messages.');
                return;
            }

            try {
                const response = await fetch(`${API_URL}/api/mpesa/status/${requestId}`);
                const data = await response.json();

                if (data.status === 'success') {
                    setStatus('success');
                    setReceiptNumber(data.result?.mpesaReceiptNumber);

                    // Close order in Poster if available
                    if (window.Poster?.orders && orderInfo?.id) {
                        try {
                            await window.Poster.orders.closeOrder(orderInfo.id, 'mpesa');
                        } catch (e) {
                            console.log('Failed to auto-close order:', e);
                        }
                    }
                    return;
                } else if (data.status === 'failed' || data.status === 'cancelled') {
                    setStatus('failed');
                    setError(data.status === 'cancelled' ? 'Payment cancelled' : 'Payment failed');
                    return;
                }

                attempts++;
                setTimeout(poll, 2000);
            } catch {
                attempts++;
                setTimeout(poll, 2000);
            }
        };

        poll();
    };

    const handleReset = () => {
        setStatus('idle');
        setError(null);
        setReceiptNumber(null);
        setCheckoutRequestId(null);
    };

    const handleClose = () => {
        if (window.Poster?.interface) {
            window.Poster.interface.closePopup();
        } else {
            window.close();
        }
    };

    return (
        <div className="widget-container">
            <div className="widget-header">
                <div className="mpesa-logo">
                    <span className="logo-m">M</span>-PESA
                </div>
                <h2>Mobile Payment</h2>
            </div>

            <div className="widget-content">
                {status === 'idle' && (
                    <>
                        <div className="amount-display">
                            <span className="currency">KES</span>
                            <span className="amount">{orderInfo?.total?.toLocaleString() || '0'}</span>
                        </div>

                        <div className="input-group">
                            <label>Phone Number</label>
                            <input
                                type="tel"
                                placeholder="0712345678"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                                className="phone-input"
                                maxLength={12}
                            />
                        </div>

                        <button className="pay-button" onClick={handleSendPayment}>
                            Send M-Pesa Request
                        </button>
                    </>
                )}

                {(status === 'sending' || status === 'waiting') && (
                    <div className="status-display">
                        <div className="spinner"></div>
                        <p className="status-text">
                            {status === 'sending' ? 'Sending request...' : 'Waiting for payment...'}
                        </p>
                        <p className="status-hint">
                            Check your phone for the M-Pesa prompt
                        </p>
                    </div>
                )}

                {status === 'success' && (
                    <div className="status-display success">
                        <div className="success-icon">✓</div>
                        <p className="status-text">Payment Successful!</p>
                        {receiptNumber && (
                            <p className="receipt">Receipt: {receiptNumber}</p>
                        )}
                        <button className="close-button" onClick={handleClose}>
                            Done
                        </button>
                    </div>
                )}

                {status === 'failed' && (
                    <div className="status-display error">
                        <div className="error-icon">✕</div>
                        <p className="status-text">{error || 'Payment failed'}</p>
                        <div className="action-buttons">
                            <button className="retry-button" onClick={handleSendPayment}>
                                Retry
                            </button>
                            <button className="reset-button" onClick={handleReset}>
                                Start Over
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
