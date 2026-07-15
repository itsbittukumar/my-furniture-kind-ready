// import { Router } from "express";
// import User from "../models/User.js";
// import Order from "../models/Order.js";
// import { requireAuth, requireAdmin } from "../middleware/auth.js";

// const router = Router();

// // Checkout: turn the logged-in customer's cart into an order
// router.post("/checkout", requireAuth, async (req, res) => {
//   if (req.user.role === "admin") return res.status(403).json({ message: "Admin accounts can't place orders." });

//   const { address, paymentMethod, paymentRef } = req.body || {};
//   const required = ["fullName", "phone", "line1", "city", "state", "pincode"];
//   const missing = required.filter((f) => !address?.[f] || !String(address[f]).trim());
//   if (missing.length > 0) {
//     return res.status(400).json({ message: `Please fill in: ${missing.join(", ")}` });
//   }
//   if (!/^\d{10}$/.test(address.phone.trim())) {
//     return res.status(400).json({ message: "Phone number must be 10 digits." });
//   }
//   if (!/^\d{6}$/.test(address.pincode.trim())) {
//     return res.status(400).json({ message: "PIN code must be 6 digits." });
//   }
//   if (!["cod", "upi", "card"].includes(paymentMethod)) {
//     return res.status(400).json({ message: "Please select a valid payment method." });
//   }
//   if (paymentMethod === "upi" && !String(paymentRef || "").trim()) {
//     return res.status(400).json({ message: "Please enter the UPI transaction / reference ID after paying." });
//   }

//   const user = await User.findById(req.user.id).populate("cart.product");
//   const items = (user.cart || []).filter((i) => i.product).map((i) => ({
//     productId: i.product._id, name: i.product.name, qty: i.qty, price: i.product.price,
//   }));
//   if (items.length === 0) return res.status(400).json({ message: "Your cart is empty." });

//   const total = items.reduce((s, i) => s + i.price * i.qty, 0);
//   const order = await Order.create({
//     username: user.username,
//     items,
//     total,
//     address: {
//       fullName: address.fullName.trim(),
//       phone: address.phone.trim(),
//       line1: address.line1.trim(),
//       line2: (address.line2 || "").trim(),
//       city: address.city.trim(),
//       state: address.state.trim(),
//       pincode: address.pincode.trim(),
//     },
//     paymentMethod,
//     paymentRef: (paymentRef || "").trim(),
//     paymentStatus: "pending",
//   });

//   user.cart = [];
//   await user.save();

//   res.status(201).json(order);
// });

// // Customer: view my own past orders
// router.get("/mine", requireAuth, async (req, res) => {
//   const orders = await Order.find({ username: req.user.username }).sort({ createdAt: -1 });
//   res.json(orders);
// });

// // Admin only: view every order placed on the store
// router.get("/", requireAuth, requireAdmin, async (req, res) => {
//   const orders = await Order.find().sort({ createdAt: -1 });
//   res.json(orders);
// });

// // Admin only: mark an order's payment as verified/received (manual UPI/COD confirmation)
// router.patch("/:id/payment-status", requireAuth, requireAdmin, async (req, res) => {
//   const { paymentStatus } = req.body || {};
//   if (!["pending", "paid"].includes(paymentStatus)) {
//     return res.status(400).json({ message: "Invalid payment status." });
//   }
//   const order = await Order.findByIdAndUpdate(req.params.id, { paymentStatus }, { new: true });
//   if (!order) return res.status(404).json({ message: "Order not found." });
//   res.json(order);
// });

// export default router;









import { Router } from "express";
import User from "../models/User.js";
import Order from "../models/Order.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { syncOrderToMySQL } from "../config/mysql.js";

const router = Router();

// Checkout: turn the logged-in customer's cart into an order
router.post("/checkout", requireAuth, async (req, res) => {
  if (req.user.role === "admin") return res.status(403).json({ message: "Admin accounts can't place orders." });

  const { address, paymentMethod, paymentRef } = req.body || {};
  const required = ["fullName", "phone", "line1", "city", "state", "pincode"];
  const missing = required.filter((f) => !address?.[f] || !String(address[f]).trim());
  if (missing.length > 0) {
    return res.status(400).json({ message: `Please fill in: ${missing.join(", ")}` });
  }
  if (!/^\d{10}$/.test(address.phone.trim())) {
    return res.status(400).json({ message: "Phone number must be 10 digits." });
  }
  if (!/^\d{6}$/.test(address.pincode.trim())) {
    return res.status(400).json({ message: "PIN code must be 6 digits." });
  }
  if (!["cod", "upi", "card"].includes(paymentMethod)) {
    return res.status(400).json({ message: "Please select a valid payment method." });
  }
  if (paymentMethod === "upi" && !String(paymentRef || "").trim()) {
    return res.status(400).json({ message: "Please enter the UPI transaction / reference ID after paying." });
  }

  const user = await User.findById(req.user.id).populate("cart.product");
  const items = (user.cart || []).filter((i) => i.product).map((i) => ({
    productId: i.product._id, name: i.product.name, qty: i.qty, price: i.product.price,
  }));
  if (items.length === 0) return res.status(400).json({ message: "Your cart is empty." });

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const order = await Order.create({
    username: user.username,
    items,
    total,
    address: {
      fullName: address.fullName.trim(),
      phone: address.phone.trim(),
      line1: address.line1.trim(),
      line2: (address.line2 || "").trim(),
      city: address.city.trim(),
      state: address.state.trim(),
      pincode: address.pincode.trim(),
    },
    paymentMethod,
    paymentRef: (paymentRef || "").trim(),
    paymentStatus: "pending",
  });

  user.cart = [];
  await user.save();

  syncOrderToMySQL(order); // best-effort, doesn't block/fail the checkout

  res.status(201).json(order);
});

// Customer: view my own past orders
router.get("/mine", requireAuth, async (req, res) => {
  const orders = await Order.find({ username: req.user.username }).sort({ createdAt: -1 });
  res.json(orders);
});

// Admin only: view every order placed on the store
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  res.json(orders);
});

// Admin only: mark an order's payment as verified/received (manual UPI/COD confirmation)
router.patch("/:id/payment-status", requireAuth, requireAdmin, async (req, res) => {
  const { paymentStatus } = req.body || {};
  if (!["pending", "paid"].includes(paymentStatus)) {
    return res.status(400).json({ message: "Invalid payment status." });
  }
  const order = await Order.findByIdAndUpdate(req.params.id, { paymentStatus }, { new: true });
  if (!order) return res.status(404).json({ message: "Order not found." });
  syncOrderToMySQL(order); // best-effort, keeps the MySQL copy's payment_status in sync
  res.json(order);
});

export default router;
