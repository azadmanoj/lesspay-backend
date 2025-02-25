// src/controllers/payment.controller.js
const MswipeService = require('../services/mswipe.service');
const Transaction = require('../models/Transaction');
const { v4: uuidv4 } = require('uuid');

class PaymentController {
  async createPaymentLink(req, res) {
    try {
      const { amount } = req.body;
      const userId = req.user.userId; // From auth middleware

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Generate session token
      const sessionToken = await MswipeService.generateToken();

      // Create payment link
      const requestId = uuidv4();
      const paymentData = {
        amount,
        phone: user.phone,
        email: user.email,
        orderId: `ORD${Date.now()}`,
        requestId
      };

      const paymentResponse = await MswipeService.generatePaymentLink(paymentData, sessionToken);

      // Store transaction details
      const transaction = new Transaction({
        userId,
        amount,
        txnId: paymentResponse.txnId,
        status: paymentResponse.status,
        paymentLink: paymentResponse.paymentLink,
        requestId,
        mswipeResponse: paymentResponse
      });

      await transaction.save();

      res.json({
        message: "Payment link generated successfully",
        paymentLink: paymentResponse.paymentLink,
        transactionId: transaction._id
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async checkStatus(req, res) {
    try {
      const { transactionId } = req.params;
      
      const transaction = await Transaction.findById(transactionId);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      const status = await MswipeService.checkTransactionStatus(transaction.txnId);
      
      // Update transaction status
      transaction.status = status.Payment_Status === 1 ? 'success' : 
                          status.Payment_Status === 0 ? 'failed' : 
                          status.Payment_Status === 3 ? 'expired' : 'pending';
      
      transaction.mswipeResponse = status;
      await transaction.save();

      res.json({
        status: transaction.status,
        details: status
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new PaymentController();
