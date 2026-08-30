"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Clipboard,
  Copy,
  Database,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type {
  AnalysisAnswer,
  DashboardSnapshot,
  HealthResponse,
  LeadershipUpdate,
} from "@/lib/api/types";
import { cn } from "@/lib/utils";

const SUGGESTED_QUESTIONS = [
  "How is our pipeline looking this quarter?",
  "Compare sector performance across the pipeline.",
  "Which deals need executive attention?",
  "Which work orders are delayed or at risk?",
  "How are billing, collections, and receivables looking?",
];

function formattedSync(value?: string): string {
  if (!value) return "Not synced";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently synced";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(date);
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  return response.json() as Promise<T>;
}

function StatusBadge({ health }: { health: HealthResponse | null }) {
  if (!health || health.status === "unavailable") {
    return (
      <span className="status-badge status-warning">
        <CircleAlert size={14} /> Connection needs attention
      </span>
    );
  }
  if (health.status === "setup_required") {
    return (
      <span className="status-badge status-muted">
        <Database size={14} /> Setup required
      </span>
    );
  }
  return (
    <span className={cn("status-badge", health.cacheState === "stale" ? "status-warning" : "status-live")}>
      <span className="status-dot" />
      {health.cacheState === "stale" ? "Last live sync" : "Live monday.com data"}
    </span>
  );
}

function LoadingShell() {
  return (
    <main className="app-shell" aria-busy="true" aria-label="Loading Skylark Command Center">
      <div className="loading-topbar">
        <div className="skeleton skeleton-logo" />
        <div className="skeleton skeleton-pill" />
      </div>
      <div className="loading-content">
        <div className="skeleton skeleton-hero" />
        <div className="metric-grid">
          {[0, 1, 2, 3].map((item) => <div className="skeleton skeleton-metric" key={item} />)}
        </div>
        <div className="skeleton skeleton-panel" />
      </div>
    </main>
  );
}

function SetupRequired({ health }: { health: HealthResponse }) {
  const setup = health.setup;
  return (
    <section className="setup-card" aria-labelledby="setup-title">
      <div className="setup-icon"><Database size={28} /></div>
      <div>
        <p className="eyebrow">Secure read-only connection</p>
        <h1 id="setup-title">Connect the two monday.com boards</h1>
        <p className="setup-intro">
          Skylark Command Center only analyzes live board data. It will not load a hidden spreadsheet or produce invented business metrics.
        </p>
      </div>
      <div className="setup-steps">
        {(setup?.instructions || []).map((instruction, index) => (
          <div className="setup-step" key={instruction}>
            <span>{index + 1}</span><p>{instruction}</p>
          </div>
        ))}
      </div>
      <div className="variable-list" aria-label="Missing deployment variables">
        <p>Required server-side variables</p>
        {(setup?.requiredVariables || []).map((variable) => <code key={variable}>{variable}</code>)}
      </div>
      <div className="security-note"><ShieldCheck size={16} /> Tokens are stored server-side only and this application sends no monday.com mutations.</div>
    </section>
  );
}

function Unavailable({ health, onRetry, loading }: { health: HealthResponse; onRetry: () => void; loading: boolean }) {
  return (
    <section className="setup-card unavailable-card" aria-labelledby="unavailable-title">
      <div className="setup-icon danger"><AlertTriangle size={28} /></div>
      <div>
        <p className="eyebrow">Live data unavailable</p>
        <h1 id="unavailable-title">The board connection could not be completed</h1>
        <p className="setup-intro">{health.message || "Please retry after checking the monday.com configuration and board access."}</p>
      </div>
      <button type="button" className="button button-primary" onClick={onRetry} disabled={loading}>
        {loading ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />} Retry live sync
      </button>
      <div className="security-note"><ShieldCheck size={16} /> No stale local files or fabricated dashboard values are shown.</div>
    </section>
  );
}

function MetricGrid({ metrics }: { metrics: DashboardSnapshot["metrics"] }) {
  return (
    <div className="metric-grid">
      {metrics.map((entry) => (
        <article className={cn("metric-card", entry.tone ? `metric-${entry.tone}` : "")} key={entry.id}>
          <p>{entry.label}</p>
          <strong>{entry.value}</strong>
          {entry.detail && <span>{entry.detail}</span>}
        </article>
      ))}
    </div>
  );
}

function ExecutiveChart({ chart }: { chart: DashboardSnapshot["chart"] }) {
  if (!chart || chart.data.length === 0) {
    return (
      <div className="chart-empty">
        <BarChart3 size={22} />
        <span>A chart will appear once the connected boards contain usable records.</span>
      </div>
    );
  }

  return (
    <section className="chart-panel" aria-labelledby="chart-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Portfolio view</p>
          <h2 id="chart-title">{chart.title}</h2>
          <p>{chart.subtitle}</p>
        </div>
        <span className="chart-unit">{chart.unitLabel}</span>
      </div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart.data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#8290a5", fontSize: 11 }}
              interval={0}
              angle={chart.data.length > 4 ? -22 : 0}
              textAnchor={chart.data.length > 4 ? "end" : "middle"}
              height={chart.data.length > 4 ? 55 : 28}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#8290a5", fontSize: 11 }}
              width={52}
              tickFormatter={(value: number) => new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value)}
            />
            <Tooltip
              cursor={{ fill: "rgba(110, 231, 183, .08)" }}
              contentStyle={{
                background: "#132238",
                border: "1px solid rgba(148, 163, 184, .25)",
                borderRadius: 12,
                boxShadow: "0 18px 40px rgba(2, 6, 23, .26)",
                color: "#eff6ff",
                fontSize: 12,
              }}
              formatter={(value) => String(value ?? "Not available")}
              labelStyle={{ color: "#a7f3d0", marginBottom: 4 }}
            />
            <Bar dataKey="value" radius={[7, 7, 2, 2]} maxBarSize={52}>
              {chart.data.map((entry, index) => <Cell key={`${entry.name}-${index}`} fill={entry.color || "#6ee7b7"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function AnswerPanel({ answer, onQuestion }: { answer: AnalysisAnswer; onQuestion: (question: string) => void }) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <section className={cn("answer-panel", answer.status === "clarification" && "clarification-panel")} aria-live="polite">
      <div className="answer-kicker">
        <span><BrainCircuit size={15} /> {answer.status === "clarification" ? "Clarification needed" : answer.status === "unsupported" ? "Available analysis" : "Executive answer"}</span>
        <small>{formattedSync(answer.syncedAt)} · {answer.cacheState === "cached" ? "cached live read" : answer.cacheState === "stale" ? "last successful sync" : "fresh live read"}</small>
      </div>
      <h2>{answer.headline}</h2>
      <p className="answer-summary">{answer.executiveSummary}</p>

      {answer.engineNote && <div className="engine-note"><Bot size={15} /> {answer.engineNote}</div>}

      {answer.status === "clarification" && answer.clarification && (
        <div className="clarification-box">
          <p>{answer.clarification.question}</p>
          <div className="chip-row">
            {answer.clarification.options.map((option) => (
              <button className="suggestion-chip" type="button" key={option.label} onClick={() => onQuestion(option.prompt)}>{option.label} <ArrowUpRight size={13} /></button>
            ))}
          </div>
        </div>
      )}

      {answer.metrics.length > 0 && <MetricGrid metrics={answer.metrics} />}
      {answer.chart && <ExecutiveChart chart={answer.chart} />}

      <div className="answer-columns">
        <AnswerList title="What this means" icon={<TrendingUp size={17} />} values={answer.insights} />
        <AnswerList title="Risks & attention" icon={<CircleAlert size={17} />} values={answer.risks} tone="risk" />
        <AnswerList title="Recommended next actions" icon={<CheckCircle2 size={17} />} values={answer.actions} tone="action" />
      </div>

      {(answer.assumptions.length > 0 || answer.caveats.length > 0) && (
        <div className="details-wrap">
          <button type="button" className="details-toggle" onClick={() => setDetailsOpen((value) => !value)} aria-expanded={detailsOpen}>
            <span><ShieldCheck size={16} /> Assumptions & data confidence</span>
            {detailsOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
          </button>
          {detailsOpen && (
            <div className="details-content">
              <div>
                <h3>Assumptions used</h3>
                <ul>{answer.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div className="caveat-list">
                <h3>Data quality and caveats</h3>
                {answer.caveats.length ? <ul>{answer.caveats.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No material caveats were detected for this view.</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {answer.evidence.length > 0 && (
        <div className="details-wrap evidence-wrap">
          <button type="button" className="details-toggle" onClick={() => setEvidenceOpen((value) => !value)} aria-expanded={evidenceOpen}>
            <span><Link2 size={16} /> Evidence & source records</span>
            {evidenceOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
          </button>
          {evidenceOpen && (
            <div className="evidence-content">
              {answer.evidence.map((group) => (
                <div className="evidence-group" key={group.title}>
                  <h3>{group.title}</h3>
                  {group.description && <p>{group.description}</p>}
                  <div className="source-list">
                    {group.records.map((record) => (
                      <a
                        key={`${record.board}-${record.itemId}`}
                        href={record.url || "#"}
                        target={record.url ? "_blank" : undefined}
                        rel={record.url ? "noreferrer" : undefined}
                        className={cn("source-record", !record.url && "source-record-disabled")}
                        onClick={(event) => { if (!record.url) event.preventDefault(); }}
                      >
                        <span>{record.board === "deals" ? "Deal" : "Work order"}</span>
                        <strong>{record.itemName}</strong>
                        {record.url && <ExternalLink size={13} />}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {answer.followUps.length > 0 && (
        <div className="follow-up-wrap">
          <p>Continue the analysis</p>
          <div className="chip-row">
            {answer.followUps.map((question) => (
              <button type="button" className="suggestion-chip" onClick={() => onQuestion(question)} key={question}>{question} <ArrowUpRight size={13} /></button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function AnswerList({ title, icon, values, tone }: { title: string; icon: React.ReactNode; values: string[]; tone?: "risk" | "action" }) {
  if (!values.length) return null;
  return (
    <section className={cn("answer-list", tone && `answer-list-${tone}`)}>
      <h3>{icon} {title}</h3>
      <ul>{values.slice(0, 5).map((value) => <li key={value}>{value}</li>)}</ul>
    </section>
  );
}

function ReadinessPanel({ health }: { health: HealthResponse }) {
  const [open, setOpen] = useState(false);
  const quality = health.quality;
  if (!quality) return null;
  const label = quality.overallLabel === "strong" ? "Strong readiness" : quality.overallLabel === "limited" ? "Limited readiness" : "Usable with caveats";

  return (
    <section className="readiness-panel">
      <button className="readiness-top" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <div><Database size={17} /><span>Data readiness</span><strong className={cn("quality-label", `quality-${quality.overallLabel}`)}>{label}</strong></div>
        {open ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
      </button>
      <p>{quality.summary}</p>
      {open && (
        <div className="readiness-content">
          <div className="readiness-stat-row">
            <span><CalendarIcon /> Date coverage <strong>{quality.dateCoverage.earliest || "—"} → {quality.dateCoverage.latest || "—"}</strong></span>
            <span><Link2 size={14} /> Board links <strong>{quality.linkage.exact} exact · {quality.linkage.grouped} grouped · {quality.linkage.probable} probable · {quality.linkage.unmatched} unmatched</strong></span>
          </div>
          <div className="board-readiness-grid">
            {quality.boardReadiness.map((board) => (
              <article key={board.board}>
                <div className="board-readiness-heading"><span>{board.board === "deals" ? "Sales pipeline" : "Project execution"}</span><strong>{board.recordCount} records</strong></div>
                <p>{board.boardName}</p>
                <div className="mapping-list">
                  {board.mappedFields.filter((field) => field.field !== "itemName").map((field) => (
                    <span key={field.field} className={cn("mapping-pill", `mapping-${field.confidence}`)}>{field.field}: {field.columnTitle}</span>
                  ))}
                </div>
                <div className="coverage-list">
                  {board.parseCoverage.map((coverage) => <span key={coverage.label}>{coverage.label}<strong>{coverage.percent}%</strong></span>)}
                </div>
                {board.missingFields.length > 0 && <div className="missing-fields">Missing: {board.missingFields.join(", ")}</div>}
              </article>
            ))}
          </div>
          {quality.warnings.length > 0 && (
            <div className="quality-warnings">
              <h3><AlertTriangle size={15} /> Detected caveats</h3>
              <ul>{quality.warnings.slice(0, 8).map((warning) => <li key={`${warning.code}-${warning.message}`}>{warning.message}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function CalendarIcon() { return <span aria-hidden="true">◷</span>; }

function LeadershipPanel({ update, loading, onGenerate }: { update: LeadershipUpdate | null; loading: boolean; onGenerate: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!update) return;
    await navigator.clipboard.writeText(update.markdown);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  const download = () => {
    if (!update) return;
    const blob = new Blob([update.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "skylark-leadership-update.md";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="leadership-panel">
      <div className="leadership-heading">
        <div>
          <p className="eyebrow">Optional executive workflow</p>
          <h2>Leadership Update</h2>
          <p>Turn live commercial and execution data into a decision-ready briefing.</p>
        </div>
        <button type="button" className="button button-primary" disabled={loading} onClick={onGenerate}>
          {loading ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />} {update ? "Refresh update" : "Generate update"}
        </button>
      </div>
      {!update ? (
        <div className="leadership-placeholder"><FileText size={22} /><p>Includes headline, pipeline, execution, risks, decisions required, and data-confidence notes.</p></div>
      ) : (
        <div className="leadership-content">
          <div className="brief-topline"><span>{update.generatedAt}</span><div><button type="button" onClick={copy}>{copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy Markdown"}</button><button type="button" onClick={download}><Clipboard size={14} />Download</button></div></div>
          <h3>{update.headline}</h3>
          <div className="brief-grid">
            {update.sections.map((section) => (
              <article key={section.title}>
                <h4>{section.title}</h4>
                <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
              </article>
            ))}
          </div>
          {update.caveats.length > 0 && <div className="brief-caveat"><CircleAlert size={15} /><span>{update.caveats[0]}</span></div>}
        </div>
      )}
    </section>
  );
}

export default function CommandCenter() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AnalysisAnswer | null>(null);
  const [leadership, setLeadership] = useState<LeadershipUpdate | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [loadingAnswer, setLoadingAnswer] = useState(false);
  const [loadingLeadership, setLoadingLeadership] = useState(false);

  const boardSummary = useMemo(() => health?.boards?.map((board) => `${board.recordCount} ${board.kind === "deals" ? "deals" : "work orders"}`).join(" · "), [health]);

  const loadHealth = async (force = false) => {
    setLoadingHealth(true);
    try {
      const response = await requestJson<HealthResponse>(force ? "/api/refresh" : "/api/health", force ? { method: "POST" } : undefined);
      setHealth(response);
      if (response.status !== "connected") {
        setAnswer(null);
        setLeadership(null);
      }
    } catch {
      setHealth({ status: "unavailable", message: "Unable to contact the application server. Please retry." });
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    // Schedule initial network synchronization after first paint rather than
    // synchronously cascading state updates from the effect body.
    const timer = window.setTimeout(() => { void loadHealth(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const ask = async (nextQuestion?: string) => {
    const prompt = (nextQuestion || question).trim();
    if (prompt.length < 3 || loadingAnswer) return;
    setQuestion(prompt);
    setLoadingAnswer(true);
    try {
      const response = await requestJson<{ status: string; answer?: AnalysisAnswer; message?: string }>("/api/ask", {
        method: "POST",
        body: JSON.stringify({ question: prompt }),
      });
      if (response.answer) {
        setAnswer(response.answer);
        setQuestion("");
      } else {
        setAnswer({
          status: "unsupported",
          question: prompt,
          headline: "Live analysis could not be completed.",
          executiveSummary: response.message || "Please refresh the board connection and try again.",
          metrics: [], insights: [], risks: [], actions: ["Retry the question after refreshing live data."], assumptions: [], caveats: [], evidence: [], followUps: [], syncedAt: new Date().toISOString(), cacheState: "stale",
        });
      }
    } catch {
      setAnswer({
        status: "unsupported",
        question: prompt,
        headline: "Live analysis could not be completed.",
        executiveSummary: "The application server could not complete this request. Refresh live data and retry.",
        metrics: [], insights: [], risks: [], actions: ["Retry the question after refreshing live data."], assumptions: [], caveats: [], evidence: [], followUps: [], syncedAt: new Date().toISOString(), cacheState: "stale",
      });
    } finally {
      setLoadingAnswer(false);
    }
  };

  const generateLeadership = async () => {
    if (loadingLeadership) return;
    setLoadingLeadership(true);
    try {
      const response = await requestJson<{ status: string; update?: LeadershipUpdate }>("/api/leadership-update", { method: "POST" });
      if (response.update) setLeadership(response.update);
    } finally {
      setLoadingLeadership(false);
    }
  };

  if (!health) return <LoadingShell />;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Skylark Command Center home">
          <span className="brand-mark"><span /><span /><span /></span>
          <span><strong>SKYLARK</strong><em>COMMAND CENTER</em></span>
        </a>
        <div className="topbar-actions">
          <StatusBadge health={health} />
          {health.status === "connected" && <button type="button" className="button button-secondary refresh-button" onClick={() => void loadHealth(true)} disabled={loadingHealth}>{loadingHealth ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}<span>Refresh</span></button>}
        </div>
      </header>

      {health.status === "setup_required" ? <SetupRequired health={health} /> : health.status === "unavailable" ? <Unavailable health={health} onRetry={() => void loadHealth(true)} loading={loadingHealth} /> : (
        <div className="dashboard" id="top">
          <section className="hero">
            <div className="hero-copy">
              <p className="eyebrow"><span className="eyebrow-dot" /> Founder-grade intelligence</p>
              <h1>Ask the business.<br /><span>See the evidence.</span></h1>
              <p>Live, read-only analysis across sales pipeline and project execution — with assumptions, data quality, and source records shown beside every conclusion.</p>
            </div>
            <div className="hero-meta">
              <div><span>Last synced</span><strong>{formattedSync(health.syncedAt)}</strong></div>
              <div><span>Connected boards</span><strong>{boardSummary || "Live boards connected"}</strong></div>
              <div><span>Data confidence</span><strong>{health.quality?.overallLabel === "strong" ? "Strong readiness" : health.quality?.overallLabel === "limited" ? "Limited readiness" : "Usable with caveats"}</strong></div>
            </div>
          </section>

          {health.snapshot && <MetricGrid metrics={health.snapshot.metrics} />}

          <section className="ask-panel" aria-labelledby="ask-title">
            <div className="ask-heading"><div><p className="eyebrow">Conversational BI agent</p><h2 id="ask-title">What would you like to understand?</h2></div><Bot size={24} /></div>
            <form className="ask-form" onSubmit={(event) => { event.preventDefault(); void ask(); }}>
              <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="e.g. How is our energy-sector pipeline looking this quarter?" maxLength={900} aria-label="Business intelligence question" />
              <button type="submit" className="button button-primary" disabled={loadingAnswer || question.trim().length < 3}>{loadingAnswer ? <Loader2 className="spin" size={17} /> : <Send size={17} />}<span>{loadingAnswer ? "Analysing" : "Ask agent"}</span></button>
            </form>
            <div className="chip-row suggested-row">
              {SUGGESTED_QUESTIONS.map((suggestion) => <button type="button" className="suggestion-chip" key={suggestion} disabled={loadingAnswer} onClick={() => void ask(suggestion)}>{suggestion}<ArrowUpRight size={13} /></button>)}
            </div>
          </section>

          <div className="dashboard-grid">
            <div className="primary-column">
              {answer ? <AnswerPanel answer={answer} onQuestion={(nextQuestion) => void ask(nextQuestion)} /> : health.snapshot && <ExecutiveChart chart={health.snapshot.chart} />}
            </div>
            <aside className="side-column">
              <ReadinessPanel health={health} />
              <div className="method-card"><ShieldCheck size={18} /><div><h3>Trusted analysis</h3><p>Code calculates the metrics. AI interprets the question and communicates verified findings; it does not invent numbers.</p></div></div>
            </aside>
          </div>

          <LeadershipPanel update={leadership} loading={loadingLeadership} onGenerate={() => void generateLeadership()} />
        </div>
      )}

      <footer className="footer"><span>Skylark Command Center</span><span>Read-only monday.com BI · Evidence-backed · Data-quality aware</span></footer>
    </main>
  );
}
