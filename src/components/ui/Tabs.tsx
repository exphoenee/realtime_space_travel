import { Fragment } from "react";
import styles from "./Tabs.module.css";

export interface TabDefinition {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: TabDefinition[];
  activeKey: string;
  onChange: (key: string) => void;
}

const Tabs = ({ tabs, activeKey, onChange }: TabsProps) => {
  return (
    <div className={styles.tabs} role="tablist">
      {tabs.map((tab, i) => (
        <Fragment key={tab.key}>
          {i > 0 && <div className={styles.tabSpacer} />}
          <button
            role="tab"
            type="button"
            aria-selected={activeKey === tab.key}
            className={`${styles.tab}${activeKey === tab.key ? ` ${styles.active}` : ""}`}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
          </button>
        </Fragment>
      ))}
    </div>
  );
};

export default Tabs;
