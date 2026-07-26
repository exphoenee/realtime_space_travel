import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import styles from "./CustomSelect.module.css";

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  /** Unique id for the label → select association */
  id: string;
  /** Currently selected value */
  value: string;
  /** Called when the user selects an option */
  onChange: (value: string) => void;
  /** All available options */
  options: SelectOption[];
  /** Disable the entire control */
  disabled?: boolean;
  /** Placeholder shown when nothing selected */
  placeholder?: string;
  /** aria-label for accessibility */
  ariaLabel?: string;
}

const CustomSelect = ({
  id,
  value,
  onChange,
  options,
  disabled = false,
  placeholder,
  ariaLabel,
}: CustomSelectProps) => {
  const [open, setOpen] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    // Use a timeout so the trigger click doesn't immediately close
    const timer = setTimeout(() => document.addEventListener("click", handleClick), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClick);
    };
  }, [open]);

  // Scroll focused item into view
  useEffect(() => {
    if (!open || focusedIdx < 0) return;
    const item = listRef.current?.children[focusedIdx] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [focusedIdx, open]);

  // Reset focus index when options or open state change
  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setFocusedIdx(idx >= 0 ? idx : 0);
    } else {
      setFocusedIdx(-1);
    }
  }, [open, options, value]);

  const selectOption = useCallback(
    (opt: SelectOption) => {
      onChange(opt.value);
      setOpen(false);
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;

      switch (e.key) {
        case "Enter":
        case " ":
          e.preventDefault();
          if (open && focusedIdx >= 0) {
            selectOption(options[focusedIdx]);
          } else {
            setOpen(true);
          }
          break;
        case "Escape":
          e.preventDefault();
          setOpen(false);
          break;
        case "ArrowDown":
          e.preventDefault();
          if (!open) {
            setOpen(true);
          } else {
            setFocusedIdx((prev) => (prev < options.length - 1 ? prev + 1 : 0));
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (!open) {
            setOpen(true);
          } else {
            setFocusedIdx((prev) => (prev > 0 ? prev - 1 : options.length - 1));
          }
          break;
        case "Tab":
          setOpen(false);
          break;
      }
    },
    [disabled, open, focusedIdx, options, selectOption],
  );

  const handleTriggerClick = useCallback(() => {
    if (!disabled) setOpen((prev) => !prev);
  }, [disabled]);

  const listId = `${id}-list`;
  const activeDescId = focusedIdx >= 0 ? `${id}-option-${focusedIdx}` : undefined;

  return (
    <div
      ref={containerRef}
      className={`${styles.container}${disabled ? ` ${styles.disabled}` : ""}`}
    >
      {/* Trigger button — mirrors the native <select> role */}
      <button
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={activeDescId}
        aria-label={ariaLabel}
        aria-disabled={disabled}
        className={`${styles.trigger}${open ? ` ${styles.triggerOpen}` : ""}`}
        onClick={handleTriggerClick}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
      >
        <span className={styles.triggerText}>
          {selectedOption?.label ?? placeholder ?? ""}
        </span>
        <svg
          className={`${styles.chevron}${open ? ` ${styles.chevronOpen}` : ""}`}
          width="12"
          height="8"
          viewBox="0 0 12 8"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M1 1.5L6 6.5L11 1.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Dropdown list */}
      {open && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          className={styles.list}
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isFocused = idx === focusedIdx;
            return (
              <li
                key={opt.value}
                id={`${id}-option-${idx}`}
                role="option"
                aria-selected={isSelected}
                className={`${styles.option}${isSelected ? ` ${styles.optionSelected}` : ""}${isFocused ? ` ${styles.optionFocused}` : ""}`}
                onClick={() => selectOption(opt)}
                onMouseEnter={() => setFocusedIdx(idx)}
              >
                {opt.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default CustomSelect;
