// src/pages/CreateAccount.tsx
import React, { useMemo, useState } from "react";
import "./signin.css";

type Props = {
  brandName?: string;
  onSubmit?: (payload: {
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
    agree: boolean;
  }) => void;
};

export default function CreateAccount({ brandName = "vaultbank", onSubmit }: Props) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const pwMatch = password.length > 0 && password === confirmPassword;

  const canSubmit = useMemo(() => {
    const e = email.trim();
    return (
      fullName.trim().length >= 2 &&
      e.length > 3 &&
      e.includes("@") &&
      password.length >= 6 &&
      pwMatch &&
      agree
    );
  }, [fullName, email, password, pwMatch, agree]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      fullName: fullName.trim(),
      email: email.trim(),
      password,
      confirmPassword,
      agree,
    };
    onSubmit?.(payload);
  }

  return (
    <main className="auth">
      <div className="authShell">
        {/* Left: copy + trust */}
        <section className="authLeft">
          <div className="authBrand">
            <span className="dot" aria-hidden="true" />
            <div className="brandText">
              <div className="brandName">{brandName}</div>
              <div className="brandTag">secure access • clean fintech</div>
            </div>
          </div>

          <h1 className="h1 glow">create your account.</h1>
          <p className="lead">
            spin up a demo login fast now, then swap in real auth when you’re ready.
          </p>

          <div className="authTrust">
            <div className="stat">
              <div className="statValue">KYC</div>
              <div className="statLabel">later (optional)</div>
            </div>
            <div className="stat">
              <div className="statValue">2FA</div>
              <div className="statLabel">add after MVP</div>
            </div>
            <div className="stat">
              <div className="statValue">safe</div>
              <div className="statLabel">secure defaults</div>
            </div>
          </div>

          <div className="callout">
            <div className="callTitle">tip</div>
            <div className="sub">
              for hackathons: store users in-memory or a simple DB table and keep flows smooth.
            </div>
          </div>
        </section>

        {/* Right: form */}
        <section className="authRight">
          <div className="panel authPanel">
            <div className="panelTop">
              <div>
                <div className="kicker">create account</div>
                <div className="balance">join your vault</div>
              </div>
              <span className="pill">new</span>
            </div>

            <form className="authForm" onSubmit={handleSubmit}>
              <label className="field">
                <span className="fieldLabel">full name</span>
                <div className="inputGroup">
                  <span className="fieldIcon" aria-hidden="true">
                    👤
                  </span>
                  <input
                    type="text"
                    autoComplete="name"
                    placeholder="your name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </label>

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
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn ghost miniBtn"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "hide password" : "show password"}
                  >
                    {showPw ? "hide" : "show"}
                  </button>
                </div>
              </label>

              <label className="field">
                <span className="fieldLabel">confirm password</span>
                <div className="inputGroup">
                  <span className="fieldIcon" aria-hidden="true">
                    ✓
                  </span>
                  <input
                    type={showPw ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </label>

              {/* small inline feedback using your existing typographic styles */}
              {!pwMatch && confirmPassword.length > 0 && (
                <div className="fineprint" style={{ marginTop: "-6px" }}>
                  passwords must match
                </div>
              )}

              <div className="authRow">
                <label className="checkRow">
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                  <span>
                    i agree to the <a href="#">terms</a>
                  </span>
                </label>

                <a className="mutedLink" href="#">
                  already have an account?
                </a>
              </div>

              <div className="panelBtns">
                <button className="btn primary" type="submit" disabled={!canSubmit}>
                  create account
                </button>
                <button className="btn" type="button">
                  back to sign in
                </button>
              </div>

              <p className="fineprint">
                we’ll never share your info. this is a demo flow—wire up real auth when ready.
              </p>
            </form>

            <div className="txBox authFoot">
              <div className="txTitle">setup checklist (demo)</div>

              <div className="txRow">
                <div className="txLeft">
                  <div className="txIcon">✅</div>
                  <div className="txText">
                    <div className="txMerchant">account details</div>
                    <div className="kicker">name + email</div>
                  </div>
                </div>
                <div className="txAmt pos">ok</div>
              </div>

              <div className="txRow">
                <div className="txLeft">
                  <div className="txIcon">🔒</div>
                  <div className="txText">
                    <div className="txMerchant">password</div>
                    <div className="kicker">min 6 chars</div>
                  </div>
                </div>
                <div className="txAmt pos">ready</div>
              </div>

              <div className="txRow">
                <div className="txLeft">
                  <div className="txIcon">⚡</div>
                  <div className="txText">
                    <div className="txMerchant">next</div>
                    <div className="kicker">route to dashboard</div>
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