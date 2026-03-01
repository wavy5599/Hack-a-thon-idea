// src/pages/Dashboard.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./dashboard.css";

type User = { name: string; tier?: string };
type Account = { id: string; type: string; name: string; balance: number };
type Tx = { id: string; merchant: string; amount: number; time: string };

// give each message a stable id so react keys are safe
type ChatMessage = { id: string; role: "user" | "ai"; text: string };

const money = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// keep bubbles from becoming giant essays (adjust or remove if you want)
const MAX_AI_CHARS = 1200;

function clampText(s: string, max: number) {
  const t = String(s ?? "");
  if (t.length <= max) return t;
  return t.slice(0, max).trimEnd() + "…";
}

function mkId() {
  // good enough for demo UI keys
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [user, setUser] = useState<User>({ name: "user", tier: "demo" });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);

  // --- AI chat state ---
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: mkId(),
      role: "ai",
      text: "i’m vault ai. ask me to analyze spending, optimize savings, or suggest a transfer.",
    },
  ]);
  const [input, setInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const total = useMemo(
    () => accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0),
    [accounts]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const meRes = await fetch("http://localhost:8080/me");
        const me = await meRes.json().catch(() => ({}));
        if (!meRes.ok) throw new Error(me?.message ?? `failed /me (${meRes.status})`);

        const txRes = await fetch("http://localhost:8080/transactions");
        const tx = await txRes.json().catch(() => ({}));
        if (!txRes.ok) throw new Error(tx?.message ?? `failed /transactions (${txRes.status})`);

        if (!alive) return;
        setUser(me.user ?? { name: "user", tier: "demo" });
        setAccounts(Array.isArray(me.accounts) ? me.accounts : []);
        setTxs(Array.isArray(tx.items) ? tx.items : []);
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
  }, []);

  // auto-scroll chat on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiLoading]);

  async function sendAi() {
    const msg = input.trim();
    if (!msg || aiLoading) return;

    setInput("");

    // add user message immediately
    setMessages((prev) => [...prev, { id: mkId(), role: "user", text: msg }]);
    setAiLoading(true);

    try {
      const res = await fetch("http://localhost:8080/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          accounts,
          transactions: txs,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        setMessages((prev) => [
          ...prev,
          { id: mkId(), role: "ai", text: String(data?.message ?? `ai error (${res.status})`) },
        ]);
        return;
      }

      // clamp the ai output so it can't overrun the UI
      const reply = clampText(String(data.reply ?? ""), MAX_AI_CHARS);

      setMessages((prev) => [...prev, { id: mkId(), role: "ai", text: reply }]);
    } catch {
      setMessages((prev) => [...prev, { id: mkId(), role: "ai", text: "could not reach server." }]);
    } finally {
      setAiLoading(false);
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
            <button className="btn" type="button">
              add account
            </button>
            <button className="btn primary" type="button">
              new transfer
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
            {/* left: total balance */}
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

            {/* left: transactions */}
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
                  return (
                    <div className="txRow" key={t.id}>
                      <div className="txLeft">
                        <div className="txIcon">{pos ? "↗" : "↘"}</div>
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

            {/* right: accounts */}
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
              </div>
            </div>

            {/* right: AI */}
            <section className="panel aiPanel">
              <div className="panelTop">
                <div>
                  <div className="kicker">vault ai</div>
                  <div className="balance">fintech copilot</div>
                </div>
                <span className="pill">beta</span>
              </div>

              {/* IMPORTANT: wrap + prevent horizontal stretching */}
              <div className="chatBox" aria-live="polite">
                {messages.map((m) => (
                  <div key={m.id} className={`bubble ${m.role}`}>
                    {m.text}
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
                  placeholder="ask vault ai..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendAi();
                  }}
                  disabled={aiLoading}
                />
                <button className="btn primary" type="button" onClick={sendAi} disabled={aiLoading}>
                  send
                </button>
              </div>
            </section>
          </section>
        )}
      </div>
    </main>
  );
}