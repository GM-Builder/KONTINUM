import sys

sys.path.insert(0, "/app/backend")

import engine
import seed_data

people = seed_data.build_people()
graph = {
    "people": people,
    "processes": seed_data.build_processes(),
    "clients": seed_data.build_clients(),
    "vendors": seed_data.build_vendors(),
    "systems": seed_data.build_systems(),
    "knowledge": seed_data.build_knowledge(people),
    "process_dependencies": [
        {"upstream_id": u, "downstream_id": d} for u, d in seed_data.PROCESS_DEPENDENCIES
    ],
}

print("counts", len(graph["people"]), len(graph["processes"]), len(graph["clients"]),
      len(graph["vendors"]), len(graph["systems"]), len(graph["knowledge"]))

org = engine.score_organization(graph)
print("org", org["baseline_score"], org["dimensions"], org["critical_knowledge_coverage"],
      org["processes_without_backup"])

scored = []
for p in graph["people"]:
    fp = engine.person_footprint(p["id"], graph)
    s = engine.score_person(fp)
    scored.append((s["score"], s["tier"], p["name"], fp["knowledge_coverage"]))
scored.sort(reverse=True)
print("top", scored[:8])
print("critical_or_high", len([s for s in scored if s[1] in ("Critical", "High")]))

sarah = next(p for p in graph["people"] if p["id"] == "sarah-mitchell")
for days in (7, 30, 90, 3650):
    result = engine.simulate_absence(sarah, graph, days, seed_data.MITIGATION_ACTIONS)
    print(days, result["simulated_score"], result["mitigated_score"], result["counts"])
