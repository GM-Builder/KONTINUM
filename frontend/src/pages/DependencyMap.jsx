import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { api, messageFor } from "@/api";
import {
  ErrorState, EvidenceChip, LoadingState, ScoreRing, StatusBadge,
} from "@/components/primitives";

const KIND_ORDER = ["process", "client", "vendor", "system", "knowledge"];

function layout(nodes) {
  const person = nodes.find((node) => node.kind === "person");
  const others = KIND_ORDER.flatMap((kind) => nodes.filter((node) => node.kind === kind));
  const total = others.length || 1;
  const positioned = [{ ...person, x: 50, y: 50 }];
  others.forEach((node, index) => {
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
    const radius = index % 2 === 0 ? 44 : 29;
    positioned.push({
      ...node,
      x: 50 + Math.cos(angle) * radius,
      y: 50 + Math.sin(angle) * radius * 0.84,
    });
  });
  return positioned;
}

export default function DependencyMap() {
  const [searchParams, setSearchParams] = useSearchParams();
  const focus = searchParams.get("focus") || "sarah-mitchell";
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setData(null);
    setError("");
    api
      .get("/dependencies", { params: { focus, critical_only: criticalOnly } })
      .then((response) => {
        setData(response.data);
        setSelected(null);
      })
      .catch((err) => setError(messageFor(err)));
  }, [focus, criticalOnly]);

  const positioned = useMemo(() => (data ? layout(data.nodes) : []), [data]);

  if (error) return <ErrorState message={error} onRetry={() => setSearchParams({ focus })} />;
  if (!data) return <LoadingState label="Tracing dependency relationships…" />;

  const person = data.focus_person;
  const detail = selected ? data.nodes.find((node) => node.id === selected) : null;
  const byId = Object.fromEntries(positioned.map((node) => [node.id, node]));

  return (
    <div className="page map-page" data-testid="dependency-map-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">DEPENDENCY MAP / FOCUS MODE</span>
          <h1>What depends on whom?</h1>
          <p>Trace observed relationships across processes, clients, vendors, systems and knowledge.</p>
        </div>
        <div className="filter-row">
          <button
            className={`filter ${criticalOnly ? "" : "active"}`}
            onClick={() => setCriticalOnly(false)}
            data-testid="map-filter-all-button"
          >
            All entities
          </button>
          <button
            className={`filter ${criticalOnly ? "active" : ""}`}
            onClick={() => setCriticalOnly(true)}
            data-testid="map-filter-critical-button"
          >
            <i className="filter-dot critical" /> Critical only
          </button>
        </div>
      </div>

      <div className="focus-switcher" data-testid="map-focus-switcher">
        <span className="eyebrow">FOCUS</span>
        {data.people.slice(0, 5).map((option) => (
          <button
            key={option.id}
            className={option.id === focus ? "active" : ""}
            onClick={() => setSearchParams({ focus: option.id })}
            data-testid={`map-focus-${option.id}-button`}
          >
            {option.name} <b>{option.score}</b>
          </button>
        ))}
      </div>

      <div className="map-layout">
        <section className="map-canvas" data-testid="dependency-graph-canvas">
          <div className="coordinates">
            NORTHSTAR / GRAPH 01 <span>{data.nodes.length} nodes · {data.edges.length} edges</span>
          </div>
          <svg className="edges" viewBox="0 0 100 100" preserveAspectRatio="none">
            {data.edges.map((edge) => {
              const source = byId[edge.source];
              const target = byId[edge.target];
              if (!source || !target) return null;
              return (
                <line
                  key={`${edge.source}-${edge.target}-${edge.relationship}`}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  className={`edge-${String(edge.risk).toLowerCase()} ${
                    selected && (selected === edge.target || selected === edge.source) ? "edge-active" : ""
                  }`}
                />
              );
            })}
          </svg>
          {positioned.map((node) => (
            <button
              key={node.id}
              className={`graph-node node-${node.kind} ${selected === node.id ? "selected" : ""} ${
                selected && selected !== node.id && node.kind !== "person" ? "dimmed" : ""
              }`}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              onClick={() => setSelected(node.id)}
              title={node.label}
              data-testid={`graph-node-${node.id}-button`}
            >
              <span className="node-dot">{node.kind === "person" ? node.score : node.kind.slice(0, 2).toUpperCase()}</span>
              <b>{node.label}</b>
              <small>{node.kind}</small>
            </button>
          ))}
          <div className="map-legend" data-testid="map-legend">
            {["person", "process", "client", "vendor", "system", "knowledge"].map((kind) => (
              <span key={kind}>
                <i className={`legend-dot node-${kind}`} /> {kind}
              </span>
            ))}
          </div>
        </section>

        <aside className="map-detail panel" data-testid="selected-node-detail">
          {detail && detail.kind !== "person" ? (
            <>
              <span className="eyebrow">SELECTED NODE</span>
              <h2>{detail.label}</h2>
              <p className="muted">
                {detail.kind} · {detail.meta}
              </p>
              <StatusBadge>{detail.risk}</StatusBadge>
              <p className="muted">
                This entity depends on {person.name}. Removing that link is what the recovery plan is for.
              </p>
              <button className="secondary-button" onClick={() => setSelected(null)} data-testid="clear-selection-button">
                Back to {person.name}
              </button>
            </>
          ) : (
            <>
              <span className="eyebrow">SELECTED NODE</span>
              <div className="detail-profile">
                <ScoreRing score={person.dependency_score} coverage={person.knowledge_coverage} size="lg" name={person.name} />
                <div>
                  <h2>{person.name}</h2>
                  <p>{person.role}</p>
                  <StatusBadge>{person.tier}</StatusBadge>
                </div>
              </div>
              <div className="why">
                <span className="eyebrow">WHY CRITICAL?</span>
                <ul>
                  <li>
                    <b>{person.critical_process_count}</b> critical processes without backup
                  </li>
                  <li>
                    <b>{person.client_count}</b> client relationships owned
                  </li>
                  <li>
                    <b>{person.trained_backups}</b> fully trained backups
                  </li>
                  <li>
                    <b>{person.knowledge_coverage}%</b> knowledge documented
                  </li>
                </ul>
              </div>
              <div className="detail-actions">
                <button
                  className="primary-button"
                  onClick={() => navigate(`/people/${person.id}`)}
                  data-testid="map-view-human-manual-button"
                >
                  View Human Manual <ArrowRight size={15} />
                </button>
                <button
                  className="secondary-button"
                  onClick={() => navigate(`/simulate/${person.id}`)}
                  data-testid="map-simulate-absence-button"
                >
                  Simulate absence
                </button>
              </div>
              <EvidenceChip confidence={0.96}>ownership records · {data.edges.length} refs</EvidenceChip>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
