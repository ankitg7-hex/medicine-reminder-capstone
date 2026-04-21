import { FormEvent, useEffect, useState } from "react";

type Profile = {
  id: string;
  username: string;
  email: string;
  timezone: string;
};

type AuthPayload = {
  token: string;
  profile: Profile;
};

type MedicationSchedule = {
  id: string;
  recurrenceType: "daily" | "selected-weekdays";
  weekdays: string[];
  times: string[];
  active: boolean;
};

type Medication = {
  id: string;
  name: string;
  type: string;
  dosage: string;
  instructions: string;
  reason: string;
  startDate: string;
  endDate: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  schedule: MedicationSchedule;
};

type DoseActionStatus = "completed" | "missed" | "skipped";
type ReminderStatus = "queued" | "sent" | "delivered" | "failed";
type ScheduleGroupKey = "dueNow" | "upcoming" | "completed" | "missed" | "skipped";
type HistoryStatusFilter = DoseActionStatus | "all";

type ReminderBadge = {
  id: string;
  scheduledSendAt: string;
  scheduledSendTime: string;
  status: ReminderStatus;
  channel: string;
  providerReference: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
};

type DoseEntry = {
  id: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  instructions: string;
  reason: string;
  scheduledAt: string;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  actionTakenAt: string | null;
  notes: string | null;
  reminder: ReminderBadge | null;
};

type ScheduleResponse = {
  date: string;
  timezone: string;
  summary: Record<ScheduleGroupKey | "total", number>;
  groups: Record<ScheduleGroupKey, DoseEntry[]>;
};

type HistoryResponse = {
  summary: Record<DoseActionStatus | "total", number>;
  history: DoseEntry[];
};

type ReminderEntry = {
  id: string;
  doseEventId: string;
  medicationId: string | null;
  medicationName: string;
  scheduledSendAt: string;
  scheduledSendTime: string;
  status: ReminderStatus;
  channel: string;
  providerReference: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
};

type DeviceEntry = {
  id: string;
  deviceName: string;
  platform: string;
  tokenPreview: string;
  createdAt: string;
  lastSeenAt: string;
};

type ReminderResponse = {
  date: string;
  timezone: string;
  policy: {
    staleAfterMinutes: number;
  };
  summary: Record<ReminderStatus | "total", number>;
  devices: DeviceEntry[];
  reminders: ReminderEntry[];
};

type ReminderProcessResponse = {
  processed: {
    queued: number;
    sent: number;
    delivered: number;
    failed: number;
    autoMissed: number;
  };
  reminders: ReminderResponse;
};

type AuditEntry = {
  id: string;
  type: string;
  userId: string | null;
  details: Record<string, unknown>;
  recordedAt: string;
};

type AuditResponse = {
  entries: AuditEntry[];
};

type HistoryFilters = {
  medicationId: string;
  status: HistoryStatusFilter;
};

type MedicationFormState = {
  name: string;
  type: string;
  dosage: string;
  instructions: string;
  reason: string;
  startDate: string;
  endDate: string;
  schedule: {
    recurrenceType: "daily" | "selected-weekdays";
    weekdays: string[];
    times: string[];
  };
};

type DeviceFormState = {
  token: string;
  deviceName: string;
  platform: string;
};

type AuthMode = "login" | "signup";

type DashboardTab =
  | "overview"
  | "medications"
  | "reminders"
  | "schedule"
  | "history"
  | "activity"
  | "account";

const sessionStorageKey = "medicine-reminder-session-token";

const weekdayOptions = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" }
] as const;

const scheduleGroupMeta: Array<{
  key: ScheduleGroupKey;
  title: string;
  description: string;
}> = [
  {
    key: "dueNow",
    title: "Due now",
    description: "Take action on doses that are due or slightly overdue."
  },
  {
    key: "upcoming",
    title: "Upcoming",
    description: "Preview the rest of the day and confirm reminders are queued."
  },
  {
    key: "completed",
    title: "Taken",
    description: "Completed doses stay visible with reminder delivery context."
  },
  {
    key: "missed",
    title: "Missed",
    description: "Missed items include manual actions and reminder timeout cases."
  },
  {
    key: "skipped",
    title: "Skipped",
    description: "Use skip when a dose is intentionally not taken."
  }
];

const doseActionOptions: Array<{
  status: DoseActionStatus;
  label: string;
  className: string;
}> = [
  { status: "completed", label: "Mark taken", className: "dose-action-positive" },
  { status: "skipped", label: "Skip", className: "dose-action-neutral" },
  { status: "missed", label: "Missed", className: "dose-action-warning" }
];

const historyStatusOptions: Array<{ value: HistoryStatusFilter; label: string }> = [
  { value: "all", label: "All outcomes" },
  { value: "completed", label: "Taken" },
  { value: "missed", label: "Missed" },
  { value: "skipped", label: "Skipped" }
];

const reminderStatusLabels: Record<ReminderStatus, string> = {
  queued: "Queued",
  sent: "Sent",
  delivered: "Delivered",
  failed: "Failed"
};

const reminderStatusTone: Record<ReminderStatus, string> = {
  queued: "queued",
  sent: "sent",
  delivered: "delivered",
  failed: "failed"
};

const medicineCatalog = [
  {
    name: "Paracetamol",
    type: "tablet",
    dosage: "500 mg",
    instructions: "After food",
    reason: "Fever or mild pain"
  },
  {
    name: "Amoxicillin",
    type: "capsule",
    dosage: "250 mg",
    instructions: "Complete the prescribed course",
    reason: "Bacterial infection"
  },
  {
    name: "Azithromycin",
    type: "tablet",
    dosage: "500 mg",
    instructions: "Take at the same time each day",
    reason: "Respiratory infection"
  },
  {
    name: "Cetirizine",
    type: "tablet",
    dosage: "10 mg",
    instructions: "Usually taken in the evening",
    reason: "Allergy relief"
  },
  {
    name: "Crocin",
    type: "tablet",
    dosage: "650 mg",
    instructions: "Use only as directed",
    reason: "Fever"
  },
  {
    name: "Dolo 650",
    type: "tablet",
    dosage: "650 mg",
    instructions: "After food if needed",
    reason: "Body pain or fever"
  },
  {
    name: "Ibuprofen",
    type: "tablet",
    dosage: "400 mg",
    instructions: "Take after meals",
    reason: "Pain and inflammation"
  },
  {
    name: "Insulin",
    type: "injection",
    dosage: "10 units",
    instructions: "Use exactly as prescribed",
    reason: "Blood sugar management"
  },
  {
    name: "Metformin",
    type: "tablet",
    dosage: "500 mg",
    instructions: "Take with meals",
    reason: "Type 2 diabetes"
  },
  {
    name: "Omeprazole",
    type: "capsule",
    dosage: "20 mg",
    instructions: "Before breakfast",
    reason: "Acidity or reflux"
  },
  {
    name: "Pantoprazole",
    type: "tablet",
    dosage: "40 mg",
    instructions: "Before breakfast",
    reason: "Acidity or gastritis"
  },
  {
    name: "Vitamin D3",
    type: "capsule",
    dosage: "1 capsule",
    instructions: "After breakfast",
    reason: "Vitamin supplement"
  }
];

function createDefaultMedicationForm(): MedicationFormState {
  const localNow = new Date();
  const localDate = new Date(localNow.getTime() - localNow.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);

  return {
    name: "",
    type: "tablet",
    dosage: "",
    instructions: "",
    reason: "",
    startDate: localDate,
    endDate: "",
    schedule: {
      recurrenceType: "daily",
      weekdays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      times: ["08:00"]
    }
  };
}

function createEmptyHistory(): HistoryResponse {
  return {
    summary: {
      completed: 0,
      missed: 0,
      skipped: 0,
      total: 0
    },
    history: []
  };
}

function createEmptyReminderResponse(): ReminderResponse {
  return {
    date: "",
    timezone: "",
    policy: {
      staleAfterMinutes: 120
    },
    summary: {
      queued: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      total: 0
    },
    devices: [],
    reminders: []
  };
}

function createEmptyAuditResponse(): AuditResponse {
  return {
    entries: []
  };
}

function createDefaultDeviceForm(): DeviceFormState {
  return {
    token: "device-token-001",
    deviceName: "Primary phone",
    platform: "android"
  };
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers = new Headers(options.headers ?? {});

  if (!headers.has("content-type") && options.body) {
    headers.set("content-type", "application/json");
  }

  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const response = await fetch(path, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorBody = await response
      .json()
      .catch(() => ({ error: "Request failed", details: [] }));
    const detailText = Array.isArray(errorBody.details) ? errorBody.details.join(" ") : "";
    throw new Error([errorBody.error, detailText].filter(Boolean).join(" ").trim());
  }

  return response.json() as Promise<T>;
}

function summarizeSchedule(medication: Medication) {
  const timeLabel = medication.schedule.times.join(", ");

  if (medication.schedule.recurrenceType === "daily") {
    return `Daily at ${timeLabel}`;
  }

  const weekdayLabel = medication.schedule.weekdays
    .map(
      (dayKey) =>
        weekdayOptions.find((option) => option.key === dayKey)?.label ?? dayKey.toUpperCase()
    )
    .join(", ");

  return `${weekdayLabel} at ${timeLabel}`;
}

function buildHistoryPath(filters: HistoryFilters) {
  const params = new URLSearchParams();

  if (filters.medicationId !== "all") {
    params.set("medicationId", filters.medicationId);
  }

  if (filters.status !== "all") {
    params.set("status", filters.status);
  }

  const query = params.toString();
  return query ? `/api/history?${query}` : "/api/history";
}

function getDoseActionGroup(status: DoseActionStatus): Extract<
  ScheduleGroupKey,
  "completed" | "missed" | "skipped"
> {
  if (status === "completed") {
    return "completed";
  }

  if (status === "missed") {
    return "missed";
  }

  return "skipped";
}

function sortDoseEntries(entries: DoseEntry[]) {
  return [...entries].sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
}

function buildScheduleSummary(groups: Record<ScheduleGroupKey, DoseEntry[]>) {
  return {
    dueNow: groups.dueNow.length,
    upcoming: groups.upcoming.length,
    completed: groups.completed.length,
    missed: groups.missed.length,
    skipped: groups.skipped.length,
    total: Object.values(groups).reduce((count, entries) => count + entries.length, 0)
  };
}

function applyDoseActionToSchedule(
  current: ScheduleResponse,
  existingEntry: DoseEntry,
  nextStatus: DoseActionStatus,
  actionTakenAt: string
) {
  const groups: Record<ScheduleGroupKey, DoseEntry[]> = {
    dueNow: current.groups.dueNow.filter((entry) => entry.id !== existingEntry.id),
    upcoming: current.groups.upcoming.filter((entry) => entry.id !== existingEntry.id),
    completed: current.groups.completed.filter((entry) => entry.id !== existingEntry.id),
    missed: current.groups.missed.filter((entry) => entry.id !== existingEntry.id),
    skipped: current.groups.skipped.filter((entry) => entry.id !== existingEntry.id)
  };
  const nextEntry = {
    ...existingEntry,
    status: nextStatus,
    actionTakenAt
  };
  const targetGroup = getDoseActionGroup(nextStatus);

  groups[targetGroup] = sortDoseEntries([...groups[targetGroup], nextEntry]);

  return {
    ...current,
    groups,
    summary: buildScheduleSummary(groups)
  };
}

function applyDoseActionToHistory(
  current: HistoryResponse,
  existingEntry: DoseEntry,
  nextStatus: DoseActionStatus,
  actionTakenAt: string
) {
  const nextEntry = {
    ...existingEntry,
    status: nextStatus,
    actionTakenAt
  };
  const nextHistory = [
    nextEntry,
    ...current.history.filter((entry) => entry.id !== nextEntry.id)
  ].sort((left, right) => right.scheduledAt.localeCompare(left.scheduledAt));

  return {
    summary: {
      completed: nextHistory.filter((entry) => entry.status === "completed").length,
      missed: nextHistory.filter((entry) => entry.status === "missed").length,
      skipped: nextHistory.filter((entry) => entry.status === "skipped").length,
      total: nextHistory.length
    },
    history: nextHistory
  };
}

function findDoseEntry(schedule: ScheduleResponse | null, doseId: string) {
  if (!schedule) {
    return null;
  }

  for (const group of Object.values(schedule.groups)) {
    const match = group.find((entry) => entry.id === doseId);

    if (match) {
      return match;
    }
  }

  return null;
}

function formatDoseStatusLabel(status: string) {
  if (status === "completed") {
    return "Taken";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Pending";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function groupHistoryEntries(entries: DoseEntry[]) {
  return Object.entries(
    entries.reduce<Record<string, DoseEntry[]>>((groups, entry) => {
      groups[entry.scheduledDate] = groups[entry.scheduledDate]
        ? [...groups[entry.scheduledDate], entry]
        : [entry];
      return groups;
    }, {})
  );
}

function formatReminderSupportText(entry: DoseEntry) {
  if (!entry.reminder) {
    return "Reminder event pending generation.";
  }

  return `${reminderStatusLabels[entry.reminder.status]} via ${entry.reminder.channel} at ${entry.reminder.scheduledSendTime}`;
}

function summarizeAuditEntry(entry: AuditEntry) {
  switch (entry.type) {
    case "device.registered":
      return "Device token registered for future reminder delivery.";
    case "reminder.worker_processed":
      return "Reminder worker simulated a delivery cycle.";
    case "dose.updated":
      return "Dose outcome was updated.";
    case "medication.created":
      return "Medication plan created.";
    case "medication.updated":
      return "Medication plan updated.";
    case "medication.archived":
      return "Medication plan archived.";
    case "profile.updated":
      return "Profile settings updated.";
    case "session.signup":
      return "Account created successfully.";
    case "session.login":
      return "Signed in successfully.";
    default:
      return entry.type;
  }
}

export function App() {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [status, setStatus] = useState("Checking session...");
  const [error, setError] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [medicationError, setMedicationError] = useState<string | null>(null);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false);
  const [isReminderProcessing, setIsReminderProcessing] = useState(false);
  const [isDeviceSaving, setIsDeviceSaving] = useState(false);
  const [editingMedicationId, setEditingMedicationId] = useState<string | null>(null);
  const [historyFilters, setHistoryFilters] = useState<HistoryFilters>({
    medicationId: "all",
    status: "all"
  });
  const [pendingDoseActionIds, setPendingDoseActionIds] = useState<string[]>([]);
  const [loginForm, setLoginForm] = useState({
    email: "ananya@example.com",
    password: "password123"
  });
  const [signupForm, setSignupForm] = useState({
    username: "ananya",
    email: "ananya@example.com",
    password: "password123",
    timezone: "Asia/Calcutta"
  });
  const [profileForm, setProfileForm] = useState({
    username: "",
    email: "",
    timezone: ""
  });
  const [deviceForm, setDeviceForm] = useState<DeviceFormState>(createDefaultDeviceForm());
  const [medicationForm, setMedicationForm] = useState<MedicationFormState>(
    createDefaultMedicationForm()
  );
  const [medications, setMedications] = useState<Medication[]>([]);
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [history, setHistory] = useState<HistoryResponse>(createEmptyHistory());
  const [reminders, setReminders] = useState<ReminderResponse>(createEmptyReminderResponse());
  const [auditTrail, setAuditTrail] = useState<AuditResponse>(createEmptyAuditResponse());

  const medicineSuggestions = medicationForm.name.trim()
    ? medicineCatalog.filter((medicine) =>
        medicine.name.toLowerCase().includes(medicationForm.name.trim().toLowerCase())
      )
    : medicineCatalog.slice(0, 6);
  const historyGroups = groupHistoryEntries(history.history);

  useEffect(() => {
    const savedToken = window.localStorage.getItem(sessionStorageKey);

    if (!savedToken) {
      setStatus("Sign in to manage your medicines, reminders, and daily schedule.");
      return;
    }

    void loadProfile(savedToken);
  }, []);

  useEffect(() => {
    if (!profile) {
      return;
    }

    setProfileForm({
      username: profile.username,
      email: profile.email,
      timezone: profile.timezone
    });
  }, [profile]);

  useEffect(() => {
    if (!token || !profile) {
      return;
    }

    void loadWorkspace(token, historyFilters);
  }, [token, profile, historyFilters]);

  async function loadProfile(nextToken: string) {
    try {
      setError(null);
      setStatus("Loading your profile...");

      const response = await apiRequest<{ profile: Profile }>("/api/me", {}, nextToken);
      setToken(nextToken);
      setProfile(response.profile);
      setStatus("Signed in");
    } catch (requestError) {
      window.localStorage.removeItem(sessionStorageKey);
      setToken(null);
      setProfile(null);
      setStatus("Sign in to manage your medicines, reminders, and daily schedule.");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not restore the session."
      );
    }
  }

  async function loadWorkspace(nextToken: string, nextFilters: HistoryFilters) {
    try {
      setWorkspaceError(null);
      setIsWorkspaceLoading(true);

      const [
        medicationsResponse,
        scheduleResponse,
        historyResponse,
        reminderResponse,
        auditResponse
      ] = await Promise.all([
        apiRequest<{ medications: Medication[] }>("/api/medications", {}, nextToken),
        apiRequest<ScheduleResponse>("/api/schedule/today", {}, nextToken),
        apiRequest<HistoryResponse>(buildHistoryPath(nextFilters), {}, nextToken),
        apiRequest<ReminderResponse>("/api/reminders/today", {}, nextToken),
        apiRequest<AuditResponse>("/api/audit-logs?limit=8", {}, nextToken)
      ]);

      setMedications(medicationsResponse.medications);
      setSchedule(scheduleResponse);
      setHistory(historyResponse);
      setReminders(reminderResponse);
      setAuditTrail(auditResponse);
    } catch (requestError) {
      setWorkspaceError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load your medications."
      );
    } finally {
      setIsWorkspaceLoading(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setError(null);
      setStatus("Signing you in...");

      const response = await apiRequest<AuthPayload>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(loginForm)
      });

      window.localStorage.setItem(sessionStorageKey, response.token);
      setToken(response.token);
      setProfile(response.profile);
      setStatus("Signed in");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Sign in failed.");
      setStatus("Sign in to manage your medicines, reminders, and daily schedule.");
    }
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setError(null);
      setStatus("Creating your account...");

      const response = await apiRequest<AuthPayload>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify(signupForm)
      });

      window.localStorage.setItem(sessionStorageKey, response.token);
      setToken(response.token);
      setProfile(response.profile);
      setStatus("Account created");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Sign up failed.");
      setStatus("Create an account to start managing your medicines and reminders.");
    }
  }

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    try {
      setError(null);
      setStatus("Saving profile...");

      const response = await apiRequest<{ profile: Profile }>(
        "/api/me",
        {
          method: "PATCH",
          body: JSON.stringify(profileForm)
        },
        token
      );

      setProfile(response.profile);
      setStatus("Profile updated");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not save profile.");
      setStatus("Signed in");
    }
  }

  function resetMedicationEditor() {
    setEditingMedicationId(null);
    setMedicationError(null);
    setMedicationForm(createDefaultMedicationForm());
  }

  async function handleMedicationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    try {
      setMedicationError(null);
      setStatus(editingMedicationId ? "Updating medication..." : "Saving medication...");

      const isEditing = Boolean(editingMedicationId);
      const payload = {
        ...medicationForm,
        endDate: medicationForm.endDate || null,
        schedule: {
          recurrenceType: medicationForm.schedule.recurrenceType,
          weekdays:
            medicationForm.schedule.recurrenceType === "daily"
              ? []
              : medicationForm.schedule.weekdays,
          times: medicationForm.schedule.times.filter(Boolean)
        }
      };

      await apiRequest<{ medication: Medication }>(
        editingMedicationId
          ? `/api/medications/${editingMedicationId}`
          : "/api/medications",
        {
          method: editingMedicationId ? "PATCH" : "POST",
          body: JSON.stringify(payload)
        },
        token
      );

      resetMedicationEditor();
      await loadWorkspace(token, historyFilters);
      setStatus(isEditing ? "Medication updated" : "Medication saved");
    } catch (requestError) {
      setMedicationError(
        requestError instanceof Error ? requestError.message : "Could not save the medication."
      );
      setStatus("Signed in");
    }
  }

  async function handleArchiveMedication() {
    if (!token || !editingMedicationId) {
      return;
    }

    try {
      setMedicationError(null);
      setStatus("Archiving medication...");

      await apiRequest<{ medication: Medication }>(
        `/api/medications/${editingMedicationId}`,
        {
          method: "DELETE"
        },
        token
      );

      resetMedicationEditor();
      await loadWorkspace(token, historyFilters);
      setStatus("Medication archived");
    } catch (requestError) {
      setMedicationError(
        requestError instanceof Error ? requestError.message : "Could not archive the medication."
      );
      setStatus("Signed in");
    }
  }

  async function handleDoseAction(doseId: string, nextStatus: DoseActionStatus) {
    if (!token || pendingDoseActionIds.includes(doseId)) {
      return;
    }

    const existingEntry = findDoseEntry(schedule, doseId);

    if (!existingEntry) {
      return;
    }

    const previousSchedule = schedule;
    const previousHistory = history;
    const actionTakenAt = new Date().toISOString();

    setPendingDoseActionIds((current) => [...current, doseId]);
    setStatus(
      nextStatus === "completed"
        ? "Recording dose as taken..."
        : nextStatus === "missed"
          ? "Recording dose as missed..."
          : "Recording skipped dose..."
    );
    setWorkspaceError(null);
    setSchedule((current) =>
      current ? applyDoseActionToSchedule(current, existingEntry, nextStatus, actionTakenAt) : current
    );
    setHistory((current) =>
      applyDoseActionToHistory(current, existingEntry, nextStatus, actionTakenAt)
    );

    try {
      await apiRequest<{ dose: DoseEntry }>(
        `/api/doses/${doseId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: nextStatus
          })
        },
        token
      );

      await loadWorkspace(token, historyFilters);
      setStatus(
        nextStatus === "completed"
          ? "Dose marked as taken"
          : nextStatus === "missed"
            ? "Dose marked as missed"
            : "Dose marked as skipped"
      );
    } catch (requestError) {
      setSchedule(previousSchedule);
      setHistory(previousHistory);
      setWorkspaceError(
        requestError instanceof Error ? requestError.message : "Could not update the dose."
      );
      setStatus("Signed in");
    } finally {
      setPendingDoseActionIds((current) => current.filter((id) => id !== doseId));
    }
  }

  async function handleProcessReminders() {
    if (!token || isReminderProcessing) {
      return;
    }

    try {
      setIsReminderProcessing(true);
      setStatus("Running reminder dispatch...");
      setWorkspaceError(null);

      const response = await apiRequest<ReminderProcessResponse>(
        "/api/reminders/process",
        {
          method: "POST"
        },
        token
      );

      setReminders(response.reminders);
      await loadWorkspace(token, historyFilters);
      setStatus(
        response.processed.autoMissed > 0
          ? "Reminder worker ran and auto-marked stale doses as missed"
          : "Reminder worker ran successfully"
      );
    } catch (requestError) {
      setWorkspaceError(
        requestError instanceof Error ? requestError.message : "Could not process reminders."
      );
      setStatus("Signed in");
    } finally {
      setIsReminderProcessing(false);
    }
  }

  async function handleDeviceRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || isDeviceSaving) {
      return;
    }

    try {
      setIsDeviceSaving(true);
      setStatus("Registering reminder-capable device...");
      setWorkspaceError(null);

      await apiRequest<{ device: DeviceEntry; devices: DeviceEntry[] }>(
        "/api/devices/register",
        {
          method: "POST",
          body: JSON.stringify(deviceForm)
        },
        token
      );

      await loadWorkspace(token, historyFilters);
      setStatus("Device token registered");
    } catch (requestError) {
      setWorkspaceError(
        requestError instanceof Error ? requestError.message : "Could not register the device."
      );
      setStatus("Signed in");
    } finally {
      setIsDeviceSaving(false);
    }
  }

  function startEditingMedication(medication: Medication) {
    setEditingMedicationId(medication.id);
    setMedicationError(null);
    setMedicationForm({
      name: medication.name,
      type: medication.type,
      dosage: medication.dosage,
      instructions: medication.instructions,
      reason: medication.reason,
      startDate: medication.startDate,
      endDate: medication.endDate ?? "",
      schedule: {
        recurrenceType: medication.schedule.recurrenceType,
        weekdays:
          medication.schedule.recurrenceType === "daily"
            ? ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
            : medication.schedule.weekdays,
        times: medication.schedule.times
      }
    });
    setStatus(`Editing ${medication.name}`);
  }

  function handleMedicationNameChange(name: string) {
    const matchedMedicine = medicineCatalog.find(
      (medicine) => medicine.name.toLowerCase() === name.trim().toLowerCase()
    );

    setMedicationForm((current) => ({
      ...current,
      name,
      dosage: matchedMedicine && !current.dosage ? matchedMedicine.dosage : current.dosage,
      type: matchedMedicine ? matchedMedicine.type : current.type,
      instructions:
        matchedMedicine && !current.instructions
          ? matchedMedicine.instructions
          : current.instructions,
      reason: matchedMedicine && !current.reason ? matchedMedicine.reason : current.reason
    }));
  }

  function toggleWeekday(weekdayKey: string) {
    setMedicationForm((current) => {
      const isSelected = current.schedule.weekdays.includes(weekdayKey);

      return {
        ...current,
        schedule: {
          ...current.schedule,
          weekdays: isSelected
            ? current.schedule.weekdays.filter((value) => value !== weekdayKey)
            : [...current.schedule.weekdays, weekdayKey]
        }
      };
    });
  }

  function updateTime(index: number, value: string) {
    setMedicationForm((current) => ({
      ...current,
      schedule: {
        ...current.schedule,
        times: current.schedule.times.map((time, timeIndex) =>
          timeIndex === index ? value : time
        )
      }
    }));
  }

  function addTimeInput() {
    setMedicationForm((current) => ({
      ...current,
      schedule: {
        ...current.schedule,
        times: [...current.schedule.times, "21:00"]
      }
    }));
  }

  function removeTimeInput(index: number) {
    setMedicationForm((current) => ({
      ...current,
      schedule: {
        ...current.schedule,
        times: current.schedule.times.filter((_, timeIndex) => timeIndex !== index)
      }
    }));
  }

  function handleLogout() {
    if (token) {
      void apiRequest("/api/auth/logout", { method: "POST" }, token).catch(() => undefined);
    }

    window.localStorage.removeItem(sessionStorageKey);
    setToken(null);
    setProfile(null);
    setActiveTab("overview");
    setMedications([]);
    setSchedule(null);
    setHistory(createEmptyHistory());
    setReminders(createEmptyReminderResponse());
    setAuditTrail(createEmptyAuditResponse());
    setEditingMedicationId(null);
    setMedicationForm(createDefaultMedicationForm());
    setDeviceForm(createDefaultDeviceForm());
    setHistoryFilters({
      medicationId: "all",
      status: "all"
    });
    setPendingDoseActionIds([]);
    setError(null);
    setWorkspaceError(null);
    setMedicationError(null);
    setAuthMode("login");
    setStatus("Sign in to manage your medicines, reminders, and daily schedule.");
  }

  return (
    <main className="app-shell" id="top">
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Daily Care Companion</p>
          <h1>Stay On Track With Your Medicines And Daily Reminders</h1>
          <p className="subtitle">
            Manage your medication schedule, keep your profile up to date, and stay organized
            with timely reminders and a clear daily plan.
          </p>
        </div>

        <div className="hero-chip">
          <span>Medication reminders</span>
          <strong>Today's care plan</strong>
        </div>
      </section>

      {error ? (
        <p className="alert error" role="alert">
          {error}
        </p>
      ) : null}
      {workspaceError ? (
        <p className="alert error" role="alert">
          {workspaceError}
        </p>
      ) : null}
      {medicationError ? (
        <p className="alert error" role="alert">
          {medicationError}
        </p>
      ) : null}
      <p className="alert info" aria-live="polite" role="status">
        {status}
      </p>

      {!profile ? (
        <section className="panel auth-panel">
          <div className="panel-header">
            <h2>{authMode === "login" ? "Sign In" : "Create Account"}</h2>
            <span className="panel-badge">Secure access</span>
          </div>

          <div className="recurrence-switch" role="tablist" aria-label="Authentication mode">
            <button
              aria-selected={authMode === "login"}
              className={authMode === "login" ? "chip-button active" : "chip-button"}
              onClick={() => setAuthMode("login")}
              type="button"
            >
              Sign In
            </button>
            <button
              aria-selected={authMode === "signup"}
              className={authMode === "signup" ? "chip-button active" : "chip-button"}
              onClick={() => setAuthMode("signup")}
              type="button"
            >
              Sign Up
            </button>
          </div>

          {authMode === "login" ? (
            <form className="form-grid" onSubmit={handleLogin}>
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  value={loginForm.email}
                  onChange={(event) =>
                    setLoginForm((current) => ({
                      ...current,
                      email: event.target.value
                    }))
                  }
                />
              </label>

              <label>
                Password
                <input
                  name="password"
                  type="password"
                  value={loginForm.password}
                  onChange={(event) =>
                    setLoginForm((current) => ({
                      ...current,
                      password: event.target.value
                    }))
                  }
                />
              </label>

              <button className="primary-button" type="submit">
                Sign In
              </button>
            </form>
          ) : (
            <form className="form-grid" onSubmit={handleSignup}>
              <label>
                Username
                <input
                  name="username"
                  value={signupForm.username}
                  onChange={(event) =>
                    setSignupForm((current) => ({
                      ...current,
                      username: event.target.value
                    }))
                  }
                />
              </label>

              <label>
                Email
                <input
                  name="email"
                  type="email"
                  value={signupForm.email}
                  onChange={(event) =>
                    setSignupForm((current) => ({
                      ...current,
                      email: event.target.value
                    }))
                  }
                />
              </label>

              <label>
                Password
                <input
                  name="password"
                  type="password"
                  value={signupForm.password}
                  onChange={(event) =>
                    setSignupForm((current) => ({
                      ...current,
                      password: event.target.value
                    }))
                  }
                />
              </label>

              <label>
                Timezone
                <input
                  name="timezone"
                  value={signupForm.timezone}
                  onChange={(event) =>
                    setSignupForm((current) => ({
                      ...current,
                      timezone: event.target.value
                    }))
                  }
                />
              </label>

              <button className="primary-button" type="submit">
                Create Account
              </button>
            </form>
          )}
        </section>
      ) : (
        <>
          <nav aria-label="Primary" className="feature-menu">
            {[
              { key: "overview", label: "Overview" },
              { key: "medications", label: "Medications" },
              { key: "reminders", label: "Reminders" },
              { key: "schedule", label: "Schedule" },
              { key: "history", label: "History" },
              { key: "activity", label: "Activity" },
              { key: "account", label: "Account Settings" }
            ].map((item) => (
              <button
                aria-pressed={activeTab === item.key}
                className={`menu-link${activeTab === item.key ? " active" : ""}`}
                key={item.key}
                onClick={() => setActiveTab(item.key as DashboardTab)}
                type="button"
              >
                {item.label}
              </button>
            ))}
            <div className="menu-spacer" />
            <button className="menu-link menu-link-button" onClick={handleLogout} type="button">
              Sign Out
            </button>
          </nav>

          {activeTab === "overview" ? (
            <>
              <section className="status-grid" aria-label="Daily summary" id="overview">
            <article className="stat-card accent-card">
              <span className="stat-label">Due now</span>
              <strong className="stat-value">{schedule?.summary.dueNow ?? 0}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Queued reminders</span>
              <strong className="stat-value">{reminders.summary.queued}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Delivered reminders</span>
              <strong className="stat-value">{reminders.summary.delivered}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Failed reminders</span>
              <strong className="stat-value">{reminders.summary.failed}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Activity updates</span>
              <strong className="stat-value">{auditTrail.entries.length}</strong>
            </article>
              </section>

              <section className="overview-grid">
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h2>Today's Snapshot</h2>
                      <p className="panel-copy">
                        A quick view of what needs your attention today.
                      </p>
                    </div>
                    <span className="panel-badge">{medications.length} medicines</span>
                  </div>

                  <section className="mini-stat-grid" aria-label="Overview details">
                    <article className="mini-stat">
                      <span>Upcoming doses</span>
                      <strong>{schedule?.summary.upcoming ?? 0}</strong>
                    </article>
                    <article className="mini-stat">
                      <span>Taken today</span>
                      <strong>{schedule?.summary.completed ?? 0}</strong>
                    </article>
                    <article className="mini-stat">
                      <span>Missed today</span>
                      <strong>{schedule?.summary.missed ?? 0}</strong>
                    </article>
                    <article className="mini-stat">
                      <span>Registered devices</span>
                      <strong>{reminders.devices.length}</strong>
                    </article>
                  </section>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h2>Quick Actions</h2>
                      <p className="panel-copy">
                        Open a feature page to manage your medicines, reminders, or account.
                      </p>
                    </div>
                  </div>

                  <div className="button-row">
                    <button className="secondary-button" onClick={() => setActiveTab("medications")} type="button">
                      Manage Medications
                    </button>
                    <button className="secondary-button" onClick={() => setActiveTab("reminders")} type="button">
                      Open Reminders
                    </button>
                    <button className="secondary-button" onClick={() => setActiveTab("schedule")} type="button">
                      View Schedule
                    </button>
                    <button className="secondary-button" onClick={() => setActiveTab("account")} type="button">
                      Account Settings
                    </button>
                  </div>
                </section>
              </section>
            </>
          ) : null}

          {activeTab === "medications" || activeTab === "reminders" || activeTab === "account" ? (
            <section className="workspace-grid" id="workspace">
              {activeTab === "medications" ? (
            <section
              aria-busy={isWorkspaceLoading}
              aria-label="Medication setup"
              className="panel medication-panel"
              id="medications"
            >
              <div className="panel-header">
                <div>
                  <h2>{editingMedicationId ? "Edit Medication" : "Add Medication"}</h2>
                  <p className="panel-copy">
                    Keep medication plans and reminder times current so delivery state and audit
                    logs stay trustworthy.
                  </p>
                </div>
                {editingMedicationId ? (
                  <button
                    className="secondary-button"
                    onClick={resetMedicationEditor}
                    type="button"
                  >
                    Cancel Edit
                  </button>
                ) : (
                  <span className="panel-badge">Reminder-aware schedule builder</span>
                )}
              </div>

              <form className="form-grid" onSubmit={handleMedicationSubmit}>
                <label>
                  Medication name
                  <input
                    list="medicine-suggestions"
                    name="name"
                    value={medicationForm.name}
                    onChange={(event) => handleMedicationNameChange(event.target.value)}
                  />
                </label>

                <datalist id="medicine-suggestions">
                  {medicineSuggestions.map((medicine) => (
                    <option key={medicine.name} value={medicine.name} />
                  ))}
                </datalist>

                <p className="field-hint">
                  Start typing a medicine name like `Paracetamol`, `Dolo 650`, or
                  `Metformin` to prefill common details.
                </p>

                <div className="two-column-grid">
                  <label>
                    Dosage
                    <input
                      name="dosage"
                      placeholder="1 tablet"
                      value={medicationForm.dosage}
                      onChange={(event) =>
                        setMedicationForm((current) => ({
                          ...current,
                          dosage: event.target.value
                        }))
                      }
                    />
                  </label>

                  <label>
                    Type
                    <select
                      name="type"
                      value={medicationForm.type}
                      onChange={(event) =>
                        setMedicationForm((current) => ({
                          ...current,
                          type: event.target.value
                        }))
                      }
                    >
                      <option value="tablet">Tablet</option>
                      <option value="capsule">Capsule</option>
                      <option value="syrup">Syrup</option>
                      <option value="injection">Injection</option>
                    </select>
                  </label>
                </div>

                <div className="two-column-grid">
                  <label>
                    Instructions
                    <input
                      name="instructions"
                      placeholder="After breakfast"
                      value={medicationForm.instructions}
                      onChange={(event) =>
                        setMedicationForm((current) => ({
                          ...current,
                          instructions: event.target.value
                        }))
                      }
                    />
                  </label>

                  <label>
                    Reason
                    <input
                      name="reason"
                      placeholder="Blood pressure support"
                      value={medicationForm.reason}
                      onChange={(event) =>
                        setMedicationForm((current) => ({
                          ...current,
                          reason: event.target.value
                        }))
                      }
                    />
                  </label>
                </div>

                <div className="two-column-grid">
                  <label>
                    Start date
                    <input
                      name="startDate"
                      type="date"
                      value={medicationForm.startDate}
                      onChange={(event) =>
                        setMedicationForm((current) => ({
                          ...current,
                          startDate: event.target.value
                        }))
                      }
                    />
                  </label>

                  <label>
                    End date
                    <input
                      name="endDate"
                      type="date"
                      value={medicationForm.endDate}
                      onChange={(event) =>
                        setMedicationForm((current) => ({
                          ...current,
                          endDate: event.target.value
                        }))
                      }
                    />
                  </label>
                </div>

                <section className="schedule-builder">
                  <div className="section-heading">
                    <h3>Recurrence</h3>
                    <p>Choose daily reminders or only specific weekdays.</p>
                  </div>

                  <div className="recurrence-switch">
                    <button
                      className={
                        medicationForm.schedule.recurrenceType === "daily"
                          ? "chip-button active"
                          : "chip-button"
                      }
                      onClick={() =>
                        setMedicationForm((current) => ({
                          ...current,
                          schedule: {
                            ...current.schedule,
                            recurrenceType: "daily"
                          }
                        }))
                      }
                      type="button"
                    >
                      Daily
                    </button>
                    <button
                      className={
                        medicationForm.schedule.recurrenceType === "selected-weekdays"
                          ? "chip-button active"
                          : "chip-button"
                      }
                      onClick={() =>
                        setMedicationForm((current) => ({
                          ...current,
                          schedule: {
                            ...current.schedule,
                            recurrenceType: "selected-weekdays",
                            weekdays:
                              current.schedule.weekdays.length > 0
                                ? current.schedule.weekdays
                                : ["mon", "wed", "fri"]
                          }
                        }))
                      }
                      type="button"
                    >
                      Selected weekdays
                    </button>
                  </div>

                  {medicationForm.schedule.recurrenceType === "selected-weekdays" ? (
                    <div className="weekday-grid" role="group" aria-label="Weekdays">
                      {weekdayOptions.map((weekday) => {
                        const isActive = medicationForm.schedule.weekdays.includes(weekday.key);

                        return (
                          <button
                            className={isActive ? "weekday-button active" : "weekday-button"}
                            key={weekday.key}
                            onClick={() => toggleWeekday(weekday.key)}
                            type="button"
                          >
                            {weekday.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  <div className="section-heading">
                    <h3>Reminder times</h3>
                    <p>Add one or more dose times in the profile timezone.</p>
                  </div>

                  <div className="time-list">
                    {medicationForm.schedule.times.map((time, index) => (
                      <div className="time-row" key={`${time}-${index}`}>
                        <input
                          aria-label={`Reminder time ${index + 1}`}
                          type="time"
                          value={time}
                          onChange={(event) => updateTime(index, event.target.value)}
                        />
                        <button
                          className="ghost-button"
                          disabled={medicationForm.schedule.times.length === 1}
                          onClick={() => removeTimeInput(index)}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>

                  <button className="secondary-button" onClick={addTimeInput} type="button">
                    Add Another Time
                  </button>
                </section>

                <div className="button-row">
                  <button className="primary-button" type="submit">
                    {editingMedicationId ? "Save Medication Changes" : "Save Medication Plan"}
                  </button>

                  {editingMedicationId ? (
                    <button
                      className="danger-button"
                      onClick={handleArchiveMedication}
                      type="button"
                    >
                      Archive Medication
                    </button>
                  ) : null}
                </div>
              </form>
            </section>
              ) : null}

            <section className="right-column">
              {activeTab === "medications" ? (
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Saved Medication Plans</h2>
                    <p className="panel-copy">
                      Edit a plan to regenerate both dose events and reminder events.
                    </p>
                  </div>
                  <span className="panel-badge">{medications.length} active</span>
                </div>

                {medications.length === 0 ? (
                  <div className="empty-state">
                    <strong>No medicines yet</strong>
                    <p>Create your first medication plan to populate today's schedule.</p>
                  </div>
                ) : (
                  <ul className="medication-list">
                    {medications.map((medication) => (
                      <li className="medication-item" key={medication.id}>
                        <div>
                          <div className="medication-heading">
                            <h3>{medication.name}</h3>
                            <span>{medication.dosage}</span>
                          </div>
                          <p>{summarizeSchedule(medication)}</p>
                          <small>
                            {medication.startDate}
                            {medication.endDate ? ` to ${medication.endDate}` : " onward"}
                          </small>
                        </div>
                        <button
                          className="secondary-button"
                          onClick={() => startEditingMedication(medication)}
                          type="button"
                        >
                          Edit
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              ) : null}

              {activeTab === "reminders" ? (
              <section className="panel reminder-panel" id="reminders">
                <div className="panel-header">
                  <div>
                    <h2>Reminder Center</h2>
                    <p className="panel-copy">
                      Process queued reminders, track delivery state, and register your devices.
                    </p>
                  </div>
                  <button
                    className="primary-button"
                    disabled={isReminderProcessing}
                    onClick={handleProcessReminders}
                    type="button"
                  >
                    {isReminderProcessing ? "Processing..." : "Run Reminder Worker"}
                  </button>
                </div>

                <section className="mini-stat-grid" aria-label="Reminder summary">
                  <article className="mini-stat">
                    <span>Queued</span>
                    <strong>{reminders.summary.queued}</strong>
                  </article>
                  <article className="mini-stat">
                    <span>Sent</span>
                    <strong>{reminders.summary.sent}</strong>
                  </article>
                  <article className="mini-stat">
                    <span>Delivered</span>
                    <strong>{reminders.summary.delivered}</strong>
                  </article>
                  <article className="mini-stat">
                    <span>Failed</span>
                    <strong>{reminders.summary.failed}</strong>
                  </article>
                </section>

                <div className="support-card">
                  <strong>{reminders.devices.length} device registrations</strong>
                  <p>
                    Without a registered device, reminders fall back to in-app delivery.
                    Items older than {reminders.policy.staleAfterMinutes} minutes can be auto-marked
                    missed by the worker.
                  </p>
                </div>

                <form className="form-grid compact-form" onSubmit={handleDeviceRegister}>
                  <label>
                    Device token
                    <input
                      value={deviceForm.token}
                      onChange={(event) =>
                        setDeviceForm((current) => ({
                          ...current,
                          token: event.target.value
                        }))
                      }
                    />
                  </label>

                  <div className="two-column-grid">
                    <label>
                      Device name
                      <input
                        value={deviceForm.deviceName}
                        onChange={(event) =>
                          setDeviceForm((current) => ({
                            ...current,
                            deviceName: event.target.value
                          }))
                        }
                      />
                    </label>

                    <label>
                      Platform
                      <select
                        value={deviceForm.platform}
                        onChange={(event) =>
                          setDeviceForm((current) => ({
                            ...current,
                            platform: event.target.value
                          }))
                        }
                      >
                        <option value="android">Android</option>
                        <option value="ios">iOS</option>
                        <option value="web">Web</option>
                      </select>
                    </label>
                  </div>

                  <button className="secondary-button" disabled={isDeviceSaving} type="submit">
                    {isDeviceSaving ? "Saving device..." : "Register Device Token"}
                  </button>
                </form>

                {reminders.devices.length === 0 ? (
                  <div className="empty-state">
                    <strong>No device tokens registered</strong>
                    <p>Register a device to switch future reminders from in-app to push.</p>
                  </div>
                ) : (
                  <ul className="device-list">
                    {reminders.devices.map((device) => (
                      <li className="device-item" key={device.id}>
                        <div>
                          <strong>{device.deviceName}</strong>
                          <p>
                            {device.platform} · {device.tokenPreview}
                          </p>
                        </div>
                        <small>{formatTimestamp(device.lastSeenAt)}</small>
                      </li>
                    ))}
                  </ul>
                )}

                {reminders.reminders.length === 0 ? (
                  <div className="empty-state">
                    <strong>No reminder events for today</strong>
                    <p>Reminder events appear here once today's dose window exists.</p>
                  </div>
                ) : (
                  <ul className="reminder-list">
                    {reminders.reminders.map((reminder) => (
                      <li className="reminder-item" key={reminder.id}>
                        <div>
                          <div className="history-item-heading">
                            <h3>{reminder.medicationName}</h3>
                            <span>{reminder.scheduledSendTime}</span>
                          </div>
                          <p>{reminder.channel} channel</p>
                          {reminder.providerReference ? (
                            <small>{reminder.providerReference}</small>
                          ) : null}
                        </div>
                        <span className={`status-pill ${reminderStatusTone[reminder.status]}`}>
                          {reminderStatusLabels[reminder.status]}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              ) : null}

              {activeTab === "account" ? (
              <section className="panel" id="account">
                <div className="panel-header">
                  <div>
                    <h2>Profile Settings</h2>
                    <p className="panel-copy">
                      Keep your account details current so reminders stay accurate.
                    </p>
                  </div>
                  <span className="panel-badge">Account</span>
                </div>

                <form className="form-grid" onSubmit={handleProfileSave}>
                  <label>
                    Username
                    <input
                      name="username"
                      value={profileForm.username}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          username: event.target.value
                        }))
                      }
                    />
                  </label>

                  <label>
                    Email
                    <input
                      name="email"
                      type="email"
                      value={profileForm.email}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          email: event.target.value
                        }))
                      }
                    />
                  </label>

                  <label>
                    Timezone
                    <input
                      name="timezone"
                      value={profileForm.timezone}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          timezone: event.target.value
                        }))
                      }
                    />
                  </label>

                  <button className="primary-button" type="submit">
                    Save Profile
                  </button>
                </form>
              </section>
              ) : null}
            </section>
          </section>
          ) : null}

          {activeTab === "schedule" ? (
          <section className="panel schedule-panel" id="schedule">
            <div className="panel-header">
              <div>
                <h2>Today's Schedule</h2>
                <p className="panel-copy">
                  {schedule
                    ? `${schedule.date} in ${schedule.timezone}`
                    : "Your current day view will appear here."}
                </p>
              </div>
              <span className="panel-badge">
                {isWorkspaceLoading ? "Refreshing..." : `${schedule?.summary.total ?? 0} doses`}
              </span>
            </div>

            {schedule && schedule.summary.total === 0 ? (
              <div className="empty-state roomy">
                <strong>No reminders scheduled today</strong>
                <p>Add a medication plan above to generate the daily board.</p>
              </div>
            ) : (
              <div className="schedule-board">
                {scheduleGroupMeta.map((group) => {
                  const entries = schedule?.groups[group.key] ?? [];
                  const isActionable = group.key === "dueNow" || group.key === "upcoming";

                  return (
                    <section className="schedule-column" key={group.key}>
                      <div className="schedule-column-header">
                        <div>
                          <h3>{group.title}</h3>
                          <p>{group.description}</p>
                        </div>
                        <strong>{entries.length}</strong>
                      </div>

                      {entries.length === 0 ? (
                        <div className="column-empty">
                          <span>No doses here yet.</span>
                        </div>
                      ) : (
                        <ul className="dose-list">
                          {entries.map((entry) => {
                            const isPending = pendingDoseActionIds.includes(entry.id);

                            return (
                              <li className="dose-item" key={entry.id}>
                                <div className="dose-copy">
                                  <div className="dose-topline">
                                    <h4>{entry.medicationName}</h4>
                                    <time>{entry.scheduledTime}</time>
                                  </div>
                                  <p>{entry.dosage}</p>
                                  {entry.instructions ? <small>{entry.instructions}</small> : null}
                                  <small className="supporting-line">{formatReminderSupportText(entry)}</small>
                                  {!isActionable ? (
                                    <div className="dose-meta">
                                      <span className={`status-pill ${entry.status}`}>
                                        {formatDoseStatusLabel(entry.status)}
                                      </span>
                                      <span>{formatTimestamp(entry.actionTakenAt)}</span>
                                    </div>
                                  ) : null}
                                </div>

                                {isActionable ? (
                                  <div className="dose-actions" aria-label="Dose actions">
                                    {doseActionOptions.map((action) => (
                                      <button
                                        className={action.className}
                                        disabled={isPending}
                                        key={action.status}
                                        onClick={() => handleDoseAction(entry.id, action.status)}
                                        type="button"
                                      >
                                        {isPending ? "Saving..." : action.label}
                                      </button>
                                    ))}
                                  </div>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </section>
          ) : null}

          {activeTab === "history" || activeTab === "activity" ? (
          <section className="insights-grid">
            {activeTab === "history" ? (
            <section className="panel history-panel" id="history">
              <div className="panel-header history-header">
                <div>
                  <h2>Dose History</h2>
                  <p className="panel-copy">
                    Filter by medication or outcome to review adherence details quickly.
                  </p>
                </div>

                <div className="history-filters">
                  <label>
                    Medication
                    <select
                      value={historyFilters.medicationId}
                      onChange={(event) =>
                        setHistoryFilters((current) => ({
                          ...current,
                          medicationId: event.target.value
                        }))
                      }
                    >
                      <option value="all">All medications</option>
                      {medications.map((medication) => (
                        <option key={medication.id} value={medication.id}>
                          {medication.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Outcome
                    <select
                      value={historyFilters.status}
                      onChange={(event) =>
                        setHistoryFilters((current) => ({
                          ...current,
                          status: event.target.value as HistoryStatusFilter
                        }))
                      }
                    >
                      {historyStatusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <section className="history-summary-grid" aria-label="History summary">
                <article className="history-stat">
                  <span>Taken</span>
                  <strong>{history.summary.completed}</strong>
                </article>
                <article className="history-stat">
                  <span>Missed</span>
                  <strong>{history.summary.missed}</strong>
                </article>
                <article className="history-stat">
                  <span>Skipped</span>
                  <strong>{history.summary.skipped}</strong>
                </article>
                <article className="history-stat">
                  <span>Total</span>
                  <strong>{history.summary.total}</strong>
                </article>
              </section>

              {history.history.length === 0 ? (
                <div className="empty-state roomy">
                  <strong>No history matches these filters</strong>
                  <p>Mark a dose as taken, missed, or skipped to populate this timeline.</p>
                </div>
              ) : (
                <div className="history-timeline">
                  {historyGroups.map(([date, entries]) => (
                    <section className="history-day" key={date}>
                      <div className="history-day-header">
                        <h3>{date}</h3>
                        <span>{entries.length} outcomes</span>
                      </div>

                      <ul className="history-list">
                        {entries.map((entry) => (
                          <li className="history-item" key={entry.id}>
                            <div>
                              <div className="history-item-heading">
                                <h4>{entry.medicationName}</h4>
                                <span>{entry.scheduledTime}</span>
                              </div>
                              <p>{entry.dosage}</p>
                              {entry.reason ? <small>{entry.reason}</small> : null}
                            </div>

                            <div className="history-item-meta">
                              <span className={`status-pill ${entry.status}`}>
                                {formatDoseStatusLabel(entry.status)}
                              </span>
                              <span>{formatTimestamp(entry.actionTakenAt)}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </section>
            ) : null}

            {activeTab === "activity" ? (
            <section className="panel audit-panel" id="activity">
              <div className="panel-header">
                <div>
                  <h2>Activity Timeline</h2>
                  <p className="panel-copy">
                    Review recent account and reminder activity in one place.
                  </p>
                </div>
                <span className="panel-badge">Recent updates</span>
              </div>

              <div className="support-card">
                <strong>What you can review here</strong>
                <p>
                  Sign-ins, profile updates, medication changes, device registrations, and
                  reminder processing updates appear in this timeline.
                </p>
              </div>

              {auditTrail.entries.length === 0 ? (
                <div className="empty-state">
                  <strong>No audit events yet</strong>
                  <p>Actions like login, device registration, and reminder dispatch appear here.</p>
                </div>
              ) : (
                <ul className="audit-list">
                  {auditTrail.entries.map((entry) => (
                    <li className="audit-item" key={entry.id}>
                      <div>
                        <strong>{summarizeAuditEntry(entry)}</strong>
                        <p>{entry.type}</p>
                      </div>
                      <small>{formatTimestamp(entry.recordedAt)}</small>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            ) : null}
          </section>
          ) : null}
        </>
      )}

      <section className="footer-note">
        <strong>Tip:</strong> Keep your profile timezone current so medication times, reminders,
        and today's schedule stay accurate wherever you are.
      </section>
    </main>
  );
}
