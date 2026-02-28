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

  const [statusMsg, setStatusMsg] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const validEmail = useMemo(() => {
    const e = email.trim();
    return e.length > 3 && e.includes("@");
  }, [email]);

  const validPassword = useMemo(() => password.length >= 6, [password]);

  const canSubmit = useMemo(() => validEmail && validPassword && !isLoading, [
    validEmail,
    validPassword,
    isLoading,
  ]);

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

      // ✅ auto-route to dashboard after success
      setTimeout(() => {
        navigate("/dashboard");
      }, 300);
    } catch (err) {
      console.error("❌ fetch failed:", err);
      setStatusMsg("could not reach java server (start it: java VaultBankServer)");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="auth">
      <div className="authShell">
        <section className="authLeft">
          <div className="authBrand">
            <span className="dot" aria-hidden="true" />
            <div className="brandText">
              <div className="brandName">{brandName}</div>
              <div className="brandTag">secure access • clean fintech</div>
            </div>
          </div>

          <h1 className="h1 glow">welcome back.</h1>
          <p className="lead">
            sign in to manage balances, track activity, and ship your hackathon demo with a clean,
            modern UI.
          </p>

          <div className="authTrust">
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

          <div className="callout">
            <div className="callTitle">tip</div>
            <div className="sub">
              keep your demo login simple: email + password, then plug in real auth later.
            </div>
          </div>
        </section>

        <section className="authRight">
          <div className="panel authPanel">
            <div className="panelTop">
              <div>
                <div className="kicker">sign in</div>
                <div className="balance">access your vault</div>
              </div>
              <span className="pill">secure</span>
            </div>

            <form className="authForm" onSubmit={handleSubmit}>
              <label className="field">
                <span className="fieldLabel">email</span>
                <div className="inputGroup">
                  <span className="fieldIcon" aria-hidden="true">
                    @
                  </span>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </label>

              <label className="field">
                <span className="fieldLabel">password</span>
                <div className="inputGroup">
                  <span className="fieldIcon" aria-hidden="true">
                    ••
                  </span>
                  <input
                    type={showPw ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className="btn ghost miniBtn"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "hide password" : "show password"}
                    disabled={isLoading}
                  >
                    {showPw ? "hide" : "show"}
                  </button>
                </div>
              </label>

              <div className="authRow">
                <label className="checkRow">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    disabled={isLoading}
                  />
                  <span>remember me</span>
                </label>

                <a className="mutedLink" href="#">
                  forgot password?
                </a>
              </div>

              {statusMsg && <p className="fineprint">{statusMsg}</p>}

              <div className="panelBtns">
                <button className="btn primary" type="submit" disabled={!canSubmit}>
                  {isLoading ? "signing in..." : "sign in"}
                </button>
              </div>

              <p className="fineprint">
                by continuing, you agree to our <a href="#">terms</a> and <a href="#">privacy</a>.
              </p>
            </form>

            <div className="txBox authFoot">
              <div className="txTitle">recent activity (demo)</div>

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
      </div>
    </main>
  );
}