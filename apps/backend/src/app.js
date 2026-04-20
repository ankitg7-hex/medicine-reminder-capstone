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
    profiles: new Map([[defaultProfile.id, { ...defaultProfile }]])
  };
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type, authorization",
    "access-control-allow-methods": "GET, POST, PATCH, OPTIONS"
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

export function createApp(options = {}) {
  const store = options.store ?? createStore();

  return async function app(req, res) {
    const url = new URL(req.url, "http://localhost");

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
        milestone: 2
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

    sendJson(res, 404, { error: "Not found" });
  };
}
