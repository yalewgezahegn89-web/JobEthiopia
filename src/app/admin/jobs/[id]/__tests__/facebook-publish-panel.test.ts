// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  mockAction: vi.fn(),
}));

vi.mock("../../actions", () => ({
  publishJobToFacebookAction: mocks.mockAction,
}));

import FacebookPublishPanel from "../facebook-publish-panel";

const JOB_ID = "11111111-1111-4111-8111-111111111111";
const POST_MESSAGE =
  "Senior Pilot — Ethiopian Airlines\n\nLocation: Addis Ababa\nType: Full time\n\nEligibility: Ethiopian applicants confirmed\n\nApply here: http://localhost:3000/jobs/11111111-1111-4111-8111-111111111111";
const POST_LINK = `http://localhost:3000/jobs/${JOB_ID}`;

type PanelProps = Parameters<typeof FacebookPublishPanel>[0];

function renderPanel(overrides: Partial<PanelProps> = {}) {
  const props: PanelProps = {
    jobId: JOB_ID,
    pageName: "Job Ethiopia",
    pageId: "872697352845055",
    postMessage: POST_MESSAGE,
    postLink: POST_LINK,
    publication: null,
    eligible: true,
    ineligibleReason: null,
    ...overrides,
  };

  return render(createElement(FacebookPublishPanel, props));
}

function getCheckbox(): HTMLInputElement {
  return screen.getByRole("checkbox", {
    name: /confirm that jobethiopia has the documented right/i,
  });
}

function getButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: /publish to facebook/i });
}

function sectionText(): string {
  return (document.querySelector("section")?.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

beforeEach(() => {
  mocks.mockAction.mockImplementation(
    async (_state: unknown, formData: FormData) => {
      const jobId = formData.get("jobId");
      const confirmed = formData.get("confirmContentRights");
      if (jobId !== JOB_ID || !confirmed) {
        return { ok: false, error: "Request was rejected" };
      }
      return { ok: true, postId: "999", outcome: "PUBLISHED" };
    },
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FacebookPublishPanel", () => {
  it("shows the owned Page destination and the exact post text", () => {
    renderPanel();

    expect(sectionText()).toContain(
      "Destination: Job Ethiopia (Page ID 872697352845055)",
    );
    const pre = document.querySelector("pre");
    expect(pre?.textContent).toBe(POST_MESSAGE);
    expect(sectionText()).toContain(POST_LINK);
  });

  it("keeps the submit button disabled until the rights checkbox is checked", async () => {
    const user = userEvent.setup();
    renderPanel();

    const checkbox = getCheckbox();
    const button = getButton();
    expect(button.disabled).toBe(true);

    await user.click(checkbox);
    expect(button.disabled).toBe(false);

    await user.click(checkbox);
    expect(button.disabled).toBe(true);
  });

  it("submits the job id and confirmation to the server action", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(getCheckbox());
    await user.click(getButton());

    await vi.waitFor(() => {
      expect(mocks.mockAction).toHaveBeenCalledTimes(1);
    });
    const formData = mocks.mockAction.mock.calls[0][1] as FormData;
    expect(formData.get("jobId")).toBe(JOB_ID);
    expect(formData.get("confirmContentRights")).toBe("on");
  });

  it("shows the success message with the created post id", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(getCheckbox());
    await user.click(getButton());

    const status = await screen.findByRole("status");
    expect((status.textContent ?? "").replace(/\s+/g, " ")).toContain(
      "post ID 999",
    );
  });

  it("shows a returned action error", async () => {
    mocks.mockAction.mockResolvedValue({ ok: false, error: "Facebook publishing is not enabled" });
    const user = userEvent.setup();
    renderPanel();

    await user.click(getCheckbox());
    await user.click(getButton());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Facebook publishing is not enabled");
  });

  it("blocks publishing and the checkbox for a job already published to the Page", () => {
    renderPanel({
      publication: {
        state: "PUBLISHED",
        facebookPostId: "999",
        lastError: null,
      },
    });

    expect(
      screen.getByText(/already published to facebook — post id 999/i),
    ).toBeTruthy();
    expect(getCheckbox().disabled).toBe(true);
    expect(getButton().disabled).toBe(true);
  });

  it("blocks publishing while an attempt is in progress", () => {
    renderPanel({
      publication: { state: "PENDING", facebookPostId: null, lastError: null },
    });

    expect(
      screen.getByText(/already in progress\. repeat requests are blocked/i),
    ).toBeTruthy();
    expect(getButton().disabled).toBe(true);
  });

  it("blocks publishing after an unclear outcome", () => {
    renderPanel({
      publication: { state: "UNKNOWN", facebookPostId: null, lastError: null },
    });

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("unclear result");
    expect(getButton().disabled).toBe(true);
  });

  it("keeps the button enabled after a definite failure so it can be retried", () => {
    renderPanel({
      publication: {
        state: "FAILED",
        facebookPostId: null,
        lastError: "Permissions error",
      },
    });

    expect(
      screen.getByText(/previous attempt failed: permissions error/i),
    ).toBeTruthy();
    expect(getCheckbox().disabled).toBe(false);
    expect(getButton().disabled).toBe(true);
  });

  it("shows the ineligibility reason and blocks submission for ineligible jobs", () => {
    renderPanel({
      eligible: false,
      ineligibleReason: "This job is not published and verified yet.",
    });

    expect(
      screen.getByText(/this job is not published and verified yet\./i),
    ).toBeTruthy();
    expect(getCheckbox().disabled).toBe(true);
    expect(getButton().disabled).toBe(true);
  });
});
