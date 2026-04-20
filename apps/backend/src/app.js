import { randomUUID } from "node:crypto";

const defaultProfile = {
  id: "demo-user",
  fullName: "Care Demo User",
  email: "demo@medireminder.local",
  timezone: "Asia/Calcutta"
};

function createStore() {
  return {
    sessions: new Map(),
    profiles: new Map([[defaultProfile.id, { ...defaultProfile }]]),
    medications: new Map()
  };
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type, authorization",
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS"
  });
  res.end(JSON.stringify(payload));
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

function normalizeMedicationInput(input, currentMedication) {
  const name = String(input.name ?? currentMedication?.name ?? "").trim();
  const dosage = String(input.dosage ?? currentMedication?.dosage ?? "").trim();
  const type = String(input.type ?? currentMedication?.type ?? "tablet").trim();
  const instructions = String(
    input.instructions ?? currentMedication?.instructions ?? ""
  ).trim();
  const reason = String(input.reason ?? currentMedication?.reason ?? "").trim();
  const startDate = String(
    input.startDate ?? currentMedication?.startDate ?? ""
  ).trim();
  const endDate = String(input.endDate ?? currentMedication?.endDate ?? "").trim();

  if (!name) {
    return { error: "Medication name is required." };
  }

  if (!dosage) {
    return { error: "Dosage is required." };
  }

  if (!startDate) {
    return { error: "Start date is required." };
  }

  if (endDate && startDate > endDate) {
    return { error: "End date must be on or after the start date." };
  }

  return {
    name,
    dosage,
    type: type || "tablet",
    instructions,
    reason,
    startDate,
    endDate
  };
}

function listUserMedications(store, userId, includeArchived) {
  return [...store.medications.values()]
    .filter((medication) => medication.userId === userId)
    .filter((medication) => includeArchived || medication.status !== "archived")
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function getMedicationForUser(store, userId, medicationId) {
  const medication = store.medications.get(medicationId);

  if (!medication || medication.userId !== userId) {
    return null;
  }

  return medication;
}

export function createApp(options = {}) {
  const store = options.store ?? createStore();

  return async function app(req, res) {
    const url = new URL(req.url, "http://localhost");
    const medicationMatch = url.pathname.match(/^\/api\/medications\/([^/]+)$/);

    if (req.method === "OPTIONS") {
      sendJson(res, 204, {});
      return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { status: "ok" });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/hello") {
      sendJson(res, 200, {
        message: "Hello from the medicine reminder backend",
        milestone: 3
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/demo-login") {
      const body = await readJson(req);
      const fullName = String(body.fullName || "").trim() || defaultProfile.fullName;
      const email = String(body.email || "").trim() || defaultProfile.email;
      const timezone =
        String(body.timezone || "").trim() || defaultProfile.timezone;

      const profile = {
        ...defaultProfile,
        fullName,
        email,
        timezone
      };

      store.profiles.set(profile.id, profile);

      const token = randomUUID();
      store.sessions.set(token, profile.id);

      sendJson(res, 200, {
        token,
        profile
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/me") {
      const session = getSessionProfile(req, store);

      if (!session?.profile) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }

      sendJson(res, 200, { profile: session.profile });
      return;
    }

    if (req.method === "PATCH" && url.pathname === "/api/me") {
      const session = getSessionProfile(req, store);

      if (!session?.profile) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }

      const body = await readJson(req);
      const nextProfile = {
        ...session.profile,
        fullName: String(body.fullName || session.profile.fullName).trim(),
        email: String(body.email || session.profile.email).trim(),
        timezone: String(body.timezone || session.profile.timezone).trim()
      };

      store.profiles.set(nextProfile.id, nextProfile);

      sendJson(res, 200, { profile: nextProfile });
      return;
    }

    if (url.pathname.startsWith("/api/medications")) {
      const session = getSessionProfile(req, store);

      if (!session?.profile) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/medications") {
        const includeArchived = url.searchParams.get("includeArchived") === "true";
        const medications = listUserMedications(
          store,
          session.profile.id,
          includeArchived
        );

        sendJson(res, 200, { medications });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/medications") {
        const body = await readJson(req);
        const normalized = normalizeMedicationInput(body);

        if ("error" in normalized) {
          sendJson(res, 400, { error: normalized.error });
          return;
        }

        const now = new Date().toISOString();
        const medication = {
          id: randomUUID(),
          userId: session.profile.id,
          ...normalized,
          status: "active",
          createdAt: now,
          updatedAt: now,
          archivedAt: null
        };

        store.medications.set(medication.id, medication);

        sendJson(res, 201, { medication });
        return;
      }

      if (medicationMatch) {
        const medication = getMedicationForUser(
          store,
          session.profile.id,
          medicationMatch[1]
        );

        if (!medication) {
          sendJson(res, 404, { error: "Medication not found." });
          return;
        }

        if (req.method === "GET") {
          sendJson(res, 200, { medication });
          return;
        }

        if (req.method === "PATCH") {
          const body = await readJson(req);
          const normalized = normalizeMedicationInput(body, medication);

          if ("error" in normalized) {
            sendJson(res, 400, { error: normalized.error });
            return;
          }

          const nextMedication = {
            ...medication,
            ...normalized,
            updatedAt: new Date().toISOString()
          };

          store.medications.set(nextMedication.id, nextMedication);
          sendJson(res, 200, { medication: nextMedication });
          return;
        }

        if (req.method === "DELETE") {
          const nextMedication = {
            ...medication,
            status: "archived",
            archivedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          store.medications.set(nextMedication.id, nextMedication);
          sendJson(res, 200, { medication: nextMedication });
          return;
        }
      }
    }

    sendJson(res, 404, { error: "Not found" });
  };
}
