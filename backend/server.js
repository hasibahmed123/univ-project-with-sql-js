import cors from "cors";
import express from "express";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json());
const port = process.env.PORT || 5600;

// Create tables if they don't exist
const createTables = async (db) => {
  try {
    // First, ensure the Customers table exists (it's referenced by Reviews)
    await db.query(`
      CREATE TABLE IF NOT EXISTS Customers (
        customer_id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        table_number INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Menu_Items table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS Menu_Items (
        item_id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        price DECIMAL(10,2) NOT NULL
      )
    `);

    // Create Orders table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS Orders (
        order_id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        order_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES Customers(customer_id) ON DELETE CASCADE
      )
    `);

    // Create Order_Items table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS Order_Items (
        order_item_id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        item_id INT NOT NULL,
        quantity INT NOT NULL,
        FOREIGN KEY (order_id) REFERENCES Orders(order_id) ON DELETE CASCADE,
        FOREIGN KEY (item_id) REFERENCES Menu_Items(item_id) ON DELETE CASCADE
      )
    `);

    // Create Reviews table
    await db.query(`
      CREATE TABLE IF NOT EXISTS Reviews (
        review_id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT,
        rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES Customers(customer_id) ON DELETE SET NULL
      )
    `);

    // Create Reservations table
    await db.query(`
      CREATE TABLE IF NOT EXISTS Reservations (
        reservation_id INT AUTO_INCREMENT PRIMARY KEY,
        customer_name VARCHAR(255) NOT NULL,
        contact_number VARCHAR(20),
        table_number INT NOT NULL,
        num_guests INT NOT NULL CHECK (num_guests > 0),
        reservation_time DATETIME NOT NULL,
        special_requests TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Inventory table
    await db.query(`
      CREATE TABLE IF NOT EXISTS Inventory (
        item_id INT AUTO_INCREMENT PRIMARY KEY,
        item_name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
        unit VARCHAR(50) NOT NULL,
        reorder_level INT NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
        cost_per_unit DECIMAL(10,2) NOT NULL CHECK (cost_per_unit > 0),
        supplier VARCHAR(255) NOT NULL,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    console.log("All tables created successfully");
  } catch (err) {
    console.error("Error creating tables:", err);
    throw err;
  }
};

// Serve frontend statically
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "../frontend")));

// Optional: send index.html for root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// Async IIFE to allow top-level await
(async () => {
  const db = await mysql.createConnection({
    host: "127.0.0.1",
    user: "root",
    password: "hasibsql",
    database: "wildwestgrill",
  });

  // GET /api/menu - list all menu items
  app.get("/api/menu", async (req, res) => {
    try {
      const [rows] = await db.query("SELECT * FROM Menu_Items");
      res.json(rows);
    } catch (err) {
      console.error("Error fetching menu:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/orders - create new order
  app.post("/api/orders", async (req, res) => {
    const { customerName, tableNumber, menuItem, quantity } = req.body;
    if (!customerName || !tableNumber || !menuItem || !quantity) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      await db.beginTransaction();

      // 1. Find or create customer
      let [customers] = await db.query(
        "SELECT customer_id FROM Customers WHERE name = ? AND table_number = ?",
        [customerName, tableNumber]
      );

      let customerId;
      if (customers.length > 0) {
        customerId = customers[0].customer_id;
      } else {
        const [result] = await db.query(
          "INSERT INTO Customers (name, table_number) VALUES (?, ?)",
          [customerName, tableNumber]
        );
        customerId = result.insertId;
      }

      // 2. Create order
      const [orderResult] = await db.query(
        "INSERT INTO Orders (customer_id) VALUES (?)",
        [customerId]
      );
      const orderId = orderResult.insertId;

      // 3. Find menu item
      const [items] = await db.query(
        "SELECT item_id FROM Menu_Items WHERE name = ?",
        [menuItem]
      );
      if (items.length === 0) {
        await db.rollback();
        return res.status(400).json({ error: "Menu item not found" });
      }

      // 4. Create order item
      await db.query(
        "INSERT INTO Order_Items (order_id, item_id, quantity) VALUES (?, ?, ?)",
        [orderId, items[0].item_id, quantity]
      );

      await db.commit();
      res.json({ message: "Order placed successfully" });
    } catch (err) {
      await db.rollback();
      console.error("Error creating order:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/orders - list all orders
  app.get("/api/orders", async (req, res) => {
    try {
      const [rows] = await db.query(`
        SELECT 
          c.name AS customer_name,
          c.table_number,
          mi.name AS item_name,
          oi.quantity,
          o.order_time AS created_at
        FROM Orders o
        JOIN Customers c ON o.customer_id = c.customer_id
        JOIN Order_Items oi ON o.order_id = oi.order_id
        JOIN Menu_Items mi ON oi.item_id = mi.item_id
        ORDER BY o.order_time DESC
        LIMIT 100
      `);
      res.json(rows);
    } catch (err) {
      console.error("Error fetching orders:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/orders/summary
  app.get("/api/orders/summary", async (req, res) => {
    try {
      const [[{ total_orders }]] = await db.query(
        "SELECT COUNT(*) as total_orders FROM Orders"
      );

      const [popularItems] = await db.query(`
        SELECT 
          mi.name,
          SUM(oi.quantity) as total_quantity
        FROM Order_Items oi
        JOIN Menu_Items mi ON oi.item_id = mi.item_id
        GROUP BY mi.item_id, mi.name
        ORDER BY total_quantity DESC
        LIMIT 1
      `);

      res.json({
        total_orders,
        most_popular_item:
          popularItems.length > 0 ? popularItems[0].name : "N/A",
      });
    } catch (err) {
      console.error("Error fetching summary:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/orders/:orderId - delete an order
  app.delete("/api/orders/:orderId", async (req, res) => {
    const orderId = req.params.orderId;
    try {
      await db.query("DELETE FROM Order_Items WHERE order_id = ?", [orderId]);
      await db.query("DELETE FROM Orders WHERE order_id = ?", [orderId]);
      res.json({ message: "Order deleted successfully" });
    } catch (err) {
      console.error("Error deleting order:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/reservations - create a new reservation
  app.post("/api/reservations", async (req, res) => {
    const {
      customerName,
      contactNumber,
      tableNumber,
      numGuests,
      reservationTime,
      specialRequests,
    } = req.body;
    try {
      const [result] = await db.query(
        `INSERT INTO Reservations 
         (customer_name, contact_number, table_number, num_guests, reservation_time, special_requests) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          customerName,
          contactNumber,
          tableNumber,
          numGuests,
          reservationTime,
          specialRequests,
        ]
      );
      res.json({
        message: "Reservation created successfully",
        reservationId: result.insertId,
      });
    } catch (err) {
      console.error("Error creating reservation:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/reservations - list all reservations
  app.get("/api/reservations", async (req, res) => {
    try {
      const [rows] = await db.query(
        "SELECT * FROM Reservations ORDER BY reservation_time"
      );
      res.json(rows);
    } catch (err) {
      console.error("Error fetching reservations:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/inventory - add new inventory item
  app.post("/api/inventory", async (req, res) => {
    const {
      itemName,
      category,
      quantity,
      unit,
      reorderLevel,
      costPerUnit,
      supplier,
    } = req.body;

    // Validate required fields
    if (
      !itemName ||
      !category ||
      quantity == null ||
      !unit ||
      reorderLevel == null ||
      costPerUnit == null ||
      !supplier
    ) {
      return res.status(400).json({
        error: "Missing required fields",
        required: [
          "itemName",
          "category",
          "quantity",
          "unit",
          "reorderLevel",
          "costPerUnit",
          "supplier",
        ],
      });
    }

    // Validate numeric fields
    if (quantity < 0) {
      return res.status(400).json({ error: "Quantity cannot be negative" });
    }
    if (reorderLevel < 0) {
      return res
        .status(400)
        .json({ error: "Reorder level cannot be negative" });
    }
    if (costPerUnit <= 0) {
      return res
        .status(400)
        .json({ error: "Cost per unit must be greater than 0" });
    }

    try {
      // Check if item already exists
      const [existing] = await db.query(
        "SELECT item_id FROM Inventory WHERE item_name = ?",
        [itemName]
      );

      if (existing.length > 0) {
        // Update existing item
        await db.query(
          `UPDATE Inventory 
           SET category = ?, quantity = quantity + ?, unit = ?, 
               reorder_level = ?, cost_per_unit = ?, supplier = ?
           WHERE item_name = ?`,
          [
            category,
            quantity,
            unit,
            reorderLevel,
            costPerUnit,
            supplier,
            itemName,
          ]
        );
        res.json({
          message: "Inventory item updated successfully",
          itemId: existing[0].item_id,
        });
      } else {
        // Insert new item
        const [result] = await db.query(
          `INSERT INTO Inventory 
           (item_name, category, quantity, unit, reorder_level, cost_per_unit, supplier) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            itemName,
            category,
            quantity,
            unit,
            reorderLevel,
            costPerUnit,
            supplier,
          ]
        );
        res.json({
          message: "Inventory item added successfully",
          itemId: result.insertId,
        });
      }
    } catch (err) {
      console.error("Error managing inventory item:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/inventory - list all inventory items
  app.get("/api/inventory", async (req, res) => {
    try {
      const [rows] = await db.query(
        "SELECT * FROM Inventory ORDER BY item_name"
      );
      res.json(rows);
    } catch (err) {
      console.error("Error fetching inventory:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/reviews - add a new review
  app.post("/api/reviews", async (req, res) => {
    const { customerId, rating, comment } = req.body;

    // Validate input
    if (!customerId || !rating || !comment) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    try {
      // First check if customer exists
      const [customers] = await db.query(
        "SELECT customer_id FROM Customers WHERE customer_id = ?",
        [customerId]
      );

      if (customers.length === 0) {
        return res.status(400).json({ error: "Customer not found" });
      }

      const [result] = await db.query(
        "INSERT INTO Reviews (customer_id, rating, comment) VALUES (?, ?, ?)",
        [customerId, rating, comment]
      );

      res.json({
        message: "Review added successfully",
        reviewId: result.insertId,
      });
    } catch (err) {
      console.error("Error adding review:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/reviews - list all reviews
  app.get("/api/reviews", async (req, res) => {
    try {
      const [rows] = await db.query(`
        SELECT r.*, c.name as customer_name 
        FROM Reviews r 
        JOIN Customers c ON r.customer_id = c.customer_id 
        ORDER BY r.created_at DESC`);
      res.json(rows);
    } catch (err) {
      console.error("Error fetching reviews:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/customers - list all customers for reviews
  app.get("/api/customers", async (req, res) => {
    try {
      // Get customers who have placed orders
      const [rows] = await db.query(`
        SELECT DISTINCT
          c.customer_id as id,
          c.name,
          c.table_number,
          MAX(o.order_time) as last_order
        FROM Customers c
        JOIN Orders o ON c.customer_id = o.customer_id
        GROUP BY c.customer_id, c.name, c.table_number
        ORDER BY last_order DESC
        LIMIT 100`);

      if (rows.length === 0) {
        return res
          .status(404)
          .json({ error: "No customers found. Place an order first." });
      }

      res.json(rows);
    } catch (err) {
      console.error("Error fetching customers:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/customers - create or get customer for reviews
  app.post("/api/customers", async (req, res) => {
    const { name, tableNumber } = req.body;

    if (!name || !tableNumber) {
      return res
        .status(400)
        .json({ error: "Name and table number are required" });
    }

    try {
      // Check if customer exists
      const [existing] = await db.query(
        "SELECT customer_id FROM Customers WHERE name = ? AND table_number = ?",
        [name, tableNumber]
      );

      if (existing.length > 0) {
        // Return existing customer ID
        return res.json({ customerId: existing[0].customer_id });
      }

      // Create new customer
      const [result] = await db.query(
        "INSERT INTO Customers (name, table_number) VALUES (?, ?)",
        [name, tableNumber]
      );

      res.json({ customerId: result.insertId });
    } catch (err) {
      console.error("Error managing customer:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Initialize tables
  await createTables(db);

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
})();
