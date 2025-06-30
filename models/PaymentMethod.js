// models/PaymentMethod.js
const mongoose = require('mongoose');

const PaymentMethodSchema = new mongoose.Schema({
  // Mongoose automatically adds an `_id` field.
  // We'll map `id` and `href` from `_id` on retrieval for TMF compliance.
  '@baseType': { type: String, default: 'PaymentMethod' },
  '@schemaLocation': { type: String }, // Optional
  '@type': { type: String, required: true }, // e.g., 'BankCard', 'DigitalWallet'
  name: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['Active', 'Inactive', 'Suspended', 'Expired', 'Cancelled'], default: 'Active' },
  statusDate: { type: Date, default: Date.now },

  // Fields specific to PaymentMethod types (made optional at the schema level)
  cardNumber: { type: String },
  brand: { type: String },
  expirationDate: { type: String }, // Consider Date type if you need date ops
  nameOnCard: { type: String },
  accountNumber: { type: String },
  owner: { type: String },
  bank: { type: String },
  service: { type: String },
  walletId: { type: String },
  checkId: { type: String },
  drawer: { type: String },
  payee: { type: String },
  signedDate: { type: Date },

  // You might want to add validFor, partyRole, etc. as per TMF670 spec if needed later
  // validFor: {
  //   startDateTime: { type: Date },
  //   endDateTime: { type: Date }
  // },
  // partyRole: {
  //   id: String,
  //   href: String,
  //   name: String,
  //   '@referredType': String
  // }
}, {
  timestamps: true, // Adds createdAt and updatedAt fields
  toJSON: { virtuals: true }, // Enable virtuals to be included in JSON output
  toObject: { virtuals: true } // Enable virtuals to be included in object output
});

// Virtual for 'id' to map to _id for TMF compliance
PaymentMethodSchema.virtual('id').get(function() {
  return this._id.toString();
});

// Virtual for 'href' to map to a URL based on _id for TMF compliance
PaymentMethodSchema.virtual('href').get(function() {
  // Use process.env.BASE_PATH here if it's consistently set, otherwise hardcode or pass it.
  return `/tmf-api/paymentMethod/v4/paymentMethod/${this._id.toString()}`;
});


module.exports = mongoose.model('PaymentMethod', PaymentMethodSchema);