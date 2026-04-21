import { randomUUID } from "node:crypto";
import {
  formatDateInTimeZone,
  formatDisplayTime,
  generateDoseEventsForProfile,
  getDoseEventForUser
} from "./scheduling.js";

const reminderStatuses = new Set(["queued", "sent", "delivered", "failed"]);
const defaultStaleAfterMinutes = 120;

function normalizeString(value) {
  return String(value || "").trim();
}

function listUserDevices(store, userId) {
  return [...store.deviceRegistrations.values()]
    .filter((device) => device.userId === userId)
    .sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt));
}

function summarizeDevice(device) {
  const suffix = device.token.slice(-6);

  return {
    id: device.id,
    deviceName: device.deviceName,
    platform: device.platform,
    tokenPreview: `...${suffix}`,
    createdAt: device.createdAt,
    lastSeenAt: device.lastSeenAt
  };
}

function getReminderChannel(store, userId) {
  return listUserDevices(store, userId).length > 0 ? "push" : "in-app";
}

function getReminderEventForDose(store, doseEventId) {
  const reminderEventId = store.reminderEventIndex.get(doseEventId);
  return reminderEventId ? store.reminderEvents.get(reminderEventId) ?? null : null;
}

function buildReminderEntry(store, profile, reminderEvent) {
  const doseEvent = store.doseEvents.get(reminderEvent.doseEventId);
  const medication = doseEvent ? store.medications.get(doseEvent.medicationId) ?? null : null;

  return {
    id: reminderEvent.id,
    doseEventId: reminderEvent.doseEventId,
    medicationId: medication?.id ?? null,
    medicationName: medication?.name ?? "Archived medication",
    scheduledSendAt: reminderEvent.scheduledSendAt,
    scheduledSendTime: formatDisplayTime(new Date(reminderEvent.scheduledSendAt), profile.timezone),
    status: reminderEvent.status,
    channel: reminderEvent.channel,
    providerReference: reminderEvent.providerReference ?? null,
    sentAt: reminderEvent.sentAt ?? null,
    deliveredAt: reminderEvent.deliveredAt ?? null,
    failedAt: reminderEvent.failedAt ?? null
  };
}

function buildReminderSummary(entries) {
  return {
    queued: entries.filter((entry) => entry.status === "queued").length,
    sent: entries.filter((entry) => entry.status === "sent").length,
    delivered: entries.filter((entry) => entry.status === "delivered").length,
    failed: entries.filter((entry) => entry.status === "failed").length,
    total: entries.length
  };
}

function markDoseMissedByWorker(store, doseEvent, now) {
  if (doseEvent.status !== "pending") {
    return false;
  }

  store.doseEvents.set(doseEvent.id, {
    ...doseEvent,
    status: "missed",
    actionTakenAt: now.toISOString(),
    notes: doseEvent.notes ?? null,
    history: [
      ...(doseEvent.history ?? []),
      {
        status: "missed",
        recordedAt: now.toISOString(),
        notes: "Auto-marked missed after reminder timeout.",
        source: "reminder-worker-timeout"
      }
    ]
  });

  return true;
}

function syncQueuedReminderChannels(store, userId) {
  const nextChannel = getReminderChannel(store, userId);

  for (const reminderEvent of store.reminderEvents.values()) {
    if (reminderEvent.userId !== userId || reminderEvent.status !== "queued") {
      continue;
    }

    store.reminderEvents.set(reminderEvent.id, {
      ...reminderEvent,
      channel: nextChannel,
      updatedAt: new Date().toISOString()
    });
  }
}

export function createNotificationAdapter(store) {
  return {
    send(reminderEvent) {
      if (reminderEvent.channel === "push") {
        const devices = listUserDevices(store, reminderEvent.userId);
        const failingDevice = devices.find((device) => device.token.toLowerCase().includes("fail"));

        if (failingDevice) {
          return {
            outcome: "failed",
            error: "Mock push delivery failed for the registered device."
          };
        }

        return {
          outcome: "sent",
          providerReference: `mock-push:${reminderEvent.id}`
        };
      }

      return {
        outcome: "delivered",
        providerReference: `mock-in-app:${reminderEvent.id}`
      };
    }
  };
}

export function generateReminderEventsForProfile(store, profile, now = new Date()) {
  generateDoseEventsForProfile(store, profile, now);
  syncQueuedReminderChannels(store, profile.id);

  for (const doseEvent of store.doseEvents.values()) {
    if (doseEvent.userId !== profile.id) {
      continue;
    }

    const medication = store.medications.get(doseEvent.medicationId);

    if (!medication || medication.status !== "active") {
      continue;
    }

    if (getReminderEventForDose(store, doseEvent.id)) {
      continue;
    }

    const timestamp = now.toISOString();
    const reminderEvent = {
      id: randomUUID(),
      userId: profile.id,
      doseEventId: doseEvent.id,
      scheduledSendAt: doseEvent.scheduledAt,
      channel: getReminderChannel(store, profile.id),
      status: "queued",
      providerReference: null,
      sentAt: null,
      deliveredAt: null,
      failedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    store.reminderEvents.set(reminderEvent.id, reminderEvent);
    store.reminderEventIndex.set(doseEvent.id, reminderEvent.id);
  }
}

export function buildReminderResponse(store, profile, now = new Date()) {
  generateReminderEventsForProfile(store, profile, now);

  const today = formatDateInTimeZone(now, profile.timezone);
  const entries = [];

  for (const reminderEvent of store.reminderEvents.values()) {
    if (reminderEvent.userId !== profile.id) {
      continue;
    }

    if (formatDateInTimeZone(new Date(reminderEvent.scheduledSendAt), profile.timezone) !== today) {
      continue;
    }

    entries.push(buildReminderEntry(store, profile, reminderEvent));
  }

  entries.sort((left, right) => left.scheduledSendAt.localeCompare(right.scheduledSendAt));

  return {
    date: today,
    timezone: profile.timezone,
    policy: {
      staleAfterMinutes: defaultStaleAfterMinutes
    },
    summary: buildReminderSummary(entries),
    devices: listUserDevices(store, profile.id).map(summarizeDevice),
    reminders: entries
  };
}

export function registerDeviceToken(store, profile, payload, now = new Date()) {
  const token = normalizeString(payload.token);
  const deviceName = normalizeString(payload.deviceName) || "Primary device";
  const platform = normalizeString(payload.platform) || "web";

  if (token.length < 8) {
    return {
      ok: false,
      statusCode: 400,
      body: {
        error: "Validation failed",
        details: ["Device token must be at least 8 characters long."]
      }
    };
  }

  const existing = [...store.deviceRegistrations.values()].find(
    (device) => device.userId === profile.id && device.token === token
  );
  const timestamp = now.toISOString();
  const device = existing
    ? {
        ...existing,
        deviceName,
        platform,
        lastSeenAt: timestamp
      }
    : {
        id: randomUUID(),
        userId: profile.id,
        token,
        deviceName,
        platform,
        createdAt: timestamp,
        lastSeenAt: timestamp
      };

  store.deviceRegistrations.set(device.id, device);
  syncQueuedReminderChannels(store, profile.id);

  return {
    ok: true,
    statusCode: 201,
    body: {
      device: summarizeDevice(device),
      devices: listUserDevices(store, profile.id).map(summarizeDevice)
    }
  };
}

export function processReminderQueue(store, profile, options = {}) {
  const now = options.now ?? new Date();
  const adapter = options.adapter ?? createNotificationAdapter(store);

  generateReminderEventsForProfile(store, profile, now);

  let processed = 0;
  let delivered = 0;
  let sent = 0;
  let failed = 0;
  let autoMissed = 0;
  const staleThreshold = now.getTime() - defaultStaleAfterMinutes * 60_000;

  for (const reminderEvent of store.reminderEvents.values()) {
    if (reminderEvent.userId !== profile.id) {
      continue;
    }

    const doseEvent = getDoseEventForUser(store, profile.id, reminderEvent.doseEventId);

    if (!doseEvent) {
      continue;
    }

    if (new Date(reminderEvent.scheduledSendAt).getTime() <= staleThreshold && doseEvent.status === "pending") {
      if (markDoseMissedByWorker(store, doseEvent, now)) {
        autoMissed += 1;
      }

      if (reminderEvent.status === "queued") {
        store.reminderEvents.set(reminderEvent.id, {
          ...reminderEvent,
          status: "failed",
          failedAt: now.toISOString(),
          updatedAt: now.toISOString()
        });
        failed += 1;
      }

      continue;
    }

    if (
      reminderEvent.status === "queued" &&
      new Date(reminderEvent.scheduledSendAt).getTime() <= now.getTime() &&
      doseEvent.status === "pending"
    ) {
      const dispatch = adapter.send(reminderEvent);
      const timestamp = now.toISOString();
      const nextReminderEvent = {
        ...reminderEvent,
        status: dispatch.outcome === "failed" ? "failed" : dispatch.outcome,
        providerReference: dispatch.providerReference ?? null,
        sentAt: dispatch.outcome === "failed" ? null : timestamp,
        deliveredAt: dispatch.outcome === "delivered" ? timestamp : null,
        failedAt: dispatch.outcome === "failed" ? timestamp : null,
        updatedAt: timestamp
      };

      store.reminderEvents.set(nextReminderEvent.id, nextReminderEvent);
      processed += 1;

      if (dispatch.outcome === "delivered") {
        delivered += 1;
      } else if (dispatch.outcome === "sent") {
        sent += 1;
      } else {
        failed += 1;
      }

      continue;
    }

    if (
      reminderEvent.status === "sent" &&
      reminderEvent.sentAt &&
      new Date(reminderEvent.sentAt).getTime() <= now.getTime()
    ) {
      const timestamp = now.toISOString();

      store.reminderEvents.set(reminderEvent.id, {
        ...reminderEvent,
        status: "delivered",
        deliveredAt: timestamp,
        updatedAt: timestamp
      });
      delivered += 1;
      continue;
    }
  }

  return {
    ok: true,
    statusCode: 200,
    body: {
      processed: {
        queued: processed,
        sent,
        delivered,
        failed,
        autoMissed
      },
      reminders: buildReminderResponse(store, profile, now)
    }
  };
}

export function buildReminderAuditDetails(store, profile) {
  return {
    userId: profile.id,
    summary: buildReminderResponse(store, profile).summary,
    devices: listUserDevices(store, profile.id).map(summarizeDevice)
  };
}

export { reminderStatuses, defaultStaleAfterMinutes };
