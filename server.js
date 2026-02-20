require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3007;

// API Configuration
const CONSUMER_KEY = process.env.KRA_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.KRA_CONSUMER_SECRET;
const TOKEN_URL = "https://sbx.kra.go.ke/v1/token/generate?grant_type=client_credentials";
const PIN_BY_ID_URL = "https://sbx.kra.go.ke/checker/v1/pin";
const REQUEST_TIMEOUT = 15000;

app.use(cors());
app.use(express.json());

// Simple request logger
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

app.use(express.static(path.join(__dirname)));

// Root route to explicitly serve index.html
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

/**
 * Get OAuth2 access token
 */
async function getAccessToken() {
    if (!CONSUMER_KEY || !CONSUMER_SECRET) {
        throw new Error("Missing KRA API credentials in environment variables.");
    }

    const credentials = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64");

    const response = await fetch(TOKEN_URL, {
        method: "GET",
        headers: { "Authorization": `Basic ${credentials}` },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Auth failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (!data.access_token) throw new Error("No access_token returned");

    return data.access_token;
}

/**
 * Main PIN check endpoint
 */
app.post("/api/check-pin", async (req, res) => {
    const { TaxpayerID, TaxpayerType } = req.body;
    console.log(`[PROCESS] Checking PIN for ID: ${TaxpayerID}, Type: ${TaxpayerType}`);

    if (!TaxpayerID || !TaxpayerType) {
        console.log("[ERROR] Missing fields");
        return res.status(400).json({ error: "Missing TaxpayerID or TaxpayerType" });
    }

    try {
        const accessToken = await getAccessToken();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

        const response = await fetch(PIN_BY_ID_URL, {
            signal: controller.signal,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ TaxpayerID, TaxpayerType }),
        });

        clearTimeout(timeoutId);

        const data = await response.json();
        console.log("[DEBUG] API Raw Data:", JSON.stringify(data));

        // Standardized response logic based on actual KRA API behavior
        if (response.ok) {
            // Success response usually contains ResponseCode 30000 or specific PIN/Name fields
            const isSuccess = data.ResponseCode === "30000" || data.TaxpayerPIN || data.pin || data.status === "Success";

            if (isSuccess) {
                console.log("[SUCCESS] PIN Found");
                // Mapping KRA specific fields to standard names for the frontend
                const mappedData = {
                    pin: data.TaxpayerPIN || data.pin || idNumber,
                    taxpayer_name: data.TaxpayerName || data.name || data.taxpayer_name,
                    pin_status: data.PINStatus || data.pin_status || "Active",
                    itax_status: data.iTaxStatus || data.itax_status || "Registered",
                    ...data
                };
                
                return res.status(200).json({
                    success: true,
                    data: mappedData,
                    idNumber: TaxpayerID
                });
            }
            // If response is OK but data indicates failure (e.g., not found)
            console.log("[INFO] ID Not Found (Data logic)");
            return res.status(200).json({ // Return 200 to avoid console error
                success: false,
                error: "Not Found",
                message: `Invalid ID Number: ${TaxpayerID}`,
                idNumber: TaxpayerID
            });
        }

        // Handle error statuses
        console.log(`[ERROR] API Error Status: ${response.status}`);
        const message = response.status === 404 ? `Invalid ID Number: ${TaxpayerID}` : (data.message || "API request failed");

        res.status(200).json({ // Return 200 for clean error handling in the UI
            success: false,
            error: data.error || "API Error",
            message: message,
            idNumber: TaxpayerID
        });

    } catch (error) {
        console.error("Server Error:", error);
        if (error.name === "AbortError") {
            return res.status(504).json({ error: "Timeout", message: "KRA API took too long to respond." });
        }
        res.status(500).json({ error: "Internal Server Error", message: error.message });
    }
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
