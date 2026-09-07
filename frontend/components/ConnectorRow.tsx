import styles from "./ConnectorRow.module.css";

export function ConnectorRow({
  initials,
  name,
  description,
  connected,
  comingSoon,
  onConnect,
  onManage,
}: {
  initials: string;
  name: string;
  description: string;
  connected?: boolean;
  comingSoon?: boolean;
  onConnect?: () => void;
  onManage?: () => void;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.icon}>{initials}</div>
      <div className={styles.info}>
        <span className={styles.name}>{name}</span>
        <span className={styles.description}>{description}</span>
      </div>
      <div className={styles.right}>
        {comingSoon ? (
          <span className={styles.comingSoonLabel}>Coming soon</span>
        ) : (
          <>
            <div className={styles.status}>
              <span className={styles.dot} data-connected={connected} />
              <span className={styles.statusLabel}>{connected ? "Connected" : "Not connected"}</span>
            </div>
            {connected ? (
              <button className={styles.buttonSecondary} onClick={onManage}>
                Manage
              </button>
            ) : (
              <button className={styles.buttonPrimary} onClick={onConnect}>
                Connect
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
