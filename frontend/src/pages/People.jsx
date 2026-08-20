import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Upload } from "lucide-react";
import { toast } from "sonner";
import { api, messageFor } from "@/api";
import { EmptyState, ErrorState, LoadingState, ScoreRing, StatusBadge } from "@/components/primitives";

const TIERS = ["All", "Critical", "High", "Moderate", "Low"];

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
      toast.success(`${response.data.imported} people imported`, {
        description: response.data.skipped ? `${response.data.skipped} rows skipped` : "Scores recalculated",
      });
      load();
    } catch (err) {
      toast.error("Import failed", { description: messageFor(err) });
    }
    event.target.value = "";
  };

  return (
    <div className="page" data-testid="people-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">PEOPLE / DEPENDENCY REGISTER</span>
          <h1>Every person, every dependency.</h1>
          <p>Dependency scores are derived from ownership, documentation and backup records only.</p>
        </div>
        <button className="secondary-button" onClick={() => fileInput.current?.click()} data-testid="import-people-button">
          <Upload size={15} /> Import CSV
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
          placeholder="Search name, role or team"
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
              {option}
            </button>
          ))}
        </div>
        <span className="mono" data-testid="people-count">
          {data ? `${data.total} people` : "…"}
        </span>
      </div>

      {error ? <ErrorState message={error} onRetry={load} /> : null}
      {!error && !data ? <LoadingState label="Scoring dependencies…" /> : null}
      {data && data.people.length === 0 ? (
        <EmptyState
          title="No people match this filter"
          body="Try a different tier, or clear the search to see the full register."
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
                  {person.process_count} processes <i /> {person.client_count} clients <i /> {person.trained_backups} trained backups
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
