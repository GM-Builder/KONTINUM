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
          <span className="brand-mark">K</span>
          <span>KONTINŪM</span>
        </div>
        <p className="eyebrow">ORGANIZATIONAL RESILIENCE INTELLIGENCE</p>
        <h1>Ketahui apa yang ditopang organisasimu.</h1>
        <p className="login-copy">
          Pandangan tenang dan berbasis bukti atas orang, proses, dan pengetahuan yang membuat
          pekerjaan tetap berjalan — serta apa yang terjadi bila salah satunya tidak tersedia.
        </p>

        {stage === "request" ? (
          <form onSubmit={requestLink} data-testid="magic-link-form">
            <label>
              Email kerja
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                data-testid="magic-link-email-input"
              />
            </label>
            <button className="primary-button" disabled={busy} data-testid="magic-link-submit-button">
              {busy ? "Menyiapkan tautan…" : "Kirim magic link"}
              <ArrowRight size={16} />
            </button>
          </form>
        ) : (
          <div className="link-sent" data-testid="magic-link-sent-panel">
            <MailCheck size={18} />
            <div>
              <b>Tautan masuk siap untuk {email}</b>
              <small>Sekali pakai, berlaku 15 menit. Pengiriman email masih disimulasikan untuk demo.</small>
            </div>
            <button className="primary-button" onClick={verify} disabled={busy} data-testid="magic-link-open-button">
              {busy ? "Memasukkan kamu…" : "Buka tautan masuk"}
              <ArrowRight size={16} />
            </button>
            <button className="text-button" onClick={() => setStage("request")} data-testid="magic-link-change-email-button">
              Pakai email lain
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
          <span>Workspace demo: Northstar Labs · 47 orang · model ketahanan deterministik</span>
        </div>
      </section>
    </main>
  );
}
