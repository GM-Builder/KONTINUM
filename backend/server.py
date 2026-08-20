import csv
import io
import os
import secrets
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

import engine
import seed_data

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Continuum API")
api = APIRouter(prefix="/api")

COLLECTIONS = ("people", "processes", "clients", "vendors", "systems", "knowledge_items")
MAGIC_LINK_TTL_MINUTES = 15
SESSION_TTL_DAYS = 7


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_token(token: str) -> str:
    return sha256(token.encode()).hexdigest()


async def seed_organization() -> None:
    org = seed_data.ORGANIZATION
    org_id = org["id"]
    people = seed_data.build_people()
    payload = {
        "people": people,
        "processes": seed_data.build_processes(),
        "clients": seed_data.build_clients(),
        "vendors": seed_data.build_vendors(),
        "systems": seed_data.build_systems(),
        "knowledge_items": seed_data.build_knowledge(people),
    }
    await db.organizations.replace_one(
        {"id": org_id},
        {**org, "counts": {
            "employees": len(payload["people"]),
            "processes": len(payload["processes"]),
            "clients": len(payload["clients"]),
            "vendors": len(payload["vendors"]),
            "systems": len(payload["systems"]),
        }, "updated_at": now_iso()},
        upsert=True,
    )
    for name in COLLECTIONS:
        rows = [{**row, "organization_id": org_id, "source": "seed"} for row in payload[name]]
        await db[name].delete_many({"organization_id": org_id, "source": {"$ne": "import"}})
        await db[name].insert_many(rows)
        await db[name].create_index("organization_id")
    await db.relationships.delete_many({})
    await db.process_dependencies.delete_many({"organization_id": org_id})
    await db.process_dependencies.insert_many([
        {"organization_id": org_id, "upstream_id": up, "downstream_id": down}
        for up, down in seed_data.PROCESS_DEPENDENCIES
    ])
    for action in seed_data.MITIGATION_ACTIONS:
        await db.mitigation_actions.update_one(
            {"id": action["id"], "organization_id": org_id},
            {
                "$set": {**action, "organization_id": org_id},
                "$setOnInsert": {"status": "Open", "created_at": now_iso()},
            },
            upsert=True,
        )
    await db.users.update_one(
        {"email": seed_data.DEMO_USER["email"]},
        {"$set": seed_data.DEMO_USER},
        upsert=True,
    )
    await db.teams.delete_many({"organization_id": org_id})
    await db.teams.insert_many([{**t, "organization_id": org_id} for t in seed_data.TEAMS])


@app.on_event("startup")
async def startup() -> None:
    await seed_organization()


@app.on_event("shutdown")
async def shutdown() -> None:
    client.close()


class LinkRequest(BaseModel):
    email: EmailStr


class VerifyRequest(BaseModel):
    token: str


class SimulationRequest(BaseModel):
    person_id: str = "sarah-mitchell"
    duration_days: int = Field(default=90, ge=1, le=3650)


class ActionUpdate(BaseModel):
    status: str = Field(pattern="^(Open|Completed)$")


async def current_session(
    request: Request, authorization: str | None = Header(default=None)
) -> dict:
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    token = token or request.cookies.get("continuum_session")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.sessions.find_one(
        {"token_hash": hash_token(token), "expires_at": {"$gt": now_iso()}}, {"_id": 0}
    )
    if not session:
        raise HTTPException(status_code=401, detail="Your session has expired. Sign in again.")
    return session


async def load_graph(org_id: str) -> dict:
    query = {"organization_id": org_id}
    projection = {"_id": 0}
    graph = {
        "people": await db.people.find(query, projection).to_list(500),
        "processes": await db.processes.find(query, projection).to_list(500),
        "clients": await db.clients.find(query, projection).to_list(500),
        "vendors": await db.vendors.find(query, projection).to_list(500),
        "systems": await db.systems.find(query, projection).to_list(500),
        "knowledge": await db.knowledge_items.find(query, projection).to_list(500),
        "process_dependencies": await db.process_dependencies.find(query, projection).to_list(200),
    }
    return graph


async def load_actions(org_id: str) -> list[dict]:
    return await db.mitigation_actions.find({"organization_id": org_id}, {"_id": 0}).to_list(100)


def completed_uplift(actions: list[dict]) -> int:
    return sum(a["org_uplift"] for a in actions if a["status"] == "Completed")


def scored_people(graph: dict) -> list[dict]:
    rows = []
    for person in graph["people"]:
        footprint = engine.person_footprint(person["id"], graph)
        scored = engine.score_person(footprint)
        rows.append({
            **person,
            "dependency_score": scored["score"],
            "tier": scored["tier"],
            "knowledge_coverage": footprint["knowledge_coverage"],
            "process_count": len(footprint["processes"]),
            "critical_process_count": len(footprint["unbacked_critical_processes"]),
            "client_count": len(footprint["clients"]),
            "vendor_count": len(footprint["vendors"]),
            "system_count": len(footprint["sole_systems"]),
            "trained_backups": footprint["trained_backups"],
            "knowledge_gap_count": len(footprint["knowledge_gaps"]),
            "revenue_at_risk": footprint["revenue_at_risk"],
        })
    return sorted(rows, key=lambda r: (-r["dependency_score"], r["name"]))


@api.post("/auth/request-link")
async def request_link(payload: LinkRequest):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user = {
            "id": f"user-{sha256(email.encode()).hexdigest()[:10]}",
            "email": email,
            "name": email.split("@")[0].replace(".", " ").title(),
            "role": "Member",
            "organization_id": seed_data.ORGANIZATION["id"],
        }
        await db.users.insert_one(dict(user))
    raw_token = secrets.token_urlsafe(24)
    window_start = (datetime.now(timezone.utc) - timedelta(minutes=MAGIC_LINK_TTL_MINUTES)).isoformat()
    recent = await db.magic_links.count_documents({"email": email, "created_at": {"$gt": window_start}})
    if recent >= 25:
        raise HTTPException(status_code=429, detail="Too many sign-in links requested. Try again in a few minutes.")
    await db.magic_links.insert_one({
        "email": email,
        "token_hash": hash_token(raw_token),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=MAGIC_LINK_TTL_MINUTES)).isoformat(),
        "used": False,
        "created_at": now_iso(),
    })
    return {
        "message": f"Sign-in link ready for {email}",
        "expires_in_minutes": MAGIC_LINK_TTL_MINUTES,
        "delivery": "demo",
        "demo_token": raw_token,
    }


@api.post("/auth/verify")
async def verify_link(payload: VerifyRequest):
    link = await db.magic_links.find_one_and_update(
        {"token_hash": hash_token(payload.token), "used": False, "expires_at": {"$gt": now_iso()}},
        {"$set": {"used": True, "used_at": now_iso()}},
    )
    if not link:
        raise HTTPException(status_code=400, detail="This sign-in link is invalid or has expired.")
    user = await db.users.find_one({"email": link["email"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=400, detail="No account is linked to this address.")
    session_token = secrets.token_urlsafe(32)
    await db.sessions.insert_one({
        "token_hash": hash_token(session_token),
        "user_id": user["id"],
        "email": user["email"],
        "organization_id": user["organization_id"],
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS)).isoformat(),
        "created_at": now_iso(),
    })
    org = await db.organizations.find_one({"id": user["organization_id"]}, {"_id": 0})
    return {"session_token": session_token, "user": user, "organization": org}


@api.get("/auth/me")
async def me(session: dict = Depends(current_session)):
    user = await db.users.find_one({"id": session["user_id"]}, {"_id": 0})
    org = await db.organizations.find_one({"id": session["organization_id"]}, {"_id": 0})
    return {"user": user, "organization": org}


@api.post("/auth/logout")
async def logout(session: dict = Depends(current_session)):
    await db.sessions.delete_many({"token_hash": session["token_hash"]})
    return {"ok": True}


@api.get("/overview")
async def overview(session: dict = Depends(current_session)):
    org_id = session["organization_id"]
    graph = await load_graph(org_id)
    actions = await load_actions(org_id)
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    score = engine.score_organization(graph, completed_uplift(actions))
    people = scored_people(graph)
    critical_people = [p for p in people if p["tier"] in ("Critical", "High")]
    critical_knowledge = sorted(
        [k for k in graph["knowledge"] if k["criticality"] in ("Critical", "High")],
        key=lambda k: k["coverage_score"],
    )[:6]
    return {
        "organization": org,
        "score": score,
        "metrics": {
            "critical_people": len(critical_people),
            "critical_knowledge_coverage": score["critical_knowledge_coverage"],
            "processes_without_backup": score["processes_without_backup"],
            "critical_dependencies": len([
                p for p in graph["processes"] if not p["backup_owner_id"]
            ]) + len([s for s in graph["systems"] if not s["secondary_admin_id"]]),
            "revenue_at_risk": sum(p["revenue_at_risk"] for p in critical_people),
            "open_actions": len([a for a in actions if a["status"] == "Open"]),
        },
        "top_dependencies": people[:5],
        "critical_knowledge": critical_knowledge,
        "trend": [
            {"label": "Baseline", "value": score["baseline_score"]},
            {"label": "Current", "value": score["current_score"]},
            {"label": "Target", "value": score["target_score"]},
        ],
    }


@api.get("/people")
async def list_people(
    search: str = "", tier: str = "", session: dict = Depends(current_session)
):
    graph = await load_graph(session["organization_id"])
    people = scored_people(graph)
    if search:
        needle = search.lower()
        people = [
            p for p in people
            if needle in p["name"].lower() or needle in p["role"].lower() or needle in p["team"].lower()
        ]
    if tier:
        people = [p for p in people if p["tier"].lower() == tier.lower()]
    return {"people": people, "total": len(people)}


@api.get("/people/{person_id}")
async def person_detail(person_id: str, session: dict = Depends(current_session)):
    org_id = session["organization_id"]
    graph = await load_graph(org_id)
    person = next((p for p in graph["people"] if p["id"] == person_id), None)
    if not person:
        raise HTTPException(status_code=404, detail="We could not find that person in this workspace.")
    footprint = engine.person_footprint(person_id, graph)
    scored = engine.score_person(footprint)
    findings = engine.build_findings(person, footprint)
    actions = [a for a in await load_actions(org_id) if a["person_id"] == person_id]
    people_by_id = {p["id"]: p["name"] for p in graph["people"]}
    return {
        "person": {
            **person,
            "dependency_score": scored["score"],
            "tier": scored["tier"],
            "knowledge_coverage": footprint["knowledge_coverage"],
            "trained_backups": footprint["trained_backups"],
            "revenue_at_risk": footprint["revenue_at_risk"],
        },
        "score_breakdown": scored["breakdown"],
        "owns": {
            "processes": [
                {**p, "backup_owner": people_by_id.get(p["backup_owner_id"])}
                for p in footprint["processes"]
            ],
            "clients": footprint["clients"],
            "vendors": footprint["vendors"],
            "systems": [
                {**s, "secondary_admin": people_by_id.get(s["secondary_admin_id"])}
                for s in footprint["systems"]
            ],
        },
        "knowledge": sorted(footprint["knowledge"], key=lambda k: k["coverage_score"]),
        "knowledge_gaps": footprint["knowledge_gaps"],
        "backs_up": footprint["backups_held"],
        "findings": findings,
        "actions": actions,
        "evidence": [
            {
                "label": f"{len(footprint['unbacked_critical_processes'])} critical processes without backup",
                "source": "process ownership records",
                "confidence": 0.96,
            },
            {
                "label": f"{len(footprint['clients'])} client relationships owned",
                "source": "client ownership records",
                "confidence": 0.99,
            },
            {
                "label": f"{footprint['knowledge_coverage']}% knowledge documented",
                "source": "knowledge coverage assessment",
                "confidence": 0.88,
            },
            {
                "label": f"{footprint['trained_backups']} fully trained backups",
                "source": "backup ownership records",
                "confidence": 0.94,
            },
        ],
    }


@api.get("/insights/{person_id}")
async def insights(person_id: str, session: dict = Depends(current_session)):
    graph = await load_graph(session["organization_id"])
    person = next((p for p in graph["people"] if p["id"] == person_id), None)
    if not person:
        raise HTTPException(status_code=404, detail="We could not find that person in this workspace.")
    footprint = engine.person_footprint(person_id, graph)
    gaps = sorted(footprint["knowledge_gaps"], key=lambda k: k["coverage_score"])
    lines = [
        f"{person['name']} is the single operating owner for "
        f"{len(footprint['unbacked_critical_processes'])} critical processes and "
        f"{len(footprint['clients'])} client relationships.",
        f"Documented knowledge sits at {footprint['knowledge_coverage']}%, so decisions in "
        f"{len(gaps)} areas currently rely on personal judgment.",
        "The exposure is a system design issue: work has concentrated where no backup ownership was defined.",
    ]
    return {
        "person_id": person_id,
        "summary": lines,
        "derivation": "Generated from the organizational graph — no inference beyond recorded evidence.",
        "confidence": 0.88,
        "evidence": [
            {"label": g["title"], "value": f"{g['coverage_score']}% coverage", "confidence": g["confidence"]}
            for g in gaps[:4]
        ],
    }


@api.get("/dependencies")
async def dependencies(
    focus: str = "sarah-mitchell",
    critical_only: bool = False,
    session: dict = Depends(current_session),
):
    org_id = session["organization_id"]
    graph = await load_graph(org_id)
    people = scored_people(graph)
    focus_person = next((p for p in people if p["id"] == focus), None)
    if not focus_person:
        raise HTTPException(status_code=404, detail="We could not find that person in this workspace.")
    footprint = engine.person_footprint(focus_person["id"], graph)
    nodes = [{
        "id": focus_person["id"],
        "label": focus_person["name"],
        "kind": "person",
        "score": focus_person["dependency_score"],
        "risk": focus_person["tier"],
        "meta": focus_person["role"],
    }]
    edges = []

    def add(entity, kind, risk, meta, relationship):
        nodes.append({
            "id": entity["id"],
            "label": entity.get("name") or entity.get("title"),
            "kind": kind,
            "risk": risk,
            "meta": meta,
        })
        edges.append({
            "source": focus_person["id"],
            "target": entity["id"],
            "relationship": relationship,
            "risk": risk,
        })

    for process in footprint["processes"]:
        add(process, "process", process["criticality"],
            f"{process['documentation_status']} documentation", "PERFORMS")
    for c in footprint["clients"]:
        add(c, "client", c["criticality"], f"${c['annual_revenue']:,} annual", "SERVES")
    for v in footprint["vendors"]:
        add(v, "vendor", v["criticality"], v["category"], "MANAGES")
    for s in footprint["systems"]:
        add(s, "system", s["criticality"],
            "Sole administrator" if not s["secondary_admin_id"] else "Secondary admin in place", "ADMINISTERS")
    for k in footprint["knowledge"]:
        add(k, "knowledge", k["criticality"], f"{k['coverage_score']}% documented", "KNOWS")
    for edge in graph["process_dependencies"]:
        upstream = next((p for p in graph["processes"] if p["id"] == edge["upstream_id"]), None)
        downstream = next((p for p in graph["processes"] if p["id"] == edge["downstream_id"]), None)
        if not upstream or not downstream:
            continue
        if upstream["owner_id"] != focus_person["id"]:
            continue
        if not any(n["id"] == downstream["id"] for n in nodes):
            nodes.append({
                "id": downstream["id"],
                "label": downstream["name"],
                "kind": "process",
                "risk": downstream["criticality"],
                "meta": "Downstream process",
            })
        edges.append({
            "source": upstream["id"],
            "target": downstream["id"],
            "relationship": "FEEDS",
            "risk": downstream["criticality"],
        })
    if critical_only:
        keep = {n["id"] for n in nodes if n["risk"] in ("Critical", "High") or n["kind"] == "person"}
        nodes = [n for n in nodes if n["id"] in keep]
        edges = [e for e in edges if e["source"] in keep and e["target"] in keep]
    return {
        "focus": focus_person["id"],
        "focus_person": focus_person,
        "people": [
            {"id": p["id"], "name": p["name"], "score": p["dependency_score"], "tier": p["tier"]}
            for p in people[:8]
        ],
        "nodes": nodes,
        "edges": edges,
    }


@api.post("/scenarios/simulate")
async def simulate(payload: SimulationRequest, session: dict = Depends(current_session)):
    org_id = session["organization_id"]
    graph = await load_graph(org_id)
    person = next((p for p in graph["people"] if p["id"] == payload.person_id), None)
    if not person:
        raise HTTPException(status_code=404, detail="We could not find that person in this workspace.")
    actions = await load_actions(org_id)
    result = engine.simulate_absence(person, graph, payload.duration_days, actions)
    record = {
        "id": secrets.token_hex(8),
        "organization_id": org_id,
        "person_id": person["id"],
        "person_name": person["name"],
        "duration_days": payload.duration_days,
        "baseline_score": result["baseline_score"],
        "simulated_score": result["simulated_score"],
        "mitigated_score": result["mitigated_score"],
        "created_at": now_iso(),
    }
    await db.scenario_runs.insert_one(dict(record))
    return {**result, "run_id": record["id"]}


@api.get("/scenarios")
async def scenario_history(session: dict = Depends(current_session)):
    runs = await db.scenario_runs.find(
        {"organization_id": session["organization_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(10)
    return {"runs": runs}


@api.get("/actions")
async def list_actions(person_id: str = "", session: dict = Depends(current_session)):
    org_id = session["organization_id"]
    actions = await load_actions(org_id)
    graph = await load_graph(org_id)
    score = engine.score_organization(graph, completed_uplift(actions))
    if person_id:
        actions = [a for a in actions if a["person_id"] == person_id]
    order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
    effort = {"Low": 0, "Medium": 1, "High": 2}
    actions.sort(key=lambda a: (
        a["status"] == "Completed",
        order.get(a["priority"], 9),
        effort.get(a["effort"], 9),
        -a["scenario_reduction"],
    ))
    return {
        "actions": actions,
        "summary": {
            "open": len([a for a in actions if a["status"] == "Open"]),
            "completed": len([a for a in actions if a["status"] == "Completed"]),
            "baseline_score": score["baseline_score"],
            "current_score": score["current_score"],
            "target_score": score["target_score"],
            "available_uplift": sum(a["org_uplift"] for a in actions if a["status"] == "Open"),
        },
    }


@api.patch("/actions/{action_id}")
async def update_action(
    action_id: str, payload: ActionUpdate, session: dict = Depends(current_session)
):
    org_id = session["organization_id"]
    updated = await db.mitigation_actions.find_one_and_update(
        {"id": action_id, "organization_id": org_id},
        {"$set": {
            "status": payload.status,
            "completed_at": now_iso() if payload.status == "Completed" else None,
        }},
    )
    if not updated:
        raise HTTPException(status_code=404, detail="That action is not in this workspace.")
    graph = await load_graph(org_id)
    actions = await load_actions(org_id)
    score = engine.score_organization(graph, completed_uplift(actions))
    return {"action_id": action_id, "status": payload.status, "score": score}


@api.get("/search")
async def search(q: str = "", session: dict = Depends(current_session)):
    org_id = session["organization_id"]
    if not q or len(q) < 2:
        return {"query": q, "results": []}
    graph = await load_graph(org_id)
    needle = q.lower()
    results = []
    for person in scored_people(graph):
        if needle in person["name"].lower() or needle in person["role"].lower():
            results.append({
                "id": person["id"],
                "label": person["name"],
                "kind": "person",
                "meta": f"{person['role']} · dependency {person['dependency_score']}",
            })
    for kind, rows, meta_key in (
        ("process", graph["processes"], "criticality"),
        ("client", graph["clients"], "tier"),
        ("vendor", graph["vendors"], "category"),
        ("system", graph["systems"], "criticality"),
    ):
        for row in rows:
            if needle in row["name"].lower():
                results.append({
                    "id": row["id"],
                    "label": row["name"],
                    "kind": kind,
                    "meta": str(row.get(meta_key, "")),
                })
    for item in graph["knowledge"]:
        if needle in item["title"].lower():
            results.append({
                "id": item["id"],
                "label": item["title"],
                "kind": "knowledge",
                "meta": f"{item['coverage_score']}% documented",
            })
    return {"query": q, "results": results[:20]}


@api.post("/import/people")
async def import_people(file: UploadFile = File(...), session: dict = Depends(current_session)):
    org_id = session["organization_id"]
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload a .csv file exported from your HR system.")
    raw = (await file.read()).decode("utf-8-sig", errors="ignore")
    reader = csv.DictReader(io.StringIO(raw))
    required = {"name", "role", "team"}
    if not reader.fieldnames or not required.issubset({f.strip().lower() for f in reader.fieldnames}):
        raise HTTPException(status_code=400, detail="CSV needs at least name, role and team columns.")
    imported, skipped = 0, 0
    for row in reader:
        clean = {k.strip().lower(): (v or "").strip() for k, v in row.items() if k}
        if not clean.get("name"):
            skipped += 1
            continue
        person_id = seed_data.slug(clean["name"])
        await db.people.update_one(
            {"id": person_id, "organization_id": org_id},
            {"$set": {
                "id": person_id,
                "organization_id": org_id,
                "name": clean["name"],
                "role": clean.get("role") or "Unassigned",
                "team": clean.get("team") or "Unassigned",
                "manager": clean.get("manager") or "Unassigned",
                "tenure": clean.get("tenure") or "—",
                "email": clean.get("email") or f"{person_id}@northstar.example",
                "location": clean.get("location") or "—",
                "initials": seed_data.initials(clean["name"]),
                "employment": "Full-time",
                "source": "import",
            }},
            upsert=True,
        )
        imported += 1
    return {"imported": imported, "skipped": skipped, "message": f"{imported} people imported"}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
