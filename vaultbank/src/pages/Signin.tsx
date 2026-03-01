// src/pages/SignIn.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./signin.css";

type Props = {
  brandName?: string;
  onSubmit?: (payload: { email: string; password: string; remember: boolean }) => void;
};

export default function SignIn({ brandName = "vaultbank", onSubmit }: Props) {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);

  const [statusMsg, setStatusMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const validEmail = useMemo(() => {
    const e = email.trim();
    return e.length > 3 && e.includes("@");
  }, [email]);

  const validPassword = useMemo(() => password.length >= 6, [password]);

  const canSubmit = useMemo(
    () => validEmail && validPassword && !isLoading,
    [validEmail, validPassword, isLoading]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validEmail) {
      setStatusMsg("enter a valid email (must include @)");
      return;
    }
    if (!validPassword) {
      setStatusMsg("password must be at least 6 characters");
      return;
    }

    setStatusMsg("contacting server...");
    setIsLoading(true);

    const payload = { email: email.trim(), password, remember };

    try {
      const res = await fetch("http://localhost:8080/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {}

      if (!res.ok) {
        setStatusMsg(data?.message ?? `login failed (${res.status})`);
        return;
      }

      setStatusMsg(data?.message ?? "login was successful ✅");
      onSubmit?.(payload);

      setTimeout(() => navigate("/dashboard"), 250);
    } catch (err) {
      console.error("❌ fetch failed:", err);
      setStatusMsg("could not reach java server (start it: java VaultBankServer)");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="dash">
      <div className="dashInner">
        <header className="dashTop">
          <div>
            <div className="kicker">secure sign in</div>
            <h1 className="dashH1">welcome back.</h1>
            <div className="muted">access your vault • demo auth</div>
          </div>

          <div className="dashActions">
            <button className="btn" type="button" onClick={() => navigate("/")}>
              home
            </button>
            <button className="btn primary" type="button" onClick={() => navigate("/dashboard")}>
              dashboard
            </button>
          </div>
        </header>

        <section className="dashGrid">
          {/* left panel */}
          <section className="panel">
            <div className="panelTop">
              <div>
                <div className="kicker">brand</div>
                <div className="balance">{brandName}</div>
              </div>
              <span className="pill">secure</span>
            </div>

            <div className="muted" style={{ marginTop: 6 }}>
              sign in to manage balances, track activity, and use vault ai.
            </div>

            <div className="statsRow" style={{ marginTop: 14 }}>
              <div className="stat">
                <div className="statValue">2FA</div>
                <div className="statLabel">ready when you are</div>
              </div>
              <div className="stat">
                <div className="statValue">AES-256</div>
                <div className="statLabel">at-rest encryption</div>
              </div>
              <div className="stat">
                <div className="statValue">99.9%</div>
                <div className="statLabel">uptime target</div>
              </div>
            </div>

            <div
              className="stat"
              style={{
                marginTop: 14,
                background: "rgba(0,0,0,0.22)",
                borderColor: "rgba(255,255,255,0.12)",
              }}
            >
              <div className="kicker">tip</div>
              <div className="muted" style={{ marginTop: 6 }}>
                keep your demo login simple: email + password now, real auth later.
              </div>
            </div>
          </section>

          {/* right panel */}
          <section className="panel" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div className="panelTop">
              <div>
                <div className="kicker">sign in</div>
                <div className="balance">access your vault</div>
              </div>
              <span className="pill">demo</span>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
              {/* email */}
              <label style={{ display: "grid", gap: 6 }}>
                <span className="kicker">email</span>
                <div className="acctRow" style={{ padding: 10 }}>
                  <div className="acctLeft" style={{ width: "100%" }}>
                    <div className="txIcon" aria-hidden="true">
                      @
                    </div>
                    <div className="txText" style={{ width: "100%" }}>
                      <input
                        style={{
                          width: "100%",
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          color: "rgba(255,255,255,0.95)",
                          fontSize: 15,
                          padding: "6px 0",
                        }}
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="you@domain.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                </div>
              </label>

              {/* password */}
              <label style={{ display: "grid", gap: 6 }}>
                <span className="kicker">password</span>
                <div className="acctRow" style={{ padding: 10 }}>
                  <div className="acctLeft" style={{ width: "100%" }}>
                    <div className="txIcon" aria-hidden="true">
                      ••
                    </div>

                    <div className="txText" style={{ width: "100%" }}>
                      <input
                        style={{
                          width: "100%",
                          border: "none",
                          outline: "none",
                          background: "transparent",
                          fontSize: 15,
                          padding: "6px 0",
                        }}
                        type={showPw ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>

                    <button
                      type="button"
                      className="btn"
                      style={{ padding: "8px 10px", borderRadius: 12 }}
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? "hide password" : "show password"}
                      disabled={isLoading}
                    >
                      {showPw ? "hide" : "show"}
                    </button>
                  </div>
                </div>
              </label>

              {/* remember row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label className="muted" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    disabled={isLoading}
                  />
                  remember me
                </label>

                <button
                  type="button"
                  className="btn"
                  style={{ padding: "8px 10px", borderRadius: 12 }}
                  onClick={() => setStatusMsg("demo: password reset disabled")}
                  disabled={isLoading}
                >
                  forgot?
                </button>
              </div>

              {statusMsg && <div className="muted">{statusMsg}</div>}

              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button className="btn primary" type="submit" disabled={!canSubmit} style={{ flex: 1 }}>
                  {isLoading ? "signing in..." : "sign in"}
                </button>
              </div>

              <div className="muted" style={{ marginTop: 2 }}>
                by continuing, you agree to our terms and privacy.
              </div>
            </form>

            {/* ✅ demo activity (NO scrollbar, and doesn't stick to bottom) */}
            <div
              style={{
                marginTop: 16,
                paddingTop: 12,
                borderTop: "1px solid rgba(255,255,255,0.10)",
                paddingBottom: 6, // gives a little floor space in the panel
              }}
            >
              <div className="kicker">recent activity (demo)</div>

              {/* no overflow here, so no extra scrollbar */}
              <div className="txBox" style={{ marginTop: 10 }}>
                <div className="txRow">
                  <div className="txLeft">
                    <div className="txIcon">↗</div>
                    <div className="txText">
                      <div className="txMerchant">login attempt</div>
                      <div className="kicker">device • web</div>
                    </div>
                  </div>
                  <div className="txAmt pos">ok</div>
                </div>

                <div className="txRow">
                  <div className="txLeft">
                    <div className="txIcon">🛡</div>
                    <div className="txText">
                      <div className="txMerchant">security check</div>
                      <div className="kicker">token refreshed</div>
                    </div>
                  </div>
                  <div className="txAmt pos">done</div>
                </div>

                <div className="txRow">
                  <div className="txLeft">
                    <div className="txIcon">⚡</div>
                    <div className="txText">
                      <div className="txMerchant">session</div>
                      <div className="kicker">ready</div>
                    </div>
                  </div>
                  <div className="txAmt">—</div>
                </div>
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}