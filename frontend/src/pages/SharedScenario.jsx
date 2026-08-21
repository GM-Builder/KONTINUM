import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import axios from "axios";
import { API_BASE } from "@/api";
import { ErrorState, LoadingState } from "@/components/primitives";
import { ScenarioResult } from "@/components/ScenarioResult";

export default function SharedScenario() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    axios
      .get(`${API_BASE}/public/scenarios/${token}`)
      .then((response) => setData(response.data))
      .catch((err) =>
        setError(err?.response?.data?.detail || "Tautan ini tidak berlaku atau sudah dicabut."),
      );
  }, [token]);

  if (error) return <div className="public-page"><ErrorState message={error} /></div>;
  if (!data) return <div className="public-page"><LoadingState label="Memuat skenario yang dibagikan…" /></div>;

  return (
    <div className="public-page" data-testid="shared-scenario-page">
      <header className="public-header">
        <div className="brand">
          <span className="brand-mark">K</span>
          <span>KONTINŪM</span>
        </div>
        <div>
          <span className="eyebrow">TAUTAN BAGI · HANYA-BACA</span>
          <p className="muted">
            {data.organization_name} · dibagikan {new Date(data.shared_at).toLocaleString("id-ID")}
          </p>
        </div>
        <button className="secondary-button" onClick={() => window.print()} data-testid="public-print-button">
          <Printer size={15} /> Cetak / PDF
        </button>
      </header>
      <div className="page">
        <ScenarioResult result={data.result} />
      </div>
    </div>
  );
}
