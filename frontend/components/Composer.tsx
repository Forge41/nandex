"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useProject } from "@/lib/project";
import styles from "./Composer.module.css";

const ACCEPTED_TYPES =
  "application/pdf," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet," +
  "application/vnd.openxmlformats-officedocument.presentationml.presentation," +
  "text/plain,text/markdown,text/csv";

type UploadStatus = { name: string; phase: "uploading" | "indexing" | "ready" | "error"; message?: string };

export function Composer({ onSend, disabled }: { onSend: (message: string) => void; disabled: boolean }) {
  const { project } = useProject();
  const [value, setValue] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [upload, setUpload] = useState<UploadStatus | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const pollIngestStatus = async (raw_document_id: string, project_id: string, name: string) => {
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const { status } = await api.get<{ status: string }>(
          `/documents/${raw_document_id}/ingest-status?project_id=${project_id}`
        );
        if (status === "completed") {
          setUpload({ name, phase: "ready" });
          return;
        }
        if (status === "failed") {
          setUpload({ name, phase: "error", message: "Indexing failed." });
          return;
        }
      } catch {
        // keep polling -- a transient network hiccup shouldn't abandon the status check
      }
    }
    setUpload({ name, phase: "error", message: "Still indexing after a while -- try asking anyway." });
  };

  const handleFile = async (file: File) => {
    if (!project) return;
    setUpload({ name: file.name, phase: "uploading" });
    const form = new FormData();
    form.append("project_id", project.id);
    form.append("file", file);
    try {
      const { id } = await api.upload<{ id: string }>("/documents/upload", form);
      setUpload({ name: file.name, phase: "indexing" });
      pollIngestStatus(id, project.id, file.name);
    } catch (err) {
      setUpload({
        name: file.name,
        phase: "error",
        message: err instanceof ApiError ? err.message : "Upload failed.",
      });
    }
  };

  return (
    <div className={styles.wrap}>
      {upload && (
        <div className={styles.uploadStatus} data-phase={upload.phase}>
          <span>{upload.name}</span>
          <span className={styles.uploadStatusPhase}>
            {upload.phase === "uploading" && "Uploading…"}
            {upload.phase === "indexing" && "Indexing…"}
            {upload.phase === "ready" && "Ready to ask about"}
            {upload.phase === "error" && (upload.message ?? "Something went wrong")}
          </span>
          <button className={styles.uploadStatusDismiss} onClick={() => setUpload(null)}>
            ×
          </button>
        </div>
      )}

      <div className={styles.bar}>
        <div className={styles.menuAnchor}>
          <button className={styles.iconButton} onClick={() => setShowMenu((v) => !v)} title="Attach">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          {showMenu && (
            <div className={styles.menu} onMouseLeave={() => setShowMenu(false)}>
              <div
                className={styles.menuItem}
                onClick={() => {
                  setShowMenu(false);
                  fileInputRef.current?.click();
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>Upload a file</span>
              </div>
              <div className={styles.menuDivider} />
              <span className={styles.menuLabel}>From your integrations</span>
              <Link href="/integrations" className={styles.menuItem} onClick={() => setShowMenu(false)}>
                <span>Manage connected apps</span>
              </Link>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) handleFile(file);
            }}
          />
        </div>

        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ask a question about your documents…"
          className={styles.input}
        />

        <button className={styles.sendButton} onClick={submit} disabled={disabled || !value.trim()}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
