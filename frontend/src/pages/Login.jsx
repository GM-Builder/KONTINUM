import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, MailCheck, ShieldAlert } from "lucide-react";
import { api, messageFor, SESSION_KEY } from "@/api";

export default function Login() {
  const [email, setEmail] = useState("demo@northstar.example");
  const [stage, setStage] = useState("request");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const requestLink = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await api.post("/auth/request-link", { email });
      setToken(response.data.demo_token);
      setStage("sent");
    } catch (err) {
      setError(messageFor(err));
    }
    setBusy(false);
  };

  const verify = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await api.post("/auth/verify", { token });
      localStorage.setItem(SESSION_KEY, response.data.session_token);
      navigate("/overview");
    } catch (err) {
      setError(messageFor(err));
      setStage("request");
    }
    setBusy(false);
  };

  return (
    <main className="login-page">
      <div className="login-grid" />
      <section className="login-panel">
        <div className="brand">
          <span className="brand-mark">C</span>
          <span>CONTINUUM</span>
        </div>
        <p className="eyebrow">ORGANIZATIONAL RESILIENCE INTELLIGENCE</p>
        <h1>Know what your organization depends on.</h1>
        <p className="login-copy">
          A calm, evidence-led view of the people, processes and knowledge that keep work moving —
          and what happens when one of them is unavailable.
        </p>

        {stage === "request" ? (
          <form onSubmit={requestLink} data-testid="magic-link-form">
            <label>
              Work email
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                data-testid="magic-link-email-input"
              />
            </label>
            <button className="primary-button" disabled={busy} data-testid="magic-link-submit-button">
              {busy ? "Preparing your link…" : "Send magic link"}
              <ArrowRight size={16} />
            </button>
          </form>
        ) : (
          <div className="link-sent" data-testid="magic-link-sent-panel">
            <MailCheck size={18} />
            <div>
              <b>Sign-in link ready for {email}</b>
              <small>Single-use link, valid for 15 minutes. Email delivery is stubbed for the demo.</small>
            </div>
            <button className="primary-button" onClick={verify} disabled={busy} data-testid="magic-link-open-button">
              {busy ? "Signing you in…" : "Open sign-in link"}
              <ArrowRight size={16} />
            </button>
            <button className="text-button" onClick={() => setStage("request")} data-testid="magic-link-change-email-button">
              Use a different email
            </button>
          </div>
        )}

        {error ? (
          <div className="error-box" data-testid="magic-link-error">
            {error}
          </div>
        ) : null}

        <div className="demo-note" data-testid="demo-access-note">
          <ShieldAlert size={16} />
          <span>Demo workspace: Northstar Labs · 47 people · deterministic resilience model</span>
        </div>
      </section>
    </main>
  );
}
