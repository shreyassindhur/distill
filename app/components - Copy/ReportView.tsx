"use client";
import ReactMarkdown from "react-markdown";
import { useState } from "react";

interface ReportViewProps {
  topic: string;
  report: string;
  sourcesFound: number;
  followups: string[];
  onFollowup: (q: string) => void;
}

export default function ReportView({
  topic,
  report,
  sourcesFound,
  followups,
  onFollowup,
}: ReportViewProps) {
  const [quickAnswers, setQuickAnswers] = useState<Record<string, string>>({});
  const [loadingQ, setLoadingQ] = useState<string | null>(null);

  const handleQuickAnswer = async (q: string) => {
    setLoadingQ(q);
    try {
      const res = await fetch("http://localhost:8000/quick-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, context: report.slice(0, 1000) }),
      });
      const data = await res.json();
      setQuickAnswers((prev) => ({ ...prev, [q]: data.answer }));
    } catch {
      setQuickAnswers((prev) => ({ ...prev, [q]: "Could not load answer." }));
    } finally {
      setLoadingQ(null);
    }
  };

  const handleExport = async (format: "pdf" | "word") => {
    const res = await fetch(`http://localhost:8000/export/${format}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, report, format }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `distill-${topic.slice(0, 30).replace(/ /g, "-").toLowerCase()}.${format === "pdf" ? "pdf" : "docx"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-12 border-t border-neutral-800 pt-10">
      {/* report */}
      <div className="prose prose-invert prose-sm max-w-none
        prose-headings:font-medium prose-headings:text-white
        prose-h1:text-2xl prose-h1:mb-2 prose-h1:mt-0
        prose-h2:text-xs prose-h2:tracking-widest prose-h2:uppercase prose-h2:text-neutral-500 prose-h2:mt-8 prose-h2:mb-3
        prose-h3:text-base prose-h3:text-neutral-200
        prose-p:text-neutral-300 prose-p:leading-7
        prose-li:text-neutral-300 prose-li:leading-7
        prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
        prose-strong:text-white
        prose-table:text-sm prose-th:text-neutral-400 prose-td:text-neutral-300
        prose-hr:border-neutral-800">
        <ReactMarkdown>{report}</ReactMarkdown>
      </div>

      {/* export */}
      <div className="mt-10 pt-6 border-t border-neutral-800">
        <p className="text-xs text-neutral-500 uppercase tracking-widest mb-3">Export</p>
        <div className="flex gap-3">
          <button
            onClick={() => handleExport("pdf")}
            className="px-4 py-2 text-xs font-medium border border-neutral-700 rounded-lg text-neutral-300 hover:border-neutral-500 hover:text-white transition-all"
          >
            ↓ PDF
          </button>
          <button
            onClick={() => handleExport("word")}
            className="px-4 py-2 text-xs font-medium border border-neutral-700 rounded-lg text-neutral-300 hover:border-neutral-500 hover:text-white transition-all"
          >
            ↓ Word
          </button>
        </div>
      </div>

      {/* follow-ups */}
      {followups.length > 0 && (
        <div className="mt-10 pt-6 border-t border-neutral-800">
          <p className="text-xs text-neutral-500 uppercase tracking-widest mb-4">Explore further</p>
          <div className="space-y-4">
            {followups.map((q) => (
              <div key={q}>
                <div className="flex items-start gap-3">
                  <p className="text-sm text-neutral-300 flex-1">{q}</p>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleQuickAnswer(q)}
                      disabled={loadingQ === q}
                      className="px-3 py-1 text-xs border border-neutral-700 rounded-lg text-neutral-400 hover:border-neutral-500 hover:text-neutral-200 transition-all disabled:opacity-40"
                    >
                      {loadingQ === q ? "..." : "Quick answer"}
                    </button>
                    <button
                      onClick={() => onFollowup(q)}
                      className="px-3 py-1 text-xs border border-neutral-700 rounded-lg text-neutral-400 hover:border-neutral-500 hover:text-neutral-200 transition-all"
                    >
                      Full report →
                    </button>
                  </div>
                </div>
                {quickAnswers[q] && (
                  <div className="mt-3 pl-4 border-l border-neutral-700 text-sm text-neutral-400 leading-7">
                    {quickAnswers[q]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* footer */}
      <div className="mt-10 pt-6 border-t border-neutral-800 text-center">
        <p className="text-xs text-neutral-600">
          Distill · {sourcesFound} sources · powered by Groq + Tavily
        </p>
      </div>
    </div>
  );
}