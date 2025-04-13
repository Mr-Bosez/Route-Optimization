// File: server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const session = require("express-session");
const helmet = require("helmet");
const dotenv = require("dotenv");
const { Server } = require("socket.io");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_ORIGIN || "*" }
});

// Middleware
app.use(express.json());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(helmet());

// Sessions
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret_key",
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false, // set to true if using https
      httpOnly: true,
      maxAge: 60 * 60 * 1000, // 1 hour
    },
  })
);

// Connect MongoDB
mongoose.connect(process.env.MONGO_URI);

// Mongoose Schema
const trafficSchema = new mongoose.Schema({
  location: String,
  latitude: Number,
  longitude: Number,
  vehicleCount: Number,
  traffic: String,
});
const Traffic = mongoose.model("Traffic", trafficSchema);

// Basic API Key Auth middleware for protected routes
const authenticate = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (apiKey === process.env.API_KEY) {
    next();
  } else {
    res.status(401).send({ error: "Unauthorized" });
  }
};

// Routes
app.post("/update_traffic", authenticate, async (req, res) => {
  const { location, vehicleCount, latitude, longitude } = req.body;
  const trafficStatus = vehicleCount > 10 ? "high" : "low";

  await Traffic.updateOne(
    { location },
    {
      $set: {
        vehicleCount,
        traffic: trafficStatus,
        latitude,
        longitude,
      },
    },
    { upsert: true }
  );

  io.emit("traffic_update", {
    location,
    latitude,
    longitude,
    traffic: trafficStatus,
    vehicleCount,
  });

  console.log(`📍 ${location} updated → 🚗 ${vehicleCount} → 🚦 ${trafficStatus}`);
  res.send({ success: true });
});

app.get("/traffic_status", async (req, res) => {
  const data = await Traffic.find({});
  res.send(data);
});

// Server Listen
server.listen(process.env.PORT || 5000, () => {
  console.log(`🚀 Server running on port ${process.env.PORT || 5000}`);
});
