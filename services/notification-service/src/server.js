import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cors from "cors";
import { connectDB } from "./config/db.js";
import internalRoutes from "./routes/internal.routes.js";
import notificationRoutes from './routes/notification.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const app = express();
const port = process.env.PORT || 8006;

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Internal-Secret"]
  })
);
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("Notification Service is running");
});

app.use("/api/notifications", notificationRoutes);
app.use("/internal", internalRoutes);

const startServer = async () => {
  await connectDB();
  const host = process.env.HOST || "0.0.0.0";
  app.listen(port, host, () => {
    console.log(`Notification Service listening at http://127.0.0.1:${port} (bound ${host})`);
  });
};

startServer().catch((err) => {
  console.error("Failed to start notification service", err);
  process.exit(1);
});
