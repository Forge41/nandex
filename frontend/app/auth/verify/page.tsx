"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import styles from "../../login/page.module.css";

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refresh } = useSession();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    (async () => {
      const token = searchParams.get("token");
      if (!token) {
        if (!ignore) setError("Missing sign-in token.");
        return;
      }
      // Strip the token from the URL immediately -- it's single-use and shouldn't linger
      // in browser history or get shared accidentally.
      window.history.replaceState(null, "", "/auth/verify");

      try {
        await api.post("/auth/verify", { token });
        await refresh();
        if (!ignore) router.replace("/");
      } catch (err) {
        if (!ignore) setError(err instanceof ApiError ? err.message : "That link is invalid or expired.");
      }
    })();

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <span className={styles.logo}>nandex</span>
        {error ? (
          <>
            <h1 className={styles.title}>Sign-in failed</h1>
            <p className={styles.subtitle}>{error}</p>
            <a href="/login">Back to sign in</a>
          </>
        ) : (
          <p className={styles.subtitle}>Signing you in…</p>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyContent />
    </Suspense>
  );
}
