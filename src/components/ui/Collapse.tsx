import { useState, type ReactNode } from "react";
import styles from "./Collapse.module.css";

interface CollapseProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Optional badge shown next to the chevron */
  badge?: string | number;
}

const Collapse = ({ title, children, defaultOpen = false, badge }: CollapseProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}>
          ▶
        </span>
        <span className={styles.title}>{title}</span>
        {badge !== undefined && (
          <span className={styles.badge}>{badge}</span>
        )}
      </button>
      <div
        className={`${styles.content} ${isOpen ? styles.contentOpen : ""}`}
        role="region"
      >
        <div className={styles.inner}>{children}</div>
      </div>
    </div>
  );
};

export default Collapse;
