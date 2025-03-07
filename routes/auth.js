const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const otpGenerator = require("otp-generator");
const User = require("../models/User");
const { sendEmail } = require("../services/email");

// Generate OTP
const generateOTP = () => {
  return otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    lowerCaseAlphabets: false,
    specialChars: false,
  });
};

// Validation middleware for signup
const validateSignup = [
  body("email").isEmail().withMessage("Please enter a valid email address"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
];

// Login route
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Please enter a valid email address"),
    body("password")
      .notEmpty()
      .withMessage("Password is required")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
  ],
  async (req, res) => {
    try {
      // Validate request body
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Check if the user exists in the database
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: "User Not Found" });
      }


      // Compare the password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      // Create and return JWT token
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
        expiresIn: "1d", // Token expires in 1 day
      });

      res.json({
        token,
        id: user._id, // Send user _id
        email: user.email, // Send email
        isVerified: user.isVerified, // Send email
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Signup route - Modified to include email and OTP
router.post("/signup", validateSignup, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password ,fullName} = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 10); // OTP valid for 10 minutes

    // Create new user
    user = new User({
      email,
      password: await bcrypt.hash(password, 10),
      otp: {
        code: otp,
        expiresAt: otpExpiry,
      },
      phoneNumber: "",
      fullName,
    });

    await user.save();

    // Send OTP Email
    const subject = "PaymentBuddy Verification Code";
    const text = `Dear ${fullName},

I hope this message finds you well.

Please find below your PaymentBuddy verification code:

Verification Code: ${otp}

This code is valid for the next 10 minutes. Kindly use it promptly to complete your verification process.

If you did not request this code or need further assistance, please do not hesitate to contact our support team.

Thank you for using PaymentBuddy.

Best regards,
PaymentBuddy Support Team
support@paymentbuddy.in`;

    await sendEmail(email, subject, text);

    res.status(201).json({
      message: "User created successfully. Please verify OTP.",
      email,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// Verify OTP route
router.post(
  "/verify-otp",
  [
    body("email").isEmail().withMessage("Please enter a valid email address"),
    body("otp").notEmpty().isLength({ min: 6, max: 6 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, otp } = req.body;

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }

      if (user.isVerified) {
        return res.status(400).json({ message: "User already verified" });
      }

      if (!user.otp || !user.otp.code || !user.otp.expiresAt) {
        return res.status(400).json({ message: "OTP not found" });
      }

      if (new Date() > user.otp.expiresAt) {
        return res.status(400).json({ message: "OTP expired" });
      }

      if (user.otp.code !== otp) {
        return res.status(400).json({ message: "Invalid OTP" });
      }

      // Verify user and remove OTP
      user.isVerified = true;
      user.otp = undefined;
      await user.save();

      // Create and return JWT token
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
        expiresIn: "1d",
      });
      res.json({ token });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Forgot password route
router.post(
  "/forgot-password",
  [body("email").isEmail().withMessage("Please enter a valid email address")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.body;
      const user = await User.findOne({ email });

      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }

      // Generate OTP
      const otp = generateOTP();
      const otpExpiry = new Date();
      otpExpiry.setMinutes(otpExpiry.getMinutes() + 10); // OTP valid for 10 minutes

      // Save OTP in the user record
      user.otp = {
        code: otp,
        expiresAt: otpExpiry,
      };
      await user.save();

      // Send OTP via Email
      const subject = "PaymentBuddy Password Reset Code";
      const text = `Your PaymentBuddy password reset code is: ${otp}. Valid for 10 minutes.`;
      await sendEmail(email, subject, text);

      res.json({
        message: "Password reset OTP sent successfully",
        email,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Verify OTP route for password reset
router.post(
  "/verify-otp",
  [
    body("email").isEmail().withMessage("Please enter a valid email address"),
    body("otp")
      .notEmpty()
      .isLength({ min: 6, max: 6 })
      .withMessage("Invalid OTP"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, otp } = req.body;
      const user = await User.findOne({ email });

      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }

      if (!user.otp || !user.otp.code || !user.otp.expiresAt) {
        return res
          .status(400)
          .json({ message: "OTP not found. Please request a new one." });
      }

      if (new Date() > user.otp.expiresAt) {
        return res
          .status(400)
          .json({ message: "OTP expired. Please request a new one." });
      }

      if (user.otp.code !== otp) {
        return res.status(400).json({ message: "Invalid OTP" });
      }

      res.json({
        message: "OTP verified successfully. You can now reset your password.",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Reset password route
router.post(
  "/reset-password",
  [
    body("email").isEmail().withMessage("Please enter a valid email address"),
    body("otp")
      .notEmpty()
      .isLength({ min: 6, max: 6 })
      .withMessage("Invalid OTP"),
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, otp, newPassword } = req.body;
      const user = await User.findOne({ email });

      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }

      if (!user.otp || !user.otp.code || !user.otp.expiresAt) {
        return res
          .status(400)
          .json({ message: "OTP not found. Please request a new one." });
      }

      if (new Date() > user.otp.expiresAt) {
        return res
          .status(400)
          .json({ message: "OTP expired. Please request a new one." });
      }

      if (user.otp.code !== otp) {
        return res.status(400).json({ message: "Invalid OTP" });
      }

      // Update password and remove OTP
      user.password = await bcrypt.hash(newPassword, 10);
      user.otp = undefined;
      await user.save();

      res.json({
        message:
          "Password reset successful. Please login with your new password.",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.post("/send-email", async (req, res) => {
  const { name, email, message } = req.body;

  const to = process.env.SUPPORT_EMAIL;
  const subject = `New message from ${name}`;
  const text = message;
  const htmlData = `<p>Name: ${name}</p><p>Email: ${email}</p><p>Message: ${message}</p>`;

  try {
    await sendEmail(to, subject, text, htmlData);
    res.status(200).send("Message sent successfully!");
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).send("Failed to send message");
  }
});


router.get("/users", async (req, res) => {
  try {
    const users = await User.find(); // Find all users in MongoDB
    res.json(users); // Send the list of users as JSON response
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Webhook endpoint for payment callbacks
router.post("/payment-callback", (req, res) => {
  // Handle the payment callback from Mswipe
  console.log("Payment callback received:", req.body);

  // Process the payment status
  const { TRAN_STATUS, IPG_ID, TranAmount, ME_InvNo } = req.body;

  

  res.json({ status: "success" });
});

// Update User Profile
router.put("/update-profile", async (req, res) => {
  try {
    const { phoneNumber, fullName, email, bankDetails } = req.body;

    // Validate phoneNumber (which is actually the phone number)
    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    // Find user by phone number instead of _id
    const user = await User.findOne({ email: email });
    if (!user) {
      return res.status(404).json({ error: "email  not found" });
    }

    // Update fields if provided
    if (fullName) user.fullName = fullName;
    if (email) user.email = email;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (bankDetails) {
      user.bankDetails = {
        accountHolder: bankDetails.accountHolder,
        accountNumber: bankDetails.accountNumber,
        ifscCode: bankDetails.ifscCode,
        bankName: bankDetails.bankName,
      };
    }

    // Save the updated user
    await user.save();

    // Return updated user without sensitive information
    const userResponse = {
      phoneNumber: user.phoneNumber,
      fullName: user.fullName,
      email: user.email,
      bankDetails: user.bankDetails,
      isVerified: user.isVerified,
    };

    res.json({
      message: "Profile updated successfully",
      user: userResponse,
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({
      error: "Failed to update profile",
      details: error.message,
    });
  }
});


router.put("/update-transactions", async (req, res) => {
  try {
    const { email, txn_id, paymentTransferStatus } = req.body;

 
    // Find user by email
    const user = await User.findOne({ email: email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Find the transaction by txn_id
    const transaction = user.transactions.find((txn) => txn.txn_id === txn_id);
    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Update the paymentTransferStatus for the transaction
    transaction.paymentTransferStatus = paymentTransferStatus;

    // Save the updated user document
    await user.save();

    // Return the updated user profile without sensitive data
    const userResponse = {
      phoneNumber: user.phoneNumber,
      fullName: user.fullName,
      email: user.email,
      bankDetails: user.bankDetails,
      transactions: user.transactions.map(txn => ({
        txn_id: txn.txn_id,
        amount: txn.amount,
        paymentStatus: txn.paymentStatus,
        paymentTransferStatus: txn.paymentTransferStatus,
      })),
      isVerified: user.isVerified,
    };

    res.json({
      message: "Transaction paymentTransferStatus updated successfully",
      user: userResponse,
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({
      error: "Failed to update payment transfer status",
      details: error.message,
    });
  }
});







module.exports = router;
