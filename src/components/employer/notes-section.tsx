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
    <div className="rounded-lg border border-gray-200 p-6 dark:border-gray-800">
      <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Internal Notes
      </h2>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Internal notes — do not store passwords or highly sensitive secrets.
      </p>

      {notes.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          No internal notes yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {notes.map((note) => (
            <li
              key={note.id}
              className="rounded-md border border-gray-200 p-3 dark:border-gray-800"
            >
              <div className="flex items-center justify-between gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {note.authorUserId ? note.authorName ?? "Unknown member" : "Former member"}
                </span>
                <div className="flex items-center gap-3">
                  <span>{new Date(note.createdAt).toLocaleString()}</span>
                  {note.updatedAt !== note.createdAt && <span>· Edited</span>}
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">
                {note.body}
              </p>
              {isOwn(note) && (
                <div className="mt-2 flex items-center gap-2">
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

      <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-800">
        <AddNoteForm applicationId={applicationId} />
      </div>
    </div>
  );
}
