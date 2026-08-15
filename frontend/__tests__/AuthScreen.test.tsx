import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuthScreen from "@/components/AuthScreen";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("AuthScreen", () => {
  beforeEach(() => {
    push.mockReset();
  });

  it("renders email and password fields with a Sign in button by default", () => {
    render(<AuthScreen />);
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Sign in$/i })).toBeInTheDocument();
  });

  it("switches to sign up mode when the toggle link is clicked", async () => {
    const user = userEvent.setup();
    render(<AuthScreen />);
    await user.click(screen.getByRole("button", { name: /Create an account/i }));
    expect(screen.getByRole("button", { name: /Create account/i })).toBeInTheDocument();
  });

  it("posts to /api/auth/login and navigates to /platform on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 1, email: "a@example.com" }),
      })
    );
    const user = userEvent.setup();
    render(<AuthScreen />);
    await user.type(screen.getByLabelText(/Email/i), "a@example.com");
    await user.type(screen.getByLabelText(/Password/i), "hunter2pass");
    await user.click(screen.getByRole("button", { name: /^Sign in$/i }));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/login"),
      expect.objectContaining({ method: "POST", credentials: "include" })
    );
    expect(push).toHaveBeenCalledWith("/platform");
  });

  it("posts to /api/auth/signup when in sign up mode", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 1, email: "a@example.com" }),
      })
    );
    const user = userEvent.setup();
    render(<AuthScreen />);
    await user.click(screen.getByRole("button", { name: /Create an account/i }));
    await user.type(screen.getByLabelText(/Email/i), "a@example.com");
    await user.type(screen.getByLabelText(/Password/i), "hunter2pass");
    await user.click(screen.getByRole("button", { name: /^Create account$/i }));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/signup"),
      expect.objectContaining({ method: "POST", credentials: "include" })
    );
    expect(push).toHaveBeenCalledWith("/platform");
  });

  it("shows an error message and does not navigate on failed sign in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ detail: "Invalid email or password" }),
      })
    );
    const user = userEvent.setup();
    render(<AuthScreen />);
    await user.type(screen.getByLabelText(/Email/i), "a@example.com");
    await user.type(screen.getByLabelText(/Password/i), "wrongpass");
    await user.click(screen.getByRole("button", { name: /^Sign in$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Invalid email or password/i
    );
    expect(push).not.toHaveBeenCalled();
  });
});
