const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const User = require('../models/User');

// Get user profile (authenticated)
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password -otp');
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user profile by ID (public)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    const user = await User.findById(id)
      .select('-password -otp')
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update personal info
router.put('/personal', [
  auth,
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('email').isEmail().withMessage('Please enter a valid email')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { fullName, email } = req.body;

    // Check if email is already used by another user
    const emailExists = await User.findOne({ 
      email: email, 
      _id: { $ne: req.userId } 
    });
    if (emailExists) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { 
        fullName,
        email
      },
      { new: true }
    ).select('-password -otp');

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update password
router.put('/password', [
  auth,
  body('password.old').notEmpty().withMessage('Current password is required'),
  body('password.new').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await User.findById(req.userId);
    const isMatch = await bcrypt.compare(req.body.password.old, user.password);
    
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(req.body.password.new, 10);
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update bank details
router.put('/bank', [
  auth,
  body('bankDetails.accountHolder').trim().notEmpty().withMessage('Account holder name is required'),
  body('bankDetails.accountNumber').trim().notEmpty().withMessage('Account number is required'),
  body('bankDetails.ifscCode').trim().matches(/^[A-Z]{4}0[A-Z0-9]{6}$/).withMessage('Invalid IFSC code'),
  body('bankDetails.bankName').trim().notEmpty().withMessage('Bank name is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { bankDetails: req.body.bankDetails },
      { new: true }
    ).select('-password -otp');

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all transactions
router.get('/transactions', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    res.json(user.transactions || []);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all transactions by userId (must come before /:transactionId route)
router.get('/user-transactions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    const user = await User.findById(userId)
      .select('transactions')
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user.transactions || []);
  } catch (error) {
    console.error('Error fetching user transactions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add new transaction
router.post('/transactions', [
  auth,
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('utrNumber').notEmpty().withMessage('UTR number is required'),
  body('utrStatus').isIn(['pending', 'success', 'failed']).withMessage('Invalid UTR status'),
  body('paymentStatus').isIn(['pending', 'success', 'failed']).withMessage('Invalid payment status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await User.findById(req.userId);
    user.transactions.push(req.body);
    await user.save();
    res.status(201).json(user.transactions[user.transactions.length - 1]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get specific transaction by ID
router.get('/transactions/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      return res.status(400).json({ message: 'Invalid transaction ID format' });
    }

    const user = await User.findOne({ 
      'transactions': transactionId 
    });

    if (!user) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    const transaction = user.transactions.id(transactionId);
    
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json(transaction);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update transaction status
router.put('/transactions/:transactionId', [
  auth,
  body('utrStatus').isIn(['pending', 'success', 'failed']).withMessage('Invalid UTR status'),
  body('paymentStatus').isIn(['pending', 'success', 'failed']).withMessage('Invalid payment status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await User.findById(req.userId);
    const transaction = user.transactions.id(req.params.transactionId);
    
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    transaction.utrStatus = req.body.utrStatus;
    transaction.paymentStatus = req.body.paymentStatus;
    await user.save();

    res.json(transaction);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
