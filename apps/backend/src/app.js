import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { createStore } from "./db.js";
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

const authMinPasswordLength = 8;

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeUsername(value) {
  return String(value || "").trim();
}

function normalizeTimezone(value, fallback = "Asia/Calcutta") {
  return String(value || "").trim() || fallback;
}

function toPublicProfile(profile) {
  return {
    id: profile.id,
    username: profile.username,
    email: profile.email,
    timezone: profile.timezone
  };
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

function verifyPassword(password, storedHash) {
  const [salt, key] = String(storedHash || "").split(":");

  if (!salt || !key) {
    return false;
  }

  const actualKey = scryptSync(password, salt, 64);
  const expectedKey = Buffer.from(key, "hex");

  return (
    actualKey.length === expectedKey.length && timingSafeEqual(actualKey, expectedKey)
  );
}

function validateAuthPayload(body, mode) {
  const username = normalizeUsername(body.username);
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const timezone = normalizeTimezone(body.timezone);
  const errors = [];

  if (mode === "signup" && !username) {
    errors.push("Username is required.");
  }

  if (!email) {
    errors.push("Email is required.");
  }

  if (!password) {
    errors.push("Password is required.");
  } else if (mode === "signup" && password.length < authMinPasswordLength) {
    errors.push(`Password must be at least ${authMinPasswordLength} characters long.`);
  }

  if (mode === "signup" && !timezone) {
    errors.push("Timezone is required.");
  }

  return {
    valid: errors.length === 0,
    errors,
    profile: {
      username,
      email,
      timezone
    },
    password
  };
}

function findProfileByEmail(store, email) {
  const normalizedEmail = normalizeEmail(email);

  for (const profile of store.profiles.values()) {
    if (profile.email === normalizedEmail) {
      return profile;
    }
  }

  return null;
}

function findProfileByUsername(store, username) {
  const normalizedUsername = normalizeUsername(username).toLowerCase();

  for (const profile of store.profiles.values()) {
    if (profile.username.toLowerCase() === normalizedUsername) {
      return profile;
    }
  }

  return null;
}

function buildUpdatedProfile(input, currentProfile) {
  return {
    ...currentProfile,
    username: normalizeUsername(input.username) || currentProfile.username,
    email: normalizeEmail(input.email) || currentProfile.email,
    timezone: normalizeTimezone(input.timezone, currentProfile.timezone),
    updatedAt: new Date().toISOString()
  };
}

function createStoreWithOptions(options = {}) {
  return options.store ?? createStore({ dbPath: options.dbPath });
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
  store.persistAuditEntry?.(entry);

  if (store.auditLogs.length > 200) {
    store.auditLogs.length = 200;
    store.trimAuditLogs?.(200);
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

function ensureReminderContext(store, profile) {
  generateDoseEventsForProfile(store, profile);
  generateReminderEventsForProfile(store, profile);
}

export function createApp(options = {}) {
  const store = createStoreWithOptions(options);

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
          environment: "production-ready-local"
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/auth/signup") {
        const body = await readJson(req);
        const validation = validateAuthPayload(body, "signup");

        if (!validation.valid) {
          sendJson(req, res, requestId, 400, {
            error: "Validation failed",
            details: validation.errors
          });
          return;
        }

        if (findProfileByEmail(store, validation.profile.email)) {
          sendJson(req, res, requestId, 409, { error: "Email is already in use." });
          return;
        }

        if (findProfileByUsername(store, validation.profile.username)) {
          sendJson(req, res, requestId, 409, { error: "Username is already in use." });
          return;
        }

        const timestamp = new Date().toISOString();
        const profile = {
          id: randomUUID(),
          username: validation.profile.username,
          email: validation.profile.email,
          passwordHash: hashPassword(validation.password),
          timezone: validation.profile.timezone,
          createdAt: timestamp,
          updatedAt: timestamp
        };

        store.profiles.set(profile.id, profile);

        const token = randomUUID();
        store.sessions.set(token, profile.id);
        ensureReminderContext(store, profile);
        recordAuditEvent(store, "session.signup", profile.id, {
          email: profile.email,
          username: profile.username,
          timezone: profile.timezone
        });

        sendJson(req, res, requestId, 201, {
          token,
          profile: toPublicProfile(profile)
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/auth/login") {
        const body = await readJson(req);
        const validation = validateAuthPayload(body, "login");

        if (!validation.valid) {
          sendJson(req, res, requestId, 400, {
            error: "Validation failed",
            details: validation.errors
          });
          return;
        }

        const profile = findProfileByEmail(store, validation.profile.email);

        if (!profile || !verifyPassword(validation.password, profile.passwordHash)) {
          sendJson(req, res, requestId, 401, { error: "Invalid email or password." });
          return;
        }

        const token = randomUUID();
        store.sessions.set(token, profile.id);
        ensureReminderContext(store, profile);
        recordAuditEvent(store, "session.login", profile.id, {
          email: profile.email,
          username: profile.username
        });

        sendJson(req, res, requestId, 200, {
          token,
          profile: toPublicProfile(profile)
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/me") {
        const session = getSessionProfile(req, store);

        if (!session?.profile) {
          sendJson(req, res, requestId, 401, { error: "Unauthorized" });
          return;
        }

        sendJson(req, res, requestId, 200, { profile: toPublicProfile(session.profile) });
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
        const nextProfile = buildUpdatedProfile(body, session.profile);
        const profileByEmail = findProfileByEmail(store, nextProfile.email);
        const profileByUsername = findProfileByUsername(store, nextProfile.username);

        if (profileByEmail && profileByEmail.id !== session.profile.id) {
          sendJson(req, res, requestId, 409, { error: "Email is already in use." });
          return;
        }

        if (profileByUsername && profileByUsername.id !== session.profile.id) {
          sendJson(req, res, requestId, 409, { error: "Username is already in use." });
          return;
        }

        store.profiles.set(nextProfile.id, nextProfile);
        if (previousTimezone !== nextProfile.timezone) {
          resetDoseEventsForUser(store, nextProfile.id);
        }
        ensureReminderContext(store, nextProfile);
        recordAuditEvent(store, "profile.updated", nextProfile.id, {
          email: nextProfile.email,
          username: nextProfile.username,
          timezone: nextProfile.timezone
        });

        sendJson(req, res, requestId, 200, { profile: toPublicProfile(nextProfile) });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/auth/logout") {
        const token = getTokenFromRequest(req);

        if (token) {
          store.sessions.delete(token);
        }

        sendJson(req, res, requestId, 204, {});
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

        sendJson(
          req,
          res,
          requestId,
          200,
          buildHistoryResponse(store, session.profile, buildHistoryFilters(url))
        );
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
