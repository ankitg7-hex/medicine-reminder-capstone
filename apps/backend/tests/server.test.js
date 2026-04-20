import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { createApp } from "../src/app.js";

async function withServer(run) {
  const server = createServer(createApp());
  server.listen(0);
  await once(server, "listening");

  const { port } = server.address();

  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("GET /health returns ok", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { status: "ok" });
  });
});

test("POST /api/auth/demo-login returns token and profile", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/demo-login`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        fullName: "Ananya Rao",
        email: "ananya@example.com",
        timezone: "Asia/Calcutta"
      })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(typeof body.token, "string");
    assert.equal(body.profile.fullName, "Ananya Rao");
    assert.equal(body.profile.email, "ananya@example.com");
    assert.equal(body.profile.timezone, "Asia/Calcutta");
  });
});

test("GET /api/me requires authorization", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/me`);
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.error, "Unauthorized");
  });
});

test("GET and PATCH /api/me work after demo login", async () => {
  await withServer(async (baseUrl) => {
    const loginResponse = await fetch(`${baseUrl}/api/auth/demo-login`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        fullName: "Priya Singh",
        email: "priya@example.com",
        timezone: "Asia/Calcutta"
      })
    });
    const loginBody = await loginResponse.json();
    const token = loginBody.token;

    const meResponse = await fetch(`${baseUrl}/api/me`, {
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    const meBody = await meResponse.json();

    assert.equal(meResponse.status, 200);
    assert.equal(meBody.profile.fullName, "Priya Singh");

    const patchResponse = await fetch(`${baseUrl}/api/me`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        fullName: "Priya S.",
        timezone: "Asia/Kolkata"
      })
    });
    const patchBody = await patchResponse.json();

    assert.equal(patchResponse.status, 200);
    assert.equal(patchBody.profile.fullName, "Priya S.");
    assert.equal(patchBody.profile.timezone, "Asia/Kolkata");
    assert.equal(patchBody.profile.email, "priya@example.com");
  });
});
