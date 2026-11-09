"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  createTaskCommentAction,
  deleteTaskCommentAction,
  updateTaskCommentAction,
} from "@/lib/actions/comments";
import type { CommentRow } from "@/lib/db/queries/comments";
import { Button } from "@/components/ui/Button";
import { formatDateTimeBR } from "@/lib/utils/date";
import { profileDisplayLabel } from "@/lib/utils/profile-display-label";

type Props = {
  taskId: string;
  comments: CommentRow[];
  currentUserId: string;
  isAdmin: boolean;
};

export function TaskCommentsSection({
  taskId,
  comments,
  currentUserId,
  isAdmin,
}: Props): React.JSX.Element {
  const router = useRouter();
  const createFormRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function onCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createTaskCommentAction(taskId, formData);
      if (!res.ok) setError(res.error);
      else {
        createFormRef.current?.reset();
        router.refresh();
      }
    });
  }

  async function onUpdate(commentId: string, formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await updateTaskCommentAction(commentId, taskId, formData);
      if (!res.ok) setError(res.error);
      else {
        setEditingId(null);
        router.refresh();
      }
    });
  }

  async function onDelete(commentId: string) {
    setError(null);
    startTransition(async () => {
      const res = await deleteTaskCommentAction(commentId, taskId);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <section className="mt-9">
      <h2 className="font-display text-lg text-ink font-semibold mb-4">
        Comentários
      </h2>

      {error && (
        <p className="text-sm text-critical mb-3" role="alert">
          {error}
        </p>
      )}

      <ul className="space-y-3 mb-4">
        {comments.map((c) => {
          const canEdit = c.authorId === currentUserId || isAdmin;
          return (
            <li
              key={c.id}
              className="border border-line rounded p-3 bg-card text-sm"
            >
              <div className="flex flex-wrap justify-between gap-2 mb-2">
                <span className="font-medium text-ink">
                  {profileDisplayLabel(c.authorName, c.authorId)}
                </span>
                <time className="font-mono text-[11px] text-mute" dateTime={c.createdAt}>
                  {formatDateTimeBR(c.createdAt)}
                  {c.updatedAt !== c.createdAt ? " · editado" : ""}
                </time>
              </div>
              {editingId === c.id ? (
                <form
                  action={(fd) => onUpdate(c.id, fd)}
                  className="space-y-2"
                >
                  <textarea
                    name="body"
                    defaultValue={c.body}
                    rows={4}
                    className="w-full rounded border border-line bg-cream-paper px-3 py-2 text-sm text-ink"
                    required
                  />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={pending}>
                      Salvar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingId(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              ) : (
                <p className="text-ink-soft whitespace-pre-wrap">{c.body}</p>
              )}
              {canEdit && editingId !== c.id && (
                <div className="flex gap-2 mt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingId(c.id)}
                  >
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-critical"
                    onClick={() => {
                      if (globalThis.confirm("Apagar este comentário?")) {
                        void onDelete(c.id);
                      }
                    }}
                  >
                    Apagar
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <form ref={createFormRef} action={onCreate} className="space-y-2">
        <label htmlFor={`task-comment-${taskId}`} className="sr-only">
          Novo comentário
        </label>
        <textarea
          id={`task-comment-${taskId}`}
          name="body"
          rows={3}
          placeholder="Escreva um comentário…"
          className="w-full rounded border border-line bg-cream-paper px-3 py-2 text-sm text-ink"
        />
        <Button type="submit" disabled={pending}>
          Comentar
        </Button>
      </form>
    </section>
  );
}
