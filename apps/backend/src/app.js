import { randomUUID } from "node:crypto";
import {
  buildReminderAuditDetails,
  buildReminderResponse,
  generateReminderEventsForProfile,
  processReminderQueue,
  registerDeviceToken
} from "./reminders.js";
import {
  applyDoseAction,
  buildHistoryResponse,
  buildMedicationResponse,
  buildTodayScheduleResponse,
  generateDoseEventsForProfile,
  getDoseEventForUser,
  resetDoseEventsForMedication,
  resetDoseEventsForUser,
  validateMedicationPayload
} from "./scheduling.js";

const defaultProfile = {
  id: "demo-user",
  fullName: "Care Demo User",
  email: "demo@medireminder.local",
  timezone: "Asia/Calcutta"
};

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function getProfileIdFromEmail(email) {
  return `user:${normalizeEmail(email)}`;
}

function createProfileFromInput(input, currentProfile = null) {
  const email = normalizeEmail(input.email) || normalizeEmail(currentProfile?.email) || defaultProfile.email;
  const fullName = String(input.fullName || "").trim() || currentProfile?.fullName || defaultProfile.fullName;
  const timezone =
    String(input.timezone || "").trim() || currentProfile?.timezone || defaultProfile.timezone;

  return {
    ...(currentProfile ?? defaultProfile),
    id: getProfileIdFromEmail(email),
    fullName,
    email,
    timezone
  };
}

function createStore() {
  const seededProfile = createProfileFromInput(defaultProfile);

  return {
    sessions: new Map(),
    profiles: new Map([[seededProfile.id, seededProfile]]),
    medications: new Map(),
    schedules: new Map(),
    medicationScheduleIndex: new Map(),
    doseEvents: new Map(),
    doseEventIndex: new Map(),
    reminderEvents: new Map(),
    reminderEventIndex: new Map(),
    deviceRegistrations: new Map(),
    auditLogs: []
  };
}

function getAllowedOrigins() {
  return String(
    process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function getCorsOrigin(req) {
  const allowedOrigins = getAllowedOrigins();
  const origin = String(req.headers.origin || "").trim();

  if (origin && allowedOrigins.includes(origin)) {
    return origin;
  }

  return allowedOrigins[0] ?? "*";
}

function sendJson(req, res, requestId, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json",
    "cache-control": "no-store",
    "x-request-id": requestId,
    "access-control-allow-origin": getCorsOrigin(req),
    vary: "Origin",
    "access-control-allow-headers": "content-type, authorization",
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "cross-origin-opener-policy": "same-origin",
    "content-security-policy":
      "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; img-src 'self' data:; connect-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'"
  });
  res.end(statusCode === 204 ? "" : JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw);
}

function getTokenFromRequest(req) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length);
}

function getSessionProfile(req, store) {
  const token = getTokenFromRequest(req);

  if (!token) {
    return null;
  }

  const userId = store.sessions.get(token);

  if (!userId) {
    return null;
  }

  return {
    token,
    profile: store.profiles.get(userId) ?? null
  };
}

function recordAuditEvent(store, type, userId = null, details = {}) {
  const entry = {
    id: randomUUID(),
    type,
    userId,
    details,
    recordedAt: new Date().toISOString()
  };

  store.auditLogs.unshift(entry);
  if (store.auditLogs.length > 200) {
    store.auditLogs.length = 200;
  }

  return entry;
}

function buildAuditResponse(store, profile, limit = 12) {
  const entries = store.auditLogs
    .filter((entry) => entry.userId === null || entry.userId === profile.id)
    .slice(0, Math.max(1, Math.min(limit, 50)));

  return { entries };
}

function getMedicationForUser(store, userId, medicationId) {
  const medication = store.medications.get(medicationId);

  if (!medication || medication.userId !== userId) {
    return null;
  }

  return medication;
}

function getScheduleForMedication(store, medicationId) {
  const scheduleId = store.medicationScheduleIndex.get(medicationId);
  return scheduleId ? store.schedules.get(scheduleId) ?? null : null;
}

function buildHistoryFilters(url) {
  return {
    medicationId: url.searchParams.get("medicationId") ?? "",
    status: url.searchParams.get("status") ?? "",
    from: url.searchParams.get("from") ?? "",
    to: url.searchParams.get("to") ?? ""
  };
}

function listMedicationResponses(store, userId, includeArchived = false) {
  return [...store.medications.values()]
    .filter((medication) => medication.userId === userId)
    .filter((medication) => includeArchived || medication.status !== "archived")
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((medication) => buildMedicationResponse(store, medication.id));
}

function buildPatchPayload(store, medication, body) {
  const schedule = getScheduleForMedication(store, medication.id);
  const nextScheduleInput =
    body.schedule && typeof body.schedule === "object" ? body.schedule : {};

  return {
    name: body.name ?? medication.name,
    type: body.type ?? medication.type,
    dosage: body.dosage ?? medication.dosage,
    instructions: body.instructions ?? medication.instructions,
    reason: body.reason ?? medication.reason,
    startDate: body.startDate ?? medication.startDate,
    endDate:
      body.endDate !== undefined ? body.endDate : medication.endDate ?? "",
    schedule: {
      recurrenceType:
        nextScheduleInput.recurrenceType ?? schedule?.recurrenceType ?? "daily",
      weekdays: nextScheduleInput.weekdays ?? schedule?.weekdays ?? [],
      times: nextScheduleInput.times ?? schedule?.times ?? []
    }
  };
}

function moveUserRecords(store, fromUserId, toUserId) {
  for (const [token, sessionUserId] of store.sessions.entries()) {
    if (sessionUserId === fromUserId) {
      store.sessions.set(token, toUserId);
    }
  }

  for (const medication of store.medications.values()) {
    if (medication.userId === fromUserId) {
      medication.userId = toUserId;
    }
  }

  for (const schedule of store.schedules.values()) {
    if (schedule.userId === fromUserId) {
      schedule.userId = toUserId;
    }
  }

  for (const doseEvent of store.doseEvents.values()) {
    if (doseEvent.userId === fromUserId) {
      doseEvent.userId = toUserId;
    }
  }

  for (const reminderEvent of store.reminderEvents.values()) {
    if (reminderEvent.userId === fromUserId) {
      reminderEvent.userId = toUserId;
    }
  }

  for (const device of store.deviceRegistrations.values()) {
    if (device.userId === fromUserId) {
      device.userId = toUserId;
    }
  }

  for (const entry of store.auditLogs) {
    if (entry.userId === fromUserId) {
      entry.userId = toUserId;
    }
  }
}

function ensureReminderContext(store, profile) {
  generateDoseEventsForProfile(store, profile);
  generateReminderEventsForProfile(store, profile);
}

export function createApp(options = {}) {
  const store = options.store ?? createStore();

  return async function app(req, res) {
    const requestId = randomUUID();

    try {
      const url = new URL(req.url, "http://localhost");
      const medicationMatch = /^\/api\/medications\/([^/]+)$/.exec(url.pathname);
      const doseMatch = /^\/api\/doses\/([^/]+)$/.exec(url.pathname);

      if (req.method === "OPTIONS") {
        sendJson(req, res, requestId, 204, {});
        return;
      }

      if (req.method === "GET" && url.pathname === "/health") {
        sendJson(req, res, requestId, 200, { status: "ok" });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/hello") {
        sendJson(req, res, requestId, 200, {
          message: "Hello from the medicine reminder backend",
          milestone: 7
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/auth/demo-login") {
        const body = await readJson(req);
        const requestedEmail = normalizeEmail(body.email) || defaultProfile.email;
        const existingProfile = store.profiles.get(getProfileIdFromEmail(requestedEmail)) ?? null;
        const profile = createProfileFromInput(body, existingProfile);

        store.profiles.set(profile.id, profile);

        const token = randomUUID();
        store.sessions.set(token, profile.id);
        ensureReminderContext(store, profile);
        recordAuditEvent(store, "session.demo_login", profile.id, {
          email: profile.email,
          timezone: profile.timezone
        });

        sendJson(req, res, requestId, 200, {
          token,
          profile
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/me") {
        const session = getSessionProfile(req, store);

        if (!session?.profile) {
          sendJson(req, res, requestId, 401, { error: "Unauthorized" });
          return;
        }

        sendJson(req, res, requestId, 200, { profile: session.profile });
        return;
      }

      if (req.method === "PATCH" && url.pathname === "/api/me") {
        const session = getSessionProfile(req, store);

        if (!session?.profile) {
          sendJson(req, res, requestId, 401, { error: "Unauthorized" });
          return;
        }

        const body = await readJson(req);
        const previousTimezone = session.profile.timezone;
        const nextProfile = createProfileFromInput(body, session.profile);

        if (
          nextProfile.id !== session.profile.id &&
          store.profiles.has(nextProfile.id)
        ) {
          sendJson(req, res, requestId, 409, { error: "Email is already in use." });
          return;
        }

        if (nextProfile.id !== session.profile.id) {
          moveUserRecords(store, session.profile.id, nextProfile.id);
          store.profiles.delete(session.profile.id);
        }

        store.profiles.set(nextProfile.id, nextProfile);
        if (previousTimezone !== nextProfile.timezone) {
          resetDoseEventsForUser(store, nextProfile.id);
        }
        ensureReminderContext(store, nextProfile);
        recordAuditEvent(store, "profile.updated", nextProfile.id, {
          email: nextProfile.email,
          timezone: nextProfile.timezone
        });

        sendJson(req, res, requestId, 200, { profile: nextProfile });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/medications") {
        const session = getSessionProfile(req, store);

        if (!session?.profile) {
          sendJson(req, res, requestId, 401, { error: "Unauthorized" });
          return;
        }

        ensureReminderContext(store, session.profile);
        sendJson(req, res, requestId, 200, {
          medications: listMedicationResponses(
            store,
            session.profile.id,
            url.searchParams.get("includeArchived") === "true"
          )
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/medications") {
        const session = getSessionProfile(req, store);

        if (!session?.profile) {
          sendJson(req, res, requestId, 401, { error: "Unauthorized" });
          return;
        }

        const body = await readJson(req);
        const validation = validateMedicationPayload(body);

        if (!validation.valid) {
          sendJson(req, res, requestId, 400, {
            error: "Validation failed",
            details: validation.errors
          });
          return;
        }

        const timestamp = new Date().toISOString();
        const medication = {
          id: randomUUID(),
          userId: session.profile.id,
          ...validation.medication,
          status: "active",
          createdAt: timestamp,
          updatedAt: timestamp,
          archivedAt: null
        };
        const schedule = {
          id: randomUUID(),
          medicationId: medication.id,
          userId: session.profile.id,
          ...validation.schedule,
          active: true,
          createdAt: timestamp,
          updatedAt: timestamp
        };

        store.medications.set(medication.id, medication);
        store.schedules.set(schedule.id, schedule);
        store.medicationScheduleIndex.set(medication.id, schedule.id);
        ensureReminderContext(store, session.profile);
        recordAuditEvent(store, "medication.created", session.profile.id, {
          medicationId: medication.id,
          medicationName: medication.name,
          reminderTimes: schedule.times
        });

        sendJson(req, res, requestId, 201, {
          medication: buildMedicationResponse(store, medication.id)
        });
        return;
      }

      if (req.method === "GET" && medicationMatch) {
        const session = getSessionProfile(req, store);

        if (!session?.profile) {
          sendJson(req, res, requestId, 401, { error: "Unauthorized" });
          return;
        }

        const medication = getMedicationForUser(store, session.profile.id, medicationMatch[1]);

        if (!medication) {
          sendJson(req, res, requestId, 404, { error: "Medication not found." });
          return;
        }

        sendJson(req, res, requestId, 200, {
          medication: buildMedicationResponse(store, medication.id)
        });
        return;
      }

      if (req.method === "PATCH" && medicationMatch) {
        const session = getSessionProfile(req, store);

        if (!session?.profile) {
          sendJson(req, res, requestId, 401, { error: "Unauthorized" });
          return;
        }

        const medication = getMedicationForUser(store, session.profile.id, medicationMatch[1]);

        if (!medication) {
          sendJson(req, res, requestId, 404, { error: "Medication not found." });
          return;
        }

        const body = await readJson(req);
        const validation = validateMedicationPayload(buildPatchPayload(store, medication, body));

        if (!validation.valid) {
          sendJson(req, res, requestId, 400, {
            error: "Validation failed",
            details: validation.errors
          });
          return;
        }

        const timestamp = new Date().toISOString();
        const nextMedication = {
          ...medication,
          ...validation.medication,
          updatedAt: timestamp
        };
        const schedule = getScheduleForMedication(store, medication.id);
        const nextSchedule = {
          ...(schedule ?? {
            id: randomUUID(),
            medicationId: medication.id,
            userId: session.profile.id,
            createdAt: timestamp
          }),
          ...validation.schedule,
          active: medication.status !== "archived",
          updatedAt: timestamp
        };

        store.medications.set(nextMedication.id, nextMedication);
        store.schedules.set(nextSchedule.id, nextSchedule);
        store.medicationScheduleIndex.set(nextMedication.id, nextSchedule.id);
        resetDoseEventsForMedication(store, nextMedication.id);
        ensureReminderContext(store, session.profile);
        recordAuditEvent(store, "medication.updated", session.profile.id, {
          medicationId: nextMedication.id,
          medicationName: nextMedication.name
        });

        sendJson(req, res, requestId, 200, {
          medication: buildMedicationResponse(store, nextMedication.id)
        });
        return;
      }

      if (req.method === "DELETE" && medicationMatch) {
        const session = getSessionProfile(req, store);

        if (!session?.profile) {
          sendJson(req, res, requestId, 401, { error: "Unauthorized" });
          return;
        }

        const medication = getMedicationForUser(store, session.profile.id, medicationMatch[1]);

        if (!medication) {
          sendJson(req, res, requestId, 404, { error: "Medication not found." });
          return;
        }

        const timestamp = new Date().toISOString();
        const nextMedication = {
          ...medication,
          status: "archived",
          archivedAt: timestamp,
          updatedAt: timestamp
        };
        const schedule = getScheduleForMedication(store, medication.id);

        if (schedule) {
          store.schedules.set(schedule.id, {
            ...schedule,
            active: false,
            updatedAt: timestamp
          });
        }

        store.medications.set(nextMedication.id, nextMedication);
        resetDoseEventsForMedication(store, nextMedication.id);
        recordAuditEvent(store, "medication.archived", session.profile.id, {
          medicationId: nextMedication.id,
          medicationName: nextMedication.name
        });

        sendJson(req, res, requestId, 200, {
          medication: buildMedicationResponse(store, nextMedication.id)
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/schedule/today") {
        const session = getSessionProfile(req, store);

        if (!session?.profile) {
          sendJson(req, res, requestId, 401, { error: "Unauthorized" });
          return;
        }

        ensureReminderContext(store, session.profile);
        sendJson(req, res, requestId, 200, buildTodayScheduleResponse(store, session.profile));
        return;
      }

      if (req.method === "PATCH" && doseMatch) {
        const session = getSessionProfile(req, store);

        if (!session?.profile) {
          sendJson(req, res, requestId, 401, { error: "Unauthorized" });
          return;
        }

        const doseEvent = getDoseEventForUser(store, session.profile.id, doseMatch[1]);

        if (!doseEvent) {
          sendJson(req, res, requestId, 404, { error: "Dose event not found." });
          return;
        }

        const body = await readJson(req);
        const result = applyDoseAction(store, session.profile, doseEvent.id, body);

        if (result.ok) {
          recordAuditEvent(store, "dose.updated", session.profile.id, {
            doseEventId: doseEvent.id,
            status: result.body.dose.status
          });
        }

        sendJson(req, res, requestId, result.statusCode, result.body);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/history") {
        const session = getSessionProfile(req, store);

        if (!session?.profile) {
          sendJson(req, res, requestId, 401, { error: "Unauthorized" });
          return;
        }

        sendJson(req, res, requestId, 200, buildHistoryResponse(store, session.profile, buildHistoryFilters(url)));
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/reminders/today") {
        const session = getSessionProfile(req, store);

        if (!session?.profile) {
          sendJson(req, res, requestId, 401, { error: "Unauthorized" });
          return;
        }

        sendJson(req, res, requestId, 200, buildReminderResponse(store, session.profile));
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/reminders/process") {
        const session = getSessionProfile(req, store);

        if (!session?.profile) {
          sendJson(req, res, requestId, 401, { error: "Unauthorized" });
          return;
        }

        const result = processReminderQueue(store, session.profile);

        recordAuditEvent(store, "reminder.worker_processed", session.profile.id, {
          ...result.body.processed,
          ...buildReminderAuditDetails(store, session.profile)
        });

        sendJson(req, res, requestId, result.statusCode, result.body);
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/devices/register") {
        const session = getSessionProfile(req, store);

        if (!session?.profile) {
          sendJson(req, res, requestId, 401, { error: "Unauthorized" });
          return;
        }

        const body = await readJson(req);
        const result = registerDeviceToken(store, session.profile, body);

        if (result.ok) {
          recordAuditEvent(store, "device.registered", session.profile.id, {
            deviceName: result.body.device.deviceName,
            platform: result.body.device.platform
          });
        }

        sendJson(req, res, requestId, result.statusCode, result.body);
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/audit-logs") {
        const session = getSessionProfile(req, store);

        if (!session?.profile) {
          sendJson(req, res, requestId, 401, { error: "Unauthorized" });
          return;
        }

        const limit = Number(url.searchParams.get("limit") || "12");
        sendJson(req, res, requestId, 200, buildAuditResponse(store, session.profile, limit));
        return;
      }

      sendJson(req, res, requestId, 404, { error: "Not found" });
    } catch (error) {
      const statusCode = error instanceof SyntaxError ? 400 : 500;

      recordAuditEvent(store, "server.error", null, {
        message: error instanceof Error ? error.message : "Unknown error",
        requestId
      });

      sendJson(
        req,
        res,
        requestId,
        statusCode,
        statusCode === 400
          ? { error: "Invalid JSON payload." }
          : { error: "Internal server error", requestId }
      );
    }
  };
}
