// Load environment variables from .env
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const connectDB = require('./db');
const PaymentMethod = require('./models/PaymentMethod');
const Listener = require('./models/Listener');
const User = require('./models/User');

const app = express();
app.use(express.json());

connectDB();

const PORT = process.env.PORT || 3000;
const BASE_PATH = '/tmf-api/paymentMethod/v4';

const validPaymentMethodTypes = [
  'BankCard',
  'BankAccountTransfer',
  'BankAccountDebit',
  'DigitalWallet',
  'Check',
  'Voucher',
  'Cash',
  'BucketPaymentMethod',
  'AccountPaymentMethod',
  'LoyaltyPaymentMethod'
];

function validatePaymentMethod(data, isCreate = true) {
  const { name, '@type': type } = data;
  if (isCreate && (!name || !type)) {
    return { valid: false, error: 'name and @type are required' };
  }
  if (type && !validPaymentMethodTypes.includes(type)) {
    return { valid: false, error: `Invalid @type. Must be one of: ${validPaymentMethodTypes.join(', ')}` };
  }
  if (type === 'BankCard') {
    if (!data.cardNumber || !data.brand || !data.expirationDate || !data.nameOnCard) {
      return { valid: false, error: 'Required fields for BankCard missing' };
    }
  } else if (type === 'BankAccountTransfer' || type === 'BankAccountDebit') {
    if (!data.accountNumber || !data.owner || !data.bank) {
      return { valid: false, error: 'Required fields for BankAccountTransfer/BankAccountDebit missing' };
    }
  } else if (type === 'DigitalWallet') {
    if (!data.service || !data.walletId) {
      return { valid: false, error: 'Required fields for DigitalWallet missing' };
    }
  } else if (type === 'Check') {
    if (!data.checkId || !data.drawer || !data.payee || !data.signedDate || !data.bank) {
      return { valid: false, error: 'Required fields for Check missing' };
    }
  }
  return { valid: true };
}

async function notifyListeners(eventType, paymentMethod) {
  const listeners = await Listener.find();
  listeners.forEach(listener => {
    const event = {
      eventId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      eventTime: new Date().toISOString(),
      eventType,
      event: { paymentMethod }
    };
    console.log(`Notifying listener at ${listener.callback}:`, JSON.stringify(event));
  });
}

// PaymentMethod routes
app.post(`${BASE_PATH}/paymentMethod`, async (req, res) => {
  const validation = validatePaymentMethod(req.body);
  if (!validation.valid) return res.status(400).json({ error: validation.error });

  const newPM = new PaymentMethod({
    ...req.body,
    status: req.body.status || 'Active',
    statusDate: new Date().toISOString(),
    '@baseType': 'PaymentMethod'
  });

  try {
    await newPM.save();
    await notifyListeners('PaymentMethodCreateEvent', newPM);
    res.status(201).json(newPM);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get(`${BASE_PATH}/paymentMethod`, async (req, res) => {
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query['@type']) filters['@type'] = req.query['@type'];
    if (req.query.name) filters.name = req.query.name;

    let projection = null;
    if (req.query.fields) {
      projection = req.query.fields.split(',').join(' ');
    }

    const paymentMethods = await PaymentMethod.find(filters).select(projection);
    res.status(200).json(paymentMethods);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(`${BASE_PATH}/paymentMethod/:id`, async (req, res) => {
  try {
    const projection = req.query.fields ? req.query.fields.split(',').join(' ') : null;
    const pm = await PaymentMethod.findById(req.params.id).select(projection);
    if (!pm) return res.status(404).json({ error: 'Not found' });
    res.status(200).json(pm);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch(`${BASE_PATH}/paymentMethod/:id`, async (req, res) => {
  try {
    const patchData = { ...req.body, statusDate: new Date().toISOString() };
    const existing = await PaymentMethod.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const proposed = { ...existing.toObject(), ...patchData };
    const validation = validatePaymentMethod(proposed, false);
    if (!validation.valid) return res.status(400).json({ error: validation.error });

    const updated = await PaymentMethod.findByIdAndUpdate(req.params.id, patchData, { new: true });
    await notifyListeners('PaymentMethodAttributeValueChangeEvent', updated);
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete(`${BASE_PATH}/paymentMethod/:id`, async (req, res) => {
  try {
    const deleted = await PaymentMethod.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    await notifyListeners('PaymentMethodDeleteEvent', deleted);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Listener (hub) routes
app.post(`${BASE_PATH}/hub`, async (req, res) => {
  const { callback } = req.body;
  if (!callback) return res.status(400).json({ error: 'callback is required' });

  const exists = await Listener.findOne({ callback });
  if (exists) return res.status(409).json({ error: 'Already registered' });

  const newListener = new Listener({ callback });
  await newListener.save();
  res.status(201).json({ id: newListener._id, callback });
});

app.delete(`${BASE_PATH}/hub/:id`, async (req, res) => {
  try {
    const deleted = await Listener.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User routes
app.post("/users", async (req, res) => {
  try {
    const user = new User(req.body);
    const saved = await user.save();
    res.status(201).json({ id: saved._id });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'User already exists' });
    res.status(500).json({ error: err.message });
  }
});

app.get("/users", async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('✅ TMF670 MongoDB-based PaymentMethod API is running');
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}${BASE_PATH}/paymentMethod`);
});
