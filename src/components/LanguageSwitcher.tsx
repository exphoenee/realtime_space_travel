import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES } from "../i18n";
import type { SupportedLanguage } from "../i18n";
import styles from "./LanguageSwitcher.module.css";

interface LanguageSwitcherProps {
  /** Extra osztály a pozicionáláshoz (pl. sarokba helyezés). */
  className?: string;
}

const LanguageSwitcher = ({ className }: LanguageSwitcherProps) => {
  const { i18n, t } = useTranslation();
  const active = (i18n.resolvedLanguage ?? i18n.language) as string;

  const handleSelect = (lng: SupportedLanguage) => {
    void i18n.changeLanguage(lng);
  };

  return (
    <div
      className={`${styles.switcher}${className ? ` ${className}` : ""}`}
      role="group"
      aria-label={t("language.label")}
      onClick={(e) => e.stopPropagation()}
    >
      {SUPPORTED_LANGUAGES.map((lng) => (
        <button
          key={lng}
          type="button"
          className={`${styles.button}${active === lng ? ` ${styles.active}` : ""}`}
          aria-pressed={active === lng}
          onClick={() => handleSelect(lng)}
          title={t(`language.${lng}`)}
        >
          {lng.toUpperCase()}
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitcher;
