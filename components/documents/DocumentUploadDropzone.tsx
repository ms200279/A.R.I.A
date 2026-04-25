"use client";

import { useCallback, useId, useRef, useState } from "react";

import {
  DOCUMENT_UPLOAD_ACCEPT_ATTR,
  DOCUMENT_UPLOAD_DESCRIPTION_KO,
} from "@/lib/documents/supported-file-types";

type Props = {
  disabled: boolean;
  /** 선택·드롭된 파일(다중 선택 시 배열) */
  onFiles: (files: File[]) => void;
  multiple?: boolean;
};

export default function DocumentUploadDropzone({
  disabled,
  onFiles,
  multiple = true,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const emitList = useCallback(
    (list: FileList | null) => {
      if (!list?.length) return;
      onFiles(Array.from(list));
    },
    [onFiles],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (disabled) return;
      emitList(e.dataTransfer.files);
    },
    [disabled, emitList],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const openPicker = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const onKeyDownZone = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openPicker();
      }
    },
    [disabled, openPicker],
  );

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label="문서 파일 선택 또는 끌어다 놓기"
        onKeyDown={onKeyDownZone}
        onClick={openPicker}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-[var(--radius-lg)] border-2 border-dashed px-4 py-10 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)] ${
          disabled
            ? "cursor-not-allowed border-white/10 bg-white/[0.02] opacity-60"
            : isDragging
              ? "border-[var(--accent)]/60 bg-[var(--accent-soft)]/20"
              : "border-white/15 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.05]"
        }`}
      >
        <p className="text-sm font-medium text-[var(--text-primary)]">
          파일을 끌어다 놓거나 클릭해서 선택
        </p>
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          {multiple ? "여러 파일을 한 번에 선택할 수 있습니다." : "한 번에 하나의 파일만 선택합니다."}
        </p>
        <p className="mt-2 max-w-md text-xs leading-relaxed text-[var(--text-tertiary)]">
          {DOCUMENT_UPLOAD_DESCRIPTION_KO}
        </p>
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="sr-only"
        accept={DOCUMENT_UPLOAD_ACCEPT_ATTR}
        disabled={disabled}
        multiple={multiple}
        onChange={(e) => {
          emitList(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
