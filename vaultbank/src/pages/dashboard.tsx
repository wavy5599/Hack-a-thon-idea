// src/pages/Dashboard.tsx
// "insane for judging" dashboard + decision-card AI + working transfers
// FIXED:
// - supports new backend shape: { ok:true, decision:{...} } OR { ok:true, reply:"..." }
// - still supports legacy shape where decision JSON came back inside reply string
// - transfer UI ledger uses non-stale account names (captures before refresh)

import React, { useEffect, useMemo, useRef, useState } from "react";
import "./dashboard.css";

type User = { name: string; tier?: string };
type Account = { id: string; type: string; name: string; balance: number };
type Tx = { id: string; merchant: string; amount: number; time: string };

type DecisionReply = {
  riskLevel: "green" | "yellow" | "red";
  oneLineVerdict: string;
  why: string[];
  betterOption: string;
  ifYouDoItAnyway: string;
  numbers: {
    purchaseAmount: number;
    fv10: number;
    fv20: number;
    fv30: number;
    hoursOfWork: number;
    spentThisWeek: number;
    baselineWeeklySpend: number;
    spike: boolean;
  };
};

type ChatMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "ai"; text: string; decision?: DecisionReply };

const API = "http://localhost:8080";

const money = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const MAX_AI_CHARS = 1200;

function clampText(s: string, max: number) {
  const t = String(s ?? "");
  if (t.length <= max) return t;
  return t.slice(0, max).trimEnd() + "…";
}

function mkId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// ---------- safely parse legacy decision JSON (when it arrives inside a string) ----------
function tryParseDecision(raw: string): DecisionReply | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  try {
    const obj = JSON.parse(s);
    if (obj && typeof obj === "object" && (obj as any).riskLevel && (obj as any).numbers) return obj as DecisionReply;
  } catch {}

  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    const chunk = s.slice(start, end + 1);
    try {
      const obj = JSON.parse(chunk);
      if (obj && typeof obj === "object" && (obj as any).riskLevel && (obj as any).numbers) return obj as DecisionReply;
    } catch {}
  }
  return null;
}

function isDecisionLike(x: any): x is DecisionReply {
  return !!x && typeof x === "object" && (x as any).riskLevel && (x as any).numbers;
}

function RiskChip({ level }: { level: DecisionReply["riskLevel"] }) {
  const label = level === "green" ? "low risk" : level === "yellow" ? "medium" : "high risk";
  return <span className={`riskChip ${level}`}>{label}</span>;
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="metric">
      <div className="metricLabel">{label}</div>
      <div className="metricValue">{value}</div>
    </div>
  );
}

function DecisionCard({ d }: { d: DecisionReply }) {
  const spikeText = d.numbers.spike ? "spike detected" : "normal range";
  return (
    <div className={`decisionCard ${d.riskLevel}`}>
      <div className="decisionTop">
        <div className="decisionTitle">
          <div className="kicker">decision analysis</div>
          <div className="decisionVerdict">{d.oneLineVerdict}</div>
        </div>
        <RiskChip level={d.riskLevel} />
      </div>

      <div className="whyRow">
        {(d.why ?? []).slice(0, 2).map((w, i) => (
          <div className="whyItem" key={i}>
            <span className="whyDot" />
            <span>{w}</span>
          </div>
        ))}
      </div>

      <div className="actionsRow">
        <div className="actionBox">
          <div className="kicker">better option</div>
          <div className="actionText">{d.betterOption || "—"}</div>
        </div>
        <div className="actionBox">
          <div className="kicker">if you do it anyway</div>
          <div className="actionText">{d.ifYouDoItAnyway || "—"}</div>
        </div>
      </div>

      <div className="metricsGrid">
        <Metric label="purchase" value={`$${money(d.numbers.purchaseAmount)}`} />
        <Metric
          label="hours of work"
          value={Number.isFinite(d.numbers.hoursOfWork) ? d.numbers.hoursOfWork.toFixed(1) : "—"}
        />
        <Metric label="fv (10y @ 8%)" value={`$${money(d.numbers.fv10)}`} />
        <Metric label="fv (20y @ 8%)" value={`$${money(d.numbers.fv20)}`} />
        <Metric label="fv (30y @ 8%)" value={`$${money(d.numbers.fv30)}`} />
        <Metric label="this week spend" value={`$${money(d.numbers.spentThisWeek)}`} />
        <Metric label="baseline/week" value={`$${money(d.numbers.baselineWeeklySpend)}`} />
        <Metric
          label="pattern"
          value={<span className={`spikePill ${d.numbers.spike ? "on" : "off"}`}>{spikeText}</span>}
        />
      </div>
    </div>
  );
}

// transfer tx helpers (UI-side ledger)
function formatNowShort() {
  const d = new Date();
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
function acctName(id: string, accounts: Account[]) {
  return accounts.find((a) => a.id === id)?.name ?? id;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [user, setUser] = useState<User>({ name: "user", tier: "demo" });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);

  // AI chat
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: mkId(),
      role: "ai",
      text: 'i’m vault ai. ask me to analyze spending, optimize savings, or type: “$180 bar weekend” for a decision score.',
    },
  ]);
  const [input, setInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // transfer UI
  const [transferOpen, setTransferOpen] = useState(false);
  const [tFrom, setTFrom] = useState<string>("");
  const [tTo, setTTo] = useState<string>("");
  const [tAmount, setTAmount] = useState<string>("100");
  const [tLoading, setTLoading] = useState(false);
  const [tErr, setTErr] = useState<string>("");

  const total = useMemo(() => accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0), [accounts]);

  async function refreshMeAndTx() {
    const meRes = await fetch(`${API}/me`);
    const me = await meRes.json().catch(() => ({}));
    if (!meRes.ok) throw new Error(me?.message ?? `failed /me (${meRes.status})`);

    const txRes = await fetch(`${API}/transactions`);
    const tx = await txRes.json().catch(() => ({}));
    if (!txRes.ok) throw new Error(tx?.message ?? `failed /transactions (${txRes.status})`);

    setUser(me.user ?? { name: "user", tier: "demo" });
    setAccounts(Array.isArray(me.accounts) ? me.accounts : []);
    setTxs(Array.isArray(tx.items) ? tx.items : []);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        await refreshMeAndTx();
        if (!alive) return;
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "dashboard load failed");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!tFrom && accounts[0]?.id) setTFrom(accounts[0].id);
    if (!tTo && accounts[1]?.id) setTTo(accounts[1].id);
  }, [accounts, tFrom, tTo]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiLoading]);

  async function sendAi(withText?: string) {
    const msg = (withText ?? input).trim();
    if (!msg || aiLoading) return;

    setInput("");
    setMessages((prev) => [...prev, { id: mkId(), role: "user", text: msg }]);
    setAiLoading(true);

    try {
      const res = await fetch(`${API}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, accounts, transactions: txs }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setMessages((prev) => [
          ...prev,
          { id: mkId(), role: "ai", text: String(data?.message ?? `ai error (${res.status})`) },
        ]);
        return;
      }

      // ✅ NEW BACKEND: decision is an object field
      if (isDecisionLike(data.decision)) {
        const d = data.decision as DecisionReply;
        setMessages((prev) => [
          ...prev,
          { id: mkId(), role: "ai", text: clampText(d.oneLineVerdict || "decision analyzed.", 220), decision: d },
        ]);
        return;
      }

      // ✅ NORMAL: reply is a string
      const rawReply = String(data.reply ?? "");

      // ✅ LEGACY BACKEND: decision JSON might be inside reply string
      const legacyDecision = tryParseDecision(rawReply);
      if (legacyDecision) {
        setMessages((prev) => [
          ...prev,
          {
            id: mkId(),
            role: "ai",
            text: clampText(legacyDecision.oneLineVerdict || "decision analyzed.", 220),
            decision: legacyDecision,
          },
        ]);
        return;
      }

      setMessages((prev) => [...prev, { id: mkId(), role: "ai", text: clampText(rawReply, MAX_AI_CHARS) }]);
    } catch {
      setMessages((prev) => [...prev, { id: mkId(), role: "ai", text: "could not reach server." }]);
    } finally {
      setAiLoading(false);
    }
  }

  // transfer: refresh balances and inject rows for instant judge-visible activity
  async function submitTransfer() {
    setTErr("");
    if (tLoading) return;

    const amt = Number(tAmount);
    if (!tFrom || !tTo || !Number.isFinite(amt) || amt <= 0) {
      setTErr("enter a valid amount and pick accounts.");
      return;
    }
    if (tFrom === tTo) {
      setTErr("from and to must be different.");
      return;
    }

    setTLoading(true);
    try {
      // capture names BEFORE refresh (state updates async)
      const fromName = acctName(tFrom, accounts);
      const toName = acctName(tTo, accounts);
      const stamp = formatNowShort();

      const res = await fetch(`${API}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromId: tFrom, toId: tTo, amount: amt }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(String(data?.message ?? `transfer failed (${res.status})`));

      // refresh balances (source of truth)
      await refreshMeAndTx();

      // UI-side “ledger”: show transfer immediately
      const transferId = String(data?.transfer?.id ?? `XFER-${Date.now()}`);

      const outTx: Tx = {
        id: `${transferId}-OUT`,
        merchant: `transfer → ${toName}`,
        amount: -Math.abs(amt),
        time: stamp,
      };

      const inTx: Tx = {
        id: `${transferId}-IN`,
        merchant: `transfer ← ${fromName}`,
        amount: +Math.abs(amt),
        time: stamp,
      };

      setTxs((prev) => [outTx, inTx, ...prev].slice(0, 30));

      setMessages((prev) => [
        ...prev,
        { id: mkId(), role: "ai", text: `transfer complete ✅ moved $${money(amt)} from ${fromName} → ${toName}.` },
      ]);

      setTransferOpen(false);
    } catch (e: any) {
      setTErr(e?.message ?? "transfer failed");
    } finally {
      setTLoading(false);
    }
  }

  return (
    <main className="dash">
      <div className="dashInner">
        <header className="dashTop">
          <div>
            <div className="kicker">dashboard</div>
            <h1 className="dashH1">welcome, {user.name}</h1>
            <div className="muted">{user.tier ?? "demo"} tier • demo data</div>
          </div>

          <div className="dashActions">
            <button className="btn" type="button" onClick={() => setTransferOpen(true)}>
              new transfer
            </button>
            <button className="btn primary" type="button" onClick={() => sendAi("analyze my spending this week")}>
              ai overview
            </button>
          </div>
        </header>

        {loading && (
          <section className="panel">
            <div className="panelTop">
              <div>
                <div className="kicker">syncing</div>
                <div className="balance">loading…</div>
              </div>
              <span className="pill">live</span>
            </div>
            <div className="muted">fetching /me and /transactions</div>
          </section>
        )}

        {!loading && err && (
          <section className="panel">
            <div className="panelTop">
              <div>
                <div className="kicker">error</div>
                <div className="balance">couldn’t load</div>
              </div>
              <span className="pill">offline</span>
            </div>
            <div className="muted" style={{ marginTop: 10 }}>
              {err}
            </div>
          </section>
        )}

        {!loading && !err && (
          <section className="dashGrid">
            {/* total */}
            <div className="panel balancePanel">
              <div className="panelTop">
                <div>
                  <div className="kicker">total balance</div>
                  <div className="balance">${money(total)}</div>
                </div>
                <span className="pill">synced</span>
              </div>

              <div className="statsRow">
                <div className="stat">
                  <div className="statValue">{accounts.length}</div>
                  <div className="statLabel">accounts</div>
                </div>
                <div className="stat">
                  <div className="statValue">{txs.length}</div>
                  <div className="statLabel">recent tx</div>
                </div>
                <div className="stat">
                  <div className="statValue">api</div>
                  <div className="statLabel">java server</div>
                </div>
              </div>
            </div>

            {/* transactions */}
            <section className="panel txPanel">
              <div className="panelTop">
                <div>
                  <div className="kicker">recent activity</div>
                  <div className="balance">transactions</div>
                </div>
                <span className="pill">live</span>
              </div>

              <div className="txBox">
                {txs.map((t) => {
                  const pos = Number(t.amount) >= 0;
                  const isTransfer = String(t.merchant).toLowerCase().startsWith("transfer");
                  return (
                    <div className="txRow" key={t.id}>
                      <div className="txLeft">
                        <div className="txIcon">{isTransfer ? "⇄" : pos ? "↗" : "↘"}</div>
                        <div className="txText">
                          <div className="txMerchant">{t.merchant}</div>
                          <div className="kicker">{t.time}</div>
                        </div>
                      </div>
                      <div className={"txAmt " + (pos ? "pos" : "neg")}>
                        {(pos ? "+" : "-")}
                        {money(Math.abs(Number(t.amount)))}
                      </div>
                    </div>
                  );
                })}
                {txs.length === 0 && <div className="muted">no activity returned</div>}
              </div>
            </section>

            {/* accounts */}
            <div className="panel accountsPanel">
              <div className="panelTop">
                <div>
                  <div className="kicker">accounts</div>
                  <div className="balance">vault</div>
                </div>
                <span className="pill">live</span>
              </div>

              <div className="acctList">
                {accounts.map((a) => (
                  <div className="acctRow" key={a.id}>
                    <div className="acctLeft">
                      <div className="txIcon">{a.type === "savings" ? "🏦" : "💳"}</div>
                      <div className="txText">
                        <div className="txMerchant">{a.name}</div>
                        <div className="kicker">
                          {a.type} • {a.id}
                        </div>
                      </div>
                    </div>
                    <div className="txAmt">${money(Number(a.balance))}</div>
                  </div>
                ))}
                {accounts.length === 0 && <div className="muted">no accounts returned</div>}

                <button className="btn mini" type="button" onClick={() => setTransferOpen(true)} style={{ marginTop: 10 }}>
                  quick transfer →
                </button>
              </div>
            </div>

            {/* AI */}
            <section className="panel aiPanel">
              <div className="panelTop">
                <div>
                  <div className="kicker">vault ai</div>
                  <div className="balance">fintech copilot</div>
                </div>
                <span className="pill">beta</span>
              </div>

              <div className="chatBox" aria-live="polite">
                {messages.map((m) => (
                  <div key={m.id} className={`bubble ${m.role}`}>
                    {"decision" in m && m.decision ? (
                      <div className="decisionWrap">
                        <div className="bubbleText">{m.text}</div>
                        <DecisionCard d={m.decision} />
                      </div>
                    ) : (
                      m.text
                    )}
                  </div>
                ))}
                {aiLoading && <div className="bubble ai">thinking...</div>}
                <div ref={chatEndRef} />
              </div>

              <div className="chatInputRow">
                <input
                  className="chatInput"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder='try: "$180 bar weekend" or "should i buy a $90 hoodie?"'
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendAi();
                  }}
                  disabled={aiLoading}
                />
                <button className="btn primary" type="button" onClick={() => sendAi()} disabled={aiLoading}>
                  send
                </button>
              </div>

              <div className="demoRow">
                <button className="btn mini" type="button" onClick={() => sendAi("$180 bar weekend")} disabled={aiLoading}>
                  demo: nightlife
                </button>
                <button className="btn mini" type="button" onClick={() => sendAi("$64 doordash tonight")} disabled={aiLoading}>
                  demo: doordash
                </button>
                <button
                  className="btn mini"
                  type="button"
                  onClick={() => sendAi("should i spend $200 on a new keyboard")}
                  disabled={aiLoading}
                >
                  demo: shopping
                </button>
                <button className="btn mini" type="button" onClick={() => setTransferOpen(true)} disabled={aiLoading}>
                  demo: transfer
                </button>
              </div>
            </section>
          </section>
        )}

        {/* TRANSFER MODAL */}
        {transferOpen && (
          <div className="modalOverlay" role="dialog" aria-modal="true">
            <div className="modalCard">
              <div className="modalTop">
                <div>
                  <div className="kicker">transfer</div>
                  <div className="modalTitle">move money instantly</div>
                </div>
                <button className="btn mini" type="button" onClick={() => setTransferOpen(false)} disabled={tLoading}>
                  close
                </button>
              </div>

              <div className="modalGrid">
                <label className="field">
                  <div className="fieldLabel">from</div>
                  <select className="fieldInput" value={tFrom} onChange={(e) => setTFrom(e.target.value)} disabled={tLoading}>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.id}) — ${money(a.balance)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <div className="fieldLabel">to</div>
                  <select className="fieldInput" value={tTo} onChange={(e) => setTTo(e.target.value)} disabled={tLoading}>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.id}) — ${money(a.balance)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <div className="fieldLabel">amount</div>
                  <input
                    className="fieldInput"
                    value={tAmount}
                    onChange={(e) => setTAmount(e.target.value)}
                    placeholder="100"
                    inputMode="decimal"
                    disabled={tLoading}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitTransfer();
                    }}
                  />
                </label>

                {tErr && <div className="modalErr">{tErr}</div>}

                <div className="modalActions">
                  <button className="btn" type="button" onClick={() => setTAmount("50")} disabled={tLoading}>
                    $50
                  </button>
                  <button className="btn" type="button" onClick={() => setTAmount("100")} disabled={tLoading}>
                    $100
                  </button>
                  <button className="btn" type="button" onClick={() => setTAmount("200")} disabled={tLoading}>
                    $200
                  </button>

                  <button className="btn primary" type="button" onClick={submitTransfer} disabled={tLoading}>
                    {tLoading ? "sending..." : "send transfer"}
                  </button>
                </div>

                <div className="muted" style={{ marginTop: 6 }}>
                  tip: do a transfer, then ask the ai “re-check my balances” to flex the full loop.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}