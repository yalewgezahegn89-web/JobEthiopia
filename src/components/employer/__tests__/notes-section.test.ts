import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";

vi.mock("../add-note-form", () => ({
  AddNoteForm: ({ applicationId }: { applicationId: string }) =>
    createElement("span", { "data-testid": "add-note-form" }, `AddNoteForm:${applicationId}`),
}));

vi.mock("../edit-note-button", () => ({
  EditNoteButton: ({ noteId }: { noteId: string }) =>
    createElement("span", { "data-testid": "edit-note-button" }, `Edit:${noteId}`),
}));

vi.mock("../delete-note-button", () => ({
  DeleteNoteButton: ({ noteId }: { noteId: string }) =>
    createElement("span", { "data-testid": "delete-note-button" }, `Delete:${noteId}`),
}));

import { renderToString } from "react-dom/server";
import { NotesSection, type NoteView } from "../notes-section";

const APP_A = "app-1";
const ME = "user-me";
const OTHER = "user-other";

function note(overrides: Partial<NoteView> = {}): NoteView {
  return {
    id: "note-1",
    authorUserId: ME,
    authorName: "Abebe",
    body: "Strong candidate, recommend phone screen.",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function render(notes: NoteView[], currentUserId: string) {
  return renderToString(
    NotesSection({ applicationId: APP_A, notes, currentUserId }) as never,
  );
}

describe("NotesSection", () => {
  it("renders the empty state when there are no notes", () => {
    const html = render([], ME);
    expect(html).toContain("Internal Notes");
    expect(html).toContain("No internal notes yet.");
  });

  it("renders the body as pre-wrap text", () => {
    const html = render([note()], ME);
    expect(html).toContain("whitespace-pre-wrap");
    expect(html).toContain("Strong candidate, recommend phone screen.");
  });

  it("shows the author name", () => {
    const html = render([note()], OTHER);
    expect(html).toContain("Abebe");
  });

  it('shows "Former member" when the author was deleted', () => {
    const html = render([note({ authorUserId: null })], OTHER);
    expect(html).toContain("Former member");
    expect(html).not.toContain("Abebe");
  });

  it('shows "Unknown member" when the author row no longer resolves a name', () => {
    const html = render([note({ authorName: null })], OTHER);
    expect(html).toContain("Unknown member");
  });

  it("shows the edited indicator only when updatedAt differs", () => {
    const edited = render([note({ updatedAt: "2026-02-01T00:00:00.000Z" })], OTHER);
    expect(edited).toContain("Edited");

    const untouched = render([note()], OTHER);
    expect(untouched).not.toContain("Edited");
  });

  it("exposes edit/delete controls only for the current user's own notes", () => {
    const own = render([note()], ME);
    expect(own).toContain("Edit:note-1");
    expect(own).toContain("Delete:note-1");

    const other = render(
      [note({ authorUserId: OTHER, authorName: "Beyene" })],
      ME,
    );
    expect(other).not.toContain("Edit:note-1");
    expect(other).not.toContain("Delete:note-1");
  });

  it("does not render unescaped HTML from note bodies", () => {
    const html = render([note({ body: "<img src=x onerror=alert(1)> & <b>bold</b>" })], OTHER);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;img");
  });

  it("always renders the add-note form with the application id", () => {
    const html = render([], ME);
    expect(html).toContain("AddNoteForm:app-1");
  });
});
