// drag-sort.js — reorder a list by dragging a handle (pointer events: mouse,
// touch and pen alike). The move/up/down buttons stay the primary way to
// reorder; this is the shortcut on top. Nothing animates: the dragged item
// follows the finger and a gold rule marks where it will land.

/**
 * @param {HTMLElement} container  holds the items
 * @param {{ item: string, handle: string, onMove: (from: number, to: number) => void }} o
 */
export function enableDragSort(container, { item, handle, onMove }) {
  if (!container) return;
  container.addEventListener('pointerdown', (e) => {
    const h = e.target.closest(handle);
    if (!h || !container.contains(h) || e.button > 0) return;
    const items = [...container.querySelectorAll(item)];
    const el = h.closest(item);
    const from = items.indexOf(el);
    if (from < 0) return;
    e.preventDefault();
    h.setPointerCapture?.(e.pointerId);
    const startY = e.clientY;
    const mids = items.map((x) => { const r = x.getBoundingClientRect(); return r.top + r.height / 2; });
    let to = from;
    el.classList.add('is-dragging');

    const mark = () => items.forEach((x, i) => {
      x.classList.toggle('drop-before', i === to && to < from);
      x.classList.toggle('drop-after', i === to && to > from);
    });
    const move = (ev) => {
      const dy = ev.clientY - startY;
      el.style.transform = `translateY(${Math.round(dy / 2) * 2}px)`; // whole art pixels
      const y = mids[from] + dy;
      to = from;
      for (let i = 0; i < mids.length; i++) {
        if (i < from && y < mids[i]) { to = i; break; }
        if (i > from && y > mids[i]) to = i;
      }
      mark();
    };
    const up = () => {
      h.removeEventListener('pointermove', move);
      h.removeEventListener('pointerup', up);
      h.removeEventListener('pointercancel', up);
      el.classList.remove('is-dragging');
      el.style.transform = '';
      items.forEach((x) => x.classList.remove('drop-before', 'drop-after'));
      if (to !== from) onMove(from, to);
    };
    h.addEventListener('pointermove', move);
    h.addEventListener('pointerup', up);
    h.addEventListener('pointercancel', up);
  });
}
