import styles from "./CategorySection.module.css";

function titleCase(slug: string) {
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function CategorySection({
  category,
  disabled,
  children,
}: {
  category: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.section}>
      <span className={styles.label}>{titleCase(category)}</span>
      <div className={styles.group} data-disabled={disabled}>
        {children}
      </div>
    </div>
  );
}
