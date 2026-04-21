import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  });
}

function baseDose(status = "pending") {
  return {
    id: "dose-1",
    medicationId: "med-1",
    medicationName: "Vitamin D",
    dosage: "1 capsule",
    instructions: "After breakfast",
    reason: "Bone health",
    scheduledAt: "2026-04-20T02:30:00.000Z",
    scheduledDate: "2026-04-20",
    scheduledTime: "8:00 AM",
    status,
    actionTakenAt: status === "pending" ? null : "2026-04-20T02:35:00.000Z",
    notes: null,
    reminder: {
      id: "rem-1",
      scheduledSendAt: "2026-04-20T02:30:00.000Z",
      scheduledSendTime: "8:00 AM",
      status: "queued",
      channel: "in-app",
      providerReference: null,
      sentAt: null,
      deliveredAt: null,
      failedAt: null
    }
  };
}

function emptySchedule() {
  return {
    date: "2026-04-20",
    timezone: "Asia/Calcutta",
    summary: {
      dueNow: 0,
      upcoming: 0,
      completed: 0,
      missed: 0,
      skipped: 0,
      total: 0
    },
    groups: {
      dueNow: [],
      upcoming: [],
      completed: [],
      missed: [],
      skipped: []
    }
  };
}

function emptyHistory() {
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

function emptyReminders() {
  return {
    date: "2026-04-20",
    timezone: "Asia/Calcutta",
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

function emptyAudit() {
  return {
    entries: []
  };
}

function baseMedication() {
  return {
    id: "med-1",
    name: "Vitamin D",
    dosage: "1 capsule",
    type: "capsule",
    instructions: "After breakfast",
    reason: "Bone health",
    startDate: "2026-04-20",
    endDate: null,
    status: "active",
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z",
    archivedAt: null,
    schedule: {
      id: "schedule-1",
      recurrenceType: "daily",
      weekdays: [],
      times: ["08:00"],
      active: true
    }
  };
}

describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the demo sign in flow", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: /reminder delivery, release guardrails, and final mvp polish/i
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /skip to workspace/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue with demo profile/i })
    ).toBeInTheDocument();
  });

  it("loads schedule, reminders, and release panels from a saved session", async () => {
    window.localStorage.setItem("medicine-reminder-demo-token", "demo-token");

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/me") {
        return jsonResponse({
          profile: {
            id: "demo-user",
            fullName: "Ananya Rao",
            email: "ananya@example.com",
            timezone: "Asia/Calcutta"
          }
        });
      }

      if (url === "/api/medications") {
        return jsonResponse({
          medications: [baseMedication()]
        });
      }

      if (url === "/api/schedule/today") {
        return jsonResponse({
          ...emptySchedule(),
          summary: {
            dueNow: 1,
            upcoming: 0,
            completed: 0,
            missed: 0,
            skipped: 0,
            total: 1
          },
          groups: {
            dueNow: [baseDose()],
            upcoming: [],
            completed: [],
            missed: [],
            skipped: []
          }
        });
      }

      if (url === "/api/history") {
        return jsonResponse(emptyHistory());
      }

      if (url === "/api/reminders/today") {
        return jsonResponse({
          ...emptyReminders(),
          summary: {
            queued: 1,
            sent: 0,
            delivered: 0,
            failed: 0,
            total: 1
          },
          reminders: [
            {
              id: "rem-1",
              doseEventId: "dose-1",
              medicationId: "med-1",
              medicationName: "Vitamin D",
              scheduledSendAt: "2026-04-20T02:30:00.000Z",
              scheduledSendTime: "8:00 AM",
              status: "queued",
              channel: "in-app",
              providerReference: null,
              sentAt: null,
              deliveredAt: null,
              failedAt: null
            }
          ]
        });
      }

      if (url === "/api/audit-logs?limit=8") {
        return jsonResponse({
          entries: [
            {
              id: "audit-1",
              type: "session.demo_login",
              userId: "demo-user",
              details: {},
              recordedAt: "2026-04-20T02:00:00.000Z"
            }
          ]
        });
      }

      return jsonResponse({ error: "Not found" }, 404);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(await screen.findByRole("button", { name: /sign out/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /reminder center/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /release readiness/i })).toBeInTheDocument();
    expect(screen.getAllByText(/queued reminders/i).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("8:00 AM")).length).toBeGreaterThan(0);
  });

  it("registers a device and processes the reminder worker", async () => {
    let reminderBody: any = {
      ...emptyReminders(),
      summary: {
        queued: 1,
        sent: 0,
        delivered: 0,
        failed: 0,
        total: 1
      },
      reminders: [
        {
          id: "rem-1",
          doseEventId: "dose-1",
          medicationId: "med-1",
          medicationName: "Vitamin D",
          scheduledSendAt: "2026-04-20T02:30:00.000Z",
          scheduledSendTime: "8:00 AM",
          status: "queued",
          channel: "in-app",
          providerReference: null,
          sentAt: null,
          deliveredAt: null,
          failedAt: null
        }
      ]
    };
    let auditBody: any = emptyAudit();

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/auth/demo-login") {
        return jsonResponse({
          token: "demo-token",
          profile: {
            id: "demo-user",
            fullName: "Ananya Rao",
            email: "ananya@example.com",
            timezone: "Asia/Calcutta"
          }
        });
      }

      if (url === "/api/medications") {
        return jsonResponse({
          medications: [baseMedication()]
        });
      }

      if (url === "/api/schedule/today") {
        return jsonResponse({
          ...emptySchedule(),
          summary: {
            dueNow: 1,
            upcoming: 0,
            completed: 0,
            missed: 0,
            skipped: 0,
            total: 1
          },
          groups: {
            dueNow: [baseDose()],
            upcoming: [],
            completed: [],
            missed: [],
            skipped: []
          }
        });
      }

      if (url === "/api/history") {
        return jsonResponse(emptyHistory());
      }

      if (url === "/api/reminders/today") {
        return jsonResponse(reminderBody);
      }

      if (url === "/api/audit-logs?limit=8") {
        return jsonResponse(auditBody);
      }

      if (url === "/api/devices/register" && init?.method === "POST") {
        reminderBody = {
          ...reminderBody,
          devices: [
            {
              id: "device-1",
              deviceName: "Ananya's Pixel",
              platform: "android",
              tokenPreview: "...ken001",
              createdAt: "2026-04-20T02:00:00.000Z",
              lastSeenAt: "2026-04-20T02:00:00.000Z"
            }
          ],
          reminders: reminderBody.reminders.map((entry: any) => ({
            ...entry,
            channel: "push"
          }))
        };
        auditBody = {
          entries: [
            {
              id: "audit-2",
              type: "device.registered",
              userId: "demo-user",
              details: {},
              recordedAt: "2026-04-20T02:00:00.000Z"
            }
          ]
        };

        return jsonResponse({
          device: reminderBody.devices[0],
          devices: reminderBody.devices
        }, 201);
      }

      if (url === "/api/reminders/process" && init?.method === "POST") {
        reminderBody = {
          ...reminderBody,
          summary: {
            queued: 0,
            sent: 1,
            delivered: 0,
            failed: 0,
            total: 1
          },
          reminders: reminderBody.reminders.map((entry: any) => ({
            ...entry,
            status: "sent",
            providerReference: "mock-push:rem-1",
            sentAt: "2026-04-20T02:30:00.000Z"
          }))
        };
        auditBody = {
          entries: [
            {
              id: "audit-3",
              type: "reminder.worker_processed",
              userId: "demo-user",
              details: {},
              recordedAt: "2026-04-20T02:30:00.000Z"
            }
          ]
        };

        return jsonResponse({
          processed: {
            queued: 1,
            sent: 1,
            delivered: 0,
            failed: 0,
            autoMissed: 0
          },
          reminders: reminderBody
        });
      }

      return jsonResponse({ error: "Not found" }, 404);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /continue with demo profile/i }));

    const registerButton = await screen.findByRole("button", { name: /register device token/i });
    fireEvent.click(registerButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/devices/register",
        expect.objectContaining({
          method: "POST"
        })
      );
    });

    expect(await screen.findByText(/ananya's pixel/i)).toBeInTheDocument();

    const processButton = await screen.findByRole("button", { name: /run reminder worker/i });
    fireEvent.click(processButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/reminders/process",
        expect.objectContaining({
          method: "POST"
        })
      );
    });

    expect(await screen.findByText(/reminder worker ran successfully/i)).toBeInTheDocument();
  });

  it("marks a dose as taken and refreshes the board", async () => {
    let scheduleBody: any = {
      ...emptySchedule(),
      summary: {
        dueNow: 1,
        upcoming: 0,
        completed: 0,
        missed: 0,
        skipped: 0,
        total: 1
      },
      groups: {
        dueNow: [baseDose()],
        upcoming: [],
        completed: [],
        missed: [],
        skipped: []
      }
    };
    let historyBody: any = emptyHistory();

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/auth/demo-login") {
        return jsonResponse({
          token: "demo-token",
          profile: {
            id: "demo-user",
            fullName: "Ananya Rao",
            email: "ananya@example.com",
            timezone: "Asia/Calcutta"
          }
        });
      }

      if (url === "/api/medications") {
        return jsonResponse({
          medications: [baseMedication()]
        });
      }

      if (url === "/api/schedule/today") {
        return jsonResponse(scheduleBody);
      }

      if (url === "/api/history") {
        return jsonResponse(historyBody);
      }

      if (url === "/api/reminders/today") {
        return jsonResponse(emptyReminders());
      }

      if (url === "/api/audit-logs?limit=8") {
        return jsonResponse(emptyAudit());
      }

      if (url === "/api/doses/dose-1" && init?.method === "PATCH") {
        scheduleBody = {
          ...scheduleBody,
          summary: {
            dueNow: 0,
            upcoming: 0,
            completed: 1,
            missed: 0,
            skipped: 0,
            total: 1
          },
          groups: {
            dueNow: [],
            upcoming: [],
            completed: [{ ...baseDose("completed"), reminder: baseDose("completed").reminder }],
            missed: [],
            skipped: []
          }
        };
        historyBody = {
          summary: {
            completed: 1,
            missed: 0,
            skipped: 0,
            total: 1
          },
          history: scheduleBody.groups.completed
        };

        return jsonResponse({
          dose: scheduleBody.groups.completed[0]
        });
      }

      return jsonResponse({ error: "Not found" }, 404);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /continue with demo profile/i }));

    const markTakenButton = await screen.findByRole("button", { name: /mark taken/i });
    fireEvent.click(markTakenButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/doses/dose-1",
        expect.objectContaining({
          method: "PATCH"
        })
      );
    });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /mark taken/i })).not.toBeInTheDocument();
    });

    expect(await screen.findByText(/dose marked as taken/i)).toBeInTheDocument();
  });
});
