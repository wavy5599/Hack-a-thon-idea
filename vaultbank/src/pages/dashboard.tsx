// src/pages/Dashboard.tsx
import React, { useEffect, useMemo, useState } from "react";
import "./dashboard.css";

type User = { name: string; tier?: string };
type Account = { id: string; type: string; name: string; balance: number };
type Tx = { id: string; merchant: string; amount: number; time: string };

function formatMoney(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatSignedMoney(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  const sign = v >= 0 ? "+" : "-";
  return `${sign}${formatMoney(Math.abs(v))}`;
}

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

  const largestAccount = useMemo(() => {
    if (!accounts.length) return null;
    return accounts.reduce((best, cur) => (Number(cur.balance) > Number(best.balance) ? cur : best), accounts[0]);
  }, [accounts]);

  const recentNet = useMemo(() => {
    // net of last up to 8 txs for a quick “trend” number
    const slice = txs.slice(0, 8);
    return slice.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [txs]);

  async function loadData() {
    try {
      setLoading(true);
      setErr(null);

      // NOTE: we only require HTTP 2xx now (not JSON "ok: true")
      const meRes = await fetch("http://localhost:8080/me");
      const me = await meRes.json().catch(() => ({}));
      if (!meRes.ok) throw new Error(me?.message ?? `failed to load /me (${meRes.status})`);

      const txRes = await fetch("http://localhost:8080/transactions");
      const tx = await txRes.json().catch(() => ({}));
      if (!txRes.ok) throw new Error(tx?.message ?? `failed to load /transactions (${txRes.status})`);

      setUser(me.user ?? { name: "user", tier: "demo" });
      setAccounts(Array.isArray(me.accounts) ? me.accounts : []);
      setTxs(Array.isArray(tx.items) ? tx.items : []);
    } catch (e: any) {
      setErr(e?.message ?? "dashboard load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      await loadData();
      if (!alive) return;
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="dash">
      <header className="dashTop">
        <div>
          <div className="kicker">dashboard</div>
          <h1 className="dashH1">welcome, {user.name}</h1>
          <div className="muted">{user.tier ?? "demo"} tier • demo data from java server</div>
        </div>

        <div className="dashActions">
          <button className="btn" type="button">
            add account
          </button>
          <button className="btn primary" type="button">
            new transfer
          </button>
          <button className="btn" type="button" onClick={loadData} disabled={loading}>
            {loading ? "refreshing..." : "refresh"}
          </button>
        </div>
      </header>

      {loading && (
        <section className="panel">
          <div className="panelTop">
            <div>
              <div className="kicker">syncing</div>
              <div className="balance">loading your vault…</div>
            </div>
            <span className="pill">live</span>
          </div>
          <div className="muted">fetching /me and /transactions</div>

          <div className="statsRow">
            <div className="stat">
              <div className="statValue">—</div>
              <div className="statLabel">accounts</div>
            </div>
            <div className="stat">
              <div className="statValue">—</div>
              <div className="statLabel">recent tx</div>
            </div>
            <div className="stat">
              <div className="statValue">—</div>
              <div className="statLabel">net</div>
            </div>
          </div>
        </section>
      )}

      {!loading && err && (
        <section className="panel">
          <div className="panelTop">
            <div>
              <div className="kicker">error</div>
              <div className="balance">couldn’t load dashboard</div>
            </div>
            <span className="pill">offline</span>
          </div>

          <p className="muted" style={{ marginTop: 10 }}>
            {err}
          </p>

          <div className="muted" style={{ marginTop: 10 }}>
            make sure your java server is running on port 8080 and endpoints exist:
            <br />
            <span className="kicker">GET</span> /me • <span className="kicker">GET</span> /transactions
          </div>

          <div className="dashActions" style={{ marginTop: 14, justifyContent: "flex-start" }}>
            <button className="btn primary" type="button" onClick={loadData}>
              retry
            </button>
          </div>
        </section>
      )}

      {!loading && !err && (
        <>
          <section className="dashGrid">
            {/* summary */}
            <div className="panel">
              <div className="panelTop">
                <div>
                  <div className="kicker">total balance</div>
                  <div className="balance">${formatMoney(totalBalance)}</div>
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
                  <div className="statValue" style={{ color: recentNet >= 0 ? "var(--vb-good)" : "var(--vb-bad)" }}>
                    {formatSignedMoney(recentNet)}
                  </div>
                  <div className="statLabel">recent net</div>
                </div>
              </div>

              <div className="muted" style={{ marginTop: 12 }}>
                top account:{" "}
                <b style={{ color: "rgba(255,255,255,0.92)" }}>
                  {largestAccount ? `${largestAccount.name} ($${formatMoney(Number(largestAccount.balance))})` : "—"}
                </b>
              </div>
            </div>

            {/* accounts */}
            <div className="panel">
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
                        <div className="kicker">
                          {a.type} • {a.id}
                        </div>
                      </div>
                    </div>
                    <div className="txAmt">${formatMoney(Number(a.balance))}</div>
                  </div>
                ))}
                {accounts.length === 0 && <div className="muted">no accounts returned</div>}
              </div>
            </div>
          </section>

          {/* transactions */}
          <section className="panel" style={{ marginTop: 14 }}>
            <div className="panelTop">
              <div>
                <div className="kicker">recent activity</div>
                <div className="balance">transactions</div>
              </div>
              <span className="pill">live</span>
            </div>

            <div className="txBox">
              {txs.map((t) => {
                const positive = Number(t.amount) >= 0;
                return (
                  <div className="txRow" key={t.id}>
                    <div className="txLeft">
                      <div className="txIcon">{positive ? "↗" : "↘"}</div>
                      <div className="txText">
                        <div className="txMerchant">{t.merchant}</div>
                        <div className="kicker">{t.time}</div>
                      </div>
                    </div>
                    <div className={"txAmt " + (positive ? "pos" : "neg")}>
                      {formatSignedMoney(Number(t.amount))}
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





