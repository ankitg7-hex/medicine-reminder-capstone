import assert from "node:assert/strict";
import React from "react";
import { JSDOM } from "jsdom";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { App } from "../.test-dist/src/App.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/"
});

function installDomGlobals() {
  const { window } = dom;

  globalThis.window = window;
  globalThis.document = window.document;
  Object.defineProperty(globalThis, "navigator", {
    value: window.navigator,
    configurable: true
  });
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Node = window.Node;
  globalThis.Event = window.Event;
  globalThis.MouseEvent = window.MouseEvent;
  globalThis.CustomEvent = window.CustomEvent;
  globalThis.localStorage = window.localStorage;
  globalThis.sessionStorage = window.sessionStorage;
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
}

installDomGlobals();

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function resetEnvironment() {
  cleanup();
  window.localStorage.clear();
}

function jsonResponse(body, status = 200) {
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

function createFetchMock() {
  return (input, init) => {
    const url = String(input);

    if (url === "/api/auth/login" && init?.method === "POST") {
      return jsonResponse({
        token: "session-token-123",
        profile: {
          id: "user-1",
          username: "ananya",
          email: "ananya@example.com",
          timezone: "Asia/Calcutta"
        }
      });
    }

    if (url === "/api/auth/logout" && init?.method === "POST") {
      return jsonResponse({ ok: true });
    }

    if (url === "/api/me") {
      return jsonResponse({
        profile: {
          id: "user-1",
          username: "ananya",
          email: "ananya@example.com",
          timezone: "Asia/Calcutta"
        }
      });
    }

    if (url === "/api/medications") {
      return jsonResponse({
        medications: []
      });
    }

    if (url === "/api/schedule/today") {
      return jsonResponse(emptySchedule());
    }

    if (url === "/api/history") {
      return jsonResponse(emptyHistory());
    }

    if (url === "/api/reminders/today") {
      return jsonResponse(emptyReminders());
    }

    if (url === "/api/audit-logs?limit=8") {
      return jsonResponse(emptyAudit());
    }

    return jsonResponse({ error: "Not found" }, 404);
  };
}

test("renders the current sign-in experience", () => {
  const view = render(React.createElement(App));

  assert.ok(
    view.getByRole("heading", {
      name: /stay on track with your medicines and daily reminders/i
    })
  );
  assert.ok(view.getAllByRole("button", { name: /^sign in$/i }).length >= 1);
  const signUpToggle = view.getByRole("button", { name: /^sign up$/i });
  assert.ok(signUpToggle);
  fireEvent.click(signUpToggle);
  assert.ok(view.getByRole("button", { name: /create account/i }));
});

test("signs in and shows the active logged-in user", async () => {
  globalThis.fetch = createFetchMock();

  const view = render(React.createElement(App));

  fireEvent.click(view.getAllByRole("button", { name: /^sign in$/i }).at(-1));

  await view.findByRole("button", { name: /sign out/i });
  assert.equal(view.getAllByText(/signed in as/i).length, 2);
  assert.ok(view.getAllByText("ananya").length > 0);
  assert.equal(window.localStorage.getItem("medicine-reminder-session-token"), "session-token-123");
});

test("signs out and returns to the authentication form", async () => {
  globalThis.fetch = createFetchMock();

  const view = render(React.createElement(App));

  fireEvent.click(view.getAllByRole("button", { name: /^sign in$/i }).at(-1));

  const signOutButton = await view.findByRole("button", { name: /sign out/i });
  fireEvent.click(signOutButton);

  await waitFor(() => {
    assert.ok(view.getByRole("heading", { name: /sign in/i }));
  });

  assert.equal(window.localStorage.getItem("medicine-reminder-session-token"), null);
});

let failures = 0;

for (const entry of tests) {
  try {
    resetEnvironment();
    await entry.fn();
    console.log(`ok - ${entry.name}`);
  } catch (error) {
    failures += 1;
    console.error(`not ok - ${entry.name}`);
    console.error(error);
  } finally {
    resetEnvironment();
  }
}

if (failures > 0) {
  console.error(`${failures} frontend test(s) failed.`);
  process.exitCode = 1;
}
