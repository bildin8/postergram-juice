import { log } from "./index";

// M-Pesa Daraja API Client
// Supports both sandbox and production environments

interface MpesaConfig {
    consumerKey: string;
    consumerSecret: string;
    shortcode: string;
    passkey: string;
    callbackUrl: string;
    environment: 'sandbox' | 'production';
}

interface StkPushRequest {
    phoneNumber: string;
    amount: number;
    accountReference: string;
    transactionDesc?: string;
}

interface StkPushResponse {
    success: boolean;
    checkoutRequestId?: string;
    merchantRequestId?: string;
    responseCode?: string;
    responseDescription?: string;
    customerMessage?: string;
    error?: string;
}

interface TransactionStatus {
    resultCode: string;
    resultDesc: string;
    mpesaReceiptNumber?: string;
    transactionDate?: string;
    phoneNumber?: string;
    amount?: number;
}

// In-memory store for transaction status (will be replaced with DB)
const transactionStore = new Map<string, {
    status: 'pending' | 'success' | 'failed' | 'cancelled';
    result?: TransactionStatus;
    createdAt: Date;
    updatedAt: Date;
}>();

export class MpesaClient {
    private config: MpesaConfig;
    private accessToken: string | null = null;
    private tokenExpiry: Date | null = null;

    constructor(config: MpesaConfig) {
        this.config = config;
    }

    private get baseUrl(): string {
        return this.config.environment === 'production'
            ? 'https://api.safaricom.co.ke'
            : 'https://sandbox.safaricom.co.ke';
    }

    /**
     * Get OAuth access token (cached with auto-refresh)
     */
    async getAccessToken(): Promise<string> {
        // Return cached token if still valid (with 5 min buffer)
        if (this.accessToken && this.tokenExpiry && new Date() < new Date(this.tokenExpiry.getTime() - 5 * 60 * 1000)) {
            return this.accessToken;
        }

        const credentials = Buffer.from(
            `${this.config.consumerKey}:${this.config.consumerSecret}`
        ).toString('base64');

        try {
            const response = await fetch(
                `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Basic ${credentials}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error(`OAuth failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            this.accessToken = data.access_token;
            // Token expires in 1 hour typically
            this.tokenExpiry = new Date(Date.now() + (parseInt(data.expires_in) || 3600) * 1000);

            log(`M-Pesa: OAuth token obtained, expires at ${this.tokenExpiry.toISOString()}`);
            return this.accessToken;
        } catch (error: any) {
            log(`M-Pesa OAuth error: ${error.message}`);
            throw new Error(`Failed to get M-Pesa access token: ${error.message}`);
        }
    }

    /**
     * Normalize phone number to 254XXXXXXXXX format
     */
    normalizePhoneNumber(phone: string): string {
        // Remove all non-digit characters
        let cleaned = phone.replace(/\D/g, '');

        // Handle various formats
        if (cleaned.startsWith('0')) {
            cleaned = '254' + cleaned.substring(1);
        } else if (cleaned.startsWith('+254')) {
            cleaned = cleaned.substring(1);
        } else if (!cleaned.startsWith('254')) {
            cleaned = '254' + cleaned;
        }

        // Validate length (254 + 9 digits = 12)
        if (cleaned.length !== 12) {
            throw new Error(`Invalid phone number format: ${phone}. Expected 10 digits starting with 0 or 07XX`);
        }

        return cleaned;
    }

    /**
     * Generate password for STK Push
     */
    private generatePassword(): { password: string; timestamp: string } {
        const timestamp = new Date()
            .toISOString()
            .replace(/[-:T.Z]/g, '')
            .substring(0, 14);

        const password = Buffer.from(
            `${this.config.shortcode}${this.config.passkey}${timestamp}`
        ).toString('base64');

        return { password, timestamp };
    }

    /**
     * Initiate STK Push to customer's phone
     */
    async stkPush(request: StkPushRequest): Promise<StkPushResponse> {
        try {
            const token = await this.getAccessToken();
            const phoneNumber = this.normalizePhoneNumber(request.phoneNumber);
            const { password, timestamp } = this.generatePassword();

            const payload = {
                BusinessShortCode: this.config.shortcode,
                Password: password,
                Timestamp: timestamp,
                TransactionType: 'CustomerPayBillOnline',
                Amount: Math.round(request.amount), // M-Pesa expects integer
                PartyA: phoneNumber,
                PartyB: this.config.shortcode,
                PhoneNumber: phoneNumber,
                CallBackURL: this.config.callbackUrl,
                AccountReference: request.accountReference || 'Payment',
                TransactionDesc: request.transactionDesc || 'Payment',
            };

            log(`M-Pesa STK Push: Initiating for ${phoneNumber}, amount ${request.amount}`);

            const response = await fetch(
                `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                }
            );

            const data = await response.json();

            if (data.ResponseCode === '0') {
                // Store pending transaction
                transactionStore.set(data.CheckoutRequestID, {
                    status: 'pending',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });

                log(`M-Pesa STK Push: Success, CheckoutRequestID=${data.CheckoutRequestID}`);

                return {
                    success: true,
                    checkoutRequestId: data.CheckoutRequestID,
                    merchantRequestId: data.MerchantRequestID,
                    responseCode: data.ResponseCode,
                    responseDescription: data.ResponseDescription,
                    customerMessage: data.CustomerMessage,
                };
            } else {
                log(`M-Pesa STK Push: Failed - ${data.errorMessage || data.ResponseDescription}`);
                return {
                    success: false,
                    responseCode: data.ResponseCode || data.errorCode,
                    responseDescription: data.ResponseDescription || data.errorMessage,
                    error: data.errorMessage || data.ResponseDescription,
                };
            }
        } catch (error: any) {
            log(`M-Pesa STK Push error: ${error.message}`);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Query STK Push transaction status
     */
    async queryTransaction(checkoutRequestId: string): Promise<TransactionStatus> {
        try {
            const token = await this.getAccessToken();
            const { password, timestamp } = this.generatePassword();

            const response = await fetch(
                `${this.baseUrl}/mpesa/stkpushquery/v1/query`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        BusinessShortCode: this.config.shortcode,
                        Password: password,
                        Timestamp: timestamp,
                        CheckoutRequestID: checkoutRequestId,
                    }),
                }
            );

            const data = await response.json();

            return {
                resultCode: data.ResultCode?.toString() || data.errorCode,
                resultDesc: data.ResultDesc || data.errorMessage,
                mpesaReceiptNumber: data.MpesaReceiptNumber,
            };
        } catch (error: any) {
            log(`M-Pesa query error: ${error.message}`);
            return {
                resultCode: '-1',
                resultDesc: error.message,
            };
        }
    }

    /**
     * Get stored transaction status (from callback)
     */
    getStoredTransaction(checkoutRequestId: string) {
        return transactionStore.get(checkoutRequestId) || null;
    }

    /**
     * Process callback from M-Pesa (called by webhook endpoint)
     */
    processCallback(callbackData: any): void {
        try {
            const { Body } = callbackData;
            if (!Body?.stkCallback) {
                log('M-Pesa Callback: Invalid callback format');
                return;
            }

            const callback = Body.stkCallback;
            const checkoutRequestId = callback.CheckoutRequestID;
            const resultCode = callback.ResultCode;
            const resultDesc = callback.ResultDesc;

            log(`M-Pesa Callback: ${checkoutRequestId} - Code=${resultCode}, Desc=${resultDesc}`);

            // Extract metadata if successful
            let metadata: any = {};
            if (resultCode === 0 && callback.CallbackMetadata?.Item) {
                for (const item of callback.CallbackMetadata.Item) {
                    metadata[item.Name] = item.Value;
                }
            }

            // Update transaction store
            transactionStore.set(checkoutRequestId, {
                status: resultCode === 0 ? 'success' : (resultCode === 1032 ? 'cancelled' : 'failed'),
                result: {
                    resultCode: resultCode.toString(),
                    resultDesc,
                    mpesaReceiptNumber: metadata.MpesaReceiptNumber,
                    amount: metadata.Amount,
                    phoneNumber: metadata.PhoneNumber?.toString(),
                    transactionDate: metadata.TransactionDate?.toString(),
                },
                createdAt: transactionStore.get(checkoutRequestId)?.createdAt || new Date(),
                updatedAt: new Date(),
            });

            log(`M-Pesa Callback: Transaction ${checkoutRequestId} updated to ${resultCode === 0 ? 'success' : 'failed'}`);
        } catch (error: any) {
            log(`M-Pesa Callback processing error: ${error.message}`);
        }
    }
}

// Singleton instance
let mpesaClient: MpesaClient | null = null;

export function initMpesaClient(): boolean {
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    const callbackUrl = process.env.MPESA_CALLBACK_URL;
    const environment = (process.env.MPESA_ENV || 'sandbox') as 'sandbox' | 'production';

    if (!consumerKey || !consumerSecret || !shortcode || !passkey || !callbackUrl) {
        log('M-Pesa: Missing required configuration. Set MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY, and MPESA_CALLBACK_URL');
        return false;
    }

    mpesaClient = new MpesaClient({
        consumerKey,
        consumerSecret,
        shortcode,
        passkey,
        callbackUrl,
        environment,
    });

    log(`M-Pesa: Client initialized in ${environment} mode`);
    return true;
}

export function getMpesaClient(): MpesaClient {
    if (!mpesaClient) {
        throw new Error('M-Pesa client not initialized. Call initMpesaClient() first.');
    }
    return mpesaClient;
}

export function isMpesaInitialized(): boolean {
    return mpesaClient !== null;
}
