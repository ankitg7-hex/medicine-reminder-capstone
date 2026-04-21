import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { createApp } from "../src/app.js";

async function withServer(run, options = {}) {
  const server = createServer(createApp(options));
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

async function createDemoSession(baseUrl, overrides = {}) {
  const loginResponse = await fetch(`${baseUrl}/api/auth/demo-login`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      fullName: "Priya Singh",
      email: "priya@example.com",
      timezone: "Asia/Calcutta",
      ...overrides
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

test("POST /api/medications validates schedule inputs", async () => {
  await withServer(async (baseUrl) => {
    const session = await createDemoSession(baseUrl);

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

test("medication create/list and today's schedule work together", async () => {
  await withServer(async (baseUrl) => {
    const session = await createDemoSession(baseUrl);
    const today = getTodayInKolkata();

    const createResponse = await fetch(`${baseUrl}/api/medications`, {
      method: "POST",
      headers: session.headers,
      body: JSON.stringify({
        name: "Blood Pressure Tablet",
        type: "tablet",
        dosage: "1 tablet",
        instructions: "After breakfast",
        reason: "Daily blood pressure support",
        startDate: today,
        schedule: {
          recurrenceType: "daily",
          times: ["08:00", "20:00"]
        }
      })
    });
    const createBody = await createResponse.json();

    assert.equal(createResponse.status, 201);
    assert.equal(createBody.medication.name, "Blood Pressure Tablet");
    assert.deepEqual(createBody.medication.schedule.times, ["08:00", "20:00"]);

    const listResponse = await fetch(`${baseUrl}/api/medications`, {
      headers: {
        authorization: session.headers.authorization
      }
    });
    const listBody = await listResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(listBody.medications.length, 1);
    assert.equal(listBody.medications[0].name, "Blood Pressure Tablet");

    const scheduleResponse = await fetch(`${baseUrl}/api/schedule/today`, {
      headers: {
        authorization: session.headers.authorization
      }
    });
    const scheduleBody = await scheduleResponse.json();

    assert.equal(scheduleResponse.status, 200);
    assert.equal(scheduleBody.timezone, "Asia/Calcutta");
    assert.equal(scheduleBody.date, today);
    assert.equal(scheduleBody.summary.total, 2);
    assert.equal(
      scheduleBody.groups.dueNow.length + scheduleBody.groups.upcoming.length,
      2
    );
    assert.equal(scheduleBody.groups.completed.length, 0);
    assert.equal(scheduleBody.groups.missed.length, 0);
  });
});

test("PATCH /api/medications regenerates the daily schedule", async () => {
  await withServer(async (baseUrl) => {
    const session = await createDemoSession(baseUrl);
    const today = getTodayInKolkata();

    const createResponse = await fetch(`${baseUrl}/api/medications`, {
      method: "POST",
      headers: session.headers,
      body: JSON.stringify({
        name: "Calcium",
        dosage: "1 tablet",
        startDate: today,
        schedule: {
          recurrenceType: "daily",
          times: ["08:00"]
        }
      })
    });
    const createBody = await createResponse.json();

    const patchResponse = await fetch(
      `${baseUrl}/api/medications/${createBody.medication.id}`,
      {
        method: "PATCH",
        headers: session.headers,
        body: JSON.stringify({
          schedule: {
            recurrenceType: "daily",
            times: ["09:30", "21:30"]
          }
        })
      }
    );
    const patchBody = await patchResponse.json();

    assert.equal(patchResponse.status, 200);
    assert.deepEqual(patchBody.medication.schedule.times, ["09:30", "21:30"]);

    const scheduleResponse = await fetch(`${baseUrl}/api/schedule/today`, {
      headers: {
        authorization: session.headers.authorization
      }
    });
    const scheduleBody = await scheduleResponse.json();
    const times = [
      ...scheduleBody.groups.dueNow.map((entry) => entry.scheduledTime),
      ...scheduleBody.groups.upcoming.map((entry) => entry.scheduledTime)
    ];

    assert.equal(scheduleBody.summary.total, 2);
    assert.equal(times.includes("8:00 AM"), false);
    assert.equal(
      times.includes("9:30 AM") || times.includes("9:30 PM"),
      true
    );
  });
});

test("PATCH /api/doses/:id records dose actions and updates history", async () => {
  await withServer(async (baseUrl) => {
    const session = await createDemoSession(baseUrl);
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
    const actionableDose = [
      ...scheduleBody.groups.dueNow,
      ...scheduleBody.groups.upcoming
    ][0];

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
    assert.equal(typeof actionBody.dose.actionTakenAt, "string");

    const refreshedScheduleResponse = await fetch(`${baseUrl}/api/schedule/today`, {
      headers: {
        authorization: session.headers.authorization
      }
    });
    const refreshedScheduleBody = await refreshedScheduleResponse.json();

    assert.equal(refreshedScheduleBody.summary.completed, 1);
    assert.equal(refreshedScheduleBody.groups.completed.length, 1);
    assert.equal(refreshedScheduleBody.groups.completed[0].id, actionableDose.id);

    const historyResponse = await fetch(`${baseUrl}/api/history`, {
      headers: {
        authorization: session.headers.authorization
      }
    });
    const historyBody = await historyResponse.json();

    assert.equal(historyResponse.status, 200);
    assert.equal(historyBody.summary.completed, 1);
    assert.equal(historyBody.history.length, 1);
    assert.equal(historyBody.history[0].medicationId, createBody.medication.id);
    assert.equal(historyBody.history[0].status, "completed");
  });
});

test("device registration and reminder status endpoints work together", async () => {
  await withServer(async (baseUrl) => {
    const session = await createDemoSession(baseUrl);
    const today = getTodayInKolkata();

    const createResponse = await fetch(`${baseUrl}/api/medications`, {
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

    assert.equal(createResponse.status, 201);

    const registerResponse = await fetch(`${baseUrl}/api/devices/register`, {
      method: "POST",
      headers: session.headers,
      body: JSON.stringify({
        token: "demo-device-token-001",
        deviceName: "Priya's Pixel",
        platform: "android"
      })
    });
    const registerBody = await registerResponse.json();

    assert.equal(registerResponse.status, 201);
    assert.equal(registerBody.devices.length, 1);
    assert.equal(registerBody.device.platform, "android");

    const remindersResponse = await fetch(`${baseUrl}/api/reminders/today`, {
      headers: {
        authorization: session.headers.authorization
      }
    });
    const remindersBody = await remindersResponse.json();

    assert.equal(remindersResponse.status, 200);
    assert.equal(remindersBody.devices.length, 1);
    assert.equal(remindersBody.summary.total, 1);
    assert.equal(remindersBody.reminders[0].channel, "push");
  });
});

test("POST /api/reminders/process can auto-mark stale reminders as missed", async () => {
  const store = {
    sessions: new Map([["stale-token", "user:stale@example.com"]]),
    profiles: new Map([
      [
        "user:stale@example.com",
        {
          id: "user:stale@example.com",
          fullName: "Stale User",
          email: "stale@example.com",
          timezone: "Asia/Calcutta"
        }
      ]
    ]),
    medications: new Map([
      [
        "med-stale",
        {
          id: "med-stale",
          userId: "user:stale@example.com",
          name: "Late Tablet",
          type: "tablet",
          dosage: "1 tablet",
          instructions: "After food",
          reason: "Demo",
          startDate: "2026-04-20",
          endDate: null,
          status: "active",
          createdAt: "2026-04-20T00:00:00.000Z",
          updatedAt: "2026-04-20T00:00:00.000Z",
          archivedAt: null
        }
      ]
    ]),
    schedules: new Map([
      [
        "schedule-stale",
        {
          id: "schedule-stale",
          medicationId: "med-stale",
          userId: "user:stale@example.com",
          recurrenceType: "daily",
          weekdays: [],
          times: ["08:00"],
          active: false,
          createdAt: "2026-04-20T00:00:00.000Z",
          updatedAt: "2026-04-20T00:00:00.000Z"
        }
      ]
    ]),
    medicationScheduleIndex: new Map([["med-stale", "schedule-stale"]]),
    doseEvents: new Map([
      [
        "dose-stale",
        {
          id: "dose-stale",
          userId: "user:stale@example.com",
          medicationId: "med-stale",
          scheduleId: "schedule-stale",
          scheduledAt: "2026-04-20T00:00:00.000Z",
          status: "pending",
          actionTakenAt: null,
          notes: null,
          history: [],
          source: "schedule-generator"
        }
      ]
    ]),
    doseEventIndex: new Map([["schedule-stale:2026-04-20T00:00:00.000Z", "dose-stale"]]),
    reminderEvents: new Map([
      [
        "reminder-stale",
        {
          id: "reminder-stale",
          userId: "user:stale@example.com",
          doseEventId: "dose-stale",
          scheduledSendAt: "2026-04-20T00:00:00.000Z",
          channel: "in-app",
          status: "queued",
          providerReference: null,
          sentAt: null,
          deliveredAt: null,
          failedAt: null,
          createdAt: "2026-04-20T00:00:00.000Z",
          updatedAt: "2026-04-20T00:00:00.000Z"
        }
      ]
    ]),
    reminderEventIndex: new Map([["dose-stale", "reminder-stale"]]),
    deviceRegistrations: new Map(),
    auditLogs: []
  };

  await withServer(
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/reminders/process`, {
        method: "POST",
        headers: {
          authorization: "Bearer stale-token",
          "content-type": "application/json"
        }
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.processed.autoMissed, 1);

      const historyResponse = await fetch(`${baseUrl}/api/history`, {
        headers: {
          authorization: "Bearer stale-token"
        }
      });
      const historyBody = await historyResponse.json();

      assert.equal(historyResponse.status, 200);
      assert.equal(historyBody.summary.missed, 1);
      assert.equal(historyBody.history[0].status, "missed");
    },
    { store }
  );
});

test("GET /api/audit-logs exposes recent user activity", async () => {
  await withServer(async (baseUrl) => {
    const session = await createDemoSession(baseUrl);
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

    await fetch(`${baseUrl}/api/devices/register`, {
      method: "POST",
      headers: session.headers,
      body: JSON.stringify({
        token: "audit-device-token",
        deviceName: "Audit Phone",
        platform: "android"
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
    assert.match(auditBody.entries[0].type, /(device\.registered|medication\.created|session\.demo_login)/);
  });
});

test("GET /api/history supports medication and status filters", async () => {
  await withServer(async (baseUrl) => {
    const session = await createDemoSession(baseUrl);
    const today = getTodayInKolkata();

    const firstCreateResponse = await fetch(`${baseUrl}/api/medications`, {
      method: "POST",
      headers: session.headers,
      body: JSON.stringify({
        name: "Vitamin B12",
        dosage: "1 tablet",
        startDate: today,
        schedule: {
          recurrenceType: "daily",
          times: ["08:00"]
        }
      })
    });
    const firstCreateBody = await firstCreateResponse.json();

    const secondCreateResponse = await fetch(`${baseUrl}/api/medications`, {
      method: "POST",
      headers: session.headers,
      body: JSON.stringify({
        name: "Magnesium",
        dosage: "1 tablet",
        startDate: today,
        schedule: {
          recurrenceType: "daily",
          times: ["21:00"]
        }
      })
    });
    const secondCreateBody = await secondCreateResponse.json();

    const scheduleResponse = await fetch(`${baseUrl}/api/schedule/today`, {
      headers: {
        authorization: session.headers.authorization
      }
    });
    const scheduleBody = await scheduleResponse.json();
    const firstDose = [...scheduleBody.groups.dueNow, ...scheduleBody.groups.upcoming].find(
      (entry) => entry.medicationId === firstCreateBody.medication.id
    );
    const secondDose = [...scheduleBody.groups.dueNow, ...scheduleBody.groups.upcoming].find(
      (entry) => entry.medicationId === secondCreateBody.medication.id
    );

    assert.ok(firstDose);
    assert.ok(secondDose);

    await fetch(`${baseUrl}/api/doses/${firstDose.id}`, {
      method: "PATCH",
      headers: session.headers,
      body: JSON.stringify({
        status: "missed"
      })
    });

    await fetch(`${baseUrl}/api/doses/${secondDose.id}`, {
      method: "PATCH",
      headers: session.headers,
      body: JSON.stringify({
        status: "skipped"
      })
    });

    const missedHistoryResponse = await fetch(`${baseUrl}/api/history?status=missed`, {
      headers: {
        authorization: session.headers.authorization
      }
    });
    const missedHistoryBody = await missedHistoryResponse.json();

    assert.equal(missedHistoryResponse.status, 200);
    assert.equal(missedHistoryBody.summary.missed, 1);
    assert.equal(missedHistoryBody.history.length, 1);
    assert.equal(missedHistoryBody.history[0].medicationId, firstCreateBody.medication.id);

    const medicationHistoryResponse = await fetch(
      `${baseUrl}/api/history?medicationId=${secondCreateBody.medication.id}`,
      {
        headers: {
          authorization: session.headers.authorization
        }
      }
    );
    const medicationHistoryBody = await medicationHistoryResponse.json();

    assert.equal(medicationHistoryResponse.status, 200);
    assert.equal(medicationHistoryBody.summary.skipped, 1);
    assert.equal(medicationHistoryBody.history.length, 1);
    assert.equal(medicationHistoryBody.history[0].status, "skipped");
  });
});

test("medication plans are isolated by logged in email", async () => {
  await withServer(async (baseUrl) => {
    const firstSession = await createDemoSession(baseUrl, {
      fullName: "Asha",
      email: "asha@example.com"
    });
    const secondSession = await createDemoSession(baseUrl, {
      fullName: "Ravi",
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
