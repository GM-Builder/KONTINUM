import { useEffect, useRef, useState } from "react";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { streamPost } from "@/api";

const SUGGESTIONS = [
  "Apa saja yang bergantung pada Sarah?",
  "Proses mana yang paling rapuh sekarang?",
  "Kalau Michael Wong resign, apa dampaknya?",
  "Aksi mana yang paling cepat menaikkan skor?",
];

export function AskPanel({ open, onClose, initialQuestion = "" }) {
  const [question, setQuestion] = useState(initialQuestion);
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    if (open) setQuestion(initialQuestion);
  }, [open, initialQuestion]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  const ask = async (value) => {
    const text = (value ?? question).trim();
    if (!text || streaming) return;
    setQuestion("");
    setError("");
    setMessages((previous) => [...previous, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setStreaming(true);
    try {
      await streamPost("/ai/ask", { question: text, session_id: "kontinum-demo" }, (chunk) => {
        setMessages((previous) => {
          const next = [...previous];
          next[next.length - 1] = {
            role: "assistant",
            content: next[next.length - 1].content + chunk,
          };
          return next;
        });
      });
    } catch (err) {
      setError(err.message);
    }
    setStreaming(false);
  };

  if (!open) return null;

  return (
    <div className="ask-overlay" data-testid="ask-panel" onClick={onClose}>
      <aside className="ask-panel" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span className="eyebrow">
              <Sparkles size={12} /> TANYA KONTINŪM
            </span>
            <h2>Analis ketergantungan</h2>
            <p className="muted">
              Dijawab dari graf organisasi. Tidak ada angka yang dikarang, dan dampak selalu disebut
              sebagai estimasi.
            </p>
          </div>
          <button className="icon-button" onClick={onClose} data-testid="ask-close-button">
            <X size={18} />
          </button>
        </header>

        <div className="ask-thread" data-testid="ask-thread">
          {messages.length === 0 ? (
            <div className="ask-suggestions">
              {SUGGESTIONS.map((item) => (
                <button key={item} onClick={() => ask(item)} data-testid={`ask-suggestion-${item.slice(0, 12).toLowerCase().replaceAll(" ", "-")}`}>
                  {item}
                </button>
              ))}
            </div>
          ) : null}
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`ask-message ask-${message.role}`}
              data-testid={`ask-message-${message.role}-${index}`}
            >
              {message.content || (streaming ? "Menyusun jawaban…" : "")}
            </div>
          ))}
          {error ? (
            <div className="error-box" data-testid="ask-error">
              {error}
            </div>
          ) : null}
          <div ref={endRef} />
        </div>

        <form
          className="ask-form"
          onSubmit={(event) => {
            event.preventDefault();
            ask();
          }}
        >
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Tanya apa pun soal ketergantungan organisasi…"
            data-testid="ask-input"
          />
          <button className="primary-button" disabled={streaming} data-testid="ask-submit-button">
            {streaming ? "Menjawab…" : "Tanya"}
            <ArrowRight size={15} />
          </button>
        </form>
      </aside>
    </div>
  );
}
