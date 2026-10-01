"use client";

/**
 * The upload control's static and small pieces.
 * (specs/017-press-floor-board)
 *
 * Split out of `FileUploader` purely to keep every function inside the
 * board module's size and complexity budget; there is no behaviour here.
 */

import React from "react";
import { CheckCircle2, Loader2, TriangleAlert, Upload } from "lucide-react";
import { FILE_CATEGORIES } from "./fileCategories";
import { formatBytes } from "./fileFormat";

export function UploadHeader() {
  return (
    <div className="flex items-center gap-2">
      <div className="bg-primary/10 text-primary flex h-7 w-7 items-center justify-center rounded-lg">
        <Upload className="h-3.5 w-3.5" />
      </div>
      <div>
        <h3 className="text-foreground text-xs font-bold">رفع ملف</h3>
        {/* Mirrors config/050-files.yaml's mimeAllowlist. The route re-checks it
            server-side — this is only so a person is not offered a choice the
            server will reject. */}
        <p className="text-2xs text-muted-foreground">
          PDF · صور · AI · PSD · ملفات صوتية
        </p>
      </div>
    </div>
  );
}

export function CategoryField({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-2xs text-foreground font-semibold">التصنيف</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-border/70 bg-background text-foreground rounded-lg border px-2 py-1.5 text-xs"
      >
        {FILE_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function NoteField({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-2xs text-foreground font-semibold">
        ملاحظة (اختياري)
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={1000}
        placeholder="مثال: ملف العميل النهائي"
        className="border-border/70 bg-background text-foreground placeholder:text-muted-foreground rounded-lg border px-2 py-1.5 text-xs"
      />
    </label>
  );
}

export function FileField({
  file,
  inputRef,
  onFile,
}: {
  readonly file: File | null;
  readonly inputRef: React.RefObject<HTMLInputElement | null>;
  readonly onFile: (file: File | null) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-2xs text-foreground font-semibold">الملف</span>
      <input
        ref={inputRef}
        type="file"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        className="border-border/70 bg-background text-foreground file:bg-primary/10 file:text-primary w-full rounded-lg border px-2 py-1.5 text-xs file:me-3 file:rounded-md file:border-0 file:px-2 file:py-1 file:text-xs file:font-semibold"
      />
      {file && (
        <span className="text-2xs text-muted-foreground truncate">
          {file.name} · {formatBytes(file.size)}
        </span>
      )}
    </label>
  );
}

export function UploadFeedback({
  error,
  done,
}: {
  readonly error: string | null;
  readonly done: boolean;
}) {
  if (error) {
    return (
      <p
        role="alert"
        className="border-destructive/40 bg-destructive/5 text-2xs text-destructive flex items-start gap-1.5 rounded-lg border px-2.5 py-2 font-semibold"
      >
        <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
        <span>{error}</span>
      </p>
    );
  }

  if (done) {
    return (
      <p className="text-2xs flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-2.5 py-2 font-semibold text-emerald-600">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        <span>تم رفع الملف بنجاح</span>
      </p>
    );
  }

  return null;
}

export function UploadSubmit({
  pending,
  onSubmit,
}: {
  readonly pending: boolean;
  readonly onSubmit: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSubmit}
      disabled={pending}
      className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          جاري الرفع...
        </>
      ) : (
        <>
          <Upload className="h-3.5 w-3.5" />
          رفع الملف
        </>
      )}
    </button>
  );
}

export interface UploadPanelState {
  readonly category: string;
  readonly note: string;
  readonly file: File | null;
  readonly pending: boolean;
  readonly error: string | null;
  readonly done: boolean;
}

interface UploadPanelProps {
  readonly state: UploadPanelState;
  readonly inputRef: React.RefObject<HTMLInputElement | null>;
  readonly onCategory: (value: string) => void;
  readonly onNote: (value: string) => void;
  readonly onFile: (file: File | null) => void;
  readonly onSubmit: () => void;
}

/** The whole control's markup, so `FileUploader` holds only the behaviour. */
export function UploadPanel({
  state,
  inputRef,
  onCategory,
  onNote,
  onFile,
  onSubmit,
}: UploadPanelProps) {
  return (
    <div className="border-border/70 bg-muted/20 flex flex-col gap-2.5 rounded-xl border p-3">
      <UploadHeader />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <CategoryField value={state.category} onChange={onCategory} />
        <NoteField value={state.note} onChange={onNote} />
      </div>
      <FileField file={state.file} inputRef={inputRef} onFile={onFile} />
      <UploadFeedback error={state.error} done={state.done} />
      <UploadSubmit pending={state.pending} onSubmit={onSubmit} />
    </div>
  );
}
