import { AddNoteForm } from "./add-note-form";
import { EditNoteButton } from "./edit-note-button";
import { DeleteNoteButton } from "./delete-note-button";

export type NoteView = {
  id: string;
  authorUserId: string | null;
  authorName: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export function NotesSection({
  applicationId,
  notes,
  currentUserId,
}: {
  applicationId: string;
  notes: NoteView[];
  currentUserId: string;
}) {
  const isOwn = (note: NoteView) => note.authorUserId === currentUserId;

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          Internal Notes
        </h2>
        <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs font-semibold text-muted">
          {notes.length}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">
        Internal notes — visible only to your organization&apos;s team.
      </p>

      {notes.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-surface-raised/50 px-4 py-8 text-center">
          <p className="text-sm text-muted">No internal notes yet.</p>
          <p className="mt-1 text-xs text-subtle">
            Add a note to share observations with your team.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-4">
          {notes.map((note) => (
            <li
              key={note.id}
              className={`rounded-xl border p-4 ${
                isOwn(note)
                  ? "border-primary/20 bg-primary-light/40"
                  : "border-border bg-surface-raised/50"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-subtle">
                <span className="inline-flex items-center gap-2 font-semibold text-foreground">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-light text-primary">
                    {(note.authorName ?? "?").charAt(0).toUpperCase()}
                  </span>
                  {note.authorUserId
                    ? note.authorName ?? "Unknown member"
                    : "Former member"}
                </span>
                <div className="flex items-center gap-2 text-subtle">
                  <time dateTime={note.createdAt}>
                    {new Date(note.createdAt).toLocaleString()}
                  </time>
                  {note.updatedAt !== note.createdAt && (
                    <span className="rounded-full bg-surface-raised px-2 py-0.5 font-medium text-muted">
                      Edited
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
                {note.body}
              </p>
              {isOwn(note) && (
                <div className="mt-3 flex items-center gap-2 border-t border-border-subtle pt-3">
                  <EditNoteButton
                    applicationId={applicationId}
                    noteId={note.id}
                    initialBody={note.body}
                  />
                  <DeleteNoteButton
                    applicationId={applicationId}
                    noteId={note.id}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 border-t border-border-subtle pt-4">
        <AddNoteForm applicationId={applicationId} />
      </div>
    </div>
  );
}
