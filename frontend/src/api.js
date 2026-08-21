import axios from "axios";

export const SESSION_KEY = "kontinum_session";
export const API_BASE = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(SESSION_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(SESSION_KEY);
      const path = window.location.pathname;
      if (!path.startsWith("/login") && !path.startsWith("/bagikan")) {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  },
);

export function messageFor(error) {
  return (
    error?.response?.data?.detail ||
    "Ada kendala saat membaca graf ketergantungan. Coba lagi sebentar."
  );
}

export const money = (value) =>
  `$${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export const DURATIONS = [
  { days: 7, label: "7 hari" },
  { days: 30, label: "30 hari" },
  { days: 90, label: "90 hari" },
  { days: 3650, label: "Permanen" },
];

/** Membaca respons SSE dari backend dan memanggil onChunk per potongan teks. */
export async function streamPost(path, body, onChunk) {
  const token = localStorage.getItem(SESSION_KEY);
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok || !response.body) {
    throw new Error("Narasi AI tidak bisa dimuat saat ini.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      const payload = part.replace(/^data: ?/, "");
      if (payload === "[DONE]") return;
      if (payload) onChunk(payload.replaceAll("\\n", "\n"));
    }
  }
}
