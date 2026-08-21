import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Link2, Printer, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api, DURATIONS, messageFor, streamPost } from "@/api";
import { ErrorState, LoadingState, SectionHeading, StatusBadge } from "@/components/primitives";
import { ScenarioResult } from "@/components/ScenarioResult";

function Comparison({ runs, active }) {
  const entries = DURATIONS.filter((option) => runs[option.days]);
  if (entries.length < 2) return null;
  return (
    <section className="panel comparison" data-testid="scenario-comparison">
      <SectionHeading eyebrow="PERBANDINGAN SKENARIO" title="Durasi mengubah besarnya kerusakan" />
      <div className="comparison-grid">
        {entries.map((option) => {
          const run = runs[option.days];
          return (
            <div
              key={option.days}
              className={`comparison-col ${option.days === active ? "active" : ""}`}
              data-testid={`comparison-${option.days}`}
            >
              <span>{option.label}</span>
              <div className="comparison-bar">
                <i style={{ height: `${run.simulated_score}%` }} />
              </div>
              <strong>{run.simulated_score}</strong>
              <small>mitigasi {run.mitigated_score}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function Simulator() {
  const { personId = "sarah-mitchell" } = useParams();
  const [duration, setDuration] = useState(90);
  const [selected, setSelected] = useState([personId]);
  const [people, setPeople] = useState([]);
  const [result, setResult] = useState(null);
  const [runs, setRuns] = useState({});
  const [busy, setBusy] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [briefing, setBriefing] = useState("");
  const [briefingBusy, setBriefingBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    setResult(null);
    setRuns({});
    setBriefing("");
    setShareUrl("");
    setSelected([personId]);
    api
      .get("/people")
      .then((response) => setPeople(response.data.people.slice(0, 6)))
      .catch((err) => setError(messageFor(err)));
  }, [personId]);

  const toggle = (id) => {
    setSelected((previous) => {
      if (previous.includes(id)) {
        return previous.length === 1 ? previous : previous.filter((item) => item !== id);
      }
      if (previous.length >= 3) {
        toast.info("Skenario gabungan maksimal tiga orang");
        return previous;
      }
      return [...previous, id];
    });
    setResult(null);
    setRuns({});
    setBriefing("");
    setShareUrl("");
  };

  const run = async (days = duration) => {
    setBusy(true);
    setError("");
    setBriefing("");
    setShareUrl("");
    try {
      const response = await api.post("/scenarios/simulate", {
        person_ids: selected,
        duration_days: days,
      });
      setResult(response.data);
      setRuns((previous) => ({ ...previous, [days]: response.data }));
    } catch (err) {
      setError(messageFor(err));
    }
    setBusy(false);
  };

  const compareAll = async () => {
    setComparing(true);
    try {
      const responses = await Promise.all(
        DURATIONS.map((option) =>
          api.post("/scenarios/simulate", { person_ids: selected, duration_days: option.days }),
        ),
      );
      const next = {};
      responses.forEach((response) => {
        next[response.data.duration_days] = response.data;
      });
      setRuns(next);
      setResult(next[duration] || responses[responses.length - 1].data);
    } catch (err) {
      setError(messageFor(err));
    }
    setComparing(false);
  };

  const makeBriefing = async () => {
    setBriefingBusy(true);
    setBriefing("");
    try {
      await streamPost(
        "/ai/briefing",
        { person_ids: selected, duration_days: result.duration_days },
        (chunk) => setBriefing((previous) => previous + chunk),
      );
    } catch (err) {
      toast.error("Briefing AI tidak tersedia", { description: err.message });
    }
    setBriefingBusy(false);
  };

  const share = async () => {
    try {
      const response = await api.post(`/scenarios/${result.run_id}/share`);
      const url = `${window.location.origin}${response.data.path}`;
      setShareUrl(url);
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Tautan bagi tersalin", { description: "Bisa dibuka tanpa login." });
      } catch {
        toast.success("Tautan bagi dibuat", { description: url });
      }
    } catch (err) {
      toast.error("Gagal membuat tautan", { description: messageFor(err) });
    }
  };

  if (error && people.length === 0) return <ErrorState message={error} onRetry={() => navigate("/people")} />;
  if (people.length === 0) return <LoadingState label="Memuat jejak ketergantungan…" />;

  const focusNames = selected
    .map((id) => people.find((person) => person.id === id)?.name || id)
    .join(" & ");

  return (
    <div className="page" data-testid="simulation-page">
      <button className="back-button" onClick={() => navigate(`/people/${personId}`)} data-testid="simulation-back-button">
        <ArrowLeft size={14} /> {people.find((p) => p.id === personId)?.name || "Kembali"}
      </button>

      <div className="page-intro">
        <div>
          <span className="eyebrow">SIMULATOR KETIDAKHADIRAN / TAMPILAN KONTRAFAKTUAL</span>
          <h1>Apa yang terjadi jika {focusNames} tidak tersedia?</h1>
          <p>Estimasi dampak yang dirambatkan melalui graf ketergantungan — bukan prediksi.</p>
        </div>
        <StatusBadge tone="calm" testId="model-badge">Model deterministik</StatusBadge>
      </div>

      <section className="simulation-setup panel" data-testid="simulation-setup-panel">
        <div>
          <span className="eyebrow">SIAPA YANG TIDAK TERSEDIA</span>
          <h2>Pilih satu orang atau skenario gabungan</h2>
          <p className="muted">
            Pilih sampai tiga orang untuk melihat dampak gabungan bila mereka absen di periode yang sama.
          </p>
        </div>
        <div className="person-picker" data-testid="person-picker">
          {people.map((person) => (
            <button
              key={person.id}
              className={selected.includes(person.id) ? "active" : ""}
              onClick={() => toggle(person.id)}
              data-testid={`scenario-person-${person.id}-button`}
            >
              {person.name} <b>{person.dependency_score}</b>
            </button>
          ))}
        </div>

        <div>
          <span className="eyebrow">DURASI SKENARIO</span>
          <h2>Pilih jendela ketidakhadiran</h2>
          <p className="muted">
            Semakin panjang, semakin menumpuk: pekerjaan tanpa backup mengantre, konteks klien pudar,
            dan keputusan tak terdokumentasi terhenti.
          </p>
        </div>
        <div className="duration-selector">
          {DURATIONS.map((option) => (
            <button
              key={option.days}
              className={duration === option.days ? "active" : ""}
              onClick={() => setDuration(option.days)}
              data-testid={`simulation-duration-${option.label.toLowerCase().replace(" ", "-")}-button`}
            >
              {option.label}
              <span>{option.days === 90 ? "Jalur demo" : ""}</span>
            </button>
          ))}
        </div>
        <div className="simulation-buttons">
          <button className="primary-button" onClick={() => run()} disabled={busy} data-testid="run-simulation-button">
            {busy ? "Merambatkan dampak…" : "Jalankan simulasi"}
            <ArrowRight size={16} />
          </button>
          <button className="secondary-button" onClick={compareAll} disabled={comparing} data-testid="compare-all-durations-button">
            {comparing ? "Membandingkan…" : "Bandingkan semua durasi"}
          </button>
        </div>
      </section>

      {error ? <ErrorState message={error} onRetry={() => run()} /> : null}

      {result ? (
        <>
          <div className="export-bar" data-testid="export-bar">
            <div>
              <span className="eyebrow">EKSPOR DEWAN</span>
              <p className="muted">Bawa satu halaman ini ke rapat: cetak jadi PDF atau bagikan tautannya.</p>
            </div>
            <div className="export-actions">
              <button className="secondary-button" onClick={() => window.print()} data-testid="print-scenario-button">
                <Printer size={15} /> Cetak / PDF
              </button>
              <button className="secondary-button" onClick={share} data-testid="share-scenario-button">
                <Link2 size={15} /> Buat tautan bagi
              </button>
              <button className="primary-button" onClick={makeBriefing} disabled={briefingBusy} data-testid="ai-briefing-button">
                <Sparkles size={15} /> {briefingBusy ? "Menulis briefing…" : "Briefing AI"}
              </button>
            </div>
          </div>

          {shareUrl ? (
            <div className="share-link" data-testid="share-link">
              <span className="mono">TAUTAN PUBLIK</span>
              <a href={shareUrl} target="_blank" rel="noreferrer">
                {shareUrl}
              </a>
            </div>
          ) : null}

          {briefing || briefingBusy ? (
            <section className="panel briefing-panel" data-testid="ai-briefing-panel">
              <SectionHeading
                eyebrow="BRIEFING EKSEKUTIF · GEMINI 3 FLASH"
                title="Naratif untuk dibacakan di rapat"
                action={<span className="mono">DITURUNKAN DARI GRAF</span>}
              />
              <div className="briefing-text">{briefing || "Menyusun briefing…"}</div>
              <p className="muted">
                Ditulis hanya dari bukti pada graf organisasi. Angka dampak adalah estimasi, bukan prediksi.
              </p>
            </section>
          ) : null}

          <Comparison runs={runs} active={result.duration_days} />
          <ScenarioResult result={result} onOpenActions={() => navigate("/actions")} />
        </>
      ) : null}
    </div>
  );
}
