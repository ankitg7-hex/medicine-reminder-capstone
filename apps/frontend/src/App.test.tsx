import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  });
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
      screen.getByRole("heading", { name: /medication crud foundation/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue with demo profile/i })
    ).toBeInTheDocument();
  });

  it("loads profile and medications from a saved session", async () => {
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
              endDate: "",
              status: "active",
              createdAt: "2026-04-20T00:00:00.000Z",
              updatedAt: "2026-04-20T00:00:00.000Z",
              archivedAt: null
            }
          ]
        });
      }

      return jsonResponse({ error: "Not found" }, 404);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(await screen.findByText("Ananya Rao")).toBeInTheDocument();
    expect(await screen.findByText("Vitamin D")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
  });

  it("creates a medication after sign in", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        jsonResponse({
          token: "demo-token",
          profile: {
            id: "demo-user",
            fullName: "Ananya Rao",
            email: "ananya@example.com",
            timezone: "Asia/Calcutta"
          }
        })
      )
      .mockImplementationOnce(() => jsonResponse({ medications: [] }))
      .mockImplementationOnce(() =>
        jsonResponse({
          medication: {
            id: "med-1",
            name: "Vitamin D",
            dosage: "1 capsule",
            type: "capsule",
            instructions: "After breakfast",
            reason: "Bone health",
            startDate: "2026-04-20",
            endDate: "",
            status: "active",
            createdAt: "2026-04-20T00:00:00.000Z",
            updatedAt: "2026-04-20T00:00:00.000Z",
            archivedAt: null
          }
        },
        201
      ))
      .mockImplementationOnce(() =>
        jsonResponse({
          medications: [
            {
              id: "med-1",
              name: "Vitamin D",
              dosage: "1 capsule",
              type: "capsule",
              instructions: "After breakfast",
              reason: "Bone health",
              startDate: "2026-04-20",
              endDate: "",
              status: "active",
              createdAt: "2026-04-20T00:00:00.000Z",
              updatedAt: "2026-04-20T00:00:00.000Z",
              archivedAt: null
            }
          ]
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: /continue with demo profile/i })
    );

    expect(await screen.findByText(/no medications yet/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/medication name/i), {
      target: { value: "Vitamin D" }
    });
    fireEvent.change(screen.getByLabelText(/^dosage$/i), {
      target: { value: "1 capsule" }
    });
    fireEvent.change(screen.getByLabelText(/^type$/i), {
      target: { value: "capsule" }
    });
    fireEvent.change(screen.getByLabelText(/instructions/i), {
      target: { value: "After breakfast" }
    });
    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: "Bone health" }
    });

    fireEvent.click(screen.getByRole("button", { name: /create medication/i }));

    expect(await screen.findByText("Vitamin D")).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/medications",
        expect.objectContaining({
          method: "POST"
        })
      );
    });
  });

  it("shows static medicine suggestions and autofills matching details", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        jsonResponse({
          token: "demo-token",
          profile: {
            id: "demo-user",
            fullName: "Ananya Rao",
            email: "ananya@example.com",
            timezone: "Asia/Calcutta"
          }
        })
      )
      .mockImplementationOnce(() => jsonResponse({ medications: [] }));

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
    expect(
      container.querySelector('datalist#medicine-suggestions option[value="Paracetamol"]')
    ).not.toBeNull();
  });
});
