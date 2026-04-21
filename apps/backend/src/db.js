import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

function ensureDatabasePath(dbPath) {
  if (!dbPath || dbPath === ":memory:") {
    return dbPath || ":memory:";
  }

  const resolvedPath = resolve(dbPath);
  mkdirSync(dirname(resolvedPath), { recursive: true });
  return resolvedPath;
}

function encodeJson(value) {
  return JSON.stringify(value ?? null);
}

function decodeJson(value, fallback) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

class PersistentEntityMap {
  constructor(db, config) {
    this.db = db;
    this.table = config.table;
    this.keyColumn = config.keyColumn ?? "id";
    this.columns = config.columns;
    this.serialize = config.serialize;
    this.deserialize = config.deserialize;
    this.cache = new Map();

    const columnList = [this.keyColumn, ...this.columns];
    const placeholders = columnList.map(() => "?").join(", ");
    const updateAssignments = this.columns.map((column) => `${column} = excluded.${column}`).join(", ");

    this.selectAllStatement = this.db.prepare(
      `SELECT ${columnList.join(", ")} FROM ${this.table}`
    );
    this.upsertStatement = this.db.prepare(
      `INSERT INTO ${this.table} (${columnList.join(", ")}) VALUES (${placeholders})
       ON CONFLICT(${this.keyColumn}) DO UPDATE SET ${updateAssignments}`
    );
    this.deleteStatement = this.db.prepare(`DELETE FROM ${this.table} WHERE ${this.keyColumn} = ?`);
  }

  load() {
    const rows = this.selectAllStatement.all();
    this.cache.clear();

    for (const row of rows) {
      const value = this.deserialize(row);
      this.cache.set(row[this.keyColumn], value);
    }

    return this;
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, value) {
    this.cache.set(key, value);
    const row = this.serialize(value);
    const params = [key, ...this.columns.map((column) => row[column])];
    this.upsertStatement.run(...params);
    return this;
  }

  delete(key) {
    this.cache.delete(key);
    this.deleteStatement.run(key);
    return true;
  }

  has(key) {
    return this.cache.has(key);
  }

  values() {
    return this.cache.values();
  }

  entries() {
    return this.cache.entries();
  }
}

class PersistentSessionMap {
  constructor(db) {
    this.db = db;
    this.cache = new Map();
    this.selectAllStatement = this.db.prepare(
      "SELECT token, user_id AS userId, created_at AS createdAt FROM sessions"
    );
    this.upsertStatement = this.db.prepare(
      `INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)
       ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id`
    );
    this.deleteStatement = this.db.prepare("DELETE FROM sessions WHERE token = ?");
  }

  load() {
    this.cache.clear();
    for (const row of this.selectAllStatement.all()) {
      this.cache.set(row.token, row);
    }
    return this;
  }

  get(token) {
    return this.cache.get(token)?.userId ?? null;
  }

  set(token, userId) {
    const existing = this.cache.get(token);
    const row = {
      token,
      userId,
      createdAt: existing?.createdAt ?? new Date().toISOString()
    };
    this.cache.set(token, row);
    this.upsertStatement.run(row.token, row.userId, row.createdAt);
    return this;
  }

  delete(token) {
    this.cache.delete(token);
    this.deleteStatement.run(token);
    return true;
  }

  entries() {
    return [...this.cache.values()].map((row) => [row.token, row.userId])[Symbol.iterator]();
  }
}

function initializeSchema(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      timezone TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS medications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      dosage TEXT NOT NULL,
      instructions TEXT NOT NULL,
      reason TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      medication_id TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      recurrence_type TEXT NOT NULL,
      weekdays_json TEXT NOT NULL,
      times_json TEXT NOT NULL,
      active INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dose_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      medication_id TEXT NOT NULL,
      schedule_id TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      status TEXT NOT NULL,
      action_taken_at TEXT,
      notes TEXT,
      history_json TEXT NOT NULL,
      source TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reminder_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      dose_event_id TEXT NOT NULL UNIQUE,
      scheduled_send_at TEXT NOT NULL,
      channel TEXT NOT NULL,
      status TEXT NOT NULL,
      provider_reference TEXT,
      sent_at TEXT,
      delivered_at TEXT,
      failed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS device_registrations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL,
      device_name TEXT NOT NULL,
      platform TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      user_id TEXT,
      details_json TEXT NOT NULL,
      recorded_at TEXT NOT NULL
    );
  `);
}

function createAuditHelpers(db) {
  const selectStatement = db.prepare(
    `SELECT id, type, user_id AS userId, details_json AS detailsJson, recorded_at AS recordedAt
     FROM audit_logs
     ORDER BY recorded_at DESC`
  );
  const insertStatement = db.prepare(
    `INSERT INTO audit_logs (id, type, user_id, details_json, recorded_at)
     VALUES (?, ?, ?, ?, ?)`
  );
  const deleteOlderThanStatement = db.prepare(
    `DELETE FROM audit_logs
     WHERE id IN (
       SELECT id FROM audit_logs
       ORDER BY recorded_at DESC
       LIMIT -1 OFFSET ?
     )`
  );

  return {
    load() {
      return selectStatement.all().map((row) => ({
        id: row.id,
        type: row.type,
        userId: row.userId,
        details: decodeJson(row.detailsJson, {}),
        recordedAt: row.recordedAt
      }));
    },
    insert(entry) {
      insertStatement.run(
        entry.id,
        entry.type,
        entry.userId,
        encodeJson(entry.details),
        entry.recordedAt
      );
    },
    trim(maxEntries) {
      deleteOlderThanStatement.run(maxEntries);
    }
  };
}

export function createStore(options = {}) {
  const dbPath = ensureDatabasePath(
    options.dbPath || process.env.DATABASE_PATH || "apps/backend/data/medicine-reminder.sqlite"
  );
  const db = new DatabaseSync(dbPath);
  initializeSchema(db);

  const profiles = new PersistentEntityMap(db, {
    table: "profiles",
    columns: ["username", "email", "password_hash", "timezone", "created_at", "updated_at"],
    serialize(value) {
      return {
        username: value.username,
        email: value.email,
        password_hash: value.passwordHash,
        timezone: value.timezone,
        created_at: value.createdAt,
        updated_at: value.updatedAt
      };
    },
    deserialize(row) {
      return {
        id: row.id,
        username: row.username,
        email: row.email,
        passwordHash: row.password_hash,
        timezone: row.timezone,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    }
  }).load();

  const medications = new PersistentEntityMap(db, {
    table: "medications",
    columns: [
      "user_id",
      "name",
      "type",
      "dosage",
      "instructions",
      "reason",
      "start_date",
      "end_date",
      "status",
      "created_at",
      "updated_at",
      "archived_at"
    ],
    serialize(value) {
      return {
        user_id: value.userId,
        name: value.name,
        type: value.type,
        dosage: value.dosage,
        instructions: value.instructions,
        reason: value.reason,
        start_date: value.startDate,
        end_date: value.endDate,
        status: value.status,
        created_at: value.createdAt,
        updated_at: value.updatedAt,
        archived_at: value.archivedAt ?? null
      };
    },
    deserialize(row) {
      return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        type: row.type,
        dosage: row.dosage,
        instructions: row.instructions,
        reason: row.reason,
        startDate: row.start_date,
        endDate: row.end_date,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        archivedAt: row.archived_at
      };
    }
  }).load();

  const schedules = new PersistentEntityMap(db, {
    table: "schedules",
    columns: [
      "medication_id",
      "user_id",
      "recurrence_type",
      "weekdays_json",
      "times_json",
      "active",
      "created_at",
      "updated_at"
    ],
    serialize(value) {
      return {
        medication_id: value.medicationId,
        user_id: value.userId,
        recurrence_type: value.recurrenceType,
        weekdays_json: encodeJson(value.weekdays ?? []),
        times_json: encodeJson(value.times ?? []),
        active: value.active ? 1 : 0,
        created_at: value.createdAt,
        updated_at: value.updatedAt
      };
    },
    deserialize(row) {
      return {
        id: row.id,
        medicationId: row.medication_id,
        userId: row.user_id,
        recurrenceType: row.recurrence_type,
        weekdays: decodeJson(row.weekdays_json, []),
        times: decodeJson(row.times_json, []),
        active: Boolean(row.active),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    }
  }).load();

  const doseEvents = new PersistentEntityMap(db, {
    table: "dose_events",
    columns: [
      "user_id",
      "medication_id",
      "schedule_id",
      "scheduled_at",
      "status",
      "action_taken_at",
      "notes",
      "history_json",
      "source"
    ],
    serialize(value) {
      return {
        user_id: value.userId,
        medication_id: value.medicationId,
        schedule_id: value.scheduleId,
        scheduled_at: value.scheduledAt,
        status: value.status,
        action_taken_at: value.actionTakenAt,
        notes: value.notes ?? null,
        history_json: encodeJson(value.history ?? []),
        source: value.source
      };
    },
    deserialize(row) {
      return {
        id: row.id,
        userId: row.user_id,
        medicationId: row.medication_id,
        scheduleId: row.schedule_id,
        scheduledAt: row.scheduled_at,
        status: row.status,
        actionTakenAt: row.action_taken_at,
        notes: row.notes,
        history: decodeJson(row.history_json, []),
        source: row.source
      };
    }
  }).load();

  const reminderEvents = new PersistentEntityMap(db, {
    table: "reminder_events",
    columns: [
      "user_id",
      "dose_event_id",
      "scheduled_send_at",
      "channel",
      "status",
      "provider_reference",
      "sent_at",
      "delivered_at",
      "failed_at",
      "created_at",
      "updated_at"
    ],
    serialize(value) {
      return {
        user_id: value.userId,
        dose_event_id: value.doseEventId,
        scheduled_send_at: value.scheduledSendAt,
        channel: value.channel,
        status: value.status,
        provider_reference: value.providerReference ?? null,
        sent_at: value.sentAt ?? null,
        delivered_at: value.deliveredAt ?? null,
        failed_at: value.failedAt ?? null,
        created_at: value.createdAt,
        updated_at: value.updatedAt
      };
    },
    deserialize(row) {
      return {
        id: row.id,
        userId: row.user_id,
        doseEventId: row.dose_event_id,
        scheduledSendAt: row.scheduled_send_at,
        channel: row.channel,
        status: row.status,
        providerReference: row.provider_reference,
        sentAt: row.sent_at,
        deliveredAt: row.delivered_at,
        failedAt: row.failed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    }
  }).load();

  const deviceRegistrations = new PersistentEntityMap(db, {
    table: "device_registrations",
    columns: ["user_id", "token", "device_name", "platform", "created_at", "last_seen_at"],
    serialize(value) {
      return {
        user_id: value.userId,
        token: value.token,
        device_name: value.deviceName,
        platform: value.platform,
        created_at: value.createdAt,
        last_seen_at: value.lastSeenAt
      };
    },
    deserialize(row) {
      return {
        id: row.id,
        userId: row.user_id,
        token: row.token,
        deviceName: row.device_name,
        platform: row.platform,
        createdAt: row.created_at,
        lastSeenAt: row.last_seen_at
      };
    }
  }).load();

  const sessions = new PersistentSessionMap(db).load();
  const auditRepo = createAuditHelpers(db);
  const auditLogs = auditRepo.load();

  const medicationScheduleIndex = new Map();
  const doseEventIndex = new Map();
  const reminderEventIndex = new Map();

  for (const schedule of schedules.values()) {
    medicationScheduleIndex.set(schedule.medicationId, schedule.id);
  }

  for (const doseEvent of doseEvents.values()) {
    doseEventIndex.set(`${doseEvent.scheduleId}:${doseEvent.scheduledAt}`, doseEvent.id);
  }

  for (const reminderEvent of reminderEvents.values()) {
    reminderEventIndex.set(reminderEvent.doseEventId, reminderEvent.id);
  }

  return {
    db,
    sessions,
    profiles,
    medications,
    schedules,
    medicationScheduleIndex,
    doseEvents,
    doseEventIndex,
    reminderEvents,
    reminderEventIndex,
    deviceRegistrations,
    auditLogs,
    persistAuditEntry(entry) {
      auditRepo.insert(entry);
    },
    trimAuditLogs(maxEntries) {
      auditRepo.trim(maxEntries);
    },
    close() {
      db.close();
    }
  };
}
