# PosterPOS Widget Configuration Guide

The "M-Pesa Payment" widget has been successfully deployed to the PosterPOS Platform. However, its visibility and location within the POS interface are controlled by the **Poster Developer Console** settings, not just the code.

Currently, the widget appears in the **Header / Order List** (the `prod<>` button you saw). To make it appear in the **Payment Window**, follow these steps:

## 1. Move Widget to Payment Screen

1.  Log in to the [Poster Developer Console](https://dev.joinposter.com/console/apps).
2.  Select your application (**M-Pesa Payment**).
3.  Navigate to the **Settings** (or **App capabilities**) section.
4.  Look for **"Widget locations"**, **"Entry points"**, or **"Functions"**.
5.  Enable the checkbox for **"Application in payment window"** (sometimes labeled simply as **"Payment"**).
6.  *Optional:* You can disable "Application in order list" if you don't want the button in the header.
7.  **Save** your changes.

*Note: You may need to refresh the PosterPOS page or reload the cache for the changes to take effect.*

## 2. Using the Widget for Payment

Once configured, a **separate button** (likely labeled "M-Pesa Payment" or with your app icon) will appear in the Payment window, usually below the standard payment methods or in a distinct "Apps" section.

**To process a payment:**
1.  Do **NOT** click the standard "M-Pesa" row (circled in blue in your screenshot) if that is a manual payment method you created in settings. That button only records a payment without triggering the widget.
2.  Instead, click the **new App Button** that appears in the payment screen.
3.  The widget will open, auto-fill the amount, and ask for the phone number.
4.  Upon successful payment, the widget will automatically **close the order** in Poster using the `closeOrder` API.

### Can I link it to the standard "M-Pesa" row?
PosterPOS generally separates "Platform Apps" from "Manual Payment Methods".
*   **Recommendation:** Rename your manual payment method to "M-Pesa (Manual)" as a fallback.
*   Train staff to use the **App Button** for automatic MPesa STK Push.

## 3. Verify Order Connection

The widget code is already designed to detect the **active order**. When opened from the payment screen, it will automatically:
*   Retrieve the Order ID and Total Amount.
*   Pre-fill the amount field.
*   Pre-fill the customer phone number (if attached to the order).

No code changes are required for this to work; it is purely a configuration change in the Poster Developer Portal.
