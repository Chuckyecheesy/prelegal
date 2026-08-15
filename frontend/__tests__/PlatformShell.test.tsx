import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlatformShell from "@/components/PlatformShell";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
}));

vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));
vi.mock("html2canvas-pro", () => ({ default: vi.fn() }));
vi.mock("jspdf", () => ({ default: vi.fn() }));

const TEMPLATE = "Party A: [Full Legal Name of Party A]";

function mockAuthedFetch() {
  return vi.fn().mockImplementation((url: string) => {
    if (url.endsWith("/api/auth/me")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ id: 1, email: "alice@example.com" }),
      });
    }
    if (url.endsWith("/api/documents")) {
      return Promise.resolve({ ok: true, json: async () => [] });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

describe("PlatformShell", () => {
  beforeEach(() => {
    push.mockReset();
    replace.mockReset();
  });

  it("redirects to / when the user is not signed in", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    render(<PlatformShell template={TEMPLATE} />);
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("renders the app shell with the user's email once authenticated", async () => {
    vi.stubGlobal("fetch", mockAuthedFetch());
    render(<PlatformShell template={TEMPLATE} />);
    expect(await screen.findByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText(/Mutual NDA Creator/i)).toBeInTheDocument();
  });

  it("shows the disclaimer footer", async () => {
    vi.stubGlobal("fetch", mockAuthedFetch());
    render(<PlatformShell template={TEMPLATE} />);
    await screen.findByText("alice@example.com");
    expect(screen.getByText(/drafts only/i)).toBeInTheDocument();
  });

  it("switches to the History view and shows the empty state", async () => {
    vi.stubGlobal("fetch", mockAuthedFetch());
    const user = userEvent.setup();
    render(<PlatformShell template={TEMPLATE} />);
    await screen.findByText("alice@example.com");
    await user.click(screen.getByRole("button", { name: /History/i }));
    expect(await screen.findByText(/No documents yet/i)).toBeInTheDocument();
  });

  it("signs out and redirects to /", async () => {
    vi.stubGlobal("fetch", mockAuthedFetch());
    const user = userEvent.setup();
    render(<PlatformShell template={TEMPLATE} />);
    await screen.findByText("alice@example.com");
    await user.click(screen.getByRole("button", { name: /Sign out/i }));
    expect(push).toHaveBeenCalledWith("/");
  });
});
