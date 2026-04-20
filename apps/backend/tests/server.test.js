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

async function createDemoSession(baseUrl) {
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

  return {
    token: loginBody.token,
    headers: {
      authorization: `Bearer ${loginBody.token}`,
      "content-type": "application/json"
    }
  };
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
    const session = await createDemoSession(baseUrl);

    const meResponse = await fetch(`${baseUrl}/api/me`, {
      headers: {
        authorization: session.headers.authorization
      }
    });
    const meBody = await meResponse.json();

    assert.equal(meResponse.status, 200);
    assert.equal(meBody.profile.fullName, "Priya Singh");

    const patchResponse = await fetch(`${baseUrl}/api/me`, {
      method: "PATCH",
      headers: session.headers,
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

test("medication CRUD supports create, list, read, update, and archive", async () => {
  await withServer(async (baseUrl) => {
    const session = await createDemoSession(baseUrl);

    const createResponse = await fetch(`${baseUrl}/api/medications`, {
      method: "POST",
      headers: session.headers,
      body: JSON.stringify({
        name: "Vitamin D",
        dosage: "1 capsule",
        type: "capsule",
        instructions: "After breakfast",
        reason: "Bone health",
        startDate: "2026-04-20",
        endDate: "2026-05-20"
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

    const archivedListResponse = await fetch(
      `${baseUrl}/api/medications?includeArchived=true`,
      {
        headers: {
          authorization: session.headers.authorization
        }
      }
    );
    const archivedListBody = await archivedListResponse.json();

    assert.equal(archivedListBody.medications.length, 1);
    assert.equal(archivedListBody.medications[0].status, "archived");
  });
});

test("medication create validates required fields", async () => {
  await withServer(async (baseUrl) => {
    const session = await createDemoSession(baseUrl);

    const response = await fetch(`${baseUrl}/api/medications`, {
      method: "POST",
      headers: session.headers,
      body: JSON.stringify({
        name: "",
        dosage: "",
        startDate: ""
      })
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "Medication name is required.");
  });
});
