// models/Listener.js
const mongoose = require('mongoose');

const ListenerSchema = new mongoose.Schema({
  callback: { type: String, required: true, unique: true },
  query: { type: String } // TMF spec often includes a query for filtering events
}, { timestamps: true });

// Virtual for 'id' to map to _id for TMF compliance
ListenerSchema.virtual('id').get(function() {
  return this._id.toString();
});

module.exports = mongoose.model('Listener', ListenerSchema);