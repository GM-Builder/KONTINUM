import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Upload } from "lucide-react";
import { toast } from "sonner";
import { api, messageFor } from "@/api";
import { EmptyState, ErrorState, LoadingState, ScoreRing, StatusBadge } from "@/components/primitives";

const TIERS = ["All", "Critical", "High", "Moderate", "Low"];
const TIER_LABEL = { All: "Semua", Critical: "Critical", High: "High", Moderate: "Moderate", Low: "Low" };

export default function People() {
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState("All");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const fileInput = useRef(null);
  const navigate = useNavigate();

  const load = () => {
    setError("");
    api
      .get("/people", { params: { search, tier: tier === "All" ? "" : tier } })
      .then((response) => setData(response.data))
      .catch((err) => setError(messageFor(err)));
  };

  useEffect(() => {
    const timer = setTimeout(load, 180);
    return () => clearTimeout(timer);
  }, [search, tier]); // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await api.post("/import/people", body);
      toast.success(`${response.data.imported} orang diimpor`, {
        description: response.data.skipped ? `${response.data.skipped} baris dilewati` : "Skor sudah dihitung ulang",
      });
      load();
    } catch (err) {
      toast.error("Impor gagal", { description: messageFor(err) });
    }
    event.target.value = "";
  };

  return (
    <div className="page" data-testid="people-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">ORANG / REGISTER KETERGANTUNGAN</span>
          <h1>Setiap orang, setiap ketergantungan.</h1>
          <p>Skor ketergantungan hanya berasal dari catatan kepemilikan, dokumentasi, dan backup.</p>
        </div>
        <button className="secondary-button" onClick={() => fileInput.current?.click()} data-testid="import-people-button">
          <Upload size={15} /> Impor CSV
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".csv"
          onChange={upload}
          className="hidden-input"
          data-testid="import-people-input"
        />
      </div>

      <div className="people-toolbar">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari nama, peran, atau tim"
          data-testid="people-search-input"
        />
        <div className="tier-filters">
          {TIERS.map((option) => (
            <button
              key={option}
              className={tier === option ? "active" : ""}
              onClick={() => setTier(option)}
              data-testid={`people-tier-${option.toLowerCase()}-button`}
            >
              {TIER_LABEL[option]}
            </button>
          ))}
        </div>
        <span className="mono" data-testid="people-count">
          {data ? `${data.total} orang` : "…"}
        </span>
      </div>

      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!error && !data ? <LoadingState label="Menghitung skor ketergantungan…" /> : null}
      {data && data.people.length === 0 ? (
        <EmptyState
          title="Tidak ada orang yang cocok"
          body="Coba tier lain, atau hapus kata kuncinya untuk melihat seluruh register."
          testId="people-empty-state"
        />
      ) : null}

      {data && data.people.length > 0 ? (
        <section className="panel people-table" data-testid="people-table">
          {data.people.map((person) => (
            <button
              key={person.id}
              className="person-row"
              onClick={() => navigate(`/people/${person.id}`)}
              data-testid={`person-row-${person.id}`}
            >
              <ScoreRing score={person.dependency_score} coverage={person.knowledge_coverage} size="sm" name={person.name} />
              <div className="person-info">
                <b>{person.name}</b>
                <span>
                  {person.role} · {person.team}
                </span>
                <small>
                  {person.process_count} proses <i /> {person.client_count} klien <i /> {person.trained_backups} backup terlatih
                </small>
              </div>
              <StatusBadge testId={`person-tier-${person.id}`}>{person.tier}</StatusBadge>
              <ChevronRight size={16} />
            </button>
          ))}
        </section>
      ) : null}
    </div>
  );
}
