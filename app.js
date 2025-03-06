require("dotenv").config();
const bodyParser = require("body-parser");
const cron = require("node-cron");

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const authRoutes = require("./routes/auth");
const profileRoutes = require("./routes/profile");
if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is not defined in environment variables");
  process.exit(1);
}

const axios = require("axios");
const User = require("./models/User");

const dbURI = process.env.MONGODB_URI;

const app = express();

// Middleware
app.use(express.json());

const corsOptions = {
  origin: "*",
  methods: "*", 
  allowedHeaders: "Content-Type, Authorization, x-auth-token", 
};

app.use(cors(corsOptions));

// Middleware to parse JSON
app.use(bodyParser.json());

// Routes
app.use("/auth", authRoutes);
app.use("/profile", profileRoutes);

// Connect to MongoDB
mongoose
  .connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => {
    console.error("Error connecting to MongoDB:", err);
    process.exit(1); // Exit process if DB connection fails
  });

const LIVE_BASE_URL = process.env.MSWIPE_BASE_URL;

const config = {
  clientId: process.env.MSWIPE_CLIENT_ID,
  custcode: process.env.MSWIPE_CUST_CODE,
  channelId: "pbl",
  applId: "api",
  password: process.env.MSWIPE_PASSWORD,
};

// Generate Auth Token
app.post("/api/generate-token", async (req, res) => {
  try {
    const tokenPayload = {
      userId: req.body.userId,
      clientId: config.clientId,
      password: config.password,
      applId: config.applId,
      channelId: config.channelId,
    };

    const response = await axios.post(
      `${LIVE_BASE_URL}/CreatePBLAuthToken`,
      tokenPayload
    );
    res.json(response.data);
  } catch (error) {
    console.error("Token generation error:", error);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

// Generate Payment Link
app.post("/api/generate-payment-link", async (req, res) => {
  try {
    const { amount,receiveAmount, mobileno, email_id, invoice_id, userId, id } = req.body;

    // Step 1: Generate Token first
    const tokenResponse = await axios.post(
      `${LIVE_BASE_URL}/CreatePBLAuthToken`,
      {
        userId,
        clientId: config.clientId,
        password: config.password,
        applId: config.applId,
        channelId: config.channelId,
      }
    );



    if (tokenResponse.data && tokenResponse.data.token) {
      const token = tokenResponse.data.token;

      // Step 2: Prepare payment link payload with the generated token
      const paymentLinkPayload = {
        amount,
        mobileno,
        custcode: config.custcode,
        user_id: userId,
        sessiontoken: token, // Use the generated token here
        versionno: "VER4.0.0",
        email_id,
        invoice_id,
        request_id: `REQ_${Date.now()}`,
        ApplicationId: config.applId,
        ChannelId: config.channelId,
        ClientId: config.clientId,
      };

      // Step 3: Make the API call to generate the payment link
      const response = await axios.post(
        `${LIVE_BASE_URL}/MswipePayment`,
        paymentLinkPayload
      );

      // Step 4: Find the user by userId and push the transaction data into their transactions array
      const user = await User.findOne({ _id: id });
      if (user) {
        const url = response.data.smslink; // Your smslink URL
        const urlParams = new URLSearchParams(new URL(url).search);
        const transID = urlParams.get("TransID");

        // Update the transaction object with the extracted transID
        user.transactions.push({
          amount,
          receiveAmount,
          txn_id: response.data.txn_id,
          smslink: response.data.smslink,
          paymentStatus: "pending",
          paymentTransferStatus: "pending",
          paymentTransactionId: transID,
          email: email_id,
        });

        // Save the updated user document
        await user.save();

        // Step 5: Automatically update payment status
        const status = await updatePaymentStatus(transID);

        // Update transaction status in the user's transactions array
        const transaction = user.transactions.find(
          (txn) => txn.paymentTransactionId === transID
        );
        if (transaction) {
          transaction.paymentStatus = status; // Update status to 'completed', 'pending', or 'failed'
          await user.save();
        }

        res.json(response.data); // Return the payment link response
      } else {
        res.status(404).json({ error: "User not found" });
      }
    } else {
      res.status(500).json({ error: "Failed to generate auth token" });
    }
  } catch (error) {
    console.error("Payment link generation error:", error);
    res.status(500).json({ error: "Failed to generate payment link" });
  }
});

const updatePaymentStatus = async (paymentTransactionId) => {
  try {
    const response = await axios.post(
      `${LIVE_BASE_URL}/getPBLTransactionDetails`,
      { id: paymentTransactionId },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data && response.data.Data && response.data.Data.length > 0) {
      const { Payment_Status } = response.data.Data[0]; // Payment status from the response

      // Determine payment status
      let status;
      if (Payment_Status === 1) {
        status = "completed";
      } else if (Payment_Status === 2) {
        status = "pending";
      } else {
        status = "failed";
      }

      return status;
    } 
  } catch (error) {
    throw new Error("Failed to fetch payment status");
  }
};


app.post("/api/payment-status", async (req, res) => {
  const { paymentTransactionId } = req.body;

  if (!paymentTransactionId) {
    return res.status(400).json({ error: "paymentTransactionId is required" });
  }

  try {
    // Make an API call to get payment status with 'application/json' content type
    const response = await axios.post(
      `${LIVE_BASE_URL}/getPBLTransactionDetails`,
      { id: paymentTransactionId }, // Send JSON object in the body
      {
        headers: {
          "Content-Type": "application/json", // Set the Content-Type to 'application/json'
        },
      }
    );

    if (response.data && response.data.Data && response.data.Data.length > 0) {
      const { Payment_Status } = response.data.Data[0]; // Access the first item in the 'Data' array

      // Determine the payment status based on the response
      let status;
      if (Payment_Status === 1) {
        status = "completed";
      } else if (Payment_Status === 2) {
        status = "pending";
      } else {
        status = "failed";
      }

      res.json({ status });
    } else {
      res.status(404).json({ error: "Payment status not found" });
    }
  } catch (error) {
    console.error("Error fetching payment status:", error);
    res.status(500).json({ error: "Failed to fetch payment status" });
  }
});

// Cron job to check the payment status every 2 sEC
cron.schedule("*/10 * * * *", async () => {
  try {
    const users = await User.find(); // Get all users

    for (let user of users) {
      // Check each transaction of the user
      for (let txn of user.transactions) {
        if (txn.paymentStatus === "pending") {
          // If the transaction status is 'pending', check the payment status
          const status = await updatePaymentStatus(txn.paymentTransactionId);
          txn.paymentStatus = status; // Update status to 'completed', 'pending', or 'failed'
          await user.save(); // Save the updated user with the new transaction status
        }
      }
    }
  } catch (error) {
    console.error("Error updating payment statuses:", error);
  }
});




// Run the payment status check every 2 seconds
setInterval(async () => {
  try {
    const users = await User.find(); // Get all users

    for (let user of users) {
      // Check each transaction of the user
      for (let txn of user.transactions) {
        if (txn.paymentStatus === "pending") {
          // If the transaction status is 'pending', check the payment status
          const status = await updatePaymentStatus(txn.paymentTransactionId);
          txn.paymentStatus = status; // Update status to 'completed', 'pending', or 'failed'
          await user.save(); // Save the updated user with the new transaction status
        }
      }
    }

  } catch (error) {
    console.error("Error updating payment statuses:", error);
  }
}, 2000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
