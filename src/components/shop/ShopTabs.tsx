import { useTranslation } from "react-i18next";
import Tabs from "../ui/Tabs";

interface ShopTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TAB_DEFS = [
  { key: "exoplanets", labelKey: "shop.tab.exoplanets" },
  { key: "ships", labelKey: "shop.tab.ships" },
  { key: "music", labelKey: "shop.tab.music" },
  { key: "credits", labelKey: "shop.credits.title" },
];

const ShopTabs = ({ activeTab, onTabChange }: ShopTabsProps) => {
  const { t } = useTranslation();

  const tabs = TAB_DEFS.map((d) => ({
    key: d.key,
    label: t(d.labelKey),
  }));

  return <Tabs tabs={tabs} activeKey={activeTab} onChange={onTabChange} />;
};

export default ShopTabs;
