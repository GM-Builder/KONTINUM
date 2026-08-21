import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { api, messageFor } from "@/api";
import { EmptyState, ErrorState, LoadingState, SectionHeading, StatusBadge } from "@/components/primitives";

export default function ActionCenter() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const navigate = useNavigate();

  const load = () => {
    setError("");
    api
      .get("/actions")
      .then((response) => setData(response.data))
      .catch((err) => setError(messageFor(err)));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (action) => {
    const nextStatus = action.status === "Completed" ? "Open" : "Completed";
    setPending(action.id);
    try {
      const response = await api.patch(`/actions/${action.id}`, { status: nextStatus });
      toast.success(nextStatus === "Completed" ? "Aksi diselesaikan" : "Aksi dibuka kembali", {
        description: `Resilience score sekarang ${response.data.score.current_score}/100`,
      });
      load();
    } catch (err) {
      toast.error("Gagal memperbarui aksi", { description: messageFor(err) });
    }
    setPending("");
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <LoadingState label="Mengurutkan rencana pemulihan…" />;

  const { actions, summary } = data;

  return (
    <div className="page" data-testid="action-center-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">ACTION CENTER / ANTREAN PERBAIKAN</span>
          <h1>Perbaiki mata rantai terlemah dulu.</h1>
          <p>Setiap aksi terhubung ke satu temuan dan diurutkan dari pengurangan risiko per usaha.</p>
        </div>
        <div className="action-summary">
          <strong data-testid="open-actions-count">{summary.open}</strong>
          <span>aksi terbuka</span>
        </div>
      </div>

      <div className="action-layout">
        <section className="panel action-queue">
          <SectionHeading eyebrow="ANTREAN PRIORITAS" title="Rencana pemulihan" action={<span className="mono">URUT: RISIKO / USAHA</span>} />
          {actions.length === 0 ? (
            <EmptyState title="Belum ada antrean" body="Jalankan simulasi untuk membuat rencana pemulihan." testId="actions-empty-state" />
          ) : null}
          {actions.map((action, index) => (
            <div
              className={`action-row ${action.status === "Completed" ? "completed" : ""}`}
              key={action.id}
              data-testid={`action-row-${action.id}`}
            >
              <div className="priority-number">{String(index + 1).padStart(2, "0")}</div>
              <div className="action-main">
                <div className="action-tags">
                  <StatusBadge testId={`action-priority-${action.id}`}>{action.priority}</StatusBadge>
                  <span className="effort">usaha {action.effort}</span>
                  <span className="effort">PIC: {action.owner}</span>
                </div>
                <h3>{action.title}</h3>
                <small>{action.rationale}</small>
                <button
                  className="text-button"
                  onClick={() => navigate(`/people/${action.person_id}`)}
                  data-testid={`action-person-${action.id}-button`}
                >
                  Lihat ketergantungannya
                </button>
              </div>
              <div className="risk-lift">
                <strong>+{action.org_uplift}</strong>
                <span>kenaikan skor</span>
                <small>+{action.scenario_reduction} skenario</small>
              </div>
              <button
                className={`complete-button ${action.status === "Completed" ? "done" : ""}`}
                onClick={() => toggle(action)}
                disabled={pending === action.id}
                data-testid={`complete-action-${action.id}-button`}
              >
                {action.status === "Completed" ? (
                  <>
                    <RotateCcw size={15} /> Buka lagi
                  </>
                ) : (
                  <>
                    <Check size={15} /> Tandai selesai
                  </>
                )}
              </button>
            </div>
          ))}
        </section>

        <aside className="panel action-impact" data-testid="action-impact-panel">
          <span className="eyebrow">HASIL TERUKUR</span>
          <h2 data-testid="action-current-score">
            {summary.current_score}
            <span>/100</span>
          </h2>
          <p>Resilience score dihitung ulang dari aksi yang sudah diselesaikan.</p>
          <div className="outcome-line">
            <span>Baseline</span>
            <b>{summary.baseline_score}</b>
          </div>
          <div className="outcome-line">
            <span>Sekarang</span>
            <b className="green">{summary.current_score}</b>
          </div>
          <div className="outcome-line">
            <span>Target rencana penuh</span>
            <b>{summary.target_score}</b>
          </div>
          <div className="outcome-line">
            <span>Kenaikan yang masih tersedia</span>
            <b>+{summary.available_uplift}</b>
          </div>
          <div className="green-callout">
            <Check size={16} />
            <span>Menjaga pengetahuan tetap berpindah itulah yang menciptakan ketahanan.</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
