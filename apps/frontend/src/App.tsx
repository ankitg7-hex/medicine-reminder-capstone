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

const sessionStorageKey = "medicine-reminder-demo-token";

const upcomingDoses = [
  { id: 1, label: "Vitamin D", time: "08:00 AM", dosage: "1 capsule" },
  { id: 2, label: "Blood Pressure Tablet", time: "09:00 PM", dosage: "1 tablet" }
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

export function App() {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState("Checking session...");
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    const savedToken = window.localStorage.getItem(sessionStorageKey);

    if (!savedToken) {
      setStatus("Sign in with a demo profile to continue.");
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
      setStatus("Sign in with a demo profile to continue.");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not restore the session."
      );
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

  function handleLogout() {
    window.localStorage.removeItem(sessionStorageKey);
    setToken(null);
    setProfile(null);
    setError(null);
    setStatus("Sign in with a demo profile to continue.");
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Milestone 2</p>
        <h1>Medicine Reminder Auth Foundation</h1>
        <p className="subtitle">
          A React + Node.js starter with demo sign-in, protected profile loading,
          and a small daily overview to anchor the rest of the app.
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
              <span className="stat-label">Upcoming Today</span>
              <strong className="stat-value">2</strong>
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
                <h2>Hello World Schedule</h2>
                <span className="panel-badge">Demo data</span>
              </div>

              <ul className="dose-list">
                {upcomingDoses.map((dose) => (
                  <li className="dose-item" key={dose.id}>
                    <div>
                      <h3>{dose.label}</h3>
                      <p>{dose.dosage}</p>
                    </div>
                    <time>{dose.time}</time>
                  </li>
                ))}
              </ul>
            </section>
          </section>
        </>
      )}

      <section className="footer-note">
        <strong>Backend endpoints:</strong> `POST /api/auth/demo-login`, `GET /api/me`,
        `PATCH /api/me`
      </section>
    </main>
  );
}
