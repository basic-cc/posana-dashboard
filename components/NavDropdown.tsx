'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  trigger: React.ReactNode;
  triggerClassName?: string;
  align?: 'left' | 'right';
  children: (close: () => void) => React.ReactNode;
}

export default function NavDropdown({ trigger, triggerClassName, align = 'right', children }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          triggerClassName ??
          `text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
            open
              ? 'bg-teal-600 text-white'
              : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
          }`
        }
      >
        {trigger}
      </button>
      {open && (
        <div
          className={`absolute top-full mt-1 ${align === 'right' ? 'right-0' : 'left-0'} z-30 min-w-[11rem] bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg shadow-lg py-1`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
