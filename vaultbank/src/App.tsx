import { useMemo, useState } from "react";
import "./App.css";

type Tx = {
  merchant: string;
  meta: string;
  amount: string;
  tone: "neg" | "pos";
  icon: string;
};

export default function App() {
  const [email, setEmail] = useState("");

  const year = useMemo(() => new Date().getFullYear(), []);

  const tx: Tx[] = [
    { merchant: "walmart", meta: "groceries • today", amount: "-$52.11", tone: "neg", icon: "↘" },
    { merchant: "spotify", meta: "subscription • yesterday", amount: "-$10.99", tone: "neg", icon: "↘" },
    { merchant: "doordash", meta: "income • jan 2", amount: "+$64.17", tone: "pos", icon: "↗" },
  ];

  const onJoin = () => alert("demo: waitlist submitted!");

  return (
    <div className="app">
      {/* top nav */}
      <header className="nav">
        <div className="navInner">
          <div className="brand">
            <span className="dot" />
            <div className="brandText">
              <div className="brandName">vaultbank</div>
              <div className="brandTag">modern fintech banking</div>
            </div>
          </div>

          <nav className="navLinks">
            <a href="#features">features</a>
            <a href="#security">security</a>
            <a href="#pricing">pricing</a>
          </nav>

          <div className="navCtas">
            <button className="btn ghost">sign in</button>
            <button className="btn primary">get started</button>
          </div>
        </div>
      </header>

      {/* main */}
      <main className="main">
        {/* hero */}
        <section className="hero">
          <div className="heroInner">
            <div className="heroLeft">
              <div className="badges">
                <span className="badge">fast transfers</span>
                <span className="badge">smart insights</span>
                <span className="badge">lock card instantly</span>
              </div>

              <h1 className="h1">
                bank with <span className="glow">clarity</span>, not chaos.
              </h1>

              <p className="lead">
                a clean, modern banking experience: real-time controls, spending insights, and security that stays out of
                your way.
              </p>

              <div className="ctaRow">
                <div className="inputGroup">
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email address"
                    inputMode="email"
                  />
                  <button className="btn primary" onClick={onJoin}>
                    join waitlist
                  </button>
                </div>

                <button className="btn ghost">see demo</button>
              </div>

              <div className="fineprint">no spam. unsubscribe anytime.</div>

              <div className="stats">
                <div className="stat">
                  <div className="statValue">3.5 hrs</div>
                  <div className="statLabel">avg time saved / week</div>
                </div>
                <div className="stat">
                  <div className="statValue">24/7</div>
                  <div className="statLabel">fraud monitoring</div>
                </div>
                <div className="stat">
                  <div className="statValue">1 tap</div>
                  <div className="statLabel">instant card lock</div>
                </div>
              </div>
            </div>

            {/* preview card */}
            <div className="heroRight">
              <div className="panel">
                <div className="panelTop">
                  <div>
                    <div className="kicker">checking balance</div>
                    <div className="balance">$3,284.55</div>
                  </div>
                  <span className="pill">live</span>
                </div>

                <div className="grid2">
                  <div className="mini">
                    <div className="kicker">savings</div>
                    <div className="miniValue">$7,421.20</div>
                  </div>
                  <div className="mini">
                    <div className="kicker">cashback</div>
                    <div className="miniValue">$42.18</div>
                  </div>
                  <div className="mini">
                    <div className="kicker">utilization</div>
                    <div className="miniValue">34%</div>
                  </div>
                  <div className="mini">
                    <div className="kicker">alerts</div>
                    <div className="miniValue">2</div>
                  </div>
                </div>

                <div className="txBox">
                  <div className="txTitle">recent activity</div>
                  {tx.map((t) => (
                    <div className="txRow" key={`${t.merchant}-${t.meta}`}>
                      <div className="txLeft">
                        <div className="txIcon">{t.icon}</div>
                        <div className="txText">
                          <div className="txMerchant">{t.merchant}</div>
                          <div className="kicker">{t.meta}</div>
                        </div>
                      </div>
                      <div className={`txAmt ${t.tone}`}>{t.amount}</div>
                    </div>
                  ))}
                </div>

                <div className="panelBtns">
                  <button className="btn primary">open account</button>
                  <button className="btn ghost">learn more</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* features */}
        <section className="section" id="features">
          <div className="sectionInner">
            <h2 className="h2">built for speed + control</h2>
            <p className="sub">simple tools that actually feel premium.</p>

            <div className="cards">
              <div className="card">
                <div className="cardIcon">⚡</div>
                <div className="cardTitle">instant transfers</div>
                <div className="cardText">move money fast with clean confirmations.</div>
              </div>

              <div className="card">
                <div className="cardIcon">🛡️</div>
                <div className="cardTitle">smart protection</div>
                <div className="cardText">real-time fraud signals and quick card lock.</div>
              </div>

              <div className="card">
                <div className="cardIcon">📊</div>
                <div className="cardTitle">spending clarity</div>
                <div className="cardText">categories + insights that stay readable.</div>
              </div>
            </div>
          </div>
        </section>

        {/* security */}
        <section className="section alt" id="security">
          <div className="sectionInner split">
            <div>
              <h2 className="h2">security that stays quiet</h2>
              <p className="sub">
                strong defaults, fewer risky flows, and better visibility when you need it.
              </p>

              <div className="bullets">
                <div className="bullet"><span className="check">✓</span> instant freeze + limits</div>
                <div className="bullet"><span className="check">✓</span> device + session monitoring</div>
                <div className="bullet"><span className="check">✓</span> exportable activity logs</div>
              </div>

              <div className="callout">
                <div className="callTitle">pro tip</div>
                <div className="sub">keep utilization under ~30% for a cleaner profile long-term.</div>
              </div>
            </div>

            <div className="stack">
              <div className="stackTop">
                <div>
                  <div className="kicker">security status</div>
                  <div className="stackTitle">protected</div>
                </div>
                <span className="pill">active</span>
              </div>

              <div className="stackRows">
                <div className="stackRow">
                  <span className="kicker">card controls</span>
                  <b>enabled</b>
                </div>
                <div className="stackRow">
                  <span className="kicker">alerts</span>
                  <b>2 recent</b>
                </div>
                <div className="stackRow">
                  <span className="kicker">login health</span>
                  <b>strong</b>
                </div>
              </div>

              <div className="stackBtns">
                <button className="btn primary">lock card</button>
                <button className="btn ghost">manage limits</button>
              </div>
            </div>
          </div>
        </section>

        {/* pricing */}
        <section className="section" id="pricing">
          <div className="sectionInner">
            <h2 className="h2">simple pricing</h2>
            <p className="sub">start free, upgrade when you want automation.</p>

            <div className="pricing">
              <div className="priceCard">
                <div className="priceName">starter</div>
                <div className="priceNum">$0</div>
                <div className="sub">personal basics</div>
                <ul className="list">
                  <li>checking + savings view</li>
                  <li>basic insights</li>
                  <li>card controls</li>
                </ul>
                <button className="btn ghost">get started</button>
              </div>

              <div className="priceCard featured">
                <div className="tag">most popular</div>
                <div className="priceName">plus</div>
                <div className="priceNum">$9</div>
                <div className="sub">per month</div>
                <ul className="list">
                  <li>advanced insights</li>
                  <li>auto-budgets</li>
                  <li>priority support</li>
                </ul>
                <button className="btn primary">start plus</button>
              </div>

              <div className="priceCard">
                <div className="priceName">team</div>
                <div className="priceNum">$29</div>
                <div className="sub">per month</div>
                <ul className="list">
                  <li>shared wallets</li>
                  <li>roles + approvals</li>
                  <li>export + reporting</li>
                </ul>
                <button className="btn ghost">contact sales</button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* footer */}
      <footer className="footer">
        <div className="footerInner">
          <div className="footerLeft">
            <div className="brand">
              <span className="dot" />
              <div className="brandText">
                <div className="brandName">vaultbank</div>
                <div className="brandTag">demo UI only</div>
              </div>
            </div>
            <div className="kicker" style={{ marginTop: 10 }}>
              © {year} vaultbank
            </div>
          </div>

          <div className="footerRight">
            <a href="#features">features</a>
            <a href="#security">security</a>
            <a href="#pricing">pricing</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
