import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the demo sign in flow", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: /medicine reminder auth foundation/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue with demo profile/i })
    ).toBeInTheDocument();
  });
});
