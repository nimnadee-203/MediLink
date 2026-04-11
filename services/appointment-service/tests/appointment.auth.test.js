import express from "express";
import request from "supertest";
import test from "node:test";
import assert from "node:assert/strict";
import appointmentRoutes from "../src/routes/appointment.routes.js";

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/appointments", appointmentRoutes);
  return app;
};

test("GET /api/appointments requires auth token", async () => {
  const app = buildApp();

  const response = await request(app).get("/api/appointments");

  assert.equal(response.status, 401);
  assert.equal(response.body.message, "Authorization token is required");
});

test("POST /api/appointments requires auth token", async () => {
  const app = buildApp();

  const response = await request(app).post("/api/appointments").send({});

  assert.equal(response.status, 401);
  assert.equal(response.body.message, "Authorization token is required");
});
