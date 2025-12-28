# M-Pesa Payment Widget for PosterPOS

This is a PosterPOS Platform App that enables M-Pesa STK Push payments directly from the POS terminal.

## Features

- Sends M-Pesa STK Push to customer's phone
- Automatically polls for payment confirmation
- Auto-closes order in Poster on successful payment
- Resend and retry functionality

## Setup

### 1. Install dependencies
```bash
cd posterpos-app
npm install
```

### 2. Build the widget
```bash
npm run build
```

### 3. Deploy to PosterPOS

1. Go to [Poster Developer Portal](https://dev.joinposter.com)
2. Create a new Platform App
3. Upload the contents of the `dist` folder
4. Configure the app settings with your API URL

## Development

```bash
npm run dev
```

This starts a local server at http://localhost:5173 for testing.

## Configuration

The widget connects to your backend at the URL specified in `vite.config.ts`. 
Update `VITE_API_URL` to point to your deployed backend:

```
https://postergram-juice-production.up.railway.app
```

## API Endpoints Used

- `POST /api/mpesa/stk-push` - Initiate payment
- `GET /api/mpesa/status/:checkoutRequestId` - Check payment status
