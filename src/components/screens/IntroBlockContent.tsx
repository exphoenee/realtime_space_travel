import React from "react";
import { Trans } from "react-i18next";
import type { TFunction } from "i18next";
import type { IntroBlockId } from "../../types";
import styles from "./IntroScreen.module.css";

/**
 * Renders one intro block's content.
 *
 * Shared by the visible crawl and the hidden measurement probe on purpose: the
 * fitted font sizes are only correct if the probe measures byte-identical
 * markup, down to the `<strong>` runs inside the rule blocks. Two copies of
 * this JSX would drift, and the drift would show up as text overflowing its
 * slot in one language.
 */
const IntroBlockContent: React.FC<{ id: IntroBlockId; t: TFunction }> = ({ id, t }) => {
  switch (id) {
    case "headline":
      return <h1 className={styles.headline}>{t("intro.headline")}</h1>;

    case "motto":
      return <p className={styles.motto}>{t("intro.motto")}</p>;

    case "paragraph1":
      return <p className={styles.paragraph}>{t("intro.paragraph1")}</p>;

    case "paragraph2":
      return <p className={styles.paragraph}>{t("intro.paragraph2")}</p>;

    case "sectionTitle":
      return <p className={styles.sectionTitle}>{t("intro.sectionTitle")}</p>;

    default:
      return (
        <p className={styles.paragraph}>
          <Trans i18nKey={`intro.${id}`} t={t} components={{ 1: <strong /> }} />
        </p>
      );
  }
};

export default IntroBlockContent;
