import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from "@projectpulse/ui";

import type { TaskScope } from "./task-repository.js";
import {
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  type MentionCandidate,
  type TaskAttachmentRecord,
  type TaskChecklistItemRecord,
  type TaskCollaborationRepository,
  type TaskCommentRecord,
  taskCollaborationRepository,
} from "./task-collaboration-repository.js";

interface TaskCollaborationPanelProps {
  canWrite: boolean;
  onChanged?: () => void;
  projectArchived: boolean;
  repository?: TaskCollaborationRepository;
  refreshKey?: string | number;
  scope: TaskScope;
  taskId: string;
}

export function TaskCollaborationPanel({
  canWrite,
  onChanged,
  projectArchived,
  repository = taskCollaborationRepository,
  refreshKey,
  scope,
  taskId,
}: TaskCollaborationPanelProps) {
  const [comments, setComments] = useState<TaskCommentRecord[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachmentRecord[]>([]);
  const [checklist, setChecklist] = useState<TaskChecklistItemRecord[]>([]);
  const [mentionCandidates, setMentionCandidates] = useState<
    MentionCandidate[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commentMentions, setCommentMentions] = useState<string[]>([]);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [editingMentions, setEditingMentions] = useState<string[]>([]);
  const [checklistTitle, setChecklistTitle] = useState("");
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string | null>(
    null,
  );
  const generation = useRef(0);
  const mounted = useRef(false);

  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError(null);
    setMutationError(null);
    try {
      const [nextComments, nextAttachments, nextChecklist, candidates] =
        await Promise.all([
          repository.listComments(scope, taskId),
          repository.listAttachments(scope, taskId),
          repository.listChecklistItems(scope, taskId),
          repository.listMentionCandidates(scope),
        ]);
      if (mounted.current && request === generation.current) {
        setComments(nextComments);
        setAttachments(nextAttachments);
        setChecklist(nextChecklist);
        setMentionCandidates(candidates);
      }
    } catch (cause) {
      if (mounted.current && request === generation.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not load task collaboration details.",
        );
    } finally {
      if (mounted.current && request === generation.current) setLoading(false);
    }
  }, [refreshKey, repository, scope, taskId]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
      generation.current += 1;
    };
  }, [load]);

  async function runMutation(
    action: () => Promise<unknown>,
    success: string,
  ): Promise<boolean> {
    if (pending) return false;
    setPending(true);
    setMutationError(null);
    setMessage(null);
    try {
      await action();
      if (mounted.current) {
        setMessage(success);
        await load();
        onChanged?.();
      }
      return true;
    } catch (cause) {
      if (mounted.current)
        setMutationError(
          cause instanceof Error
            ? cause.message
            : "Could not save collaboration details.",
        );
      return false;
    } finally {
      if (mounted.current) setPending(false);
    }
  }

  function toggleMention(
    userId: string,
    selected: string[],
    setSelected: (value: string[]) => void,
  ) {
    setSelected(
      selected.includes(userId)
        ? selected.filter((candidate) => candidate !== userId)
        : [...selected, userId],
    );
  }

  function submitComment(event: FormEvent) {
    event.preventDefault();
    if (!commentBody.trim()) return;
    void runMutation(
      () =>
        repository.createComment(scope, taskId, {
          body: commentBody,
          mentionedUserIds: commentMentions,
        }),
      "Comment added.",
    ).then((succeeded) => {
      if (mounted.current && succeeded) {
        setCommentBody("");
        setCommentMentions([]);
      }
    });
  }

  function beginEdit(comment: TaskCommentRecord) {
    setEditingCommentId(comment.id);
    setEditingBody(comment.deletedAt ? "" : comment.body);
    setEditingMentions(comment.mentionedUserIds);
    setMutationError(null);
    setMessage(null);
  }

  function submitEdit(event: FormEvent, comment: TaskCommentRecord) {
    event.preventDefault();
    if (!editingBody.trim()) return;
    void runMutation(
      () =>
        repository.editComment(scope, taskId, comment, {
          body: editingBody,
          mentionedUserIds: editingMentions,
        }),
      "Comment updated.",
    ).then((succeeded) => {
      if (mounted.current && succeeded) {
        setEditingCommentId(null);
        setEditingBody("");
        setEditingMentions([]);
      }
    });
  }

  function addChecklistItem(event: FormEvent) {
    event.preventDefault();
    if (!checklistTitle.trim()) return;
    void runMutation(
      () =>
        repository.createChecklistItem(
          scope,
          taskId,
          checklistTitle,
          checklist.length,
        ),
      "Checklist item added.",
    ).then((succeeded) => {
      if (mounted.current && succeeded) setChecklistTitle("");
    });
  }

  function uploadAttachment(file: File) {
    void runMutation(
      () => repository.uploadAttachment(scope, taskId, file),
      "Attachment uploaded.",
    );
  }

  async function openAttachment(attachment: TaskAttachmentRecord) {
    setOpeningAttachmentId(attachment.id);
    setMutationError(null);
    setMessage(null);
    try {
      const url = await repository.getAttachmentUrl(attachment);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (cause) {
      setMutationError(
        cause instanceof Error ? cause.message : "Could not open attachment.",
      );
    } finally {
      setOpeningAttachmentId(null);
    }
  }

  const completedCount = checklist.filter((item) => item.completedAt).length;
  const readOnlyMessage = projectArchived
    ? "This project is archived. Collaboration details are read-only."
    : "You have read-only access to this task.";

  return (
    <section aria-label="Task collaboration" className="task-collaboration">
      {message ? <p role="status">{message}</p> : null}
      {mutationError ? (
        <p role="alert" className="auth-error">
          {mutationError}
        </p>
      ) : null}
      {!canWrite ? <p className="muted">{readOnlyMessage}</p> : null}
      {loading ? <p role="status">Loading collaboration…</p> : null}
      {error ? (
        <div className="task-collaboration-error">
          <p role="alert" className="auth-error">
            {error}
          </p>
          <Button onClick={() => void load()} variant="secondary">
            Retry collaboration
          </Button>
        </div>
      ) : null}
      {!loading && !error ? (
        <div className="task-collaboration-grid">
          <CommentsCard
            canWrite={canWrite}
            commentBody={commentBody}
            commentMentions={commentMentions}
            comments={comments}
            editingBody={editingBody}
            editingCommentId={editingCommentId}
            editingMentions={editingMentions}
            mentionCandidates={mentionCandidates}
            pending={pending}
            onCancelEdit={() => setEditingCommentId(null)}
            onChangeCommentBody={setCommentBody}
            onChangeCommentMentions={setCommentMentions}
            onChangeEditingBody={setEditingBody}
            onChangeEditingMentions={setEditingMentions}
            onDelete={(comment) =>
              void runMutation(
                () => repository.deleteComment(scope, taskId, comment),
                "Comment deleted.",
              )
            }
            onEdit={beginEdit}
            onSubmit={submitComment}
            onSubmitEdit={submitEdit}
            scopeUserId={scope.userId}
            toggleMention={toggleMention}
          />
          <ChecklistCard
            canWrite={canWrite}
            completedCount={completedCount}
            items={checklist}
            onAdd={addChecklistItem}
            onChangeTitle={setChecklistTitle}
            onDelete={(item) =>
              void runMutation(
                () => repository.deleteChecklistItem(scope, taskId, item),
                "Checklist item deleted.",
              )
            }
            onToggle={(item, completed) =>
              void runMutation(
                () =>
                  repository.toggleChecklistItem(
                    scope,
                    taskId,
                    item,
                    completed,
                  ),
                completed
                  ? "Checklist item completed."
                  : "Checklist item reopened.",
              )
            }
            pending={pending}
            title={checklistTitle}
          />
          <AttachmentsCard
            attachments={attachments}
            canWrite={canWrite}
            onOpen={(attachment) => void openAttachment(attachment)}
            openingAttachmentId={openingAttachmentId}
            onUpload={uploadAttachment}
            pending={pending}
          />
        </div>
      ) : null}
    </section>
  );
}

function CommentsCard({
  canWrite,
  commentBody,
  commentMentions,
  comments,
  editingBody,
  editingCommentId,
  editingMentions,
  mentionCandidates,
  onCancelEdit,
  onChangeCommentBody,
  onChangeCommentMentions,
  onChangeEditingBody,
  onChangeEditingMentions,
  onDelete,
  onEdit,
  onSubmit,
  onSubmitEdit,
  pending,
  scopeUserId,
  toggleMention,
}: {
  canWrite: boolean;
  commentBody: string;
  commentMentions: string[];
  comments: TaskCommentRecord[];
  editingBody: string;
  editingCommentId: string | null;
  editingMentions: string[];
  mentionCandidates: MentionCandidate[];
  onCancelEdit: () => void;
  onChangeCommentBody: (value: string) => void;
  onChangeCommentMentions: (value: string[]) => void;
  onChangeEditingBody: (value: string) => void;
  onChangeEditingMentions: (value: string[]) => void;
  onDelete: (comment: TaskCommentRecord) => void;
  onEdit: (comment: TaskCommentRecord) => void;
  onSubmit: (event: FormEvent) => void;
  onSubmitEdit: (event: FormEvent, comment: TaskCommentRecord) => void;
  pending: boolean;
  scopeUserId: string;
  toggleMention: (
    userId: string,
    selected: string[],
    setSelected: (value: string[]) => void,
  ) => void;
}) {
  return (
    <Card aria-label="Task comments">
      <CardHeader>
        <CardTitle>Comments</CardTitle>
        <p className="muted">Discuss the task with project members.</p>
      </CardHeader>
      <CardContent>
        {comments.length ? (
          <ul aria-label="Task comments" className="task-comment-list">
            {comments.map((comment) => {
              const isAuthor = comment.authorId === scopeUserId;
              const isEditing = editingCommentId === comment.id;
              return (
                <li className="task-comment-item" key={comment.id}>
                  <div className="task-comment-meta">
                    <span>
                      {isAuthor
                        ? "You"
                        : (comment.authorId ?? "Unknown member")}
                    </span>
                    <time dateTime={comment.updatedAt}>
                      {new Date(comment.updatedAt).toLocaleString()}
                    </time>
                    {comment.editVersion > 0 && !comment.deletedAt ? (
                      <Badge>Edited</Badge>
                    ) : null}
                  </div>
                  {isEditing ? (
                    <form onSubmit={(event) => onSubmitEdit(event, comment)}>
                      <label className="field">
                        <span className="pp-field-label">Edit comment</span>
                        <textarea
                          aria-label={`Edit comment ${comment.id}`}
                          className="pp-input task-comment-input"
                          maxLength={20000}
                          onChange={(event) =>
                            onChangeEditingBody(event.target.value)
                          }
                          value={editingBody}
                        />
                      </label>
                      <MentionPicker
                        candidates={mentionCandidates}
                        selected={editingMentions}
                        setSelected={onChangeEditingMentions}
                        toggleMention={toggleMention}
                      />
                      <div className="project-actions">
                        <Button
                          disabled={pending || !editingBody.trim()}
                          type="submit"
                        >
                          Save comment
                        </Button>
                        <Button
                          disabled={pending}
                          onClick={onCancelEdit}
                          variant="ghost"
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <p
                        className={
                          comment.deletedAt ? "muted" : "task-comment-body"
                        }
                      >
                        {comment.deletedAt ? "Comment deleted" : comment.body}
                      </p>
                      {!comment.deletedAt && comment.mentionedUserIds.length ? (
                        <div
                          className="task-collaboration-badges"
                          aria-label="Mentioned members"
                        >
                          {comment.mentionedUserIds.map((userId) => (
                            <Badge key={userId}>@{userId}</Badge>
                          ))}
                        </div>
                      ) : null}
                      {canWrite && isAuthor && !comment.deletedAt ? (
                        <div className="project-actions">
                          <Button
                            disabled={pending}
                            onClick={() => onEdit(comment)}
                            size="sm"
                            variant="ghost"
                          >
                            Edit comment
                          </Button>
                          <Button
                            disabled={pending}
                            onClick={() => onDelete(comment)}
                            size="sm"
                            variant="ghost"
                          >
                            Delete comment
                          </Button>
                        </div>
                      ) : null}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">No comments yet.</p>
        )}
        {canWrite ? (
          <form className="task-comment-form" onSubmit={onSubmit}>
            <label className="field">
              <span className="pp-field-label">Comment</span>
              <textarea
                aria-label="Comment"
                className="pp-input task-comment-input"
                maxLength={20000}
                onChange={(event) => onChangeCommentBody(event.target.value)}
                placeholder="Write a comment…"
                value={commentBody}
              />
            </label>
            <MentionPicker
              candidates={mentionCandidates}
              selected={commentMentions}
              setSelected={onChangeCommentMentions}
              toggleMention={toggleMention}
            />
            <Button disabled={pending || !commentBody.trim()} type="submit">
              Add comment
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MentionPicker({
  candidates,
  selected,
  setSelected,
  toggleMention,
}: {
  candidates: MentionCandidate[];
  selected: string[];
  setSelected: (value: string[]) => void;
  toggleMention: (
    userId: string,
    selected: string[],
    setSelected: (value: string[]) => void,
  ) => void;
}) {
  if (!candidates.length) return null;
  return (
    <fieldset className="task-mention-picker">
      <legend>Mention project members</legend>
      <div className="task-mention-options">
        {candidates.map(({ userId }) => (
          <label key={userId}>
            <input
              aria-label={`Mention ${userId}`}
              checked={selected.includes(userId)}
              onChange={() => toggleMention(userId, selected, setSelected)}
              type="checkbox"
            />
            @{userId}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ChecklistCard({
  canWrite,
  completedCount,
  items,
  onAdd,
  onChangeTitle,
  onDelete,
  onToggle,
  pending,
  title,
}: {
  canWrite: boolean;
  completedCount: number;
  items: TaskChecklistItemRecord[];
  onAdd: (event: FormEvent) => void;
  onChangeTitle: (value: string) => void;
  onDelete: (item: TaskChecklistItemRecord) => void;
  onToggle: (item: TaskChecklistItemRecord, completed: boolean) => void;
  pending: boolean;
  title: string;
}) {
  return (
    <Card aria-label="Task checklist">
      <CardHeader>
        <CardTitle>Checklist</CardTitle>
        <p className="muted">
          {completedCount} of {items.length} complete. Checklist changes do not
          change task status.
        </p>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <ul aria-label="Task checklist items" className="task-checklist-list">
            {items.map((item) => (
              <li key={item.id}>
                <label>
                  <input
                    aria-label={`Complete ${item.title}`}
                    checked={Boolean(item.completedAt)}
                    disabled={!canWrite || pending}
                    onChange={(event) => onToggle(item, event.target.checked)}
                    type="checkbox"
                  />
                  <span
                    className={
                      item.completedAt ? "task-checklist-complete" : undefined
                    }
                  >
                    {item.title}
                  </span>
                </label>
                {canWrite ? (
                  <Button
                    disabled={pending}
                    onClick={() => onDelete(item)}
                    size="sm"
                    variant="ghost"
                  >
                    Delete item
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No checklist items yet.</p>
        )}
        {canWrite ? (
          <form className="task-checklist-form" onSubmit={onAdd}>
            <Input
              disabled={pending}
              label="New checklist item"
              maxLength={500}
              onChange={(event) => onChangeTitle(event.target.value)}
              value={title}
            />
            <Button disabled={pending || !title.trim()} type="submit">
              Add checklist item
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AttachmentsCard({
  attachments,
  canWrite,
  onOpen,
  openingAttachmentId,
  onUpload,
  pending,
}: {
  attachments: TaskAttachmentRecord[];
  canWrite: boolean;
  onOpen: (attachment: TaskAttachmentRecord) => void;
  openingAttachmentId: string | null;
  onUpload: (file: File) => void;
  pending: boolean;
}) {
  return (
    <Card aria-label="Task attachments">
      <CardHeader>
        <CardTitle>Attachments</CardTitle>
        <p className="muted">Protected project files are stored privately.</p>
      </CardHeader>
      <CardContent>
        {attachments.length ? (
          <ul aria-label="Task attachments" className="task-attachment-list">
            {attachments.map((attachment) => (
              <li key={attachment.id}>
                <div>
                  <strong>{attachment.fileName}</strong>
                  <small>
                    {attachment.contentType} ·{" "}
                    {formatBytes(attachment.byteSize)}
                  </small>
                </div>
                <div className="project-actions">
                  <Badge>Private</Badge>
                  <Button
                    disabled={openingAttachmentId !== null}
                    onClick={() => onOpen(attachment)}
                    size="sm"
                    variant="ghost"
                  >
                    {openingAttachmentId === attachment.id
                      ? "Opening…"
                      : "Open attachment"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No attachments yet.</p>
        )}
        {canWrite ? (
          <label className="field task-attachment-input">
            <span className="pp-field-label">Upload attachment</span>
            <input
              accept={ALLOWED_ATTACHMENT_TYPES.join(",")}
              aria-label="Upload attachment"
              disabled={pending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                if (file) onUpload(file);
              }}
              type="file"
            />
            <span className="pp-field-hint">
              PDF, ZIP, PNG, JPEG, GIF, WEBP, Markdown, or text; up to{" "}
              {formatBytes(MAX_ATTACHMENT_BYTES)}.
            </span>
          </label>
        ) : null}
      </CardContent>
    </Card>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
