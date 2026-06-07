"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  hasError?: boolean;
  id?: string;
  name?: string;
  "aria-describedby"?: string;
}

export default function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  icon,
  hasError = false,
  id,
  name,
  "aria-describedby": ariaDescribedBy,
}: Props) {
  const generatedId = useId();
  const triggerId = id ?? `${generatedId}-trigger`;
  const listboxId = `${generatedId}-listbox`;
  const hiddenName = name ?? id;
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value],
  );
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const activeOption = options[activeIndex];

  const openListbox = useCallback(() => {
    setOpen(true);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [selectedIndex]);

  const closeListbox = useCallback((focusTrigger = false) => {
    setOpen(false);

    if (focusTrigger) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  const chooseOption = useCallback(
    (option: SelectOption) => {
      onChange(option.value);
      closeListbox(true);
    },
    [closeListbox, onChange],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        closeListbox();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [closeListbox, open]);

  useEffect(() => {
    if (!open || !listRef.current) {
      return;
    }

    const activeElement = listRef.current.children[activeIndex] as
      | HTMLElement
      | undefined;

    activeElement?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function moveActiveIndex(direction: 1 | -1) {
    setActiveIndex((currentIndex) => {
      const nextIndex = currentIndex + direction;

      if (nextIndex < 0) {
        return options.length - 1;
      }

      if (nextIndex >= options.length) {
        return 0;
      }

      return nextIndex;
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();

        if (!open) {
          openListbox();
        } else {
          moveActiveIndex(1);
        }

        break;
      case "ArrowUp":
        event.preventDefault();

        if (!open) {
          openListbox();
        } else {
          moveActiveIndex(-1);
        }

        break;
      case "Home":
        if (open) {
          event.preventDefault();
          setActiveIndex(0);
        }

        break;
      case "End":
        if (open) {
          event.preventDefault();
          setActiveIndex(options.length - 1);
        }

        break;
      case "Enter":
      case " ":
        event.preventDefault();

        if (open && activeOption) {
          chooseOption(activeOption);
        } else {
          openListbox();
        }

        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          closeListbox(true);
        }

        break;
      case "Tab":
        closeListbox();
        break;
    }
  }

  const borderClass = hasError
    ? "border-error focus:ring-error/20"
    : open
      ? "border-ink ring-2 ring-earth/20"
      : "border-border hover:border-ink-muted focus:ring-earth/20";

  return (
    <div ref={containerRef} className="relative">
      {hiddenName && <input type="hidden" name={hiddenName} value={value} />}

      <button
        ref={triggerRef}
        id={triggerId}
        data-custom-select-trigger
        type="button"
        role="combobox"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={hasError || undefined}
        aria-describedby={ariaDescribedBy}
        aria-activedescendant={
          open && activeOption ? `${listboxId}-${activeOption.value}` : undefined
        }
        onClick={() => {
          if (open) {
            closeListbox();
          } else {
            openListbox();
          }
        }}
        onKeyDown={handleKeyDown}
        className={`flex w-full items-center rounded-xl border bg-canvas py-3 pl-10 pr-9 text-left text-[15px] transition-[border-color,box-shadow,transform] duration-150 focus:outline-none focus:ring-2 active:scale-[0.99] ${borderClass}`}
      >
        {icon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted">
            {icon}
          </span>
        )}

        <span
          className={`block min-w-0 truncate ${
            selectedOption ? "text-ink" : "text-ink-muted/60"
          }`}
        >
          {selectedOption?.label ?? placeholder}
        </span>

        <ChevronDown
          size={15}
          className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-labelledby={triggerId}
          className="animate-select-pop absolute left-0 right-0 top-full z-50 mt-2 max-h-64 overflow-auto rounded-xl border border-border bg-canvas p-1.5 text-[15px] shadow-[0_18px_42px_rgba(20,17,16,0.12)]"
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            const active = index === activeIndex;

            return (
              <li
                id={`${listboxId}-${option.value}`}
                key={option.value}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseOption(option)}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                  active ? "bg-earth/10" : "hover:bg-ink/[0.04]"
                } ${selected ? "font-medium text-earth" : "text-ink"}`}
              >
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {selected && <Check size={14} strokeWidth={2.5} />}
                </span>
                <span className="min-w-0 truncate">{option.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
