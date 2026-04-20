import { FormEvent, useEffect, useState } from "react";

type Profile = {
  id: string;
  fullName: string;
  email: string;
  timezone: string;
};

type Medication = {
  id: string;
  name: string;
  dosage: string;
  type: string;
  instructions: string;
  reason: string;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

type AuthPayload = {
  token: string;
  profile: Profile;
};

type MedicationFormState = {
  name: string;
  dosage: string;
  type: string;
  instructions: string;
  reason: string;
  startDate: string;
  endDate: string;
};

const sessionStorageKey = "medicine-reminder-demo-token";

const emptyMedicationForm: MedicationFormState = {
  name: "",
  dosage: "",
  type: "tablet",
  instructions: "",
  reason: "",
  startDate: "2026-04-20",
  endDate: ""
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
    const errorBody = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(errorBody.error || "Request failed");
  }

  return response.json() as Promise<T>;
}

function toMedicationForm(medication: Medication): MedicationFormState {
  return {
    name: medication.name,
    dosage: medication.dosage,
    type: medication.type,
    instructions: medication.instructions,
    reason: medication.reason,
    startDate: medication.startDate,
    endDate: medication.endDate
  };
}

export function App() {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [status, setStatus] = useState("Checking session...");
  const [error, setError] = useState<string | null>(null);
  const [isSavingMedication, setIsSavingMedication] = useState(false);
  const [selectedMedicationId, setSelectedMedicationId] = useState<string | null>(null);
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
  const [medicationForm, setMedicationForm] =
    useState<MedicationFormState>(emptyMedicationForm);

  const medicineSuggestions = medicineCatalog.filter((medicine) =>
    medicine.name.toLowerCase().includes(medicationForm.name.trim().toLowerCase())
  );

  useEffect(() => {
    const savedToken = window.localStorage.getItem(sessionStorageKey);

    if (!savedToken) {
      setStatus("Sign in with a demo profile to continue.");
      return;
    }

    void restoreSession(savedToken);
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

  async function restoreSession(nextToken: string) {
    try {
      setError(null);
      setStatus("Loading your profile...");

      const profileResponse = await apiRequest<{ profile: Profile }>(
        "/api/me",
        {},
        nextToken
      );
      const medicationResponse = await apiRequest<{ medications: Medication[] }>(
        "/api/medications",
        {},
        nextToken
      );

      setToken(nextToken);
      setProfile(profileResponse.profile);
      setMedications(medicationResponse.medications);
      setStatus("Signed in");
    } catch (requestError) {
      window.localStorage.removeItem(sessionStorageKey);
      setToken(null);
      setProfile(null);
      setMedications([]);
      setSelectedMedicationId(null);
      setMedicationForm(emptyMedicationForm);
      setStatus("Sign in with a demo profile to continue.");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not restore the session."
      );
    }
  }

  async function loadMedications(activeToken: string) {
    const response = await apiRequest<{ medications: Medication[] }>(
      "/api/medications",
      {},
      activeToken
    );
    setMedications(response.medications);
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
      setSelectedMedicationId(null);
      setMedicationForm(emptyMedicationForm);
      await loadMedications(response.token);
      setStatus("Signed in");
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Demo login failed."
      );
      setStatus("Sign in with a demo profile to continue.");
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

  async function handleMedicationSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    try {
      setError(null);
      setIsSavingMedication(true);
      setStatus(selectedMedicationId ? "Updating medication..." : "Creating medication...");

      const path = selectedMedicationId
        ? `/api/medications/${selectedMedicationId}`
        : "/api/medications";
      const method = selectedMedicationId ? "PATCH" : "POST";

      await apiRequest<{ medication: Medication }>(
        path,
        {
          method,
          body: JSON.stringify(medicationForm)
        },
        token
      );

      await loadMedications(token);
      setMedicationForm(emptyMedicationForm);
      setSelectedMedicationId(null);
      setStatus(selectedMedicationId ? "Medication updated" : "Medication created");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not save medication."
      );
      setStatus("Signed in");
    } finally {
      setIsSavingMedication(false);
    }
  }

  async function handleArchiveMedication() {
    if (!token || !selectedMedicationId) {
      return;
    }

    try {
      setError(null);
      setStatus("Archiving medication...");

      await apiRequest<{ medication: Medication }>(
        `/api/medications/${selectedMedicationId}`,
        {
          method: "DELETE"
        },
        token
      );

      await loadMedications(token);
      setSelectedMedicationId(null);
      setMedicationForm(emptyMedicationForm);
      setStatus("Medication archived");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not archive medication."
      );
      setStatus("Signed in");
    }
  }

  function handleMedicationSelect(medication: Medication) {
    setSelectedMedicationId(medication.id);
    setMedicationForm(toMedicationForm(medication));
    setStatus(`Editing ${medication.name}`);
  }

  function handleMedicationReset() {
    setSelectedMedicationId(null);
    setMedicationForm(emptyMedicationForm);
    setStatus("Ready to add a new medication.");
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

  function handleLogout() {
    window.localStorage.removeItem(sessionStorageKey);
    setToken(null);
    setProfile(null);
    setMedications([]);
    setSelectedMedicationId(null);
    setMedicationForm(emptyMedicationForm);
    setError(null);
    setStatus("Sign in with a demo profile to continue.");
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Milestone 3</p>
        <h1>Medication CRUD Foundation</h1>
        <p className="subtitle">
          The app now supports demo sign-in, profile updates, and starter
          medication create, edit, list, and archive flows backed by Node.js APIs.
        </p>
      </section>

      {error ? <p className="alert error">{error}</p> : null}
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
          <section className="status-grid" aria-label="Daily summary">
            <article className="stat-card">
              <span className="stat-label">Active Medications</span>
              <strong className="stat-value">{medications.length}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Signed In As</span>
              <strong className="stat-value compact">{profile.fullName}</strong>
            </article>
            <article className="stat-card">
              <span className="stat-label">Timezone</span>
              <strong className="stat-value compact">{profile.timezone}</strong>
            </article>
          </section>

          <section className="content-grid">
            <section className="panel">
              <div className="panel-header">
                <h2>Profile Settings</h2>
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

            <section className="panel">
              <div className="panel-header">
                <h2>{selectedMedicationId ? "Edit Medication" : "Add Medication"}</h2>
                {selectedMedicationId ? (
                  <button
                    className="secondary-button"
                    onClick={handleMedicationReset}
                    type="button"
                  >
                    New Medication
                  </button>
                ) : (
                  <span className="panel-badge">CRUD ready</span>
                )}
              </div>

              <form className="form-grid" onSubmit={handleMedicationSave}>
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
                  `Metformin` to see suggestions and autofill common details.
                </p>

                <label>
                  Dosage
                  <input
                    name="dosage"
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

                <label>
                  Instructions
                  <input
                    name="instructions"
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
                    value={medicationForm.reason}
                    onChange={(event) =>
                      setMedicationForm((current) => ({
                        ...current,
                        reason: event.target.value
                      }))
                    }
                  />
                </label>

                <div className="date-grid">
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

                <div className="button-row">
                  <button className="primary-button" disabled={isSavingMedication} type="submit">
                    {selectedMedicationId ? "Save Changes" : "Create Medication"}
                  </button>

                  {selectedMedicationId ? (
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
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>Medication List</h2>
              <span className="panel-badge">{medications.length} active</span>
            </div>

            {medications.length === 0 ? (
              <p className="empty-state">
                No medications yet. Add your first medication to start the CRUD
                workflow.
              </p>
            ) : (
              <ul className="dose-list">
                {medications.map((medication) => (
                  <li className="dose-item medication-item" key={medication.id}>
                    <div>
                      <h3>{medication.name}</h3>
                      <p>
                        {medication.dosage} | {medication.type}
                      </p>
                      <p>
                        {medication.instructions || "No instructions"} | Starts{" "}
                        {medication.startDate}
                      </p>
                    </div>

                    <div className="medication-actions">
                      <span className="status-pill">{medication.status}</span>
                      <button
                        className="secondary-button"
                        onClick={() => handleMedicationSelect(medication)}
                        type="button"
                      >
                        Edit
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <section className="footer-note">
        <strong>Backend endpoints:</strong> `GET/POST /api/medications`,
        `GET/PATCH/DELETE /api/medications/:id`, `POST /api/auth/demo-login`,
        `GET /api/me`, `PATCH /api/me`
      </section>
    </main>
  );
}
