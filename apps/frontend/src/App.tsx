import { FormEvent, useEffect, useState } from "react";

type Profile = {
  id: string;
  fullName: string;
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

type DoseEntry = {
  id: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  instructions: string;
  reason: string;
  scheduledAt: string;
  scheduledTime: string;
  status: string;
};

type ScheduleGroupKey = "dueNow" | "upcoming" | "completed" | "missed";

type ScheduleResponse = {
  date: string;
  timezone: string;
  summary: Record<ScheduleGroupKey | "total", number>;
  groups: Record<ScheduleGroupKey, DoseEntry[]>;
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

const sessionStorageKey = "medicine-reminder-demo-token";

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
    description: "Doses scheduled for now or already overdue."
  },
  {
    key: "upcoming",
    title: "Upcoming",
    description: "Later today so the next doses are easy to scan."
  },
  {
    key: "completed",
    title: "Completed",
    description: "Ready for milestone 5 dose actions."
  },
  {
    key: "missed",
    title: "Missed",
    description: "Held for future adherence tracking."
  }
];

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

export function App() {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState("Checking session...");
  const [error, setError] = useState<string | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [medicationError, setMedicationError] = useState<string | null>(null);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false);
  const [editingMedicationId, setEditingMedicationId] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState({
    fullName: "Ananya Rao",
    email: "ananya@example.com",
    timezone: "Asia/Calcutta"
  });
  const [profileForm, setProfileForm] = useState({
    fullName: "",
    email: "",
    timezone: ""
  });
  const [medicationForm, setMedicationForm] = useState<MedicationFormState>(
    createDefaultMedicationForm()
  );
  const [medications, setMedications] = useState<Medication[]>([]);
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);

  const medicineSuggestions = medicineCatalog.filter((medicine) =>
    medicine.name.toLowerCase().includes(medicationForm.name.trim().toLowerCase())
  );

  useEffect(() => {
    const savedToken = window.localStorage.getItem(sessionStorageKey);

    if (!savedToken) {
      setStatus("Sign in with a demo profile to set up medication schedules.");
      return;
    }

    void loadProfile(savedToken);
  }, []);

  useEffect(() => {
    if (!profile) {
      return;
    }

    setProfileForm({
      fullName: profile.fullName,
      email: profile.email,
      timezone: profile.timezone
    });
  }, [profile]);

  useEffect(() => {
    if (!token || !profile) {
      return;
    }

    void loadWorkspace(token);
  }, [token, profile]);

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
      setStatus("Sign in with a demo profile to set up medication schedules.");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not restore the session."
      );
    }
  }

  async function loadWorkspace(nextToken: string) {
    try {
      setWorkspaceError(null);
      setIsWorkspaceLoading(true);

      const [medicationsResponse, scheduleResponse] = await Promise.all([
        apiRequest<{ medications: Medication[] }>("/api/medications", {}, nextToken),
        apiRequest<ScheduleResponse>("/api/schedule/today", {}, nextToken)
      ]);

      setMedications(medicationsResponse.medications);
      setSchedule(scheduleResponse);
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

      const response = await apiRequest<AuthPayload>("/api/auth/demo-login", {
        method: "POST",
        body: JSON.stringify(loginForm)
      });

      window.localStorage.setItem(sessionStorageKey, response.token);
      setToken(response.token);
      setProfile(response.profile);
      setStatus("Signed in");
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Demo login failed."
      );
      setStatus("Sign in with a demo profile to set up medication schedules.");
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
      setError(
        requestError instanceof Error ? requestError.message : "Could not save profile."
      );
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
      await loadWorkspace(token);
      setStatus(editingMedicationId ? "Medication updated" : "Medication saved");
    } catch (requestError) {
      setMedicationError(
        requestError instanceof Error
          ? requestError.message
          : "Could not save the medication."
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
      await loadWorkspace(token);
      setStatus("Medication archived");
    } catch (requestError) {
      setMedicationError(
        requestError instanceof Error
          ? requestError.message
          : "Could not archive the medication."
      );
      setStatus("Signed in");
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
      dosage:
        matchedMedicine && !current.dosage ? matchedMedicine.dosage : current.dosage,
      type: matchedMedicine ? matchedMedicine.type : current.type,
      instructions:
        matchedMedicine && !current.instructions
          ? matchedMedicine.instructions
          : current.instructions,
      reason:
        matchedMedicine && !current.reason ? matchedMedicine.reason : current.reason
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
    window.localStorage.removeItem(sessionStorageKey);
    setToken(null);
    setProfile(null);
    setMedications([]);
    setSchedule(null);
    setEditingMedicationId(null);
    setMedicationForm(createDefaultMedicationForm());
    setError(null);
    setWorkspaceError(null);
    setMedicationError(null);
    setStatus("Sign in with a demo profile to set up medication schedules.");
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Milestone 4</p>
          <h1>Medicine Scheduling And Today&apos;s Dose Board</h1>
          <p className="subtitle">
            Create daily or selected-weekday reminder plans, save multiple dose
            times, and preview today&apos;s schedule in one place.
          </p>
        </div>

        <div className="hero-chip">
          <span>Rolling 7-day generation</span>
          <strong>Timezone-aware</strong>
        </div>
      </section>

      {error ? <p className="alert error">{error}</p> : null}
      {workspaceError ? <p className="alert error">{workspaceError}</p> : null}
      {medicationError ? <p className="alert error">{medicationError}</p> : null}
      <p className="alert info">{status}</p>

      {!profile ? (
        <section className="panel auth-panel">
          <div className="panel-header">
            <h2>Demo Sign In</h2>
            <span className="panel-badge">Protected flow</span>
          </div>

          <form className="form-grid" onSubmit={handleLogin}>
            <label>
              Full name
              <input
                name="fullName"
                value={loginForm.fullName}
                onChange={(event) =>
                  setLoginForm((current) => ({
                    ...current,
                    fullName: event.target.value
                  }))
                }
              />
            </label>

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
              Timezone
              <input
                name="timezone"
                value={loginForm.timezone}
                onChange={(event) =>
                  setLoginForm((current) => ({
                    ...current,
                    timezone: event.target.value
                  }))
                }
              />
            </label>

            <button className="primary-button" type="submit">
              Continue With Demo Profile
            </button>
          </form>
        </section>
      ) : (
        <>
          <section className="status-grid" aria-label="Scheduling summary">
            <article className="stat-card accent-card">
              <span className="stat-label">Due now</span>
              <strong className="stat-value">{schedule?.summary.dueNow ?? 0}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Upcoming today</span>
              <strong className="stat-value">{schedule?.summary.upcoming ?? 0}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Medication plans</span>
              <strong className="stat-value">{medications.length}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Timezone</span>
              <strong className="stat-value compact">{profile.timezone}</strong>
            </article>
          </section>

          <section className="workspace-grid">
            <section className="panel medication-panel">
              <div className="panel-header">
                <div>
                  <h2>{editingMedicationId ? "Edit Medication" : "Add Medication"}</h2>
                  <p className="panel-copy">
                    Set treatment dates, recurrence, and one or more daily reminder
                    times.
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
                  <span className="panel-badge">Schedule builder</span>
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

            <section className="right-column">
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Saved Medication Plans</h2>
                    <p className="panel-copy">
                      Edit a plan to regenerate the next seven days of doses.
                    </p>
                  </div>
                  <span className="panel-badge">{medications.length} active</span>
                </div>

                {medications.length === 0 ? (
                  <div className="empty-state">
                    <strong>No medicines yet</strong>
                    <p>Create your first medication plan to populate today&apos;s schedule.</p>
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

              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Profile Settings</h2>
                    <p className="panel-copy">
                      Timezone changes regenerate the reminder window.
                    </p>
                  </div>
                  <button className="secondary-button" onClick={handleLogout} type="button">
                    Sign Out
                  </button>
                </div>

                <form className="form-grid" onSubmit={handleProfileSave}>
                  <label>
                    Full name
                    <input
                      name="fullName"
                      value={profileForm.fullName}
                      onChange={(event) =>
                        setProfileForm((current) => ({
                          ...current,
                          fullName: event.target.value
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
            </section>
          </section>

          <section className="panel schedule-panel">
            <div className="panel-header">
              <div>
                <h2>Today&apos;s Schedule</h2>
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
                          {entries.map((entry) => (
                            <li className="dose-item" key={entry.id}>
                              <div>
                                <h4>{entry.medicationName}</h4>
                                <p>{entry.dosage}</p>
                                {entry.instructions ? <small>{entry.instructions}</small> : null}
                              </div>
                              <time>{entry.scheduledTime}</time>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      <section className="footer-note">
        <strong>Backend endpoints:</strong> `GET /api/medications`, `POST /api/medications`,
        `PATCH/DELETE /api/medications/:id`, `GET /api/medications?includeArchived=true`,
        `GET /api/schedule/today`
      </section>
    </main>
  );
}
