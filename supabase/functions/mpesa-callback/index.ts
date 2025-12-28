// M-Pesa Callback Edge Function
// Receives callbacks from Safaricom M-Pesa and stores in database

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Parse callback from M-Pesa
        const callbackData = await req.json()
        console.log('M-Pesa callback received:', JSON.stringify(callbackData))

        const body = callbackData.Body
        if (!body?.stkCallback) {
            console.log('Invalid callback format')
            return new Response(
                JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const callback = body.stkCallback
        const checkoutRequestId = callback.CheckoutRequestID
        const merchantRequestId = callback.MerchantRequestID
        const resultCode = callback.ResultCode
        const resultDesc = callback.ResultDesc

        // Determine status
        let status = 'pending'
        if (resultCode === 0) {
            status = 'success'
        } else if (resultCode === 1032) {
            status = 'cancelled'
        } else if (resultCode !== undefined) {
            status = 'failed'
        }

        // Extract metadata if successful
        let phoneNumber = null
        let amount = null
        let mpesaReceiptNumber = null
        let transactionDate = null

        if (resultCode === 0 && callback.CallbackMetadata?.Item) {
            for (const item of callback.CallbackMetadata.Item) {
                switch (item.Name) {
                    case 'MpesaReceiptNumber':
                        mpesaReceiptNumber = item.Value
                        break
                    case 'Amount':
                        amount = item.Value
                        break
                    case 'PhoneNumber':
                        phoneNumber = item.Value?.toString()
                        break
                    case 'TransactionDate':
                        // Parse M-Pesa date format (YYYYMMDDHHmmss)
                        const dateStr = item.Value?.toString()
                        if (dateStr && dateStr.length === 14) {
                            transactionDate = new Date(
                                parseInt(dateStr.substring(0, 4)),   // year
                                parseInt(dateStr.substring(4, 6)) - 1, // month (0-indexed)
                                parseInt(dateStr.substring(6, 8)),  // day
                                parseInt(dateStr.substring(8, 10)), // hour
                                parseInt(dateStr.substring(10, 12)), // minute
                                parseInt(dateStr.substring(12, 14)) // second
                            ).toISOString()
                        }
                        break
                }
            }
        }

        // Upsert transaction record
        const { error } = await supabase
            .from('mpesa_transactions')
            .upsert({
                checkout_request_id: checkoutRequestId,
                merchant_request_id: merchantRequestId,
                phone_number: phoneNumber,
                amount: amount,
                status: status,
                result_code: resultCode,
                result_desc: resultDesc,
                mpesa_receipt_number: mpesaReceiptNumber,
                transaction_date: transactionDate,
                raw_callback: callbackData,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'checkout_request_id'
            })

        if (error) {
            console.error('Database error:', error)
        } else {
            console.log(`Transaction ${checkoutRequestId} updated: ${status}`)
        }

        // Always respond success to M-Pesa
        return new Response(
            JSON.stringify({ ResultCode: 0, ResultDesc: 'Success' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Error processing callback:', error)
        // Still respond success to prevent M-Pesa retries
        return new Response(
            JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
