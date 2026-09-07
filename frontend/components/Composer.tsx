"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./Composer.module.css";

export function Composer({ onSend, disabled }: { onSend: (message: string) => void; disabled: boolean }) {
  const [value, setValue] = useState("");
  const [showMenu, setShowMenu] = useState(false);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.bar}>
        <div className={styles.menuAnchor}>
          <button className={styles.iconButton} onClick={() => setShowMenu((v) => !v)} title="Attach">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          {showMenu && (
            <div className={styles.menu} onMouseLeave={() => setShowMenu(false)}>
              {/* No document-upload endpoint exists on the backend yet -- disabled until one does. */}
              <div className={styles.menuItemDisabled} title="Not available yet">
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
