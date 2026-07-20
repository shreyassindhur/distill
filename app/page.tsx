"use client";
/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars, react-hooks/refs */
import { useState, useRef, useCallback, useEffect } from "react";

let audioCtx: AudioContext | null = null;
function getCtx() { if (!audioCtx) audioCtx = new AudioContext(); return audioCtx; }

function playSubmit() {
  const ctx = getCtx();
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = "sine"; o.frequency.setValueAtTime(260, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.12);
  g.gain.setValueAtTime(0.08, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.2);
}

function playResult() {
  const ctx = getCtx();
  const sr = ctx.sampleRate;
  const len = sr * 0.3;
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) { const t = i / sr; d[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - t / 0.3) * (1 - t / 0.3); }
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 800; f.Q.value = 0.6;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.06, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
  src.connect(f).connect(g).connect(ctx.destination); src.start();
}

function playChime() {
  const ctx = getCtx();
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = "sine"; o.frequency.setValueAtTime(660, ctx.currentTime);
  o.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
  g.gain.setValueAtTime(0.07, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.5);
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const SESSION_KEY = "distill_session";
const CREDIT_CACHE = "distill_credits_v2";
const CREDIT_COST: Record<Mode, number> = { topic: 2, analyze: 2, compare: 3, write_paper: 6 };
type Mode = "topic" | "analyze" | "compare" | "write_paper";
interface Report { topic: string; report: string; sources_found: number; followups: string[]; contested?: string; mode?: string; }
interface HistoryItem { topic: string; sources: number; report: string; followups: string[]; contested?: string; mode?: string; }

const TONES = [
  { value: "default", label: "Standard" }, { value: "academic", label: "Academic" },
  { value: "executive", label: "Executive" }, { value: "journalist", label: "Editorial" },
];
const HERO_HEADS = [
  "Ask a question.\nGet a researched answer.", "Not sure what to trust?\nWe help with that.",
  "Not everything you read is true.\nWe show you what is.", "Stop guessing which sources to trust.\nWe do the hard part.",
  "One question. Multiple sources.\nOne honest answer.", "Research you can cite,\nnot just copy-paste from.",
  "No hallucinations.\nJust real sources, graded honestly.", "Because \"I read it somewhere\"\nisn't good enough.",
  "Answers are easy.\nTrustworthy ones are hard.\nWe built the hard part.", "Type a question.\nGet back evidence, not opinions.",
];
const FACTS = [
  "Marie Curie won Nobel Prizes in both Physics (1903) and Chemistry (1911) — the only person to achieve this.",
  "In 1905, Albert Einstein published four papers that transformed physics: the photoelectric effect, Brownian motion, special relativity, and E=mc².",
  "Rosalind Franklin's X-ray crystallography Image 51 was the key evidence for the double-helix structure of DNA.",
  "India's Chandrayaan-3 landed on the Moon's south pole in 2023 — the first spacecraft to ever touch that region.",
  "Grace Hopper invented the first compiler, paving the way for modern programming languages.",
  "Alan Turing's 1936 paper 'On Computable Numbers' laid the foundation for all modern computing.",
  "C. V. Raman discovered the Raman Effect in 1928, earning India's first Nobel in Physics — the discovery was made in Calcutta.",
  "Srinivasa Ramanujan, a self-taught mathematician from Tamil Nadu, contributed over 3,900 theorems with minimal formal training.",
  "Generative AI research papers on arXiv grew from ~200 in 2020 to over 15,000 in 2025 — 75× growth in five years.",
  "Neural networks were first described mathematically in 1943 — long before computers could run them.",
  "The James Webb Space Telescope can detect the heat of a single candle 100,000 light-years away.",
  "ISRO's Mars Orbiter Mission (Mangalyaan, 2014) cost $74M — less than the budget of the film Gravity ($100M).",
  "The EU passed the AI Act in 2024 — the world's first comprehensive legal framework for artificial intelligence.",
  "Ancient Indian mathematician Aryabhata calculated pi to 3.1416 and explained lunar eclipses in 499 CE.",
  "India now publishes the third-most scientific research papers in the world, behind only China and the US.",
];

interface CreditData { balance: number; feedbackGiven: boolean; feedbackDate: string; feedbackText: string; }
const now = () => new Date().toDateString();
const defCD = (): CreditData => ({ balance: 30, feedbackGiven: false, feedbackDate: "", feedbackText: "" });
const mapCD = (d: Record<string, unknown>): CreditData => ({ balance: (d.balance as number) ?? 30, feedbackGiven: (d.feedback_given as boolean) ?? false, feedbackDate: (d.feedback_date as string) ?? "", feedbackText: (d.feedback_text as string) ?? "" });

function useMediaQuery(q: string) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(q);
    setM(mq.matches);
    const fn = (e: MediaQueryListEvent) => setM(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [q]);
  return m;
}

function Cursor() {
  return <span style={{ display: "inline-block", width: "2px", height: "14px", background: "#6EE7B7", verticalAlign: "middle", marginLeft: "4px", animation: "cursorBlink 1s step-end infinite" }} />;
}

function LoadingPulse({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#666", letterSpacing: "0.03em" }}>{label}</span>
      <span style={{ fontFamily: "monospace", fontSize: "14px", color: "#6EE7B7" }}>
        <span style={{ animation: "fadeDots 1.2s ease infinite" }}>.</span>
        <span style={{ animation: "fadeDots 1.2s ease infinite", animationDelay: "0.4s" }}>.</span>
        <span style={{ animation: "fadeDots 1.2s ease infinite", animationDelay: "0.8s" }}>.</span>
      </span>
    </div>
  );
}

export default function Home() {
  const [mode, setMode]           = useState<Mode>("topic");
  const [topic, setTopic]         = useState("");
  const [url, setUrl]             = useState("");
  const [topicA, setTopicA]       = useState("");
  const [topicB, setTopicB]       = useState("");
  const [tone, setTone]           = useState("default");
  const [loading, setLoading]     = useState(false);
  const [msg, setMsg]             = useState("");
  const [result, setResult]       = useState<Report | null>(null);
  const [history, setHistory]     = useState<HistoryItem[]>([]);
  const [cd, setCd]               = useState<CreditData>(defCD());
  const [error, setError]         = useState("");
  const [fileName, setFileName]   = useState("");
  
  const [sessionId, setSessionId] = useState("");
  
  const [quickAnswers, setQA]     = useState<Record<string, string>>({});
  const [loadingQ, setLoadingQ]   = useState<string | null>(null);
  const [sidebarOpen, setSB]      = useState(true);
  const [factIdx, setFactIdx]     = useState(0);
  const [heroHead, setHeroHead]   = useState(0);
  const [exLatex, setExLatex]     = useState(false);
  const [dark, setDark]           = useState(true);
  const [heroIn, setHeroIn]       = useState(false);
  const [toneOpen, setToneOpen]   = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackLove, setFeedbackLove] = useState("");
  const [feedbackImprove, setFeedbackImprove] = useState("");
  const [feedbackName, setFeedbackName] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [editReport, setEditReport] = useState("");
  const [editSection, setEditSection] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [clock, setClock] = useState(new Date());
  const [mobileMenu, setMobileMenu] = useState(false);

  const fileRef  = useRef<HTMLInputElement>(null);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const sbOpen = isMobile ? mobileMenu : sidebarOpen;

  useEffect(() => {
    (async () => {
      if (typeof window !== "undefined") { localStorage.removeItem("distill_credits"); }
      const cached = typeof window !== "undefined" ? localStorage.getItem(CREDIT_CACHE) : null;
      const sid = localStorage.getItem(SESSION_KEY);
      if (!sid) {
        try {
          const r = await fetch(`${API}/credits/init`, { method: "POST" });
          if (r.ok) { const d = await r.json(); const newSid: string = d.session_id; localStorage.setItem(SESSION_KEY, newSid); setSessionId(newSid); const m = mapCD(d); setCd(m); localStorage.setItem(CREDIT_CACHE, JSON.stringify(m)); return; }
        } catch {}
        if (cached) try { setCd(JSON.parse(cached)); } catch {}
      } else {
        try {
          const r = await fetch(`${API}/credits/${sid}`);
          if (r.ok) { const m = mapCD(await r.json()); setCd(m); localStorage.setItem(CREDIT_CACHE, JSON.stringify(m)); setSessionId(sid); return; }
          if (r.status === 404) localStorage.removeItem(SESSION_KEY);
        } catch {}
        try {
          const r2 = await fetch(`${API}/credits/init`, { method: "POST" });
          if (r2.ok) { const d = await r2.json(); const newSid: string = d.session_id; localStorage.setItem(SESSION_KEY, newSid); setSessionId(newSid); const m = mapCD(d); setCd(m); localStorage.setItem(CREDIT_CACHE, JSON.stringify(m)); return; }
        } catch {}
        if (cached) try { setCd(JSON.parse(cached)); } catch {}
      }
    })();
    setTimeout(() => setHeroIn(true), 60);
  }, []);
  useEffect(() => { const id = setInterval(() => setFactIdx(p => (p + 1) % FACTS.length), 10000); return () => clearInterval(id); }, []);
  useEffect(() => { const id = setInterval(() => setHeroHead(p => (p + 1) % HERO_HEADS.length), 60000); return () => clearInterval(id); }, []);
  useEffect(() => { const id = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { setMounted(true); }, []);

  const store = useCallback((r: Report) => {
    setResult(r); setEditReport(r.report); setEditSection(null); setTimeout(playResult, 200);
    const usedCost = CREDIT_COST[mode] || 1;
    const next = { ...cd, balance: Math.max(0, cd.balance - usedCost) };
    setCd(next);
    if (typeof window !== "undefined") localStorage.setItem(CREDIT_CACHE, JSON.stringify(next));
    if (sessionId) {
      fetch(`${API}/credits/deduct`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sessionId, cost: usedCost }) });
    }
    setHistory(prev => {
      if (prev.find(h => h.topic === r.topic)) return prev;
      return [{ topic: r.topic, sources: r.sources_found, report: r.report, followups: r.followups, contested: r.contested, mode: r.mode }, ...prev].slice(0, 12);
    });
    setTimeout(() => document.getElementById("rt")?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [cd, mode, sessionId]);

  const submit = async () => {
    const cost = CREDIT_COST[mode];
    if (cd.balance < cost) { setError(`This costs ${cost} credit${cost > 1 ? "s" : ""}. You have ${cd.balance}. Give feedback or share Distill to earn more.`); return; }
    setError(""); setLoading(true); setResult(null); playSubmit();
    try {
      if (mode === "topic") {
        if (!topic.trim()) { setError("Enter a topic."); setLoading(false); return; }
        setMsg("Gathering sources");
        const r = await fetch(`${API}/research/topic`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, depth: "normal", tone }) });
        const d = await r.json(); if (d.error) throw new Error(d.error); store(d);
      } else if (mode === "analyze") {
        if (!url.trim() && !fileName) { setError("Enter a URL or upload a file."); setLoading(false); return; }
        setMsg("Analyzing");
        const form = new FormData(); form.append("tone", tone);
        if (url.trim()) form.append("url", url);
        const file = fileRef.current?.files?.[0];
        if (file) form.append("file", file);
        const r = await fetch(`${API}/research/analyze`, { method: "POST", body: form });
        const d = await r.json(); if (d.error) throw new Error(d.error); store(d);
      } else if (mode === "compare") {
        if (!topicA.trim() || !topicB.trim()) { setError("Enter both topics."); setLoading(false); return; }
        setMsg("Comparing");
        const r = await fetch(`${API}/research/compare`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic_a: topicA, topic_b: topicB, depth: "normal" }) });
        const d = await r.json(); if (d.error) throw new Error(d.error); store(d);
      } else if (mode === "write_paper") {
        if (!topic.trim()) { setError("Enter a research topic."); setLoading(false); return; }
        setMsg("Querying Semantic Scholar");
        const r = await fetch(`${API}/paper/write`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, depth: "normal" }) });
        const d = await r.json(); if (d.error) throw new Error(d.error); store(d);
      }
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setLoading(false); setMsg(""); }
  };

  const doExport = async (fmt: "pdf" | "word") => {
    if (!result) return;
    try {
      const r = await fetch(`${API}/export/${fmt}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: result.topic, report: result.report, format: fmt }) });
      if (!r.ok) { setError("Export failed — backend not available"); return; }
      const blob = await r.blob();
      const filename = `distill-${result.topic.slice(0, 30).replace(/ /g, "-").toLowerCase()}.${fmt === "pdf" ? "pdf" : "docx"}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
    } catch { setError("Export failed"); }
  };

  const doLatex = async () => {
    if (!result) return; setExLatex(true);
    try {
      const reportToUse = resPaper ? editReport : result.report;
      const r = await fetch(`${API}/export/latex`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: result.topic, report: reportToUse, authors: "Distill Research Assistant" }) });
      if (!r.ok) { setError("LaTeX export failed — backend not available"); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      a.download = `distill-${result.topic.slice(0, 30).replace(/ /g, "-").toLowerCase()}.tex`;
      document.body.appendChild(a); a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
    } catch { setError("LaTeX export failed."); } finally { setExLatex(false); }
  };

  const doQuick = async (q: string) => {
    setLoadingQ(q);
    try {
      const r = await fetch(`${API}/quick-answer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q, context: result?.report.slice(0, 1000) }) });
      const d = await r.json(); setQA(p => ({ ...p, [q]: d.answer }));
    } catch { setQA(p => ({ ...p, [q]: "Could not load." })); } finally { setLoadingQ(null); }
  };

  const wc = (t: string) => {
    const w = t.replace(/[#*\[\]()]/g, "").split(/\s+/).filter(Boolean).length;
    return `${w.toLocaleString()} words — ${Math.max(1, Math.round(w / 200))} min`;
  };

  const T = dark ? {
    bg: "#0C0C0F", bgCard: "#131317", bgHover: "#1A1A20", bgMuted: "#111115",
    border: "#222228", borderStrong: "#2E2E38", borderAccent: "#AA9A8B",
    text: "#F0EFE8", textSub: "#B8B6AE", textMid: "#7A7870", textFaint: "#4A4845",
    accent: "#AA9A8B", accentBg: "rgba(170,154,139,0.08)", accentBgHov: "rgba(170,154,139,0.13)",
    rust: "#F87171", rustBg: "rgba(248,113,113,0.08)", sage: "#34d399", sageBg: "rgba(52,211,153,0.08)",
    amber: "#FCD34D", amberBg: "rgba(252,211,77,0.07)",
  } : {
    bg: "#F8F6F1", bgCard: "#FFFFFF", bgHover: "#F0EDE5", bgMuted: "#EFECE5",
    border: "#D6D2C8", borderStrong: "#B8B3A6", borderAccent: "#8A7A6B",
    text: "#1A1815", textSub: "#3D3A33", textMid: "#555248", textFaint: "#7C786A",
    accent: "#6B5D50", accentBg: "rgba(107,93,80,0.07)", accentBgHov: "rgba(107,93,80,0.12)",
    rust: "#DC2626", rustBg: "rgba(220,38,38,0.06)", sage: "#059669", sageBg: "rgba(5,150,105,0.06)",
    amber: "#D97706", amberBg: "rgba(217,119,6,0.06)",
  };

  const SERIF = "'Source Serif 4','Georgia',serif";
  const SANS  = "'Inter',-apple-system,system-ui,sans-serif";
  const MONO  = "'JetBrains Mono','SF Mono',ui-monospace,monospace";
  const isPaper = mode === "write_paper";
  const resPaper = result?.mode === "write_paper";
  const M = isMobile;
  const p = <T,>(d: T, m: T): T => M ? m : d;

  const h = (txt: string) => txt
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" target="_blank" style="color:${T.accent};text-decoration:underline;text-underline-offset:3px;text-decoration-color:${T.border}">$1</a>`)
    .replace(/\*\*([^*]+)\*\*/g, `<strong style="color:${T.text};font-weight:650">$1</strong>`)
    .replace(/\*([^*]+)\*/g, `<em style="color:${T.textMid}">$1</em>`)
    .replace(/\[Confirmed\]/g, `<span style="font-family:${MONO};font-size:11px;color:${T.sage};background:${T.sageBg};padding:2px 8px;border-radius:4px;letter-spacing:0.05em;font-weight:700;margin-left:4px;border-left:2px solid ${T.sage}">CONFIRMED</span>`)
    .replace(/\[Emerging\]/g, `<span style="font-family:${MONO};font-size:11px;color:${T.amber};background:${T.amberBg};padding:2px 8px;border-radius:4px;letter-spacing:0.05em;font-weight:700;margin-left:4px;border-left:2px solid ${T.amber}">EMERGING</span>`)
    .replace(/\[Debated\]/g, `<span style="font-family:${MONO};font-size:11px;color:${T.rust};background:${T.rustBg};padding:2px 8px;border-radius:4px;letter-spacing:0.05em;font-weight:700;margin-left:4px;border-left:2px solid ${T.rust}">DEBATED</span>`)
    .replace(/\[Unclear\]/g, `<span style="font-family:${MONO};font-size:11px;color:${T.textFaint};background:${T.bgCard};padding:2px 8px;border-radius:4px;letter-spacing:0.05em;font-weight:700;margin-left:4px;border-left:2px solid ${T.textFaint}">UNCLEAR</span>`);

  const parseSections = (text: string) => {
    const lines = text.split("\n"); const secs: { id: number; full: string }[] = [];
    let cur: string[] = [];
    for (const line of lines) {
      if (line.startsWith("## ")) { if (cur.length) { secs.push({ id: secs.length, full: cur.join("\n") }); cur = []; } }
      cur.push(line);
    }
    if (cur.length) secs.push({ id: secs.length, full: cur.join("\n") });
    return secs;
  };

  const renderReport = (text: string) => {
    const lines = text.split("\n");
    const out: React.ReactElement[] = [];
    let tRows: string[][] = []; let inTable = false;
    const flush = () => {
      if (!tRows.length) return;
      const [hdr, , ...bodyRows] = tRows;
      out.push(
        <div key={`t${out.length}`} style={{ overflowX: "auto", margin: "8px 0 28px", borderRadius: "8px", border: `1px solid ${T.border}` }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: T.bgMuted }}>
              {(hdr || []).map((c, j) => <th key={j} style={{ padding: "10px 14px", textAlign: "left", fontSize: "10.5px", fontWeight: 600, color: T.textMid, letterSpacing: "0.07em", textTransform: "uppercase", fontFamily: MONO, borderBottom: `1px solid ${T.border}` }}>{c}</th>)}
            </tr></thead>
            <tbody>{bodyRows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 1 ? T.bgMuted : "transparent" }}>
                {row.map((c, j) => <td key={j} style={{ padding: "9px 14px", fontSize: "13.5px", color: T.textSub, borderBottom: i < bodyRows.length - 1 ? `1px solid ${T.border}` : "none", fontFamily: SANS }} dangerouslySetInnerHTML={{ __html: h(c) }} />)}
              </tr>
            ))}</tbody>
          </table>
        </div>
      );
      tRows = []; inTable = false;
    };
    lines.forEach((raw, i) => {
      const line = raw.trim();
      if (line.startsWith("|")) {
        const cells = line.split("|").map(c => c.trim()).filter((_, idx, a) => idx > 0 && idx < a.length - 1);
        if (!cells.every(c => c.match(/^-+$/))) { tRows.push(cells); inTable = true; } return;
      }
      if (inTable) flush();
      if (!line) { out.push(<div key={i} style={{ height: "9px" }} />); return; }
      if (line.startsWith("# "))
        out.push(<h1 key={i} style={{ fontFamily: SERIF, fontSize: "28px", fontWeight: 600, color: T.text, letterSpacing: "-0.01em", marginBottom: "8px", marginTop: 0, lineHeight: "1.2" }}>{line.slice(2)}</h1>);
      else if (line.startsWith("## "))
        out.push(<div key={i} style={{ display: "flex", alignItems: "center", gap: "14px", marginTop: "44px", marginBottom: "18px" }}>
          <span style={{ fontFamily: MONO, fontSize: "10.5px", fontWeight: 600, color: T.accent, letterSpacing: "0.12em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{line.slice(3)}</span>
          <div style={{ flex: 1, height: "1px", background: T.border }} />
        </div>);
      else if (line.startsWith("### "))
        out.push(<h3 key={i} style={{ fontFamily: SERIF, fontSize: "17px", fontWeight: 600, color: T.textSub, marginTop: "22px", marginBottom: "9px" }}>{line.slice(4)}</h3>);
      else if (line.startsWith("#### "))
        out.push(<h4 key={i} style={{ fontFamily: MONO, fontSize: "12px", fontWeight: 600, color: T.textMid, marginTop: "16px", marginBottom: "7px", letterSpacing: "0.02em" }}>{line.slice(5)}</h4>);
      else if (line.startsWith("- ") || line.startsWith("* "))
        out.push(<div key={i} style={{ display: "flex", gap: "12px", marginBottom: "11px" }}>
          <span style={{ color: T.accent, flexShrink: 0, marginTop: "9px", fontSize: "5px" }}>◆</span>
          <p style={{ fontFamily: SANS, fontSize: "14.5px", color: T.textSub, lineHeight: "1.78", margin: 0 }} dangerouslySetInnerHTML={{ __html: h(line.slice(2)) }} />
        </div>);
      else if (line.match(/^\d+\.\s/))
        out.push(<div key={i} style={{ display: "flex", gap: "12px", marginBottom: "11px" }}>
          <span style={{ fontFamily: MONO, color: T.accent, flexShrink: 0, fontSize: "12px", fontWeight: 700, minWidth: "20px" }}>{line.match(/^\d+/)?.[0]}</span>
          <p style={{ fontFamily: SANS, fontSize: "14.5px", color: T.textSub, lineHeight: "1.78", margin: 0 }} dangerouslySetInnerHTML={{ __html: h(line.replace(/^\d+\.\s/, "")) }} />
        </div>);
      else if (line.startsWith(">"))
        out.push(<blockquote key={i} style={{ borderLeft: `2px solid ${T.accent}`, paddingLeft: "16px", margin: "18px 0", color: T.textMid, fontFamily: SERIF, fontStyle: "italic", fontSize: "15px", lineHeight: "1.7" }}>{line.slice(1).trim()}</blockquote>);
      else if (line.startsWith("http"))
        out.push(<a key={i} href={line} target="_blank" style={{ display: "block", fontSize: "12px", fontFamily: MONO, color: T.textMid, marginBottom: "4px", textDecoration: "underline", wordBreak: "break-all" }}>{line}</a>);
      else if (line.match(/^[-_*]{3,}$/))
        out.push(<div key={i} style={{ height: "1px", background: T.border, margin: "26px 0" }} />);
      else
        out.push(<p key={i} style={{ fontFamily: SANS, fontSize: "14.5px", color: T.textSub, lineHeight: "1.82", marginBottom: "13px" }} dangerouslySetInnerHTML={{ __html: h(line) }} />);
    });
    if (inTable) flush();
    return out;
  };

  const renderContested = (text: string) => {
    if (!text || text.toLowerCase().includes("broadly consistent")) return null;
    const items = text.split("\n").filter(l => l.trim()).map((line, i) => {
      const clean = line.replace(/^[-*]\s*/, "").trim();
      if (!clean) return null;
      return <p key={i} style={{ fontFamily: SANS, fontSize: "13.5px", color: T.textMid, lineHeight: "1.75", marginBottom: "10px" }} dangerouslySetInnerHTML={{ __html: clean.replace(/\*\*([^*]+)\*\*/g, `<strong style="color:${T.textSub};font-weight:600">$1</strong>`) }} />;
    });
    return items.some(Boolean) ? items : null;
  };

  const inp: React.CSSProperties = { width: "100%", background: "transparent", border: "none", borderBottom: `1.5px solid ${T.borderStrong}`, padding: "15px 2px", fontFamily: SERIF, fontSize: p("20px", "18px"), color: T.text, outline: "none", transition: "border-color 0.2s" };
  const chip = (active: boolean): React.CSSProperties => ({ padding: "5px 12px", fontFamily: MONO, fontSize: "11px", fontWeight: 600, background: active ? T.accent : "transparent", color: active ? (dark ? "#0C0C0F" : T.bg) : T.textMid, border: `1px solid ${active ? T.accent : T.borderStrong}`, cursor: "pointer", transition: "all 0.15s", letterSpacing: "0.02em", borderRadius: "3px" });

  const upRow = (fn: string, ref: React.RefObject<HTMLInputElement | null>, setFn: (s: string) => void, ph: string) => (
    <div onClick={() => ref.current?.click()}
      style={{ display: "flex", alignItems: "center", gap: "16px", border: `1.5px dashed ${T.borderStrong}`, padding: "20px 18px", cursor: "pointer", transition: "all 0.2s", background: T.bgMuted, borderRadius: "6px" }}>
      <span style={{ fontFamily: MONO, fontSize: "16px", color: T.accent }}>↑</span>
      <p style={{ fontFamily: SANS, fontSize: "14px", color: fn ? T.text : T.textMid, margin: 0, flex: 1, fontWeight: fn ? 600 : 400 }}>{fn || ph}</p>
      {fn && <span style={{ fontFamily: MONO, fontSize: "10px", color: T.sage, fontWeight: 700, letterSpacing: "0.05em" }}>READY</span>}
      <input ref={ref} type="file" accept=".pdf" style={{ display: "none" }} onChange={e => { setFn(e.target.files?.[0]?.name || ""); setError(""); }} />
    </div>
  );

  const aBtn = (label: string, dis: boolean, fn: () => void, col: "accent" | "amber" = "accent") => (
    <button onClick={fn} disabled={dis} style={{ marginTop: "16px", padding: "12px 28px", fontFamily: MONO, fontSize: "12px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", background: dis ? T.bgHover : (col === "accent" ? T.accent : T.amber), color: dis ? T.textFaint : (dark ? "#0C0C0F" : "#fff"), border: "none", cursor: dis ? "not-allowed" : "pointer", transition: "all 0.18s", borderRadius: "4px" }}>{label}</button>
  );

  const coreTabs: { id: Mode; label: string; tip: string }[] = [
    { id: "topic", label: "Research", tip: "Research any topic — web + academic sources with evidence tags" },
    { id: "analyze", label: "Analyze", tip: "Analyze a URL or PDF — checks claims against the web" },
    { id: "compare", label: "Compare", tip: "Compare two subjects side by side" },
  ];
  const acadTabs: { id: Mode; label: string; tip: string }[] = [
    { id: "write_paper", label: "Literature Review", tip: "IEEE-formatted review with real academic citations" },
  ];

  const sidebarContent = (
    <div style={{ padding: sbOpen ? "24px 18px" : "24px 12px", display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", flexDirection: "column", marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div onClick={() => { if (!M && !sbOpen) setSB(true); }} style={{ width: sbOpen ? "44px" : "32px", height: sbOpen ? "44px" : "32px", background: T.accent, borderRadius: sbOpen ? "10px" : "7px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.25s", cursor: sbOpen ? "default" : "pointer", position: "relative" }}>
            <span style={{ fontFamily: SERIF, fontSize: sbOpen ? "22px" : "16px", fontWeight: 700, color: dark ? "#0C0C0F" : "#fff", fontStyle: "italic", lineHeight: 1 }}>D</span>
          </div>
          {sbOpen && <div style={{ marginLeft: "10px", display: "flex", flexDirection: "column" }}>
            <span style={{ fontFamily: SERIF, fontSize: "16px", fontWeight: 700, color: T.text, lineHeight: 1.2 }}>Distill</span>
            <span style={{ fontFamily: MONO, fontSize: "10px", fontWeight: 500, color: T.textMid, letterSpacing: "0.04em", marginTop: "3px" }}>Research, Refined</span>
          </div>}
          {sbOpen && (M ? (
            <button onClick={() => setMobileMenu(false)} style={{ background: "none", border: "none", cursor: "pointer", color: T.textFaint, fontSize: "20px", padding: "2px 6px", fontFamily: "inherit", marginLeft: "auto" }}>✕</button>
          ) : (
            <button onClick={() => setSB(false)} style={{ background: "none", border: "none", cursor: "pointer", color: T.textFaint, fontSize: "14px", padding: "2px 0", fontFamily: "inherit", marginLeft: "auto" }}>‹</button>
          ))}
        </div>
        {sbOpen && <button onClick={() => setDark(p => !p)} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: "5px", padding: "3px 7px", fontSize: "12px", cursor: "pointer", color: T.textMid, marginTop: "10px", fontFamily: "inherit", alignSelf: "flex-start" }}>{dark ? "☀" : "◑"}</button>}
      </div>

      {!sbOpen && <button onClick={() => setDark(p => !p)} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: "5px", padding: "5px", fontSize: "12px", cursor: "pointer", color: T.textMid, marginBottom: "16px", fontFamily: "inherit" }}>{dark ? "☀" : "◑"}</button>}

      {sbOpen && <>
        <div style={{ marginBottom: "12px", paddingBottom: "14px", borderBottom: `1px solid ${T.border}` }}>
          <p style={{ fontFamily: MONO, fontSize: "9px", color: T.textFaint, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px" }}>Credits</p>
          <div style={{ background: T.bg, borderRadius: "6px", padding: "12px 14px", border: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "8px" }}>
              <span style={{ fontFamily: MONO, fontSize: "28px", fontWeight: 700, color: T.accent, lineHeight: 1 }}>{cd.balance}</span>
              <span style={{ fontFamily: MONO, fontSize: "9px", color: T.textFaint }}>available</span>
            </div>
            <div style={{ height: "1px", background: T.border, marginBottom: "8px" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: MONO, fontSize: "8px", color: T.textFaint, letterSpacing: "0.03em", textTransform: "uppercase" }}>{mode}</span>
              <span style={{ fontFamily: MONO, fontSize: "13px", fontWeight: 600, color: T.textMid }}>−{CREDIT_COST[mode]}</span>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: "14px", paddingBottom: "14px", borderBottom: `1px solid ${T.border}` }}>
          <p style={{ fontFamily: MONO, fontSize: "9px", color: T.textFaint, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>Earn More</p>
          <button onClick={() => { if (!cd.feedbackGiven) { setShowFeedback(true); setFeedbackRating(0); setFeedbackLove(""); setFeedbackImprove(""); } }}
            style={{ width: "100%", padding: "7px 10px", fontFamily: MONO, fontSize: "9px", fontWeight: 700, background: cd.feedbackGiven ? T.bgMuted : T.accentBg, color: cd.feedbackGiven ? T.textFaint : T.accent, border: `1px solid ${cd.feedbackGiven ? T.border : T.accent}`, borderRadius: "4px", cursor: cd.feedbackGiven ? "default" : "pointer", letterSpacing: "0.03em", textTransform: "uppercase", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{cd.feedbackGiven ? "✓ Feedback submitted" : "✎ Submit feedback"}</span>
            <span style={{ fontFamily: MONO, fontSize: "8px", opacity: 0.8 }}>+10</span>
          </button>
        </div>

        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <p style={{ fontFamily: MONO, fontSize: "9px", color: T.textFaint, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>History</p>
          {history.length === 0 ? <p style={{ fontFamily: SANS, fontSize: "11.5px", color: T.textFaint, lineHeight: "1.6" }}>Your research appears here.</p>
            : <div style={{ display: "flex", flexDirection: "column", gap: "1px", overflowY: "auto", flex: 1 }}>
                {history.map((item, i) => (
                  <button key={i} onClick={() => { setResult({ topic: item.topic, report: item.report, sources_found: item.sources, followups: item.followups, contested: item.contested, mode: item.mode }); setEditReport(item.report); setEditSection(null); if (M) setMobileMenu(false); }}
                    style={{ width: "100%", textAlign: "left", padding: "6px 10px", fontFamily: SANS, fontSize: "11.5px", color: T.textMid, background: "transparent", border: "none", borderLeft: "2px solid transparent", cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.topic}
                  </button>
                ))}
              </div>}
        </div>

        <div style={{ paddingTop: "10px", borderTop: `1px solid ${T.border}`, marginTop: "10px" }}>
          <p style={{ fontFamily: MONO, fontSize: "9px", color: T.textFaint, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>Did You Know?</p>
          <p key={factIdx} style={{ fontFamily: SANS, fontSize: "11px", color: T.textMid, lineHeight: "1.6", animation: "fadeIn 0.6s ease" }}>{FACTS[factIdx]}</p>
        </div>
      </>}
    </div>
  );

  const mainPad = p("74px 62px 130px", "28px 16px 80px");
  const heroMb = p("52px", "36px");
  const heroTitleSize = p("clamp(2rem,3.6vw,2.8rem)", "clamp(1.5rem,5vw,2.2rem)");

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.bg, color: T.textSub, fontFamily: SANS, transition: "background 0.3s,color 0.3s" }}>
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", background: `radial-gradient(ellipse 80% 60% at 50% -20%, ${dark ? "rgba(170,154,139,0.06)" : "rgba(107,93,80,0.04)"} 0%, transparent 70%)` }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", background: `radial-gradient(ellipse 50% 50% at 100% 100%, ${dark ? "rgba(170,154,139,0.04)" : "rgba(107,93,80,0.03)"} 0%, transparent 60%)` }} />

      {/* Mobile top bar */}
      {M && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: T.bgCard, borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button onClick={() => setMobileMenu(true)} style={{ background: "none", border: "none", cursor: "pointer", color: T.text, fontSize: "20px", fontFamily: "inherit", padding: "4px", display: "flex", alignItems: "center" }}>☰</button>
            <div style={{ width: "32px", height: "32px", background: T.accent, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: SERIF, fontSize: "16px", fontWeight: 700, color: dark ? "#0C0C0F" : "#fff", fontStyle: "italic" }}>D</span>
            </div>
            <span style={{ fontFamily: SERIF, fontSize: "15px", fontWeight: 600, color: T.text }}>Distill</span>
          </div>
          <button onClick={() => setDark(p => !p)} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: "5px", padding: "4px 8px", fontSize: "14px", cursor: "pointer", color: T.textMid, fontFamily: "inherit" }}>{dark ? "☀" : "◑"}</button>
        </div>
      )}

      {/* Mobile sidebar overlay */}
      {M && mobileMenu && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100 }}>
          <div onClick={() => setMobileMenu(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} />
          <aside style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "280px", background: T.bgCard, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", overflow: "hidden", animation: "slideInLeft 0.2s ease" }}>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      {!M && (
        <aside style={{ width: sidebarOpen ? "256px" : "56px", flexShrink: 0, borderRight: `1px solid ${T.border}`, minHeight: "100vh", display: "flex", flexDirection: "column", transition: "width 0.3s cubic-bezier(.4,0,.2,1)", overflow: "hidden", position: "sticky", top: 0, height: "100vh", zIndex: 10, background: T.bgCard }}>
          {sidebarContent}
        </aside>
      )}

      {/* Main content */}
      <main style={{ flex: 1, overflowY: "auto", position: "relative", zIndex: 1, marginTop: M ? "56px" : 0, paddingBottom: "80px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: mainPad }}>

          {/* Hero */}
          <div style={{ opacity: heroIn ? 1 : 0, transition: "opacity 1.2s ease", marginBottom: heroMb }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: p("20px", "16px") }}>
              <div style={{ width: "24px", height: "1.5px", background: T.accent }} />
              <span style={{ fontFamily: MONO, fontSize: "10px", color: T.accent, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>Research Assistant<Cursor /></span>
            </div>
            <div style={{ marginBottom: p("32px", "24px") }}>
              <h1 key={"h" + heroHead} style={{ fontFamily: SERIF, fontSize: heroTitleSize, fontWeight: 600, color: T.text, lineHeight: 1.12, letterSpacing: "-0.015em", marginBottom: "16px", maxWidth: "620px", animation: "fadeIn 0.5s ease" }}>
                {HERO_HEADS[heroHead].split("\n").map((line, i) => <span key={i}>{line}{i < HERO_HEADS[heroHead].split("\n").length - 1 && <br />}</span>)}
              </h1>
            </div>
            <div style={{ display: "flex", flexDirection: M ? "column" : "row", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
              {[
                { icon: "1", label: "You ask", sub: "Type a topic, paste a URL, or upload a PDF" },
                { icon: "2", label: "We search & compare", sub: "Multiple sources read in parallel — web + academic papers" },
                { icon: "3", label: "Report with confidence", sub: M ? "Every claim tagged with real citations" : "Every claim tagged confirmed · emerging · debated · unclear, with real citations" },
              ].map((s, i) => (
                <div key={i} title={s.sub} style={{ flex: M ? "none" : 1, padding: p("14px 16px", "12px 14px"), borderRight: M ? "none" : (i < 2 ? `1px solid ${T.border}` : "none"), borderBottom: M && i < 2 ? `1px solid ${T.border}` : "none", cursor: "default" }}>
                  <span style={{ fontFamily: MONO, fontSize: "13px", fontWeight: 700, color: T.accent, display: "block", marginBottom: p("8px", "6px") }}>{s.icon}</span>
                  <p style={{ fontFamily: SANS, fontSize: "12px", color: T.text, fontWeight: 600, marginBottom: "4px" }}>{s.label}</p>
                  <p style={{ fontFamily: SANS, fontSize: "11px", color: T.textMid, lineHeight: "1.45", margin: 0 }}>{s.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ marginBottom: p("24px", "20px") }}>
            <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, marginBottom: "-1px", alignItems: "center", overflowX: M ? "auto" : "visible", WebkitOverflowScrolling: M ? "touch" : undefined }}>
              {[...coreTabs, ...acadTabs].map(m => (
                <button key={m.id} title={m.tip} onClick={() => { setMode(m.id); setError(""); }}
                  style={{ padding: p("11px 18px", "10px 14px"), background: mode === m.id ? T.accentBg : "transparent", border: "none", borderBottom: `2px solid ${mode === m.id ? T.accent : "transparent"}`, cursor: "pointer", fontFamily: MONO, fontSize: p("11px", "10px"), fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: mode === m.id ? T.accent : T.textFaint, marginBottom: "-1px", whiteSpace: "nowrap", flexShrink: M ? 0 : undefined }}>
                  {m.label}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              {mode === "write_paper" && <span style={{ fontFamily: MONO, fontSize: "9px", color: T.accent, letterSpacing: "0.06em", paddingBottom: "12px", whiteSpace: "nowrap", flexShrink: 0 }}>IEEE-FORMAT</span>}
            </div>
          </div>

          {/* Tone selector */}
          {!isPaper && mode !== "compare" && (
            <div style={{ marginBottom: p("24px", "20px") }}>
              <button onClick={() => setToneOpen(p => !p)} style={{ display: "flex", alignItems: "center", gap: "10px", background: T.bgMuted, border: `1px solid ${toneOpen ? T.accent : T.border}`, borderRadius: "6px", cursor: "pointer", padding: "10px 14px", width: "100%", fontFamily: "inherit" }}>
                <span style={{ fontFamily: MONO, fontSize: "12px", fontWeight: 700, color: T.accent, letterSpacing: "0.02em" }}>Style</span>
                <span style={{ flex: 1, fontFamily: SANS, fontSize: "13px", color: T.text, textAlign: "left" }}>{TONES.find(t => t.value === tone)?.label}</span>
                <span style={{ fontFamily: MONO, fontSize: "10px", color: T.textFaint, transform: toneOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
              </button>
              {toneOpen && (
                <div style={{ marginTop: "6px", border: `1px solid ${T.border}`, borderRadius: "6px", overflow: "hidden", background: T.bgCard }}>
                  {TONES.map(t => {
                    const descs: Record<string, string> = { default: "Clear and simple", academic: "Formal, cited, methodical", executive: "Short, decisive", journalist: "Active voice, story-driven" };
                    return (
                    <button key={t.value} onClick={() => { setTone(t.value); setToneOpen(false); }}
                      style={{ width: "100%", textAlign: "left", padding: "10px 14px", background: tone === t.value ? T.accentBg : "transparent", border: "none", borderBottom: `1px solid ${T.border}`, cursor: "pointer", fontFamily: "inherit", display: "block" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: SANS, fontSize: "13px", fontWeight: tone === t.value ? 700 : 500, color: tone === t.value ? T.accent : T.text }}>{t.label}</span>
                        {tone === t.value && <span style={{ fontFamily: MONO, fontSize: "10px", color: T.accent }}>✓</span>}
                      </div>
                      <p style={{ fontFamily: SANS, fontSize: "11px", color: T.textMid, margin: "2px 0 0", lineHeight: "1.4" }}>{descs[t.value]}</p>
                    </button>
                  );})}
                </div>
              )}
            </div>
          )}

          {/* Inputs per mode */}
          {mode === "topic" && (
            <div style={{ marginBottom: p("32px", "28px") }}>
              <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === "Enter" && !loading && submit()}
                placeholder={M ? "Subject of inquiry" : "Subject of inquiry — e.g. remote work and productivity"} style={inp} autoFocus />
              {aBtn(loading ? "Distilling…" : "Begin Distillation", loading || !topic.trim(), submit)}
            </div>
          )}
          {mode === "analyze" && (
            <div style={{ marginBottom: p("32px", "28px") }}>
              <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && !loading && submit()}
                placeholder={M ? "Paste a URL — https://" : "Paste a URL to analyze — https://"} style={{ ...inp, fontFamily: MONO, fontSize: p("15px", "14px") }} autoFocus />
              <div style={{ margin: "12px 0", textAlign: "center", fontFamily: MONO, fontSize: "9px", color: T.textFaint, letterSpacing: "0.06em" }}>OR</div>
              {upRow(fileName, fileRef, setFileName, M ? "Upload a PDF" : "Upload a PDF to analyze")}
              {aBtn(loading ? "Analyzing…" : "Analyze", loading || (!url.trim() && !fileName), submit)}
            </div>
          )}
          {mode === "compare" && (
            <div style={{ marginBottom: p("32px", "28px") }}>
              <div style={{ display: "flex", flexDirection: M ? "column" : "row", alignItems: M ? "stretch" : "flex-end", gap: M ? "12px" : "18px" }}>
                <input value={topicA} onChange={e => setTopicA(e.target.value)} placeholder="First subject" style={{ ...inp, flex: 1 }} autoFocus />
                <span style={{ fontFamily: MONO, fontSize: "11px", fontWeight: 700, color: T.textFaint, textAlign: "center", paddingBottom: M ? 0 : "18px", flexShrink: 0 }}>VS</span>
                <input value={topicB} onChange={e => setTopicB(e.target.value)} onKeyDown={e => e.key === "Enter" && !loading && submit()} placeholder="Second subject" style={{ ...inp, flex: 1 }} />
              </div>
              {aBtn(loading ? "Comparing…" : "Compare", loading || !topicA.trim() || !topicB.trim(), submit)}
            </div>
          )}
          {mode === "write_paper" && (
            <div style={{ marginBottom: p("32px", "28px") }}>
              <div style={{ padding: p("14px 18px 0", "14px 0 0"), marginBottom: "20px" }}>
                <p style={{ fontFamily: SANS, fontSize: "12.5px", color: T.textSub, lineHeight: "1.65", margin: 0, fontWeight: 600 }}>What this generates</p>
                <p style={{ fontFamily: SANS, fontSize: "12.5px", color: T.textFaint, lineHeight: "1.65", marginTop: "4px", marginBottom: 0 }}>
                  {M ? "A literature review in IEEE format, grounded in real papers." : "A literature review grounded in real Semantic Scholar papers, structured in IEEE format. You supply the original data, results, and contribution."}
                </p>
              </div>
              <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === "Enter" && !loading && submit()}
                placeholder={M ? "Research topic" : "Research topic — e.g. ML in climate change prediction"} style={inp} autoFocus />
              {aBtn(loading ? "Generating…" : "Generate Review", loading || !topic.trim(), submit, "amber")}
            </div>
          )}
          
          {loading && <div style={{ marginBottom: p("32px", "28px") }}><LoadingPulse label={`${msg}…${isPaper ? " (~45 seconds)" : ""}`} /></div>}
          {error && <div style={{ fontFamily: SANS, fontSize: "13px", color: T.rust, marginBottom: p("24px", "20px"), padding: "10px 14px", background: T.rustBg, borderLeft: `2px solid ${T.rust}`, borderRadius: "0 4px 4px 0" }}>{error}</div>}

          {/* Result */}
          {result && !loading && (
            <div id="rt" style={{ animation: "slideUp 0.4s cubic-bezier(.4,0,.2,1) forwards" }}>
              <div style={{ display: "flex", flexDirection: M ? "column" : "row", justifyContent: "space-between", alignItems: M ? "flex-start" : "center", gap: "8px", marginBottom: p("32px", "24px"), paddingBottom: "16px", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: MONO, fontSize: "10px", color: T.textFaint, letterSpacing: "0.08em" }}>{result.sources_found} SOURCES</span>
                  {result.mode && <span style={{ fontFamily: MONO, fontSize: "9.5px", color: resPaper ? T.accent : T.textMid, padding: "2px 8px", background: resPaper ? T.accentBg : T.bgMuted, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600, borderRadius: "4px", border: `1px solid ${resPaper ? T.accent : T.border}` }}>
                    {result.mode === "write_paper" ? "Literature Review · IEEE" : result.mode}
                  </span>}
                </div>
                <span style={{ fontFamily: MONO, fontSize: "10px", color: T.textFaint }}>{wc(result.report)}</span>
              </div>

              {resPaper && <div style={{ marginBottom: "24px" }}>
                <p style={{ fontFamily: SANS, fontSize: "12px", color: T.textFaint, margin: 0, lineHeight: "1.6" }}>Literature review grounded in real peer-reviewed sources. Verify every citation.</p>
              </div>}

              {!resPaper && <div style={{ marginBottom: "24px", padding: "10px 14px", background: T.bgMuted, borderRadius: "6px", border: `1px solid ${T.border}` }}>
                <span style={{ fontFamily: SANS, fontSize: "11.5px", color: T.textSub, lineHeight: "1.5" }}>
                  Distill searches multiple sources and tags each claim: <strong style={{ color: T.sage }}>confirmed</strong>, <strong style={{ color: T.amber }}>emerging</strong>, <strong style={{ color: T.rust }}>debated</strong>, <strong style={{ color: T.textFaint }}>unclear</strong>.
                </span>
              </div>}

              {resPaper && <div style={{ marginBottom: "16px" }}>
                <p style={{ fontFamily: SANS, fontSize: "11.5px", color: T.textFaint, margin: 0, lineHeight: "1.5" }}>Click edit on any section below to add your own data, results, or methodology.</p>
              </div>}

              {resPaper ? (
                <div style={{ marginBottom: p("48px", "36px") }}>
                  {parseSections(editReport).map((sec) => (
                    <div key={sec.id} style={{ marginBottom: "8px", position: "relative" }}>
                      {editSection === sec.id ? (
                        <div>
                          <textarea value={sec.full} onChange={e => { const parts = parseSections(editReport); parts[sec.id] = { ...sec, full: e.target.value }; setEditReport(parts.map(p => p.full).join("\n")); }}
                            style={{ width: "100%", minHeight: p("180px", "160px"), padding: "12px", fontFamily: MONO, fontSize: "12px", color: T.textSub, background: T.bg, border: `1px solid ${T.accent}`, borderRadius: "6px", outline: "none", resize: "vertical", lineHeight: "1.6" }} />
                          <button onClick={() => setEditSection(null)} style={{ marginTop: "6px", padding: "6px 14px", fontFamily: MONO, fontSize: "10px", fontWeight: 700, background: T.accent, color: dark ? "#0C0C0F" : "#fff", border: "none", borderRadius: "4px", cursor: "pointer", letterSpacing: "0.04em", textTransform: "uppercase" }}>Done</button>
                        </div>
                      ) : (
                        <div>
                          {renderReport(sec.full)}
                          {sec.id === editSection && <div style={{ textAlign: "right", marginTop: "2px" }}>
                            <button onClick={() => setEditSection(sec.id)} style={{ padding: "2px 10px", fontFamily: MONO, fontSize: "9px", fontWeight: 700, background: "transparent", color: T.accent, border: `1px solid ${T.accent}`, borderRadius: "3px", cursor: "pointer", letterSpacing: "0.02em", opacity: 0.45 }}>✎ Edit section</button>
                          </div>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ marginBottom: p("48px", "36px") }}>{renderReport(result.report)}</div>
              )}

              {!isPaper && result.contested && renderContested(result.contested) && (
                <div style={{ marginBottom: p("40px", "32px"), paddingTop: p("28px", "24px"), borderTop: `1px solid ${T.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "18px" }}>
                    <span style={{ fontFamily: MONO, fontSize: "10.5px", fontWeight: 700, color: T.rust, letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Where Sources Disagree</span>
                    <div style={{ flex: 1, height: "1px", background: T.border }} />
                  </div>
                  <div style={{ paddingLeft: "14px", borderLeft: `2px solid ${T.rust}` }}>{renderContested(result.contested)}</div>
                </div>
              )}

              <div style={{ padding: p("18px 0", "16px 0"), borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, marginBottom: p("36px", "28px") }}>
                <div style={{ display: "flex", flexDirection: M ? "column" : "row", justifyContent: "space-between", alignItems: M ? "flex-start" : "center", gap: M ? "10px" : 0 }}>
                  <span style={{ fontFamily: MONO, fontSize: "10px", color: T.textFaint, letterSpacing: "0.08em", textTransform: "uppercase" }}>Export</span>
                  <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
                    {(["pdf", "word"] as const).map(fmt => (
                      <button key={fmt} onClick={() => doExport(fmt)} style={{ background: "none", border: "none", fontFamily: MONO, fontSize: "11.5px", fontWeight: 700, color: T.textMid, cursor: "pointer", padding: 0, letterSpacing: "0.03em" }}>↓ {fmt.toUpperCase()}</button>
                    ))}
                    {resPaper && <button onClick={doLatex} disabled={exLatex} style={{ background: "none", border: `1px solid ${T.accent}`, padding: "5px 12px", fontFamily: MONO, fontSize: "11px", fontWeight: 700, color: T.accent, cursor: exLatex ? "not-allowed" : "pointer", opacity: exLatex ? 0.5 : 1, letterSpacing: "0.02em", borderRadius: "4px" }}>
                      {exLatex ? "···" : "↓ LATEX (IEEE)"}
                    </button>}
                  </div>
                </div>
                {resPaper && <p style={{ fontFamily: SANS, fontSize: "11px", color: T.textFaint, marginTop: "10px" }}>Open the .tex in <a href="https://overleaf.com" target="_blank" style={{ color: T.accent, textDecoration: "underline" }}>Overleaf</a> → compile → IEEE two-column PDF.</p>}
              </div>

              {!isPaper && result.followups.length > 0 && (
                <div style={{ marginBottom: p("48px", "36px") }}>
                  <p style={{ fontFamily: MONO, fontSize: "10px", color: T.textFaint, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "18px" }}>Further Inquiry</p>
                  {result.followups.map((q, qi) => (
                    <div key={qi}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: p("16px", "12px"), padding: "14px 0", borderTop: qi === 0 ? "none" : `1px solid ${T.border}`, flexWrap: M ? "wrap" : "nowrap" }}>
                        <span style={{ fontFamily: MONO, fontSize: "10px", fontWeight: 700, color: T.accent, marginTop: "3px", flexShrink: 0 }}>{String(qi + 1).padStart(2, "0")}</span>
                        <p style={{ fontFamily: SERIF, fontSize: "15px", color: T.textSub, lineHeight: "1.55", flex: M ? "1 1 100%" : 1, margin: 0, order: M ? 3 : 0 }}>{q}</p>
                        <div style={{ display: "flex", gap: p("16px", "12px"), flexShrink: 0 }}>
                          <button onClick={() => doQuick(q)} disabled={loadingQ === q} style={{ background: "none", border: "none", fontFamily: MONO, fontSize: "10.5px", fontWeight: 600, color: loadingQ === q ? T.textFaint : T.textMid, cursor: loadingQ === q ? "not-allowed" : "pointer", padding: 0 }}>{loadingQ === q ? "···" : "QUICK"}</button>
                          <button onClick={() => { setMode("topic"); setTopic(q); setResult(null); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ background: "none", border: "none", fontFamily: MONO, fontSize: "10.5px", fontWeight: 600, color: T.textMid, cursor: "pointer", padding: 0 }}>DEEPEN →</button>
                        </div>
                      </div>
                      {quickAnswers[q] && <div style={{ paddingLeft: "22px", paddingBottom: "14px" }}>
                        <p style={{ fontFamily: SANS, fontSize: "13px", color: T.textMid, lineHeight: "1.75", margin: 0, borderLeft: `2px solid ${T.borderStrong}`, paddingLeft: "14px" }}>{quickAnswers[q]}</p>
                      </div>}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: p("18px", "16px"), borderTop: `1px solid ${T.border}`, flexWrap: "wrap", gap: "8px" }}>
                <p style={{ fontFamily: MONO, fontSize: "9.5px", color: T.textFaint, letterSpacing: "0.08em" }}>DISTILL · {result.sources_found} SOURCES</p>
                <p style={{ fontFamily: MONO, fontSize: "9.5px", color: T.textFaint, letterSpacing: "0.04em" }}>GROQ · TAVILY · SEMANTIC SCHOLAR</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Feedback modal */}
      {showFeedback && (
        <div onClick={() => setShowFeedback(false)} style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", padding: "16px" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: "420px", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: "12px", padding: p("28px 24px", "24px 20px") }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <p style={{ fontFamily: SERIF, fontSize: "18px", fontWeight: 600, color: T.text, margin: 0 }}>Help us improve Distill</p>
              <button onClick={() => setShowFeedback(false)} style={{ background: "none", border: "none", color: T.textFaint, cursor: "pointer", fontSize: "18px", fontFamily: "inherit", padding: "0 4px" }}>✕</button>
            </div>
            <p style={{ fontFamily: SANS, fontSize: "12px", color: T.textMid, marginBottom: "20px" }}>Your feedback earns <strong style={{ color: T.accent }}>+10 credits</strong>.</p>
            <textarea value={feedbackLove} onChange={e => setFeedbackLove(e.target.value)} placeholder="What did you love?"
              rows={2} style={{ width: "100%", padding: "8px 10px", fontFamily: SANS, fontSize: "12.5px", color: T.textSub, background: T.bg, border: `1px solid ${T.border}`, borderRadius: "4px", outline: "none", resize: "none", marginBottom: "14px" }} />
            <textarea value={feedbackImprove} onChange={e => setFeedbackImprove(e.target.value)} placeholder="What can we improve?"
              rows={2} style={{ width: "100%", padding: "8px 10px", fontFamily: SANS, fontSize: "12.5px", color: T.textSub, background: T.bg, border: `1px solid ${T.border}`, borderRadius: "4px", outline: "none", resize: "none", marginBottom: "14px" }} />
            <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
              <input value={feedbackName} onChange={e => setFeedbackName(e.target.value)} placeholder="Your name *"
                style={{ flex: 1, padding: "8px 10px", fontFamily: SANS, fontSize: "12.5px", color: T.textSub, background: T.bg, border: `1px solid ${T.border}`, borderRadius: "4px", outline: "none" }} />
              <input value={feedbackEmail} onChange={e => setFeedbackEmail(e.target.value)} placeholder="Your email *"
                style={{ flex: 1, padding: "8px 10px", fontFamily: SANS, fontSize: "12.5px", color: T.textSub, background: T.bg, border: `1px solid ${T.border}`, borderRadius: "4px", outline: "none" }} />
            </div>
            <div style={{ display: "flex", gap: "4px", marginBottom: "20px" }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setFeedbackRating(n)}
                  style={{ width: p("40px", "36px"), height: p("36px", "34px"), background: feedbackRating >= n ? T.accent : T.bgMuted, color: feedbackRating >= n ? (dark ? "#0C0C0F" : "#fff") : T.textFaint, border: `1px solid ${feedbackRating >= n ? T.accent : T.border}`, borderRadius: "4px", cursor: "pointer", fontFamily: MONO, fontSize: "13px", fontWeight: 700 }}>{n}</button>
              ))}
            </div>
            {(() => {
              const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              const validName = feedbackName.trim().length > 0;
              const validEmail = emailRe.test(feedbackEmail.trim());
              const canSubmit = (feedbackLove.trim() || feedbackImprove.trim() || feedbackRating) && validName && validEmail;
              const err = !validName && (feedbackName.trim().length > 0 || feedbackImprove.trim() || feedbackLove.trim() || feedbackRating) ? "Name is required" :
                          !validEmail && feedbackEmail.trim().length > 0 ? "Enter a valid email address" : "";
              return <>
              {err && <p style={{ fontFamily: SANS, fontSize: "11px", color: T.rust, margin: "0 0 10px" }}>{err}</p>}
              <button onClick={async () => {
                if (!canSubmit) return;
                if (sessionId) {
                  try { const r = await fetch(`${API}/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sessionId, love: feedbackLove, improve: feedbackImprove, rating: feedbackRating, name: feedbackName, email: feedbackEmail }) }); if (r.ok) { const d = await r.json(); if (d.credits) setCd(mapCD(d.credits)); } } catch {}
                }
                setCd(p => ({ ...p, feedbackGiven: true, feedbackDate: now(), feedbackText: `♥ ${feedbackLove}\n▲ ${feedbackImprove}\n★ ${feedbackRating}/5\nName: ${feedbackName}\nEmail: ${feedbackEmail}` }));
                setShowFeedback(false); playChime();
              }}
                disabled={!canSubmit}
                style={{ width: "100%", padding: "10px", fontFamily: MONO, fontSize: "11px", fontWeight: 700, background: canSubmit ? T.accent : T.bgMuted, color: canSubmit ? (dark ? "#0C0C0F" : "#fff") : T.textFaint, border: "none", borderRadius: "6px", cursor: canSubmit ? "pointer" : "not-allowed", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Submit Feedback · +10 Credits
              </button>
              </>;
            })()}
          </div>
        </div>
      )}

      {!M && <div style={{ position: "fixed", bottom: "14px", right: "22px", zIndex: 50, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "1px", fontFamily: MONO, pointerEvents: "none" }}>
        <span style={{ fontSize: "10px", fontWeight: 600, color: T.textSub, letterSpacing: "0.02em" }}>{clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        <span style={{ fontSize: "8px", fontWeight: 500, color: T.textMid, letterSpacing: "0.08em" }}>{clock.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" }).toUpperCase()}</span>
      </div>}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        @keyframes cursorBlink { 0%,100% { opacity:1; } 50% { opacity:0; } }
        @keyframes fadeDots { 0%,100% { opacity:0.2; } 50% { opacity:1; } }
        @keyframes slideUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes slideInLeft { from { transform:translateX(-100%); } to { transform:translateX(0); } }
        button:active { transform:scale(0.97) !important; }
        input::placeholder { color:${T.textFaint}; opacity:1; }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:${T.borderStrong}; border-radius:2px; }
        ::-webkit-scrollbar-thumb:hover { background:${T.textFaint}; }
        a { color:${T.accent}; }
        @media (max-width: 768px) { input, textarea, select { font-size:16px !important; } }
      `}</style>
    </div>
  );
}
