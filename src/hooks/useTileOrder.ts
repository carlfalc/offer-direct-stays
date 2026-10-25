import { useRef, useState } from 'react';

/**
 * Persisted ordering for a small set of dashboard tiles, keyed by id.
 * Unknown saved ids are dropped and newly-added defaults are appended,
 * so the layout stays valid as tiles change.
 */
export function useTileOrder(storageKey: string, defaults: string[]) {
  const [order, setOrderState] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as string[];
        const known = saved.filter((id) => defaults.includes(id));
        const missing = defaults.filter((id) => !known.includes(id));
        return [...known, ...missing];
      }
    } catch { /* ignore */ }
    return defaults;
  });

  const persist = (next: string[]) => {
    setOrderState(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const move = (fromId: string, toId: string) => {
    if (!fromId || fromId === toId) return;
    const next = order.slice();
    const fi = next.indexOf(fromId);
    const ti = next.indexOf(toId);
    if (fi < 0 || ti < 0) return;
    next.splice(fi, 1);
    next.splice(ti, 0, fromId);
    persist(next);
  };

  const reset = () => {
    setOrderState(defaults);
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
  };

  // drag source tracking for HTML5 drag-and-drop
  const dragId = useRef<string | null>(null);
  const dragProps = (id: string) => ({
    draggable: true,
    onDragStart: () => { dragId.current = id; },
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: () => { if (dragId.current) move(dragId.current, id); dragId.current = null; },
  });

  return { order, move, reset, dragProps };
}
