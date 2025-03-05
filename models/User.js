const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
  },
  receiveAmount: {
    type: Number,
    required: false,
  },
  txn_id: {
    type: String,
  },
  paymentTransactionId: {
    type: String,
  },
  smslink: {
    type: String,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, "Please enter a valid email"],
  },
  paymentStatus: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending",
  },

  paymentTransferStatus: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const bankDetailsSchema = new mongoose.Schema({
  accountHolder: String,
  accountNumber: String,
  ifscCode: String,
  bankName: String,
});

const userSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    sparse: true, // Allows multiple nulls
    default: "",
  },

  userRole: {
    type: String,
    default: "User",
  },

  password: {
    type: String,
    required: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  otp: {
    code: String,
    expiresAt: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  fullName: {
    type: String,
    trim: true,
    default: "",
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, "Please enter a valid email"],
  },
  bankDetails: bankDetailsSchema,
  transactions: [transactionSchema],
});

module.exports = mongoose.model("User", userSchema);
