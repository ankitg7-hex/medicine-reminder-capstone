import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { createApp } from "../src/app.js";

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

async function withServer(run, options = {}) {
  const server = createServer(createApp({ dbPath: ":memory:", ...options }));
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

async function createAccountSession(baseUrl, overrides = {}) {
  const signupResponse = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      username: "priya",
      email: "priya@example.com",
      password: "password123",
      timezone: "Asia/Calcutta",
      ...overrides
    })
  });
  const signupBody = await signupResponse.json();

  return {
    token: signupBody.token,
    headers: {
      authorization: `Bearer ${signupBody.token}`,
      "content-type": "application/json"
    }
  };
}

function getTodayInKolkata() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Calcutta"
  });
}

test("GET /health returns ok", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { status: "ok" });
  });
});

test("POST /api/auth/signup returns token and profile", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        username: "ananya",
        email: "ananya@example.com",
        password: "password123",
        timezone: "Asia/Calcutta"
      })
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(typeof body.token, "string");
    assert.equal(body.profile.username, "ananya");
    assert.equal(body.profile.email, "ananya@example.com");
    assert.equal(body.profile.timezone, "Asia/Calcutta");
  });
});

test("POST /api/auth/login validates persisted credentials", async () => {
  await withServer(async (baseUrl) => {
    await createAccountSession(baseUrl, {
      username: "meera",
      email: "meera@example.com"
    });

    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        email: "meera@example.com",
        password: "password123"
      })
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.profile.username, "meera");
  });
});

test("security headers and CORS defaults are applied", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`, {
      headers: {
        Origin: "http://localhost:5173"
      }
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5173");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.match(response.headers.get("content-security-policy") || "", /default-src 'self'/);
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

test("GET and PATCH /api/me work after signup", async () => {
  await withServer(async (baseUrl) => {
    const session = await createAccountSession(baseUrl);

    const meResponse = await fetch(`${baseUrl}/api/me`, {
      headers: {
        authorization: session.headers.authorization
      }
    });
    const meBody = await meResponse.json();

    assert.equal(meResponse.status, 200);
    assert.equal(meBody.profile.username, "priya");

    const patchResponse = await fetch(`${baseUrl}/api/me`, {
      method: "PATCH",
      headers: session.headers,
      body: JSON.stringify({
        username: "priya-care",
        timezone: "Asia/Kolkata"
      })
    });
    const patchBody = await patchResponse.json();

    assert.equal(patchResponse.status, 200);
    assert.equal(patchBody.profile.username, "priya-care");
    assert.equal(patchBody.profile.timezone, "Asia/Kolkata");
    assert.equal(patchBody.profile.email, "priya@example.com");
  });
});

test("medication CRUD supports create, list, read, update, and archive", async () => {
  await withServer(async (baseUrl) => {
    const session = await createAccountSession(baseUrl);
    const today = getTodayInKolkata();

    const createResponse = await fetch(`${baseUrl}/api/medications`, {
      method: "POST",
      headers: session.headers,
      body: JSON.stringify({
        name: "Vitamin D",
        dosage: "1 capsule",
        type: "capsule",
        instructions: "After breakfast",
        reason: "Bone health",
        startDate: today,
        endDate: "2026-05-20",
        schedule: {
          recurrenceType: "daily",
          times: ["08:00"]
        }
      })
    });
    const createBody = await createResponse.json();

    assert.equal(createResponse.status, 201);
    assert.equal(createBody.medication.name, "Vitamin D");
    assert.equal(createBody.medication.status, "active");

    const medicationId = createBody.medication.id;

    const listResponse = await fetch(`${baseUrl}/api/medications`, {
      headers: {
        authorization: session.headers.authorization
      }
    });
    const listBody = await listResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(listBody.medications.length, 1);
    assert.equal(listBody.medications[0].id, medicationId);

    const detailResponse = await fetch(`${baseUrl}/api/medications/${medicationId}`, {
      headers: {
        authorization: session.headers.authorization
      }
    });
    const detailBody = await detailResponse.json();

    assert.equal(detailResponse.status, 200);
    assert.equal(detailBody.medication.reason, "Bone health");

    const updateResponse = await fetch(`${baseUrl}/api/medications/${medicationId}`, {
      method: "PATCH",
      headers: session.headers,
      body: JSON.stringify({
        dosage: "2 capsules",
        instructions: "After dinner"
      })
    });
    const updateBody = await updateResponse.json();

    assert.equal(updateResponse.status, 200);
    assert.equal(updateBody.medication.dosage, "2 capsules");
    assert.equal(updateBody.medication.instructions, "After dinner");
    assert.deepEqual(updateBody.medication.schedule.times, ["08:00"]);

    const archiveResponse = await fetch(`${baseUrl}/api/medications/${medicationId}`, {
      method: "DELETE",
      headers: {
        authorization: session.headers.authorization
      }
    });
    const archiveBody = await archiveResponse.json();

    assert.equal(archiveResponse.status, 200);
    assert.equal(archiveBody.medication.status, "archived");

    const activeListResponse = await fetch(`${baseUrl}/api/medications`, {
      headers: {
        authorization: session.headers.authorization
      }
    });
    const activeListBody = await activeListResponse.json();

    assert.equal(activeListBody.medications.length, 0);
  });
});

test("POST /api/medications validates schedule inputs", async () => {
  await withServer(async (baseUrl) => {
    const session = await createAccountSession(baseUrl);

    const response = await fetch(`${baseUrl}/api/medications`, {
      method: "POST",
      headers: session.headers,
      body: JSON.stringify({
        name: "Vitamin C",
        dosage: "1 tablet",
        startDate: "2026-04-20",
        schedule: {
          recurrenceType: "selected-weekdays",
          weekdays: [],
          times: ["08:00"]
        }
      })
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "Validation failed");
    assert.match(body.details[0], /weekday/i);
  });
});

test("dose actions update schedule and history", async () => {
  await withServer(async (baseUrl) => {
    const session = await createAccountSession(baseUrl);
    const today = getTodayInKolkata();

    const createResponse = await fetch(`${baseUrl}/api/medications`, {
      method: "POST",
      headers: session.headers,
      body: JSON.stringify({
        name: "Omega 3",
        dosage: "1 capsule",
        startDate: today,
        schedule: {
          recurrenceType: "daily",
          times: ["08:00", "21:00"]
        }
      })
    });
    const createBody = await createResponse.json();

    assert.equal(createResponse.status, 201);

    const scheduleResponse = await fetch(`${baseUrl}/api/schedule/today`, {
      headers: {
        authorization: session.headers.authorization
      }
    });
    const scheduleBody = await scheduleResponse.json();
    const actionableDose = [...scheduleBody.groups.dueNow, ...scheduleBody.groups.upcoming][0];

    assert.ok(actionableDose);

    const actionResponse = await fetch(`${baseUrl}/api/doses/${actionableDose.id}`, {
      method: "PATCH",
      headers: session.headers,
      body: JSON.stringify({
        status: "completed",
        notes: "Taken with breakfast"
      })
    });
    const actionBody = await actionResponse.json();

    assert.equal(actionResponse.status, 200);
    assert.equal(actionBody.dose.status, "completed");
    assert.equal(actionBody.dose.notes, "Taken with breakfast");

    const historyResponse = await fetch(`${baseUrl}/api/history`, {
      headers: {
        authorization: session.headers.authorization
      }
    });
    const historyBody = await historyResponse.json();

    assert.equal(historyResponse.status, 200);
    assert.equal(historyBody.summary.completed, 1);
    assert.equal(historyBody.history[0].medicationId, createBody.medication.id);
  });
});

test("device registration and reminder status endpoints work together", async () => {
  await withServer(async (baseUrl) => {
    const session = await createAccountSession(baseUrl);
    const today = getTodayInKolkata();

    await fetch(`${baseUrl}/api/medications`, {
      method: "POST",
      headers: session.headers,
      body: JSON.stringify({
        name: "Reminder Tablet",
        dosage: "1 tablet",
        startDate: today,
        schedule: {
          recurrenceType: "daily",
          times: ["08:00"]
        }
      })
    });

    const registerResponse = await fetch(`${baseUrl}/api/devices/register`, {
      method: "POST",
      headers: session.headers,
      body: JSON.stringify({
        token: "device-token-001",
        deviceName: "Priya's Pixel",
        platform: "android"
      })
    });
    const registerBody = await registerResponse.json();

    assert.equal(registerResponse.status, 201);
    assert.equal(registerBody.devices.length, 1);

    const remindersResponse = await fetch(`${baseUrl}/api/reminders/today`, {
      headers: {
        authorization: session.headers.authorization
      }
    });
    const remindersBody = await remindersResponse.json();

    assert.equal(remindersResponse.status, 200);
    assert.equal(remindersBody.devices.length, 1);
    assert.equal(remindersBody.reminders[0].channel, "push");
  });
});

test("GET /api/audit-logs exposes recent user activity", async () => {
  await withServer(async (baseUrl) => {
    const session = await createAccountSession(baseUrl);
    const today = getTodayInKolkata();

    await fetch(`${baseUrl}/api/medications`, {
      method: "POST",
      headers: session.headers,
      body: JSON.stringify({
        name: "Audit Tablet",
        dosage: "1 tablet",
        startDate: today,
        schedule: {
          recurrenceType: "daily",
          times: ["08:00"]
        }
      })
    });

    const auditResponse = await fetch(`${baseUrl}/api/audit-logs?limit=5`, {
      headers: {
        authorization: session.headers.authorization
      }
    });
    const auditBody = await auditResponse.json();

    assert.equal(auditResponse.status, 200);
    assert.ok(auditBody.entries.length >= 2);
    assert.match(auditBody.entries[0].type, /(medication\.created|session\.(signup|login))/);
  });
});

test("medication plans are isolated by logged in user", async () => {
  await withServer(async (baseUrl) => {
    const firstSession = await createAccountSession(baseUrl, {
      username: "asha",
      email: "asha@example.com"
    });
    const secondSession = await createAccountSession(baseUrl, {
      username: "ravi",
      email: "ravi@example.com"
    });
    const today = getTodayInKolkata();

    const createResponse = await fetch(`${baseUrl}/api/medications`, {
      method: "POST",
      headers: firstSession.headers,
      body: JSON.stringify({
        name: "Vitamin D",
        dosage: "1 capsule",
        startDate: today,
        schedule: {
          recurrenceType: "daily",
          times: ["08:00"]
        }
      })
    });

    assert.equal(createResponse.status, 201);

    const firstListResponse = await fetch(`${baseUrl}/api/medications`, {
      headers: {
        authorization: firstSession.headers.authorization
      }
    });
    const firstListBody = await firstListResponse.json();

    const secondListResponse = await fetch(`${baseUrl}/api/medications`, {
      headers: {
        authorization: secondSession.headers.authorization
      }
    });
    const secondListBody = await secondListResponse.json();

    assert.equal(firstListBody.medications.length, 1);
    assert.equal(secondListBody.medications.length, 0);
  });
});

let failures = 0;

for (const entry of tests) {
  try {
    await entry.fn();
    console.log(`ok - ${entry.name}`);
  } catch (error) {
    failures += 1;
    console.error(`not ok - ${entry.name}`);
    console.error(error);
  }
}

if (failures > 0) {
  console.error(`${failures} backend test(s) failed.`);
  process.exitCode = 1;
}
