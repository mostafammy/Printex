"use client";

/**
 * The Files tab's upload control: a 050 attachment, written through 050's own
 * `/api/files/upload` route.
 * (specs/017-press-floor-board)
 *
 * This is where a file actually gets attached from the board. The other upload
 * surface in the app — 050's `FilePanel` on `/work-items/[id]/files` — is
 * rendered by a page that never passes an `onUpload` callback, so its button is
 * inert. Rather than duplicate the upload a second time, the popup posts to the
 * same route: the streaming, SHA-256 dedupe, version supersede and audit all
 * still happen exactly once, in 050's service, under 050's authorization.
 */

import React, { useRef, useState } from "react";
import { UploadPanel } from "./UploadControls";
import { uploadErrorMessage } from "./uploadErrorMessage";

export interface UploadState {
  readonly category: string;
  readonly note: string;
  readonly file: File | null;
  readonly pending: boolean;
  readonly error: string | null;
  readonly done: boolean;
}

const INITIAL_STATE: UploadState = {
  category: "SUPPORTING",
  note: "",
  file: null,
  pending: false,
  error: null,
  done: false,
};

interface UploadPayload {
  readonly error?: string;
  readonly message?: string;
}

interface PostUploadInput {
  readonly workItemId: string;
  readonly category: string;
  readonly file: File;
  readonly note?: string;
}

/** `null` means stored; a string is the Arabic message to show the user. */
async function postUpload(input: PostUploadInput): Promise<string | null> {
  const form = new FormData();
  form.set("workItemId", input.workItemId);
  form.set("category", input.category);
  form.set("file", input.file);
  if (input.note) form.set("note", input.note);

  try {
    const response = await fetch("/api/files/upload", {
      method: "POST",
      body: form,
    });
    const payload = (await response
      .json()
      .catch(() => null)) as UploadPayload | null;
    if (!response.ok) return uploadErrorMessage(response.status, payload);
    return null;
  } catch {
    return "تعذر رفع الملف. تحقق من الاتصال وحاول مرة أخرى";
  }
}

interface FileUploaderProps {
  readonly cardId: string;
  readonly onUploaded?: () => void | Promise<void>;
}

export function FileUploader({ cardId, onUploaded }: FileUploaderProps) {
  const [state, setState] = useState<UploadState>(INITIAL_STATE);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const patch = (next: Partial<UploadState>) =>
    setState((s) => ({ ...s, ...next }));

  async function handleUpload() {
    if (!state.file) {
      patch({ error: "اختر ملفاً أولاً" });
      return;
    }

    patch({ pending: true, error: null, done: false });
    const failure = await postUpload({
      workItemId: cardId,
      category: state.category,
      file: state.file,
      note: state.note.trim() || undefined,
    });

    if (failure) {
      patch({ pending: false, error: failure });
      return;
    }

    // A refused upload keeps its chosen file: the fix is usually the category,
    // and re-picking the same file off disk is a needless step.
    if (fileInputRef.current) fileInputRef.current.value = "";
    patch(INITIAL_STATE);
    await onUploaded?.();
  }

  return (
    <UploadPanel
      state={state}
      inputRef={fileInputRef}
      onCategory={(category) => patch({ category })}
      onNote={(note) => patch({ note })}
      onFile={(file) => patch({ file, error: null, done: false })}
      onSubmit={() => void handleUpload()}
    />
  );
}
