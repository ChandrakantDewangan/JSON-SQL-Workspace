import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Mock Backend APIs
  const mockData: Record<string, any[]> = {
    users: [
      { id: 1, name: "Alice Johnson", email: "alice@example.com", role_id: 1 },
      { id: 2, name: "Bob Smith", email: "bob@example.com", role_id: 2 },
      { id: 3, name: "Charlie Brown", email: "charlie@example.com", role_id: 2 },
      { id: 4, name: "Diana Prince", email: "diana@example.com", role_id: 1 },
    ],
    roles: [
      { id: 1, role_name: "Admin", permissions: "all" },
      { id: 2, role_name: "User", permissions: "read-only" },
    ],
    orders: [
      { id: 101, user_id: 1, product: "Laptop", amount: 1200 },
      { id: 102, user_id: 2, product: "Mouse", amount: 25 },
      { id: 103, user_id: 1, product: "Monitor", amount: 300 },
      { id: 104, user_id: 3, product: "Keyboard", amount: 75 },
    ]
  };

  app.get("/api/tables", (req, res) => {
    res.json(Object.keys(mockData));
  });

  app.get("/api/table/:name", (req, res) => {
    const name = req.params.name;
    if (mockData[name]) {
      res.json(mockData[name]);
    } else {
      res.status(404).json({ error: "Table not found" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
