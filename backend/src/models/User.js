import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const savedAddressSchema = new mongoose.Schema({
  label: { type: String, default: "Home" }, // e.g. "Home", "Work"
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  line1: { type: String, required: true },
  line2: { type: String, default: "" },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true, minlength: 3 },
  email: { type: String, required: true, trim: true, lowercase: true },
  password: { type: String, required: true }, // bcrypt hash
  role: { type: String, enum: ["customer", "admin"], default: "customer" },
  cart: { type: [cartItemSchema], default: [] },
  addresses: { type: [savedAddressSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("User", userSchema);
