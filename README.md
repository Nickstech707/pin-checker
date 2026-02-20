# KRA PIN Checker

A unified web application to check KRA (Kenya Revenue Authority) PIN numbers using the KRA API.

**Live Demo**: [kra-pin-checker.vercel.app](https://kra-pin-checker.vercel.app)

## Setup

### 1. Configure Environment Variables

Create a `.env` file in the root directory and add your KRA API credentials:

```env
KRA_CONSUMER_KEY=your_key_here
KRA_CONSUMER_SECRET=your_secret_here
PORT=3007
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start the Application

```bash
npm start
```

Once started, the application is available at:

- `http://localhost:3007`

This single endpoint serves the frontend (`index.html`) and handles the API proxy requests.

## How It Works

- **Unified Architecture**: The Express server (`server.js`) serves the static frontend and provides a secure proxy for API requests.
- **Security**: API credentials are kept server-side to prevent exposure in the browser.
- **Serverless Ready**: The project is structured with an `api/` directory and `vercel.json` for seamless deployment to Vercel.

## Test Credentials

Use these test credentials from the KRA documentation:

| TaxpayerType | TaxpayerID   | Notes                                |
| ------------ | ------------ | ------------------------------------ |
| KE           | 41789723     | Kenyan Resident Sample Data          |
| NKE          | 787528       | Non-Kenyan Resident Sample Data      |
| NKENR        | B3962C4A5718 | Non-Kenyan Non-Resident Sample Data  |
| COMP         | 0000200S4304 | Non-Individual (Company) Sample Data |

## Vercel Deployment

1. Connect your repository to Vercel.
2. Add `KRA_CONSUMER_KEY` and `KRA_CONSUMER_SECRET` in the Vercel project environment variables settings.
3. Deploy! The `vercel.json` handles all routing automatically.
