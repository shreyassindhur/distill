type Mode = "topic" | "url" | "pdf" | "compare";

interface ModeToggleProps {
  mode: Mode;
  onChange: (mode: Mode) => void;
}

const modes: { id: Mode; label: string }[] = [
  { id: "topic", label: "Topic" },
  { id: "url", label: "URL" },
  { id: "pdf", label: "PDF" },
  { id: "compare", label: "Compare" },
];

export default function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="flex gap-2 mb-6">
      {modes.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`px-4 py-1.5 rounded-full text-xs font-medium tracking-wide border transition-all duration-150 ${
            mode === m.id
              ? "bg-white text-black border-white"
              : "bg-transparent text-neutral-400 border-neutral-700 hover:border-neutral-500 hover:text-neutral-200"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}