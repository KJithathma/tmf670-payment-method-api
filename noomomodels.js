const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  // Add other user fields as needed
});

const paymentMethodSchema = new mongoose.Schema({
  name: String,
  '@type': String,
  status: { type: String, default: 'Active' },
  statusDate: { type: Date, default: Date.now },
  // Add other payment method fields as needed
});

const User = mongoose.model('User ', userSchema);
const PaymentMethod = mongoose.model('PaymentMethod', paymentMethodSchema);

module.exports = { User, PaymentMethod };
