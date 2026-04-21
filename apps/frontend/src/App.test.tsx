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
        name: /dose actions, daily signals, and adherence history/i
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue with demo profile/i })
    ).toBeInTheDocument();
  });

  it("loads profile, medication plans, schedule, and history from a saved session", async () => {
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
          medications: [
            {
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
            }
          ]
        });
      }

      if (url === "/api/schedule/today") {
        return jsonResponse({
          date: "2026-04-20",
          timezone: "Asia/Calcutta",
          summary: {
            dueNow: 1,
            upcoming: 0,
            completed: 0,
            missed: 0,
            skipped: 0,
            total: 1
          },
          groups: {
            dueNow: [
              {
                id: "dose-1",
                medicationId: "med-1",
                medicationName: "Vitamin D",
                dosage: "1 capsule",
                instructions: "After breakfast",
                reason: "Bone health",
                scheduledAt: "2026-04-20T02:30:00.000Z",
                scheduledDate: "2026-04-20",
                scheduledTime: "8:00 AM",
                status: "pending",
                actionTakenAt: null,
                notes: null
              }
            ],
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

      return jsonResponse({ error: "Not found" }, 404);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(await screen.findByRole("button", { name: /sign out/i })).toBeInTheDocument();
    expect((await screen.findAllByText("Vitamin D")).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /today's schedule/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /dose history/i })).toBeInTheDocument();
    expect(screen.getByText("8:00 AM")).toBeInTheDocument();
  });

  it("marks a dose as taken and refreshes the board", async () => {
    let scheduleBody: any = {
      date: "2026-04-20",
      timezone: "Asia/Calcutta",
      summary: {
        dueNow: 1,
        upcoming: 0,
        completed: 0,
        missed: 0,
        skipped: 0,
        total: 1
      },
      groups: {
        dueNow: [
          {
            id: "dose-1",
            medicationId: "med-1",
            medicationName: "Vitamin D",
            dosage: "1 capsule",
            instructions: "After breakfast",
            reason: "Bone health",
            scheduledAt: "2026-04-20T02:30:00.000Z",
            scheduledDate: "2026-04-20",
            scheduledTime: "8:00 AM",
            status: "pending",
            actionTakenAt: null,
            notes: null
          }
        ],
        upcoming: [],
        completed: [],
        missed: [],
        skipped: []
      }
    };
    let historyBody: ReturnType<typeof emptyHistory> = emptyHistory();

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
          medications: [
            {
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
            }
          ]
        });
      }

      if (url === "/api/schedule/today") {
        return jsonResponse(scheduleBody);
      }

      if (url === "/api/history") {
        return jsonResponse(historyBody);
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
            completed: [
              {
                id: "dose-1",
                medicationId: "med-1",
                medicationName: "Vitamin D",
                dosage: "1 capsule",
                instructions: "After breakfast",
                reason: "Bone health",
                scheduledAt: "2026-04-20T02:30:00.000Z",
                scheduledDate: "2026-04-20",
                scheduledTime: "8:00 AM",
                status: "completed",
                actionTakenAt: "2026-04-20T02:35:00.000Z",
                notes: null
              }
            ],
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
