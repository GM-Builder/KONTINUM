"""Mesin skor ketahanan & simulasi ketidakhadiran (deterministik).

Semua angka yang ditampilkan produk berasal dari sini.
Target kalibrasi: Sarah Mitchell = 87, baseline organisasi = 64.
"""

PERSON_WEIGHTS = {
    "unbacked_critical_process": 6,
    "client_relationship": 5,
    "vendor_relationship": 5,
    "sole_system_access": 5,
    "knowledge_gap_factor": 0.25,
    "no_backup_penalty": 12,
    "backup_credit": 6,
}

ORG_WEIGHTS = {
    "knowledge_documentation": 0.30,
    "backup_coverage": 0.30,
    "process_documentation": 0.20,
    "access_resilience": 0.20,
}

DURATION_FACTORS = {7: 0.35, 30: 0.65, 90: 1.0, 3650: 1.3}
DURATION_LABELS = {7: "7 hari", 30: "30 hari", 90: "90 hari", 3650: "Permanen"}

TIERS = [(75, "Critical"), (50, "High"), (25, "Moderate"), (0, "Low")]


def tier_for(score: int) -> str:
    for threshold, label in TIERS:
        if score >= threshold:
            return label
    return "Low"


def duration_factor(days: int) -> float:
    if days in DURATION_FACTORS:
        return DURATION_FACTORS[days]
    return round(min(1.3, max(0.2, days / 90)), 2)


def duration_label(days: int) -> str:
    return DURATION_LABELS.get(days, f"{days} hari")


def person_footprint(person_id: str, graph: dict) -> dict:
    processes = [p for p in graph["processes"] if p["owner_id"] == person_id]
    unbacked = [p for p in processes if not p["backup_owner_id"]]
    unbacked_critical = [p for p in unbacked if p["criticality"] == "Critical"]
    clients = [c for c in graph["clients"] if c["owner_id"] == person_id]
    vendors = [v for v in graph["vendors"] if v["owner_id"] == person_id]
    systems = [s for s in graph["systems"] if s["owner_id"] == person_id]
    sole_systems = [s for s in systems if not s["secondary_admin_id"]]
    knowledge = [k for k in graph["knowledge"] if k["primary_person_id"] == person_id]
    backups_held = [p for p in graph["processes"] if p["backup_owner_id"] == person_id]
    trained_backups = [
        p for p in processes if p["criticality"] == "Critical" and p["backup_owner_id"]
    ]
    coverage_values = [k["coverage_score"] for k in knowledge]
    coverage = round(sum(coverage_values) / len(coverage_values)) if coverage_values else 100
    return {
        "processes": processes,
        "unbacked_processes": unbacked,
        "unbacked_critical_processes": unbacked_critical,
        "clients": clients,
        "vendors": vendors,
        "systems": systems,
        "sole_systems": sole_systems,
        "knowledge": knowledge,
        "knowledge_gaps": [k for k in knowledge if k["coverage_score"] < 70],
        "backups_held": backups_held,
        "trained_backups": len(trained_backups),
        "knowledge_coverage": coverage,
        "revenue_at_risk": sum(c["annual_revenue"] for c in clients),
    }


def score_person(footprint: dict) -> dict:
    w = PERSON_WEIGHTS
    owns_critical_scope = bool(footprint["unbacked_critical_processes"] or footprint["clients"])
    knowledge_points = round(w["knowledge_gap_factor"] * (100 - footprint["knowledge_coverage"]))
    breakdown = [
        {
            "label": "Proses kritis tanpa backup",
            "detail": f"{len(footprint['unbacked_critical_processes'])} proses",
            "points": w["unbacked_critical_process"] * len(footprint["unbacked_critical_processes"]),
        },
        {
            "label": "Relasi klien yang dipegang",
            "detail": f"{len(footprint['clients'])} klien",
            "points": w["client_relationship"] * len(footprint["clients"]),
        },
        {
            "label": "Relasi vendor yang dipegang",
            "detail": f"{len(footprint['vendors'])} vendor",
            "points": w["vendor_relationship"] * len(footprint["vendors"]),
        },
        {
            "label": "Akses sistem tunggal",
            "detail": f"{len(footprint['sole_systems'])} sistem",
            "points": w["sole_system_access"] * len(footprint["sole_systems"]),
        },
        {
            "label": "Pengetahuan belum terdokumentasi",
            "detail": f"{footprint['knowledge_coverage']}% terdokumentasi",
            "points": knowledge_points,
        },
        {
            "label": "Kesiapan backup",
            "detail": f"{footprint['trained_backups']} backup terlatih",
            "points": max(
                0,
                w["no_backup_penalty"] - w["backup_credit"] * footprint["trained_backups"],
            ) if owns_critical_scope else 0,
        },
    ]
    total = min(100, sum(row["points"] for row in breakdown))
    return {"score": total, "tier": tier_for(total), "breakdown": breakdown}


def score_organization(graph: dict, completed_uplift: int = 0) -> dict:
    processes = graph["processes"]
    systems = graph["systems"]
    knowledge = graph["knowledge"]
    backup_coverage = 100 * len([p for p in processes if p["backup_owner_id"]]) / len(processes)
    documentation = 100 * sum(
        1 if p["documentation_status"] == "Documented" else 0.5 if p["documentation_status"] == "Partial" else 0
        for p in processes
    ) / len(processes)
    access = 100 * len([s for s in systems if s["secondary_admin_id"]]) / len(systems)
    knowledge_documentation = sum(k["coverage_score"] for k in knowledge) / len(knowledge)
    raw = (
        ORG_WEIGHTS["knowledge_documentation"] * knowledge_documentation
        + ORG_WEIGHTS["backup_coverage"] * backup_coverage
        + ORG_WEIGHTS["process_documentation"] * documentation
        + ORG_WEIGHTS["access_resilience"] * access
    )
    baseline = round(raw)
    critical_knowledge = [k for k in knowledge if k["criticality"] in ("Critical", "High")]
    critical_coverage = round(
        sum(k["coverage_score"] for k in critical_knowledge) / len(critical_knowledge)
    )
    return {
        "baseline_score": baseline,
        "current_score": min(100, baseline + completed_uplift),
        "target_score": min(100, baseline + 18),
        "dimensions": [
            {
                "label": "Dokumentasi pengetahuan",
                "value": round(knowledge_documentation),
                "weight": ORG_WEIGHTS["knowledge_documentation"],
            },
            {
                "label": "Kepemilikan backup",
                "value": round(backup_coverage),
                "weight": ORG_WEIGHTS["backup_coverage"],
            },
            {
                "label": "Dokumentasi proses",
                "value": round(documentation),
                "weight": ORG_WEIGHTS["process_documentation"],
            },
            {
                "label": "Ketahanan akses",
                "value": round(access),
                "weight": ORG_WEIGHTS["access_resilience"],
            },
        ],
        "critical_knowledge_coverage": critical_coverage,
        "processes_without_backup": len([p for p in processes if not p["backup_owner_id"]]),
    }


def build_findings(person: dict, footprint: dict) -> list[dict]:
    findings = []
    name = person["name"]
    if footprint["unbacked_critical_processes"]:
        names = ", ".join(p["name"] for p in footprint["unbacked_critical_processes"][:3])
        findings.append({
            "id": "process-continuity",
            "title": "Proses kritis berhenti tanpa pemilik tervalidasi",
            "severity": "Critical",
            "explanation": (
                f"{len(footprint['unbacked_critical_processes'])} proses kritis ({names}) hanya "
                f"mencantumkan {name} sebagai pemilik, dan belum satu pun punya backup owner tervalidasi."
            ),
            "evidence": "catatan kepemilikan & backup proses",
            "confidence": 0.96,
            "references": len(footprint["unbacked_critical_processes"]),
        })
    if len(footprint["clients"]) >= 2:
        top = ", ".join(c["name"] for c in footprint["clients"][:3])
        findings.append({
            "id": "client-concentration",
            "title": "Relasi klien terkonsentrasi pada satu operator",
            "severity": "High",
            "explanation": (
                f"{len(footprint['clients'])} relasi klien ({top}) berjalan melalui {name}, "
                f"mencakup ${footprint['revenue_at_risk']:,} pendapatan tahunan tanpa konteks yang dibagikan."
            ),
            "evidence": "catatan kepemilikan klien",
            "confidence": 0.93,
            "references": len(footprint["clients"]),
        })
    if len(footprint["knowledge_gaps"]) >= 3:
        lowest = sorted(footprint["knowledge_gaps"], key=lambda k: k["coverage_score"])[0]
        findings.append({
            "id": "undocumented-knowledge",
            "title": "Pertimbangan operasional belum terdokumentasi",
            "severity": "Critical",
            "explanation": (
                f"{len(footprint['knowledge_gaps'])} area pengetahuan berada di bawah cakupan 70%, "
                f"terendah \"{lowest['title']}\" pada {lowest['coverage_score']}%. Pengetahuan ini "
                "hanya bisa berpindah lewat percakapan langsung."
            ),
            "evidence": "penilaian cakupan pengetahuan",
            "confidence": 0.88,
            "references": len(footprint["knowledge_gaps"]),
        })
    if footprint["sole_systems"]:
        names = ", ".join(s["name"] for s in footprint["sole_systems"][:3])
        findings.append({
            "id": "sole-system-access",
            "title": "Akses administratif tunggal menahan pemulihan",
            "severity": "High",
            "explanation": (
                f"{names} tidak punya administrator kedua, sehingga perubahan akses dan langkah "
                f"pemulihan menumpuk menunggu {name}."
            ),
            "evidence": "catatan akses sistem",
            "confidence": 0.94,
            "references": len(footprint["sole_systems"]),
        })
    if len(footprint["vendors"]) >= 3:
        findings.append({
            "id": "vendor-relationship",
            "title": "Relasi vendor tanpa titik kontak kedua",
            "severity": "High",
            "explanation": (
                f"{len(footprint['vendors'])} relasi vendor dikelola {name} sendiri, sehingga konteks "
                "komersial dan jalur eskalasi tidak dibagikan."
            ),
            "evidence": "catatan kepemilikan vendor",
            "confidence": 0.9,
            "references": len(footprint["vendors"]),
        })
    return findings


def downstream_processes(process_ids: set[str], dependencies: list[dict]) -> list[str]:
    found = []
    frontier = set(process_ids)
    seen = set(process_ids)
    while frontier:
        nxt = set()
        for edge in dependencies:
            if edge["upstream_id"] in frontier and edge["downstream_id"] not in seen:
                nxt.add(edge["downstream_id"])
                seen.add(edge["downstream_id"])
                found.append(edge["downstream_id"])
        frontier = nxt
    return found


def simulate_absence(people: list[dict], graph: dict, duration_days: int, actions: list[dict]) -> dict:
    """Simulasi satu atau beberapa orang tidak tersedia bersamaan."""
    org = score_organization(graph)
    baseline = org["baseline_score"]
    footprints = {person["id"]: person_footprint(person["id"], graph) for person in people}

    direct_ids, client_rows, knowledge_rows, sole_systems, findings = set(), {}, {}, {}, []
    for person in people:
        footprint = footprints[person["id"]]
        direct_ids.update(p["id"] for p in footprint["unbacked_processes"])
        for client in footprint["clients"]:
            client_rows[client["id"]] = {**client, "owner_name": person["name"]}
        for item in footprint["knowledge_gaps"]:
            knowledge_rows[item["id"]] = {**item, "owner_name": person["name"]}
        for system in footprint["sole_systems"]:
            sole_systems[system["id"]] = {**system, "owner_name": person["name"]}
        for finding in build_findings(person, footprint):
            findings.append({
                **finding,
                "id": f"{person['id']}-{finding['id']}" if len(people) > 1 else finding["id"],
                "person_name": person["name"],
            })

    downstream_ids = [
        pid for pid in downstream_processes(direct_ids, graph["process_dependencies"])
        if pid not in direct_ids
    ]
    by_id = {p["id"]: p for p in graph["processes"]}
    affected_processes = [
        {**by_id[pid], "impact": "Langsung", "reason": "Tidak ada backup owner tervalidasi"}
        for pid in sorted(direct_ids, key=lambda pid: by_id[pid]["name"])
    ] + [
        {**by_id[pid], "impact": "Turunan", "reason": "Bergantung pada proses hulu yang terhenti"}
        for pid in downstream_ids
    ]
    clients_at_risk = [
        {
            "id": c["id"],
            "name": c["name"],
            "annual_revenue": c["annual_revenue"],
            "tier": c["tier"],
            "reason": f"Pemilik relasi utama ({c['owner_name']}) tidak tersedia",
        }
        for c in client_rows.values()
    ]
    knowledge_gaps = list(knowledge_rows.values())
    factor = duration_factor(duration_days)
    raw_impact = (
        2 * len(affected_processes)
        + 2 * len(clients_at_risk)
        + 0.5 * len(knowledge_gaps)
        + 1 * len(sole_systems)
    )
    penalty = round(raw_impact * factor)
    simulated = max(0, baseline - penalty)
    person_ids = {person["id"] for person in people}
    plan = [a for a in actions if a["person_id"] in person_ids]
    recovery = sum(a["scenario_reduction"] for a in plan)
    ceiling = baseline + sum(a["org_uplift"] for a in plan)
    mitigated = min(100, ceiling, simulated + recovery)
    return {
        "person": {
            "id": people[0]["id"],
            "name": people[0]["name"],
            "role": people[0]["role"],
        },
        "people": [
            {"id": p["id"], "name": p["name"], "role": p["role"]} for p in people
        ],
        "duration_days": duration_days,
        "duration_label": duration_label(duration_days),
        "baseline_score": baseline,
        "simulated_score": simulated,
        "mitigated_score": mitigated,
        "score_drop": baseline - simulated,
        "confidence": 0.72,
        "impact_factor": factor,
        "affected_processes": affected_processes,
        "clients_at_risk": clients_at_risk,
        "knowledge_gaps": knowledge_gaps,
        "sole_systems": list(sole_systems.values()),
        "revenue_at_risk": sum(c["annual_revenue"] for c in clients_at_risk),
        "counts": {
            "processes": len(affected_processes),
            "clients": len(clients_at_risk),
            "knowledge_gaps": len(knowledge_gaps),
            "critical_findings": len([f for f in findings if f["severity"] in ("Critical", "High")]),
        },
        "findings": findings,
        "recovery_plan": plan,
        "assumptions": [
            "Tidak ada backup owner tervalidasi yang menggantikan selama periode ketidakhadiran",
            "Cakupan dokumentasi pengetahuan tetap seperti yang tercatat hari ini",
            "Dampak hanya mengikuti ketergantungan yang teramati di graf organisasi",
            "Angka ini estimasi dampak, bukan prediksi hasil",
        ],
    }
