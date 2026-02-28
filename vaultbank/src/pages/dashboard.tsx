// src/pages/Dashboard.tsx
import React, { useEffect, useMemo, useState } from "react";
import "./dashboard.css";

type User = { name: string; tier?: string };
type Account = { id: string; type: string; name: string; balance: number };
type Tx = { id: string; merchant: string; amount: number; time: string };

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [user, setUser] = useState<User>({ name: "user", tier: "demo" });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);

  const totalBalance = useMemo(
    () => accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0),
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

        if (!meRes.ok || !me.ok) {
          throw new Error(me?.message ?? `failed to load /me (${meRes.status})`);
        }

        const txRes = await fetch("http://localhost:8080/transactions");
        const tx = await txRes.json().catch(() => ({}));

        if (!txRes.ok || !tx.ok) {
          throw new Error(tx?.message ?? `failed to load /transactions (${txRes.status})`);
        }

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

  return (
    <main className="dash">
      <header className="dashTop">
        <div>
          <div className="kicker">dashboard</div>
          <h1 className="dashH1">welcome, {user.name}</h1>
          <div className="muted">{user.tier ?? "demo"} tier • live demo data</div>
        </div>
        <div className="dashActions">
          <button className="btn">add account</button>
          <button className="btn primary">new transfer</button>
        </div>
      </header>

      {loading && (
        <section className="panel dashPanel">
          <div className="txTitle">loading…</div>
          <div className="muted">fetching accounts and activity from your java server</div>
        </section>
      )}

      {err && (
        <section className="panel dashPanel">
          <div className="txTitle">couldn’t load dashboard</div>
          <div className="muted" style={{ marginTop: 6 }}>
            {err}
          </div>
          <div className="muted" style={{ marginTop: 10 }}>
            make sure the java server is running and /me + /transactions exist.
          </div>
        </section>
      )}

      {!loading && !err && (
        <>
          <section className="dashGrid">
            <div className="panel dashPanel">
              <div className="panelTop">
                <div>
                  <div className="kicker">total balance</div>
                  <div className="balance">${totalBalance.toFixed(2)}</div>
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
                  <div className="statLabel">recent items</div>
                </div>
                <div className="stat">
                  <div className="statValue">api</div>
                  <div className="statLabel">java server</div>
                </div>
              </div>
            </div>

            <div className="panel dashPanel">
              <div className="panelTop">
                <div>
                  <div className="kicker">accounts</div>
                  <div className="balance">vault accounts</div>
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
                        <div className="kicker">{a.type} • {a.id}</div>
                      </div>
                    </div>
                    <div className="txAmt">${Number(a.balance).toFixed(2)}</div>
                  </div>
                ))}
                {accounts.length === 0 && <div className="muted">no accounts returned</div>}
              </div>
            </div>
          </section>

          <section className="panel dashPanel" style={{ marginTop: 16 }}>
            <div className="panelTop">
              <div>
                <div className="kicker">recent activity</div>
                <div className="balance">transactions</div>
              </div>
              <span className="pill">demo</span>
            </div>

            <div className="txBox">
              {txs.map((t) => {
                const positive = Number(t.amount) >= 0;
                return (
                  <div className="txRow" key={t.id}>
                    <div className="txLeft">
                      <div className="txIcon">{positive ? "↙" : "↗"}</div>
                      <div className="txText">
                        <div className="txMerchant">{t.merchant}</div>
                        <div className="kicker">{t.time}</div>
                      </div>
                    </div>
                    <div className={"txAmt " + (positive ? "pos" : "")}>
                      {positive ? "+" : ""}
                      {Number(t.amount).toFixed(2)}
                    </div>
                  </div>
                );
              })}
              {txs.length === 0 && <div className="muted">no activity returned</div>}
            </div>
          </section>
        </>
      )}
    </main>
  );
}






