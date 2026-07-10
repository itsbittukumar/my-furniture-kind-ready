import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: String,
    qty: Number,
    price: Number,
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String, default: "" },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema({
  username: { type: String, required: true },
  items: { type: [orderItemSchema], default: [] },
  total: { type: Number, required: true },
  address: { type: addressSchema, required: true },
  paymentMethod: { type: String, enum: ["cod", "upi", "card"], default: "cod" },
  paymentStatus: { type: String, enum: ["pending", "paid"], default: "pending" },
  paymentRef: { type: String, default: "" }, // UPI transaction/UTR number entered by the customer
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Order", orderSchema);
