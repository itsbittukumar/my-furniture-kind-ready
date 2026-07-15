import mysql from "mysql2/promise";

// Connects to an external MySQL server (running on the host machine, outside
// the kind cluster). Orders are dual-written here in addition to MongoDB —
// MongoDB remains the source of truth for the app; this is a best-effort
// copy, so a MySQL failure never blocks or fails a checkout.
let pool = null;
let connectionOk = false;

export function getMySQLPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || "host.docker.internal",
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE || "sk_furniture",
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      connectTimeout: 5000,
    });
  }
  return pool;
}

export async function initMySQL() {
  if (!process.env.MYSQL_HOST && !process.env.MYSQL_USER) {
    console.log("MySQL env vars not set — skipping MySQL order sync (MongoDB-only mode).");
    return;
  }
  try {
    const p = getMySQLPool();
    await p.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(64) PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        payment_method VARCHAR(20) NOT NULL,
        payment_status VARCHAR(20) NOT NULL,
        payment_ref VARCHAR(255),
        full_name VARCHAR(255),
        phone VARCHAR(20),
        address_line1 VARCHAR(255),
        address_line2 VARCHAR(255),
        city VARCHAR(100),
        state VARCHAR(100),
        pincode VARCHAR(10),
        items_json JSON,
        created_at DATETIME NOT NULL
      )
    `);
    connectionOk = true;
    console.log("Connected to MySQL — order sync enabled.");
  } catch (err) {
    connectionOk = false;
    console.error("MySQL connection failed (order sync disabled, MongoDB still works fine):", err.message);
  }
}

// Best-effort copy of a MongoDB order into MySQL. Never throws — a checkout
// must succeed even if MySQL is unreachable.
export async function syncOrderToMySQL(order) {
  if (!connectionOk) return;
  try {
    const p = getMySQLPool();
    await p.query(
      `INSERT INTO orders
        (id, username, total, payment_method, payment_status, payment_ref,
         full_name, phone, address_line1, address_line2, city, state, pincode,
         items_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE payment_status = VALUES(payment_status)`,
      [
        String(order._id),
        order.username,
        order.total,
        order.paymentMethod,
        order.paymentStatus,
        order.paymentRef || "",
        order.address?.fullName || "",
        order.address?.phone || "",
        order.address?.line1 || "",
        order.address?.line2 || "",
        order.address?.city || "",
        order.address?.state || "",
        order.address?.pincode || "",
        JSON.stringify(order.items || []),
        order.createdAt || new Date(),
      ]
    );
  } catch (err) {
    console.error("MySQL order sync failed (order was still saved in MongoDB):", err.message);
  }
}
