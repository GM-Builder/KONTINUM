import { useEffect, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { toast } from "sonner";
import { api, messageFor } from "@/api";
import { Bar, LoadingState } from "@/components/primitives";

export function KnowledgeInterview({ knowledgeId, onClose, onCaptured }) {
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/knowledge/${knowledgeId}/interview`)
      .then((response) => setData(response.data))
      .catch((err) => setError(messageFor(err)));
  }, [knowledgeId]);

  const submit = async () => {
    const filled = Object.values(answers).filter((value) => value && value.trim());
    if (filled.length === 0) {
      setError("Isi minimal satu jawaban sebelum menyimpan.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await api.post(`/knowledge/${knowledgeId}/capture`, { answers: filled });
      toast.success(`Cakupan naik +${response.data.coverage_gain} poin`, {
        description: `${data.knowledge.title} sekarang ${response.data.coverage_score}% · skor ketergantungan ${response.data.person.dependency_score}`,
      });
      onCaptured?.(response.data);
      onClose();
    } catch (err) {
      setError(messageFor(err));
    }
    setBusy(false);
  };

  return (
    <div className="ask-overlay" data-testid="knowledge-interview" onClick={onClose}>
      <aside className="ask-panel" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span className="eyebrow">REKAM PENGETAHUAN</span>
            <h2>{data ? data.knowledge.title : "Memuat…"}</h2>
            {data ? (
              <p className="muted">
                {data.knowledge.domain} · cakupan sekarang {data.knowledge.coverage_score}%. {data.note}
              </p>
            ) : null}
          </div>
          <button className="icon-button" onClick={onClose} data-testid="interview-close-button">
            <X size={18} />
          </button>
        </header>

        {!data ? <LoadingState label="Menyiapkan pertanyaan wawancara…" /> : null}

        {data ? (
          <div className="interview-body">
            <Bar value={data.knowledge.coverage_score} tone={data.knowledge.coverage_score < 50 ? "danger" : "warn"} />
            {data.questions.map((questionText, index) => (
              <label key={questionText} className="interview-question">
                <span>
                  {String(index + 1).padStart(2, "0")}. {questionText}
                </span>
                <textarea
                  rows={3}
                  value={answers[index] || ""}
                  onChange={(event) => setAnswers((prev) => ({ ...prev, [index]: event.target.value }))}
                  data-testid={`interview-answer-${index}`}
                />
              </label>
            ))}
            {error ? (
              <div className="error-box" data-testid="interview-error">
                {error}
              </div>
            ) : null}
            <button className="primary-button" onClick={submit} disabled={busy} data-testid="interview-submit-button">
              {busy ? "Menyimpan…" : `Simpan & hitung ulang skor (+${data.coverage_gain} maks)`}
              <ArrowRight size={15} />
            </button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
