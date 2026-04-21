import { randomUUID } from "node:crypto";

const weekdayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const recurrenceTypes = new Set(["daily", "selected-weekdays"]);
const windowDays = 7;

function parseDateParts(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

function parseTimeParts(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);

  if (!match) {
    return null;
  }

  return {
    hour: Number(match[1]),
    minute: Number(match[2])
  };
}

function formatDateParts(parts) {
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function getZonedParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: String(parts.weekday || "").slice(0, 3).toLowerCase()
  };
}

function formatDateInTimeZone(date, timeZone) {
  return formatDateParts(getZonedParts(date, timeZone));
}

function formatDisplayTime(date, timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function addDays(dateString, days) {
  const parts = parseDateParts(dateString);
  const utcValue = Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0, 0);
  const nextDate = new Date(utcValue);

  return `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, "0")}-${String(nextDate.getUTCDate()).padStart(2, "0")}`;
}

function getWeekdayKey(dateString) {
  const parts = parseDateParts(dateString);
  const dayIndex = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0)).getUTCDay();

  return weekdayKeys[dayIndex];
}

function zonedDateTimeToUtc(dateString, timeString, timeZone) {
  const dateParts = parseDateParts(dateString);
  const timeParts = parseTimeParts(timeString);
  const targetValue = Date.UTC(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    timeParts.hour,
    timeParts.minute,
    0,
    0
  );

  let guess = targetValue;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const zoned = getZonedParts(new Date(guess), timeZone);
    const currentValue = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      0,
      0
    );
    const diff = targetValue - currentValue;

    if (diff === 0) {
      break;
    }

    guess += diff;
  }

  return new Date(guess);
}

function shouldGenerateForDate(schedule, dateString) {
  if (schedule.recurrenceType === "daily") {
    return true;
  }

  return schedule.weekdays.includes(getWeekdayKey(dateString));
}

function normalizeString(value) {
  return String(value || "").trim();
}

export function validateMedicationPayload(payload) {
  const name = normalizeString(payload.name);
  const type = normalizeString(payload.type) || "Tablet";
  const dosage = normalizeString(payload.dosage);
  const instructions = normalizeString(payload.instructions);
  const reason = normalizeString(payload.reason);
  const startDate = normalizeString(payload.startDate);
  const endDate = normalizeString(payload.endDate);
  const rawSchedule = payload.schedule && typeof payload.schedule === "object" ? payload.schedule : {};
  const recurrenceType = normalizeString(rawSchedule.recurrenceType);
  const weekdays = Array.isArray(rawSchedule.weekdays)
    ? rawSchedule.weekdays.map((value) => normalizeString(value).toLowerCase()).filter(Boolean)
    : [];
  const times = Array.isArray(rawSchedule.times)
    ? rawSchedule.times.map((value) => normalizeString(value)).filter(Boolean)
    : [];

  const errors = [];

  if (!name) {
    errors.push("Medication name is required.");
  }

  if (!dosage) {
    errors.push("Dosage is required.");
  }

  if (!parseDateParts(startDate)) {
    errors.push("Start date must use YYYY-MM-DD format.");
  }

  if (endDate && !parseDateParts(endDate)) {
    errors.push("End date must use YYYY-MM-DD format.");
  }

  if (startDate && endDate && startDate > endDate) {
    errors.push("End date must be on or after the start date.");
  }

  if (!recurrenceTypes.has(recurrenceType)) {
    errors.push("Recurrence type must be daily or selected-weekdays.");
  }

  if (times.length === 0) {
    errors.push("Add at least one reminder time.");
  }

  const invalidTimes = times.filter((value) => !parseTimeParts(value));

  if (invalidTimes.length > 0) {
    errors.push("Reminder times must use 24-hour HH:MM format.");
  }

  const uniqueWeekdays = [...new Set(weekdays)];
  const invalidWeekdays = uniqueWeekdays.filter((value) => !weekdayKeys.includes(value));

  if (invalidWeekdays.length > 0) {
    errors.push("Weekday selections are invalid.");
  }

  if (recurrenceType === "selected-weekdays" && uniqueWeekdays.length === 0) {
    errors.push("Choose at least one weekday for selected-weekdays recurrence.");
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors
    };
  }

  return {
    valid: true,
    medication: {
      name,
      type,
      dosage,
      instructions,
      reason,
      startDate,
      endDate: endDate || null
    },
    schedule: {
      recurrenceType,
      weekdays: recurrenceType === "daily" ? [] : uniqueWeekdays,
      times: [...new Set(times)].sort()
    }
  };
}

export function resetDoseEventsForMedication(store, medicationId) {
  const idsToDelete = [];

  for (const doseEvent of store.doseEvents.values()) {
    if (doseEvent.medicationId === medicationId) {
      idsToDelete.push(doseEvent.id);
    }
  }

  for (const id of idsToDelete) {
    const doseEvent = store.doseEvents.get(id);

    if (!doseEvent) {
      continue;
    }

    store.doseEventIndex.delete(`${doseEvent.scheduleId}:${doseEvent.scheduledAt}`);
    store.doseEvents.delete(id);
  }
}

export function resetDoseEventsForUser(store, userId) {
  const medicationIds = [];

  for (const medication of store.medications.values()) {
    if (medication.userId === userId) {
      medicationIds.push(medication.id);
    }
  }

  medicationIds.forEach((medicationId) => resetDoseEventsForMedication(store, medicationId));
}

export function generateDoseEventsForProfile(store, profile, now = new Date()) {
  const today = formatDateInTimeZone(now, profile.timezone);
  const windowEnd = addDays(today, windowDays - 1);

  for (const medication of store.medications.values()) {
    if (medication.userId !== profile.id || medication.status !== "active") {
      continue;
    }

    const scheduleId = store.medicationScheduleIndex.get(medication.id);
    const schedule = scheduleId ? store.schedules.get(scheduleId) : null;

    if (!schedule || !schedule.active) {
      continue;
    }

    const rangeStart = medication.startDate > today ? medication.startDate : today;
    const rangeEnd =
      medication.endDate && medication.endDate < windowEnd ? medication.endDate : windowEnd;

    if (rangeStart > rangeEnd) {
      continue;
    }

    let cursor = rangeStart;

    while (cursor <= rangeEnd) {
      if (shouldGenerateForDate(schedule, cursor)) {
        for (const reminderTime of schedule.times) {
          const scheduledAt = zonedDateTimeToUtc(cursor, reminderTime, profile.timezone).toISOString();
          const idempotencyKey = `${schedule.id}:${scheduledAt}`;

          if (store.doseEventIndex.has(idempotencyKey)) {
            continue;
          }

          const doseEvent = {
            id: randomUUID(),
            userId: profile.id,
            medicationId: medication.id,
            scheduleId: schedule.id,
            scheduledAt,
            status: "pending",
            actionTakenAt: null,
            source: "schedule-generator"
          };

          store.doseEvents.set(doseEvent.id, doseEvent);
          store.doseEventIndex.set(idempotencyKey, doseEvent.id);
        }
      }

      cursor = addDays(cursor, 1);
    }
  }
}

export function buildMedicationResponse(store, medicationId) {
  const medication = store.medications.get(medicationId);

  if (!medication) {
    return null;
  }

  const scheduleId = store.medicationScheduleIndex.get(medication.id);
  const schedule = scheduleId ? store.schedules.get(scheduleId) : null;

  return {
    ...medication,
    schedule: schedule
      ? {
          id: schedule.id,
          recurrenceType: schedule.recurrenceType,
          weekdays: schedule.weekdays,
          times: schedule.times,
          active: schedule.active
        }
      : null
  };
}

export function buildTodayScheduleResponse(store, profile, now = new Date()) {
  generateDoseEventsForProfile(store, profile, now);

  const today = formatDateInTimeZone(now, profile.timezone);
  const groups = {
    dueNow: [],
    upcoming: [],
    completed: [],
    missed: []
  };

  for (const doseEvent of store.doseEvents.values()) {
    if (doseEvent.userId !== profile.id) {
      continue;
    }

    const medication = store.medications.get(doseEvent.medicationId);

    if (!medication || medication.status !== "active") {
      continue;
    }

    if (formatDateInTimeZone(new Date(doseEvent.scheduledAt), profile.timezone) !== today) {
      continue;
    }

    const doseSummary = {
      id: doseEvent.id,
      medicationId: medication.id,
      medicationName: medication.name,
      dosage: medication.dosage,
      instructions: medication.instructions,
      reason: medication.reason,
      scheduledAt: doseEvent.scheduledAt,
      scheduledTime: formatDisplayTime(new Date(doseEvent.scheduledAt), profile.timezone),
      status: doseEvent.status
    };

    if (doseEvent.status === "completed") {
      groups.completed.push(doseSummary);
      continue;
    }

    if (doseEvent.status === "missed") {
      groups.missed.push(doseSummary);
      continue;
    }

    if (new Date(doseEvent.scheduledAt).getTime() <= now.getTime()) {
      groups.dueNow.push(doseSummary);
      continue;
    }

    groups.upcoming.push(doseSummary);
  }

  Object.values(groups).forEach((entries) =>
    entries.sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt))
  );

  return {
    date: today,
    timezone: profile.timezone,
    summary: {
      dueNow: groups.dueNow.length,
      upcoming: groups.upcoming.length,
      completed: groups.completed.length,
      missed: groups.missed.length,
      total: Object.values(groups).reduce((count, entries) => count + entries.length, 0)
    },
    groups
  };
}
