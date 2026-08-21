"""Lapisan narasi AI (Gemini 3 Flash via Emergent LLM Key) dengan fallback deterministik."""

import os

from emergentintegrations.llm.chat import LlmChat, StreamDone, TextDelta, UserMessage

PROVIDER, MODEL = "gemini", "gemini-3-flash-preview"

GUARDRAIL = (
    "Kamu adalah analis ketahanan organisasi untuk produk KONTINŪM. "
    "Jawab dalam Bahasa Indonesia yang tenang, ringkas, dan analitis. "
    "Aturan wajib: (1) hanya gunakan fakta pada bagian DATA, jangan mengarang angka atau nama; "
    "(2) sebut angka sebagai estimasi dampak, bukan prediksi; "
    "(3) soroti risiko sistem, jangan menilai kinerja atau karakter orang; "
    "(4) jangan gunakan tabel, emoji, atau markdown heading; tulis paragraf pendek atau butir '-'; "
    "(5) jika data tidak cukup, katakan apa yang perlu divalidasi."
)

BRIEFING_SYSTEM = GUARDRAIL + (
    " Tugasmu: tulis briefing eksekutif 3 paragraf pendek: (a) apa yang terjadi dan seberapa besar "
    "dampaknya, (b) rantai dampak paling tajam beserta buktinya, (c) langkah pemulihan prioritas "
    "dengan dampak skornya."
)

ASK_SYSTEM = GUARDRAIL + (
    " Tugasmu: jawab pertanyaan pengguna tentang ketergantungan organisasi dalam maksimal 6 butir "
    "atau 2 paragraf pendek, selalu merujuk entitas nyata dari DATA."
)


def api_key() -> str | None:
    return os.environ.get("EMERGENT_LLM_KEY")


def money(value: int) -> str:
    return f"${value:,}"


def scenario_facts(result: dict, org_score: dict) -> str:
    names = ", ".join(p["name"] for p in result["people"])
    lines = [
        f"Organisasi: Northstar Labs. Skor ketahanan baseline {result['baseline_score']}/100.",
        f"Skenario: {names} tidak tersedia selama {result['duration_label']}.",
        f"Skor selama ketidakhadiran {result['simulated_score']}/100 "
        f"(turun {result['score_drop']} poin), setelah mitigasi {result['mitigated_score']}/100.",
        f"Proses terdampak {result['counts']['processes']}, klien berisiko "
        f"{result['counts']['clients']}, celah pengetahuan {result['counts']['knowledge_gaps']}, "
        f"temuan kritis {result['counts']['critical_findings']}.",
        f"Pendapatan tahunan yang terekspos {money(result['revenue_at_risk'])}.",
        "Proses terdampak: "
        + "; ".join(f"{p['name']} ({p['impact']}, {p['criticality']})" for p in result["affected_processes"]),
        "Klien berisiko: "
        + "; ".join(f"{c['name']} {money(c['annual_revenue'])}" for c in result["clients_at_risk"]),
        "Celah pengetahuan: "
        + "; ".join(f"{k['title']} {k['coverage_score']}%" for k in result["knowledge_gaps"]),
        "Temuan: " + "; ".join(f"{f['title']} [{f['severity']}] — {f['explanation']}" for f in result["findings"]),
        "Rencana pemulihan: "
        + "; ".join(
            f"{a['title']} (+{a['scenario_reduction']} skenario, +{a['org_uplift']} skor organisasi, "
            f"effort {a['effort']}, PIC {a['owner']})"
            for a in result["recovery_plan"]
        ),
        "Dimensi skor organisasi: "
        + "; ".join(f"{d['label']} {d['value']}% (bobot {d['weight']})" for d in org_score["dimensions"]),
    ]
    return "\n".join(lines)


def org_facts(graph: dict, people: list[dict], org_score: dict) -> str:
    top = people[:6]
    lines = [
        f"Organisasi Northstar Labs: {len(graph['people'])} orang, {len(graph['processes'])} proses, "
        f"{len(graph['clients'])} klien, {len(graph['vendors'])} vendor, {len(graph['systems'])} sistem.",
        f"Skor ketahanan {org_score['current_score']}/100 (baseline {org_score['baseline_score']}, "
        f"target dengan rencana penuh {org_score['target_score']}).",
        "Dimensi: " + "; ".join(f"{d['label']} {d['value']}%" for d in org_score["dimensions"]),
        f"Proses tanpa backup: {org_score['processes_without_backup']}.",
        "Ketergantungan teratas: "
        + "; ".join(
            f"{p['name']} ({p['role']}) skor {p['dependency_score']} tier {p['tier']}, "
            f"{p['critical_process_count']} proses kritis tanpa backup, {p['client_count']} klien, "
            f"{p['vendor_count']} vendor, {p['system_count']} sistem tunggal, "
            f"{p['knowledge_coverage']}% pengetahuan terdokumentasi, "
            f"{p['knowledge_gap_count']} celah pengetahuan"
            for p in top
        ),
    ]
    return "\n".join(lines)


def person_facts(person: dict, footprint: dict) -> str:
    return "\n".join([
        f"{person['name']} — {person['role']} ({person['team']}).",
        "Proses yang dimiliki: " + (
            "; ".join(
                f"{p['name']} ({p['criticality']}, dokumentasi {p['documentation_status']}, "
                f"backup {p['backup_owner_id'] or 'tidak ada'})"
                for p in footprint["processes"]
            ) or "tidak ada"
        ),
        "Klien: " + ("; ".join(f"{c['name']} {money(c['annual_revenue'])}" for c in footprint["clients"]) or "tidak ada"),
        "Vendor: " + ("; ".join(v["name"] for v in footprint["vendors"]) or "tidak ada"),
        "Sistem dengan akses tunggal: " + ("; ".join(s["name"] for s in footprint["sole_systems"]) or "tidak ada"),
        "Pengetahuan: " + "; ".join(f"{k['title']} {k['coverage_score']}% ({k['status']})" for k in footprint["knowledge"]),
        f"Cakupan dokumentasi rata-rata {footprint['knowledge_coverage']}%, "
        f"backup terlatih {footprint['trained_backups']}.",
    ])


def fallback_briefing(result: dict) -> str:
    names = " dan ".join(p["name"] for p in result["people"])
    top_findings = result["findings"][:2]
    plan = result["recovery_plan"][:3]
    parts = [
        f"Jika {names} tidak tersedia selama {result['duration_label']}, skor ketahanan organisasi "
        f"turun dari {result['baseline_score']} ke {result['simulated_score']} dari 100. "
        f"{result['counts']['processes']} proses terdampak, {result['counts']['clients']} klien berisiko, "
        f"dan {result['counts']['knowledge_gaps']} area pengetahuan tidak punya jalur transfer. "
        f"Angka ini estimasi dampak berdasarkan ketergantungan yang tercatat, bukan prediksi.",
        " ".join(f"{f['title']}: {f['explanation']}" for f in top_findings),
        "Prioritas pemulihan: "
        + "; ".join(f"{a['title']} (+{a['org_uplift']} skor organisasi)" for a in plan)
        + f". Menyelesaikan rencana ini mengangkat skenario ke {result['mitigated_score']} dari 100.",
    ]
    return "\n\n".join(part for part in parts if part.strip())


def fallback_answer(question: str, facts: str) -> str:
    return (
        "Lapisan naratif AI sedang tidak tersedia, jadi ini ringkasan langsung dari graf organisasi "
        f"untuk pertanyaan \"{question}\":\n\n{facts}"
    )


async def stream_text(session_id: str, system: str, prompt: str, fallback: str):
    """Streaming token dari Gemini; jatuh ke teks deterministik bila gagal."""
    key = api_key()
    if not key:
        yield fallback
        return
    produced = False
    try:
        chat = LlmChat(api_key=key, session_id=session_id, system_message=system).with_model(
            PROVIDER, MODEL
        )
        async for event in chat.stream_message(UserMessage(text=prompt)):
            if isinstance(event, TextDelta):
                if event.content:
                    produced = True
                    yield event.content
            elif isinstance(event, StreamDone):
                break
    except Exception:  # noqa: BLE001 - demo harus selalu punya jawaban
        if not produced:
            yield fallback
        return
    if not produced:
        yield fallback


INTERVIEW_TEMPLATES = {
    "Client history": [
        "Keputusan atau kesepakatan apa dengan klien ini yang tidak tertulis di mana pun?",
        "Siapa kontak kunci di sisi klien, dan apa preferensi komunikasinya?",
        "Masalah apa yang pernah meledak di akun ini dan bagaimana diselesaikan?",
        "Sinyal awal apa yang menandakan akun ini mulai berisiko?",
    ],
    "Negotiation": [
        "Batas komersial apa yang boleh dan tidak boleh diberikan?",
        "Konsesi apa yang pernah dipakai dan bagaimana hasilnya?",
        "Siapa pengambil keputusan di sisi lawan dan apa motivasinya?",
        "Langkah apa yang diambil jika negosiasi menemui jalan buntu?",
    ],
    "Exception handling": [
        "Kapan sebuah pengecualian layak disetujui, dan kapan tidak?",
        "Siapa yang harus dimintai persetujuan untuk setiap tingkat pengecualian?",
        "Contoh pengecualian terakhir yang disetujui dan alasannya?",
        "Kesalahan apa yang paling sering terjadi saat orang lain menangani ini?",
    ],
    "Systems": [
        "Langkah konfigurasi apa yang tidak terdokumentasi tetapi wajib diketahui?",
        "Bagaimana cara memulihkan sistem ini jika terjadi kegagalan?",
        "Siapa yang berhak memberi akses, dan apa syaratnya?",
        "Jebakan atau perilaku aneh apa yang perlu diwaspadai?",
    ],
    "Finance": [
        "Pertimbangan apa yang dipakai saat angka tidak cocok?",
        "Kapan sebuah selisih boleh dibiarkan dan kapan harus dieskalasi?",
        "Urutan langkah apa yang wajib diikuti pada penutupan bulan?",
        "Siapa yang harus memberi persetujuan akhir?",
    ],
}

DEFAULT_INTERVIEW = [
    "Keputusan apa dalam area ini yang hanya kamu yang tahu caranya?",
    "Langkah apa yang biasanya terlewat kalau orang lain mengerjakannya?",
    "Sumber, berkas, atau kontak apa yang wajib dibuka saat mengerjakan ini?",
    "Situasi apa yang harus dieskalasi, dan ke siapa?",
]


def interview_questions(item: dict) -> list[str]:
    return INTERVIEW_TEMPLATES.get(item.get("domain"), DEFAULT_INTERVIEW)
