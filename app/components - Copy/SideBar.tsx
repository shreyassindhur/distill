interface HistoryItem {
  topic: string;
  sources: number;
  report: string;
  followups: string[];
}

interface SidebarProps {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  searchesUsed: number;
  maxSearches: number;
}

export default function Sidebar({
  history,
  onSelect,
  searchesUsed,
  maxSearches,
}: SidebarProps) {
  const remaining = maxSearches - searchesUsed;

  return (
    <aside className="w-56 shrink-0 border-r border-neutral-800 min-h-screen pt-8 px-4">
      <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">
        Recent
      </p>
      <p className="text-xs text-neutral-600 mb-6">
        {remaining} research{remaining !== 1 ? "es" : ""} left
      </p>

      {history.length === 0 ? (
        <p className="text-xs text-neutral-700 leading-5">
          Your research history will appear here.
        </p>
      ) : (
        <div className="space-y-1">
          {history.map((item, i) => (
            <button
              key={i}
              onClick={() => onSelect(item)}
              className="w-full text-left px-3 py-2 rounded-lg text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 transition-all truncate"
            >
              ↗ {item.topic}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}