"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import styles from "./page.module.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/auth/login", { email });
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <span className={styles.logo}>nandex</span>
        {sent ? (
          <>
            <h1 className={styles.title}>Check your email</h1>
            <p className={styles.subtitle}>
              We sent a sign-in link to <strong>{email}</strong>. Click it to continue.
            </p>
          </>
        ) : (
          <>
            <h1 className={styles.title}>Sign in</h1>
            <p className={styles.subtitle}>We&apos;ll email you a link to sign in, no password needed.</p>
            <form onSubmit={submit} className={styles.form}>
              <input
                type="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={styles.input}
              />
              <button type="submit" disabled={submitting} className={styles.button}>
                {submitting ? "Sending…" : "Continue with email"}
              </button>
            </form>
            {error && <p className={styles.error}>{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
