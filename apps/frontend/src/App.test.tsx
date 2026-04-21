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
      total: 0
    },
    groups: {
      dueNow: [],
      upcoming: [],
      completed: [],
      missed: []
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
        name: /medicine scheduling and today's dose board/i
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue with demo profile/i })
    ).toBeInTheDocument();
  });

  it("loads profile, medication plans, and today's schedule from a saved session", async () => {
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
                scheduledTime: "8:00 AM",
                status: "pending"
              }
            ],
            upcoming: [],
            completed: [],
            missed: []
          }
        });
      }

      return jsonResponse({ error: "Not found" }, 404);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(await screen.findByRole("button", { name: /sign out/i })).toBeInTheDocument();
    expect((await screen.findAllByText("Vitamin D")).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: /today's schedule/i })
    ).toBeInTheDocument();
    expect(screen.getByText("8:00 AM")).toBeInTheDocument();
  });

  it("shows medicine suggestions and autofills common details", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
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
        return jsonResponse({ medications: [] });
      }

      if (url === "/api/schedule/today") {
        return jsonResponse(emptySchedule());
      }

      return jsonResponse({ error: "Not found" }, 404);
    });

    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: /continue with demo profile/i })
    );

    fireEvent.change(await screen.findByLabelText(/medication name/i), {
      target: { value: "Paracetamol" }
    });

    expect(screen.getByDisplayValue("500 mg")).toBeInTheDocument();
    expect(screen.getByDisplayValue("After food")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Fever or mild pain")).toBeInTheDocument();

    await waitFor(() => {
      expect(
        container.querySelector('datalist#medicine-suggestions option[value="Paracetamol"]')
      ).not.toBeNull();
    });
  });
});
