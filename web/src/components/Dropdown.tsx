import { Children, isValidElement, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import './Dropdown.scss';
import { CaretDownIcon, CheckIcon } from '@phosphor-icons/react/dist/ssr';

/** Named accent tones, resolved to themed colours in Dropdown.scss. */
export type DropdownTone = 'positive' | 'warning' | 'negative' | 'info';

interface DropdownProps<T extends string> {
  /** Children must be `<DropdownOption>` elements. */
  children: ReactNode;
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the trigger button and listbox. */
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}

interface DropdownOptionProps<T extends string> {
  value: T;
  /** Defaults to the trimmed option text. */
  label?: string;
  /** Optional leading accent dot for this option. */
  tone?: DropdownTone;
  children: ReactNode;
}

interface DropdownOptionData<T extends string> {
  value: T;
  label: string;
  tone?: DropdownTone;
}

/**
 * Custom select control — native `<select>` popups are unstyleable/broken in
 * FiveM's CEF, so selection UIs must be built in-DOM (see fivem-nui skill).
 * Fully themed via the CSS custom properties in `_colors.scss`.
 *
 * Declarative compound API:
 *
 * ```tsx
 * <Dropdown value={status} onChange={setStatus} ariaLabel='Business status'>
 *   <DropdownOption value='open' tone='positive'>Open</DropdownOption>
 *   <DropdownOption value='busy' tone='warning'>Busy</DropdownOption>
 * </Dropdown>
 * ```
 */
export function Dropdown<T extends string>({
  children,
  value,
  onChange,
  ariaLabel,
  disabled,
  className,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Extract the declared options from <DropdownOption> children. Label defaults
  // to the option's trimmed text content, so `tone`/`label` stay optional.
  const options = useMemo(() => {
    const opts: DropdownOptionData<T>[] = [];
    Children.forEach(children, (child) => {
      if (isValidElement<DropdownOptionProps<T>>(child)) {
        const { value: v, label, tone, children: text } = child.props;
        const textLabel = Array.isArray(text) ? text.join('') : typeof text === 'object' && text !== null ? '' : text;
        const resolved = (label ?? (typeof textLabel === 'string' ? textLabel.trim() : '')).trim();
        opts.push({ value: v, label: resolved, tone });
      }
    });
    return opts;
  }, [children]);

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const selected = options[selectedIndex];
  const activeOption = activeIndex >= 0 ? options[activeIndex] : undefined;

  const openMenu = useCallback(() => {
    setActiveIndex(selectedIndex);
    setOpen(true);
  }, [selectedIndex]);

  const closeMenu = useCallback((refocus = false) => {
    setOpen(false);
    setActiveIndex(-1);
    if (refocus) triggerRef.current?.focus();
  }, []);

  // Close when clicking/tapping anywhere outside the control
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) closeMenu();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open, closeMenu]);

  // Keep the highlighted option in view while navigating with the keyboard
  useEffect(() => {
    if (!open || activeIndex < 0 || !listRef.current) return;
    listRef.current.children[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  const select = useCallback(
    (opt: DropdownOptionData<T>) => {
      if (opt.value !== value) onChange(opt.value);
      closeMenu(true);
    },
    [value, onChange, closeMenu],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        openMenu();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % options.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + options.length) % options.length);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (activeOption) select(activeOption);
        break;
      case 'Escape':
        e.preventDefault();
        closeMenu(true);
        break;
      case 'Tab':
        closeMenu();
        break;
    }
  };

  // The declared children are the source of truth for the data model; the
  // rendered menu is built from the extracted `options` so the trigger and
  // listbox stay consistent and keyboard-navigable.
  const renderedOptions = useMemo(() => {
    return options.map((opt, i) => {
      return (
        <button
          key={opt.value}
          id={`${listId}-${i}`}
          type='button'
          // biome-ignore lint/a11y/useSemanticElements: native <option> elements are unstyleable in CEF; see component doc
          role='option'
          aria-selected={opt.value === value}
          className={[
            'dropdown-option',
            i === activeIndex && 'active',
            opt.value === value && 'selected',
            opt.tone && `tone-${opt.tone}`,
          ]
            .filter(Boolean)
            .join(' ')}
          onMouseEnter={() => setActiveIndex(i)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => select(opt)}
        >
          {opt.tone && <span className='dropdown-dot' aria-hidden='true' />}
          <span className='dropdown-label'>{opt.label}</span>
          {opt.value === value && <CheckIcon size={14} className='dropdown-check' aria-hidden='true' />}
        </button>
      );
    });
  }, [options, listId, value, activeIndex, select]);

  return (
    <div
      ref={rootRef}
      className={['dropdown', open && 'open', selected?.tone && `tone-${selected.tone}`, className]
        .filter(Boolean)
        .join(' ')}
      onKeyDown={onKeyDown}
    >
      <button
        ref={triggerRef}
        type='button'
        className='dropdown-trigger'
        onClick={() => (open ? closeMenu() : openMenu())}
        disabled={disabled}
        aria-haspopup='listbox'
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        {selected?.tone && <span className='dropdown-dot' aria-hidden='true' />}
        <span className='dropdown-label'>{selected?.label ?? ''}</span>
        <CaretDownIcon size={16} className='dropdown-chevron' aria-hidden='true' />
      </button>

      {open && (
        <div
          ref={listRef}
          id={listId}
          className='dropdown-menu'
          // biome-ignore lint/a11y/useSemanticElements: native <select> popups are broken/unstyleable in FiveM's CEF; the ARIA listbox is built in DOM (fivem-nui skill)
          role='listbox'
          tabIndex={-1}
          aria-label={ariaLabel}
          aria-activedescendant={activeOption ? `${listId}-${activeIndex}` : undefined}
        >
          {renderedOptions}
        </div>
      )}
    </div>
  );
}

/**
 * One selectable entry of a `<Dropdown>`. Its trimmed text content is the
 * label shown in the trigger and menu unless an explicit `label` is given.
 */
export const DropdownOption = <T extends string>(_props: DropdownOptionProps<T>): ReactNode => null;
