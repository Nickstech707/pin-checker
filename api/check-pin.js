const fetch = require("node-fetch");

// API Configuration - OAuth2 Client Credentials
const CONSUMER_KEY = process.env.KRA_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.KRA_CONSUMER_SECRET;
const TOKEN_URL = "https://sbx.kra.go.ke/v1/token/generate?grant_type=client_credentials";
const PIN_BY_ID_URL = "https://sbx.kra.go.ke/checker/v1/pin";

/**
 * Get OAuth2 access token using client credentials
 */
async function getAccessToken() {
  if (!CONSUMER_KEY || !CONSUMER_SECRET) {
      throw new Error("Missing KRA API credentials in environment variables.");
  }

  const credentials = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64");
  
  const response = await fetch(TOKEN_URL, {
    method: "GET",
    headers: {
      "Authorization": `Basic ${credentials}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Auth failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.access_token) {
    throw new Error("No access_token in response");
  }

  return data.access_token;
}

module.exports = async (req, res) => {
  // Handle CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { TaxpayerID, TaxpayerType } = req.body;

    // Validate input
    if (!TaxpayerID || !TaxpayerType) {
      return res.status(400).json({
        error: "Missing required fields: TaxpayerID and TaxpayerType are required",
      });
    }

    // Step 1: Get OAuth2 access token
    let accessToken;
    try {
      accessToken = await getAccessToken();
    } catch (tokenError) {
      console.error("OAuth Token Error:", tokenError.message);
      return res.status(401).json({
        error: "Authentication failed",
        message: tokenError.message,
      });
    }

    // Step 2: Call PIN Checker API with access token
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); 

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
            // Mapping KRA specific fields to standard names for the frontend
            const mappedData = {
                pin: data.TaxpayerPIN || data.pin || TaxpayerID,
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
        
        // ID Not Found according to data logic
        return res.status(200).json({ // Return 200 to avoid console error
            success: false,
            error: "Not Found",
            message: `Invalid ID Number: ${TaxpayerID}`,
            idNumber: TaxpayerID
        });
    }

    // Handle error statuses
    const message = response.status === 404 ? `Invalid ID Number: ${TaxpayerID}` : (data.message || "API request failed");

    return res.status(200).json({ // Return 200 for clean error handling in the UI
        success: false,
        error: data.error || "API Error",
        message: message,
        idNumber: TaxpayerID
    });

  } catch (error) {
    console.error("Server Error:", error);

    if (error.name === "AbortError") {
      return res.status(504).json({
        error: "Request timeout",
        message: "The KRA API did not respond in time. Please try again later.",
      });
    }

    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};
