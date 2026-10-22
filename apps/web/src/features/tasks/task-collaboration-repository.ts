import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "../../app/auth-client.js";
import type { TaskScope } from "./task-repository.js";

export const ATTACHMENT_BUCKET = "projectpulse-attachments";
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_ATTACHMENT_TYPES = [
  "application/pdf",
  "application/zip",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/markdown",
  "text/plain",
] as const;

export type AllowedAttachmentType = (typeof ALLOWED_ATTACHMENT_TYPES)[number];

export interface TaskCommentRecord {
  authorId: string | null;
  body: string;
  createdAt: string;
  deletedAt: string | null;
  editVersion: number;
  id: string;
  mentionedUserIds: string[];
  taskId: string;
  updatedAt: string;
}

export interface MentionCandidate {
  userId: string;
}

export interface TaskAttachmentRecord {
  byteSize: number;
  commentId: string | null;
  contentType: string;
  createdAt: string;
  fileName: string;
  id: string;
  storagePath: string;
  taskId: string | null;
  uploadedBy: string | null;
}

export interface TaskChecklistItemRecord {
  completedAt: string | null;
  completedBy: string | null;
  createdAt: string;
  id: string;
  position: number;
  taskId: string;
  title: string;
  updatedAt: string;
}

export interface TaskCommentDraft {
  body: string;
  mentionedUserIds: string[];
}

export interface AttachmentStorage {
  createSignedUrl(path: string, expiresInSeconds: number): Promise<string>;
  remove(path: string): Promise<void>;
  upload(path: string, file: Blob, contentType: string): Promise<void>;
}

export interface TaskCollaborationRepository {
  createChecklistItem(
    scope: TaskScope,
    taskId: string,
    title: string,
    position?: number,
  ): Promise<TaskChecklistItemRecord>;
  createComment(
    scope: TaskScope,
    taskId: string,
    draft: TaskCommentDraft,
  ): Promise<TaskCommentRecord>;
  deleteChecklistItem(
    scope: TaskScope,
    taskId: string,
    item: TaskChecklistItemRecord,
  ): Promise<TaskChecklistItemRecord>;
  deleteComment(
    scope: TaskScope,
    taskId: string,
    comment: TaskCommentRecord,
  ): Promise<TaskCommentRecord>;
  editComment(
    scope: TaskScope,
    taskId: string,
    comment: TaskCommentRecord,
    draft: TaskCommentDraft,
  ): Promise<TaskCommentRecord>;
  listAttachments(
    scope: TaskScope,
    taskId: string,
  ): Promise<TaskAttachmentRecord[]>;
  listChecklistItems(
    scope: TaskScope,
    taskId: string,
  ): Promise<TaskChecklistItemRecord[]>;
  listComments(scope: TaskScope, taskId: string): Promise<TaskCommentRecord[]>;
  listMentionCandidates(scope: TaskScope): Promise<MentionCandidate[]>;
  getAttachmentUrl(attachment: TaskAttachmentRecord): Promise<string>;
  toggleChecklistItem(
    scope: TaskScope,
    taskId: string,
    item: TaskChecklistItemRecord,
    completed: boolean,
  ): Promise<TaskChecklistItemRecord>;
  uploadAttachment(
    scope: TaskScope,
    taskId: string,
    file: File,
    commentId?: string,
  ): Promise<TaskAttachmentRecord>;
}

interface CommentRow {
  author_id: string | null;
  body: string;
  created_at: string;
  deleted_at: string | null;
  edit_version: number;
  id: string;
  task_id: string;
  updated_at: string;
}

interface MentionRow {
  comment_id: string;
  mentioned_user_id: string;
}

interface AttachmentRow {
  byte_size: number;
  comment_id: string | null;
  content_type: string;
  created_at: string;
  file_name: string;
  id: string;
  storage_path: string;
  task_id: string | null;
  uploaded_by: string | null;
}

interface ChecklistRow {
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  id: string;
  position: number;
  task_id: string;
  title: string;
  updated_at: string;
}

const commentColumns =
  "id, task_id, author_id, body, edit_version, deleted_at, created_at, updated_at";
const attachmentColumns =
  "id, task_id, comment_id, uploaded_by, storage_path, file_name, content_type, byte_size, created_at";
const checklistColumns =
  "id, task_id, title, position, completed_at, completed_by, created_at, updated_at";

export class AttachmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttachmentValidationError";
  }
}

export function validateAttachmentFile(
  file: Pick<File, "name" | "size" | "type">,
) {
  const contentType = file.type.toLowerCase();
  if (!file.name.trim()) {
    throw new AttachmentValidationError("Choose a file with a name.");
  }
  if (
    !ALLOWED_ATTACHMENT_TYPES.includes(contentType as AllowedAttachmentType)
  ) {
    throw new AttachmentValidationError(
      "This file type is not allowed. Use PDF, ZIP, PNG, JPEG, GIF, WEBP, Markdown, or plain text.",
    );
  }
  if (file.size < 1 || file.size > MAX_ATTACHMENT_BYTES) {
    throw new AttachmentValidationError(
      "Attachments must be between 1 byte and 10 MiB.",
    );
  }
  return { contentType: contentType as AllowedAttachmentType };
}

export function sanitizeAttachmentFileName(fileName: string) {
  const baseName = fileName.split(/[\\/]/).at(-1)?.trim() ?? "attachment";
  const safeName = baseName.replace(/[^A-Za-z0-9._ -]/g, "_");
  return (safeName || "attachment").slice(0, 160);
}

function databaseError(error: { code?: string; message: string }) {
  if (error.code === "42501") {
    return new Error(
      "You no longer have permission to change collaboration details in this project.",
    );
  }
  if (error.code === "55000") return new Error(error.message);
  if (error.code === "22023" || error.code === "23514")
    return new Error(error.message);
  if (error.code === "23503") return new Error(error.message);
  return new Error(
    error.message || "Could not load task collaboration details.",
  );
}

function toComment(
  row: CommentRow,
  mentionedUserIds: string[],
): TaskCommentRecord {
  return {
    authorId: row.author_id,
    body: row.deleted_at ? "Comment deleted" : row.body,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
    editVersion: row.edit_version,
    id: row.id,
    mentionedUserIds,
    taskId: row.task_id,
    updatedAt: row.updated_at,
  };
}

function toAttachment(row: AttachmentRow): TaskAttachmentRecord {
  return {
    byteSize: row.byte_size,
    commentId: row.comment_id,
    contentType: row.content_type,
    createdAt: row.created_at,
    fileName: row.file_name,
    id: row.id,
    storagePath: row.storage_path,
    taskId: row.task_id,
    uploadedBy: row.uploaded_by,
  };
}

function toChecklistItem(row: ChecklistRow): TaskChecklistItemRecord {
  return {
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    createdAt: row.created_at,
    id: row.id,
    position: row.position,
    taskId: row.task_id,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

function requestId() {
  return crypto.randomUUID();
}

export function createSupabaseAttachmentStorage(
  client: SupabaseClient = supabase,
): AttachmentStorage {
  return {
    async createSignedUrl(path, expiresInSeconds) {
      const { data, error } = await client.storage
        .from(ATTACHMENT_BUCKET)
        .createSignedUrl(path, expiresInSeconds);
      if (error) throw databaseError(error);
      return data.signedUrl;
    },
    async remove(path) {
      const { error } = await client.storage
        .from(ATTACHMENT_BUCKET)
        .remove([path]);
      if (error) throw databaseError(error);
    },
    async upload(path, file, contentType) {
      const { error } = await client.storage
        .from(ATTACHMENT_BUCKET)
        .upload(path, file, { contentType, upsert: false });
      if (error) throw databaseError(error);
    },
  };
}

export function createTaskCollaborationRepository(
  client: SupabaseClient = supabase,
  storage: AttachmentStorage = createSupabaseAttachmentStorage(client),
): TaskCollaborationRepository {
  async function commentMutation(
    scope: TaskScope,
    taskId: string,
    action: "create" | "edit" | "delete",
    comment: TaskCommentRecord | undefined,
    draft: TaskCommentDraft,
  ) {
    const { data, error } = await client
      .rpc("manage_task_comment", {
        target_organization_id: scope.organizationId,
        target_project_id: scope.projectId,
        target_task_id: taskId,
        action,
        request_id: requestId(),
        target_comment_id: comment?.id ?? null,
        comment_body: action === "delete" ? null : draft.body.trim(),
        mentioned_user_ids: action === "delete" ? [] : draft.mentionedUserIds,
      })
      .select(commentColumns)
      .single<CommentRow>();
    if (error) throw databaseError(error);
    const mentionIds =
      action === "delete" ? [] : (draft.mentionedUserIds ?? []).filter(Boolean);
    return toComment(data, mentionIds);
  }

  async function checklistMutation(
    scope: TaskScope,
    taskId: string,
    action: "create" | "toggle" | "delete",
    item?: TaskChecklistItemRecord,
    title?: string,
    completed?: boolean,
    position = 0,
  ) {
    const { data, error } = await client
      .rpc("manage_task_checklist_item", {
        target_organization_id: scope.organizationId,
        target_project_id: scope.projectId,
        target_task_id: taskId,
        action,
        request_id: requestId(),
        item_id: item?.id ?? null,
        item_title: title?.trim() ?? null,
        item_completed: completed ?? null,
        item_position: position,
      })
      .select(checklistColumns)
      .single<ChecklistRow>();
    if (error) throw databaseError(error);
    return toChecklistItem(data);
  }

  return {
    async createChecklistItem(scope, taskId, title, position = 0) {
      const trimmed = title.trim();
      if (!trimmed || trimmed.length > 500)
        throw new Error("Add a checklist item between 1 and 500 characters.");
      return checklistMutation(
        scope,
        taskId,
        "create",
        undefined,
        trimmed,
        undefined,
        position,
      );
    },
    createComment: (scope, taskId, draft) =>
      commentMutation(scope, taskId, "create", undefined, draft),
    deleteChecklistItem: (scope, taskId, item) =>
      checklistMutation(scope, taskId, "delete", item),
    deleteComment: (scope, taskId, comment) =>
      commentMutation(scope, taskId, "delete", comment, {
        body: "",
        mentionedUserIds: [],
      }),
    editComment: (scope, taskId, comment, draft) =>
      commentMutation(scope, taskId, "edit", comment, draft),
    async listAttachments(scope, taskId) {
      const { data, error } = await client
        .from("attachments")
        .select(attachmentColumns)
        .eq("organization_id", scope.organizationId)
        .eq("project_id", scope.projectId)
        .eq("task_id", taskId)
        .order("created_at", { ascending: true })
        .returns<AttachmentRow[]>();
      if (error) throw databaseError(error);
      return (data ?? []).map(toAttachment);
    },
    async listChecklistItems(scope, taskId) {
      const { data, error } = await client
        .from("task_checklist_items")
        .select(checklistColumns)
        .eq("organization_id", scope.organizationId)
        .eq("project_id", scope.projectId)
        .eq("task_id", taskId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true })
        .returns<ChecklistRow[]>();
      if (error) throw databaseError(error);
      return (data ?? []).map(toChecklistItem);
    },
    async listComments(scope, taskId) {
      const { data, error } = await client
        .from("comments")
        .select(commentColumns)
        .eq("organization_id", scope.organizationId)
        .eq("project_id", scope.projectId)
        .eq("task_id", taskId)
        .order("created_at", { ascending: true })
        .returns<CommentRow[]>();
      if (error) throw databaseError(error);
      const rows = data ?? [];
      if (!rows.length) return [];
      const { data: mentions, error: mentionError } = await client
        .from("comment_mentions")
        .select("comment_id, mentioned_user_id")
        .eq("organization_id", scope.organizationId)
        .eq("project_id", scope.projectId)
        .eq("task_id", taskId)
        .in(
          "comment_id",
          rows.map((row) => row.id),
        )
        .returns<MentionRow[]>();
      if (mentionError) throw databaseError(mentionError);
      const mentionMap = new Map<string, string[]>();
      for (const mention of mentions ?? []) {
        const values = mentionMap.get(mention.comment_id) ?? [];
        values.push(mention.mentioned_user_id);
        mentionMap.set(mention.comment_id, values);
      }
      return rows.map((row) => toComment(row, mentionMap.get(row.id) ?? []));
    },
    async listMentionCandidates(scope) {
      const { data, error } = await client
        .from("project_memberships")
        .select("user_id")
        .eq("organization_id", scope.organizationId)
        .eq("project_id", scope.projectId)
        .order("user_id", { ascending: true })
        .returns<{ user_id: string }[]>();
      if (error) throw databaseError(error);
      return (data ?? []).map(({ user_id }) => ({ userId: user_id }));
    },
    getAttachmentUrl(attachment) {
      return storage.createSignedUrl(attachment.storagePath, 5 * 60);
    },
    async toggleChecklistItem(scope, taskId, item, completed) {
      return checklistMutation(
        scope,
        taskId,
        "toggle",
        item,
        undefined,
        completed,
      );
    },
    async uploadAttachment(scope, taskId, file, commentId) {
      const { contentType } = validateAttachmentFile(file);
      const safeName = sanitizeAttachmentFileName(file.name);
      const path = `${scope.organizationId}/${scope.projectId}/${taskId}/${crypto.randomUUID()}-${safeName}`;
      await storage.upload(path, file, contentType);
      try {
        const { data, error } = await client
          .rpc("register_task_attachment", {
            target_organization_id: scope.organizationId,
            target_project_id: scope.projectId,
            target_task_id: taskId,
            request_id: requestId(),
            target_storage_path: path,
            target_file_name: safeName,
            target_content_type: contentType,
            target_byte_size: file.size,
            target_comment_id: commentId ?? null,
          })
          .select(attachmentColumns)
          .single<AttachmentRow>();
        if (error) throw databaseError(error);
        return toAttachment(data);
      } catch (cause) {
        try {
          await storage.remove(path);
        } catch {
          // Keep the original metadata error visible. The private bucket and
          // path policy prevent an orphan from being publicly readable.
        }
        throw cause;
      }
    },
  };
}

export const taskCollaborationRepository = createTaskCollaborationRepository();
