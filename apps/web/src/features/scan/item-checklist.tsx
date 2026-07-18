import type { YardItem } from "@yard/contracts";

type ItemChecklistProps = {
  items: YardItem[];
  onToggle: (item: YardItem) => void;
};

export function ItemChecklist({ items, onToggle }: ItemChecklistProps) {
  const selectedCount = items.filter((item) => item.selected).length;

  return (
    <section className="item-checklist" aria-labelledby="item-checklist-title">
      <div className="item-checklist-header">
        <div>
          <span className="label">Quick select</span>
          <h2 id="item-checklist-title">Select items</h2>
        </div>
        <span className="chip pill-soft">
          {selectedCount}/{items.length}
        </span>
      </div>
      <p className="muted">Use this list when a box is small or hard to reach.</p>
      <div className="item-checklist-list">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="item-checklist-row"
            data-selected={item.selected}
            aria-pressed={item.selected}
            onClick={() => onToggle(item)}
          >
            <span className="item-checkmark" aria-hidden="true">
              {item.selected ? "✓" : ""}
            </span>
            <span className="item-checklist-copy">
              <strong>{item.title}</strong>
              <span>{item.category}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
