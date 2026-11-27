// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, Fragment, type ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@/lib/i18n/client";
import { AccountMenu } from "@/components/account-menu";

const mocks = vi.hoisted(() => ({
  mockPathname: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.mockPathname(),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    onClick,
    ...props
  }: {
    children: ReactNode;
    onClick?: (event: { preventDefault: () => void }) => void;
    [key: string]: unknown;
  }) =>
    createElement(
      "a",
      {
        ...props,
        onClick: (event: { preventDefault: () => void }) => {
          event.preventDefault();
          onClick?.(event);
        },
      },
      children,
    ),
}));

const links = [
  { href: "/profile", label: "Profile" },
  { href: "/settings", label: "Settings" },
];

function renderMenu({ withOutsideButton = false } = {}) {
  // eslint-disable-next-line react/no-children-prop -- I18nProvider requires an explicit children prop in createElement
  const menu = createElement(I18nProvider, {
    locale: "en",
    children: createElement(AccountMenu, { userName: "Alem", links }),
  });

  return render(
    withOutsideButton
      ? createElement(
          Fragment,
          null,
          menu,
          createElement("button", { type: "button" }, "Outside"),
        )
      : menu,
  );
}

function getTrigger(): HTMLButtonElement {
  return screen.getByRole("button", { name: "Account" });
}

beforeEach(() => {
  mocks.mockPathname.mockReturnValue("/jobs");
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AccountMenu", () => {
  it("opens and closes as a disclosure with accessible button attributes", async () => {
    const user = userEvent.setup();
    renderMenu();

    const trigger = getTrigger();
    const controls = trigger.getAttribute("aria-controls");

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(controls).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Account" })).toBeNull();

    await user.click(trigger);

    const navigation = screen.getByRole("navigation", { name: "Account" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(navigation.getAttribute("id")).toBe(controls);
    expect(screen.queryByRole("menu")).toBeNull();

    await user.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("navigation", { name: "Account" })).toBeNull();
  });

  it("toggles with Enter and Space", async () => {
    const user = userEvent.setup();
    renderMenu();

    const trigger = getTrigger();
    trigger.focus();

    await user.keyboard("{Enter}");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    await user.keyboard("{Enter}");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    await user.keyboard(" ");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    renderMenu();

    const trigger = getTrigger();
    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    await user.keyboard("{Escape}");

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("navigation", { name: "Account" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes when clicking outside the disclosure", async () => {
    const user = userEvent.setup();
    renderMenu({ withOutsideButton: true });

    const trigger = getTrigger();
    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    await user.click(screen.getByRole("button", { name: "Outside" }));

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("navigation", { name: "Account" })).toBeNull();
  });

  it("closes when a navigation link is activated", async () => {
    const user = userEvent.setup();
    renderMenu();

    const trigger = getTrigger();
    await user.click(trigger);

    await user.click(screen.getByRole("link", { name: "Profile" }));

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("navigation", { name: "Account" })).toBeNull();
  });

  it("supports natural Tab and Shift+Tab navigation through links", async () => {
    const user = userEvent.setup();
    renderMenu();

    const trigger = getTrigger();
    await user.click(trigger);

    const profile = screen.getByRole("link", { name: "Profile" });
    const settings = screen.getByRole("link", { name: "Settings" });
    const logout = screen.getByRole("button", { name: "Logout" });

    await user.tab();
    expect(document.activeElement).toBe(profile);

    await user.tab();
    expect(document.activeElement).toBe(settings);

    await user.tab();
    expect(document.activeElement).toBe(logout);

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(settings);
  });

  it("preserves active-link styling and aria-current", async () => {
    mocks.mockPathname.mockReturnValue("/profile");
    const user = userEvent.setup();
    renderMenu();

    await user.click(getTrigger());

    const profile = screen.getByRole("link", { name: "Profile" });
    const settings = screen.getByRole("link", { name: "Settings" });

    expect(profile.getAttribute("aria-current")).toBe("page");
    expect(profile.className).toContain("bg-primary-light");
    expect(settings.getAttribute("aria-current")).toBeNull();
    expect(settings.className).not.toContain("bg-primary-light");
  });

  it("keeps the logout form available", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(getTrigger());

    const logout = screen.getByRole("button", { name: "Logout" });
    const form = logout.closest("form");

    expect(logout.getAttribute("type")).toBe("submit");
    expect(form?.getAttribute("action")).toBe("/logout");
    expect(form?.getAttribute("method")?.toLowerCase()).toBe("post");
  });
});
