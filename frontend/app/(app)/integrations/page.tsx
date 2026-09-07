"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useProject } from "@/lib/project";
import { COMING_SOON_APPS } from "@/lib/integrations-catalog";
import { CategorySection } from "@/components/CategorySection";
import { ConnectorRow } from "@/components/ConnectorRow";
import styles from "./page.module.css";

type FormField = { reference_key: string; type: string; display_name: string; required: boolean };
type App = {
  app_name: string;
  display_name: string;
  category: string;
  auth_type: string;
  meta: { description?: string; form_fields?: FormField[] };
};
type Connection = { id: string; app_name: string; status: string };

function initialsFor(name: string) {
  return name
    .split(/[\s_]+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function IntegrationsContent() {
  const { project } = useProject();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<Record<string, App[]>>({});
  const [connections, setConnections] = useState<Connection[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [credentialApp, setCredentialApp] = useState<App | null>(null);

  const refetchConnections = async () => {
    if (!project) return;
    const data = await api.get<{ connections: Connection[] }>(`/connections?project_id=${project.id}`);
    setConnections(data.connections);
  };

  useEffect(() => {
    api.get<{ categories: Record<string, App[]> }>("/apps").then((data) => setCategories(data.categories));
  }, []);

  useEffect(() => {
    let ignore = false;
    if (project) {
      api
        .get<{ connections: Connection[] }>(`/connections?project_id=${project.id}`)
        .then((data) => {
          if (!ignore) setConnections(data.connections);
        });
    }
    return () => {
      ignore = true;
    };
  }, [project]);

  useEffect(() => {
    let ignore = false;

    (async () => {
      const connected = searchParams.get("connected");
      const error = searchParams.get("error");
      if (ignore || (!connected && !error)) return;
      setBanner(
        connected
          ? `Connected ${connected.replace(/_/g, " ")}.`
          : `Connection failed: ${error!.replace(/_/g, " ")}.`
      );
      router.replace("/integrations");
      await refetchConnections();
    })();

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const connectionFor = (appName: string) => connections.find((c) => c.app_name === appName && c.status !== "revoked");

  const connect = async (app: App) => {
    if (!project) return;
    if (app.auth_type === "oauth2" || app.auth_type === "form_based_oauth2") {
      const { authorize_url } = await api.post<{ authorize_url: string }>(`/apps/${app.app_name}/install`, {
        project_id: project.id,
      });
      // Full-page browser redirect to the OAuth provider -- a legitimate mutation of the
      // global `window`, not React state; the lint rule can't distinguish the two.
      // eslint-disable-next-line react-hooks/immutability
      window.location.href = authorize_url;
    } else {
      setCredentialApp(app);
    }
  };

  const manage = async (connection: Connection) => {
    if (!project) return;
    if (!window.confirm("Disconnect this app?")) return;
    await api.delete(`/connections/${connection.id}?project_id=${project.id}`);
    refetchConnections();
  };

  return (
    <div className={styles.page}>
      <div className={styles.headerBlock}>
        <div className={styles.headerCopy}>
          <span className={styles.title}>Integrations</span>
          <span className={styles.subtitle}>
            Connect the apps your team already works in — nandex imports and indexes their content
            automatically.
          </span>
        </div>
        {banner && <div className={styles.banner}>{banner}</div>}
      </div>

      {Object.entries(categories).map(([category, apps]) => (
        <CategorySection key={category} category={category}>
          {apps.map((app) => {
            const connection = connectionFor(app.app_name);
            return (
              <ConnectorRow
                key={app.app_name}
                initials={initialsFor(app.display_name)}
                name={app.display_name}
                description={app.meta.description ?? ""}
                connected={!!connection}
                onConnect={() => connect(app)}
                onManage={() => connection && manage(connection)}
              />
            );
          })}
        </CategorySection>
      ))}

      <CategorySection category="coming_soon" disabled>
        {COMING_SOON_APPS.map((app) => (
          <ConnectorRow key={app.name} initials={app.initials} name={app.name} description={app.description} comingSoon />
        ))}
      </CategorySection>

      {credentialApp && (
        <CredentialModal
          app={credentialApp}
          onClose={() => setCredentialApp(null)}
          onSubmit={async (credentials) => {
            if (!project) return;
            await api.post(`/apps/${credentialApp.app_name}/connect`, { project_id: project.id, credentials });
            setCredentialApp(null);
            refetchConnections();
          }}
        />
      )}
    </div>
  );
}

function CredentialModal({
  app,
  onClose,
  onSubmit,
}: {
  app: App;
  onClose: () => void;
  onSubmit: (credentials: Record<string, string>) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const fields = app.meta.form_fields ?? [];

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <span className={styles.modalTitle}>Connect {app.display_name}</span>
        <form
          className={styles.modalForm}
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(values);
          }}
        >
          {fields.map((field) => (
            <label key={field.reference_key} className={styles.modalField}>
              <span>{field.display_name}</span>
              <input
                type={field.type === "password" ? "password" : "text"}
                required={field.required}
                value={values[field.reference_key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [field.reference_key]: e.target.value }))}
              />
            </label>
          ))}
          <button type="submit" className={styles.modalSubmit}>
            Connect
          </button>
        </form>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={null}>
      <IntegrationsContent />
    </Suspense>
  );
}
