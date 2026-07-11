import { Router } from "express";
import User from "../models/User.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

// Admin only: view registered customers (never expose password hashes)
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const users = await User.find({ role: "customer" }).select("-password -cart");
  res.json(users);
});

const REQUIRED_ADDRESS_FIELDS = ["fullName", "phone", "line1", "city", "state", "pincode"];

function validateAddress(address) {
  const missing = REQUIRED_ADDRESS_FIELDS.filter((f) => !address?.[f] || !String(address[f]).trim());
  if (missing.length > 0) return `Please fill in: ${missing.join(", ")}`;
  if (!/^\d{10}$/.test(String(address.phone).trim())) return "Phone number must be 10 digits.";
  if (!/^\d{6}$/.test(String(address.pincode).trim())) return "PIN code must be 6 digits.";
  return null;
}

// Logged-in user: list my saved addresses
router.get("/me/addresses", requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id).select("addresses");
  res.json(user?.addresses || []);
});

// Logged-in user: save a new address
router.post("/me/addresses", requireAuth, async (req, res) => {
  const { label, fullName, phone, line1, line2, city, state, pincode } = req.body || {};
  const err = validateAddress(req.body);
  if (err) return res.status(400).json({ message: err });

  const user = await User.findById(req.user.id);
  user.addresses.push({
    label: (label || "Home").trim(),
    fullName: fullName.trim(),
    phone: phone.trim(),
    line1: line1.trim(),
    line2: (line2 || "").trim(),
    city: city.trim(),
    state: state.trim(),
    pincode: pincode.trim(),
  });
  await user.save();
  res.status(201).json(user.addresses);
});

// Logged-in user: update one of my saved addresses
router.put("/me/addresses/:addressId", requireAuth, async (req, res) => {
  const err = validateAddress(req.body);
  if (err) return res.status(400).json({ message: err });

  const user = await User.findById(req.user.id);
  const addr = user.addresses.id(req.params.addressId);
  if (!addr) return res.status(404).json({ message: "Address not found." });

  const { label, fullName, phone, line1, line2, city, state, pincode } = req.body;
  Object.assign(addr, {
    label: (label || "Home").trim(),
    fullName: fullName.trim(),
    phone: phone.trim(),
    line1: line1.trim(),
    line2: (line2 || "").trim(),
    city: city.trim(),
    state: state.trim(),
    pincode: pincode.trim(),
  });
  await user.save();
  res.json(user.addresses);
});

// Logged-in user: delete one of my saved addresses
router.delete("/me/addresses/:addressId", requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  user.addresses.id(req.params.addressId)?.deleteOne();
  await user.save();
  res.json(user.addresses);
});

export default router;
