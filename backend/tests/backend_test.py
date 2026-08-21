"""KONTINŪM backend integration tests.

Covers magic-link auth, seed integrity, deterministic scoring, single & multi
scenario simulation, action center math, search/insights, CSV import, plus the
new AI streaming (briefing + ask), share-scenario export, and knowledge capture
endpoints. Test data (knowledge_overrides, mitigation status) is always
restored to the canonical demo state at the end.
"""
import io
import os
import time

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as fh:
        for line in fh:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

DEMO_EMAIL = "demo@northstar.example"


# ----- Fixtures ---------------------------------------------------------

@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def demo_token(api):
    r = api.post(f"{BASE_URL}/api/auth/request-link", json={"email": DEMO_EMAIL})
    assert r.status_code == 200, r.text
    tok = r.json().get("demo_token")
    assert tok
    return tok


@pytest.fixture(scope="session")
def session_token(api, demo_token):
    r = api.post(f"{BASE_URL}/api/auth/verify", json={"token": demo_token})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "session_token" in data
    return data["session_token"]


@pytest.fixture(scope="session")
def auth_headers(session_token):
    return {"Authorization": f"Bearer {session_token}", "Content-Type": "application/json"}


def _mongo_cleanup():
    """Drop knowledge_overrides + imported people so Sarah=87 & baseline=64 again."""
    import subprocess
    script = (
        "import asyncio\n"
        "from motor.motor_asyncio import AsyncIOMotorClient\n"
        "async def go():\n"
        "    c = AsyncIOMotorClient('mongodb://localhost:27017')\n"
        "    db = c['test_database']\n"
        "    await db.knowledge_overrides.delete_many({})\n"
        "    await db.people.delete_many({'source': 'import'})\n"
        "asyncio.run(go())\n"
    )
    return subprocess.run(["python", "-c", script], capture_output=True, text=True, timeout=30)


# ----- Auth -------------------------------------------------------------

class TestAuth:
    def test_request_link(self, api):
        r = api.post(f"{BASE_URL}/api/auth/request-link", json={"email": DEMO_EMAIL})
        assert r.status_code == 200
        assert r.json().get("demo_token")

    def test_magic_link_single_use(self, api):
        r = api.post(f"{BASE_URL}/api/auth/request-link", json={"email": DEMO_EMAIL})
        tok = r.json()["demo_token"]
        r1 = api.post(f"{BASE_URL}/api/auth/verify", json={"token": tok})
        assert r1.status_code == 200
        r2 = api.post(f"{BASE_URL}/api/auth/verify", json={"token": tok})
        assert r2.status_code == 400

    def test_no_auth_returns_401(self, api):
        r = api.get(f"{BASE_URL}/api/overview")
        assert r.status_code == 401

    def test_invalid_bearer_returns_401(self, api):
        r = api.get(f"{BASE_URL}/api/overview", headers={"Authorization": "Bearer garbage"})
        assert r.status_code == 401


# ----- Overview / seed integrity ---------------------------------------

class TestOverview:
    def test_counts_and_baseline(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/overview", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        counts = data["organization"]["counts"]
        assert counts["employees"] == 47
        assert counts["processes"] == 18
        assert counts["clients"] == 12
        assert counts["vendors"] == 7
        assert counts["systems"] == 11
        assert data["score"]["baseline_score"] == 64
        assert data["metrics"]["critical_people"] == 4
        assert data["metrics"]["processes_without_backup"] == 7


# ----- People / deterministic scoring ----------------------------------

class TestPeople:
    @pytest.fixture(autouse=True, scope="class")
    def _ensure_clean(self):
        _mongo_cleanup()
        yield

    def test_list_people(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/people", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == 47
        sarah = next(p for p in data["people"] if p["id"] == "sarah-mitchell")
        assert sarah["dependency_score"] == 87
        assert sarah["tier"] == "Critical"
        crit_high = [p for p in data["people"] if p["tier"] in ("Critical", "High")]
        assert len(crit_high) == 4

    def test_sarah_detail(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/people/sarah-mitchell", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert d["person"]["dependency_score"] == 87
        assert len(d["owns"]["processes"]) == 5
        assert len(d["owns"]["clients"]) == 3
        assert len(d["knowledge"]) == 9
        assert len(d["knowledge_gaps"]) == 8
        assert d["person"]["trained_backups"] == 0
        assert len(d["findings"]) == 4
        assert len(d["actions"]) == 3
        assert sum(row["points"] for row in d["score_breakdown"]) == 87
        # Findings text must be in Bahasa Indonesia
        joined = " ".join(f["explanation"] for f in d["findings"]).lower()
        assert any(word in joined for word in ("proses", "pengetahuan", "klien", "tidak"))

    def test_unknown_person_404(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/people/unknown-id", headers=auth_headers)
        assert r.status_code == 404


# ----- Simulation (single + multi + backward compat) -------------------

class TestSimulation:
    def test_sarah_90_day(self, api, auth_headers):
        r = api.post(
            f"{BASE_URL}/api/scenarios/simulate",
            headers=auth_headers,
            json={"person_id": "sarah-mitchell", "duration_days": 90},
        )
        assert r.status_code == 200
        d = r.json()
        assert d["baseline_score"] == 64
        assert d["simulated_score"] == 39
        assert d["mitigated_score"] == 82
        assert d["counts"]["processes"] == 7
        assert d["counts"]["clients"] == 3
        assert d["counts"]["knowledge_gaps"] == 8
        assert d["counts"]["critical_findings"] == 4
        assert "run_id" in d
        # Findings/assumptions must be Bahasa Indonesia
        text = " ".join(f["explanation"] for f in d["findings"]).lower()
        assert any(w in text for w in ("proses", "klien", "pengetahuan", "tanpa"))

    @pytest.mark.parametrize("days,expected", [(7, 55), (30, 48), (3650, 32)])
    def test_duration_progression(self, api, auth_headers, days, expected):
        r = api.post(
            f"{BASE_URL}/api/scenarios/simulate",
            headers=auth_headers,
            json={"person_id": "sarah-mitchell", "duration_days": days},
        )
        assert r.status_code == 200
        assert r.json()["simulated_score"] == expected

    def test_determinism(self, api, auth_headers):
        payload = {"person_id": "sarah-mitchell", "duration_days": 90}
        a = api.post(f"{BASE_URL}/api/scenarios/simulate", headers=auth_headers, json=payload).json()
        b = api.post(f"{BASE_URL}/api/scenarios/simulate", headers=auth_headers, json=payload).json()
        for k in ("baseline_score", "simulated_score", "mitigated_score"):
            assert a[k] == b[k]

    def test_unknown_person_simulate_404(self, api, auth_headers):
        r = api.post(
            f"{BASE_URL}/api/scenarios/simulate",
            headers=auth_headers,
            json={"person_id": "nope", "duration_days": 90},
        )
        assert r.status_code == 404

    def test_multi_person_scenario(self, api, auth_headers):
        r = api.post(
            f"{BASE_URL}/api/scenarios/simulate",
            headers=auth_headers,
            json={"person_ids": ["sarah-mitchell", "michael-wong"], "duration_days": 90},
        )
        assert r.status_code == 200
        d = r.json()
        assert d["simulated_score"] == 32
        assert d["mitigated_score"] == 87
        assert d["counts"]["processes"] == 8
        assert len(d["people"]) == 2
        # findings prefixed with the person id they came from
        ids = [f["id"] for f in d["findings"]]
        assert any(fid.startswith("sarah-mitchell") for fid in ids)
        assert any(fid.startswith("michael-wong") for fid in ids)

    def test_multi_person_over_limit_400(self, api, auth_headers):
        r = api.post(
            f"{BASE_URL}/api/scenarios/simulate",
            headers=auth_headers,
            json={"person_ids": ["sarah-mitchell", "michael-wong", "priya-shah", "james-carter"],
                  "duration_days": 90},
        )
        assert r.status_code == 400

    def test_multi_person_empty_400(self, api, auth_headers):
        r = api.post(
            f"{BASE_URL}/api/scenarios/simulate",
            headers=auth_headers,
            json={"person_ids": [], "person_id": "", "duration_days": 90},
        )
        assert r.status_code == 400

    def test_multi_person_unknown_id_404(self, api, auth_headers):
        r = api.post(
            f"{BASE_URL}/api/scenarios/simulate",
            headers=auth_headers,
            json={"person_ids": ["sarah-mitchell", "ghost-person"], "duration_days": 90},
        )
        assert r.status_code == 404


# ----- Share / Public export -------------------------------------------

class TestShare:
    def test_share_flow_and_idempotent(self, api, auth_headers):
        run = api.post(
            f"{BASE_URL}/api/scenarios/simulate",
            headers=auth_headers,
            json={"person_id": "sarah-mitchell", "duration_days": 90},
        ).json()
        run_id = run["run_id"]
        sim_score = run["simulated_score"]

        s1 = api.post(f"{BASE_URL}/api/scenarios/{run_id}/share", headers=auth_headers)
        assert s1.status_code == 200
        data1 = s1.json()
        assert data1["token"]
        assert data1["path"] == f"/bagikan/{data1['token']}"

        s2 = api.post(f"{BASE_URL}/api/scenarios/{run_id}/share", headers=auth_headers)
        assert s2.status_code == 200
        assert s2.json()["token"] == data1["token"]  # idempotent

        # Public GET without auth
        pub = requests.get(f"{BASE_URL}/api/public/scenarios/{data1['token']}")
        assert pub.status_code == 200
        payload = pub.json()
        assert payload["result"]["simulated_score"] == sim_score
        assert "organization_name" in payload

    def test_share_unknown_run_404(self, api, auth_headers):
        r = api.post(f"{BASE_URL}/api/scenarios/does-not-exist/share", headers=auth_headers)
        assert r.status_code == 404

    def test_public_bad_token_404(self):
        r = requests.get(f"{BASE_URL}/api/public/scenarios/garbage-token-xyz")
        assert r.status_code == 404


# ----- AI streaming (briefing + ask + history) -------------------------

def _read_sse(response, timeout=90):
    """Collect SSE 'data:' chunks until [DONE] or timeout."""
    start = time.time()
    chunks = []
    done = False
    for raw in response.iter_lines(decode_unicode=True):
        if time.time() - start > timeout:
            break
        if not raw:
            continue
        if raw.startswith("data: "):
            payload = raw[len("data: "):]
            if payload == "[DONE]":
                done = True
                break
            chunks.append(payload.replace("\\n", "\n"))
    return chunks, done


class TestAI:
    def test_briefing_stream(self, api, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/ai/briefing",
            headers=auth_headers,
            json={"person_id": "sarah-mitchell", "duration_days": 90},
            stream=True,
            timeout=90,
        )
        assert r.status_code == 200
        assert "text/event-stream" in r.headers.get("content-type", "")
        chunks, done = _read_sse(r)
        text = "".join(chunks)
        assert done, "SSE stream must terminate with [DONE]"
        assert len(text) > 300, f"briefing too short: {len(text)} chars"
        # Bahasa Indonesia + real numbers referenced (canonical or explanation)
        low = text.lower()
        assert any(w in low for w in ("proses", "klien", "ketahanan", "pengetahuan"))
        # No hallucinated names outside the seed (soft check: must at least mention Sarah/Northstar)
        assert "sarah" in low

    def test_ask_stream_and_history(self, api, auth_headers):
        session_id = f"test-session-{int(time.time())}"
        r = requests.post(
            f"{BASE_URL}/api/ai/ask",
            headers=auth_headers,
            json={"question": "Apa saja yang bergantung pada Sarah?", "session_id": session_id},
            stream=True,
            timeout=90,
        )
        assert r.status_code == 200
        chunks, done = _read_sse(r)
        text = "".join(chunks)
        assert done
        assert len(text) > 100
        low = text.lower()
        # must reference at least one real entity
        assert any(needle in low for needle in ("acme", "northstar", "pricing", "sarah"))

        h = api.get(
            f"{BASE_URL}/api/ai/history?session_id={session_id}",
            headers=auth_headers,
        )
        assert h.status_code == 200
        msgs = h.json()["messages"]
        roles = [m["role"] for m in msgs]
        assert "user" in roles and "assistant" in roles

    def test_ask_question_too_short_422(self, api, auth_headers):
        r = api.post(
            f"{BASE_URL}/api/ai/ask",
            headers=auth_headers,
            json={"question": "hi"},
        )
        assert r.status_code == 422


# ----- Knowledge capture ----------------------------------------------

@pytest.fixture(scope="class")
def knowledge_cleanup():
    yield
    _mongo_cleanup()


class TestKnowledge:
    KID = "knowledge-pricing-exception-rules"

    @pytest.fixture(autouse=True, scope="class")
    def _cleanup(self, knowledge_cleanup):
        # Ensure overrides start empty for this class so canonical numbers hold
        _mongo_cleanup()
        yield
        _mongo_cleanup()

    def test_interview_returns_4_indonesian_questions(self, api, auth_headers):
        r = api.get(
            f"{BASE_URL}/api/knowledge/{self.KID}/interview", headers=auth_headers
        )
        assert r.status_code == 200
        d = r.json()
        assert len(d["questions"]) == 4
        assert d["coverage_gain"] == 25
        # ID language check on first question
        assert any(word in d["questions"][0].lower() for word in ("apa", "siapa", "kapan", "bagaimana"))

    def test_capture_updates_scores(self, api, auth_headers):
        # Initial coverage = 21, Sarah = 87
        answers = [
            "Batas diskon 15% saja untuk klien Tier A.",
            "Semua pengecualian di atas 10% harus disetujui CFO.",
            "Contoh terakhir: Acme minta 20% dan ditolak.",
            "Sering lupa mencatat rationale di CRM.",
        ]
        r = api.post(
            f"{BASE_URL}/api/knowledge/{self.KID}/capture",
            headers=auth_headers,
            json={"answers": answers},
        )
        assert r.status_code == 200
        d = r.json()
        assert d["coverage_score"] == 46
        assert d["person"]["dependency_score"] < 87  # Sarah should drop
        assert "score" in d and "current_score" in d["score"]

    def test_capture_empty_answers_400(self, api, auth_headers):
        r = api.post(
            f"{BASE_URL}/api/knowledge/{self.KID}/capture",
            headers=auth_headers,
            json={"answers": ["", "  "]},
        )
        assert r.status_code == 400

    def test_capture_unknown_knowledge_404(self, api, auth_headers):
        r = api.post(
            f"{BASE_URL}/api/knowledge/does-not-exist/capture",
            headers=auth_headers,
            json={"answers": ["something"]},
        )
        assert r.status_code == 404


# ----- Action center ---------------------------------------------------

SARAH_ACTIONS = [
    "action-backup-owner-acme",
    "action-capture-exception-rules",
    "action-shadow-vendor-negotiation",
]


class TestActions:
    def test_list_actions(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/actions", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert len(d["actions"]) == 5
        assert d["summary"]["baseline_score"] == 64

    def test_complete_all_sarah_to_82_then_reopen(self, api, auth_headers):
        final_score = None
        for aid in SARAH_ACTIONS:
            r = api.patch(
                f"{BASE_URL}/api/actions/{aid}",
                headers=auth_headers,
                json={"status": "Completed"},
            )
            assert r.status_code == 200, r.text
            final_score = r.json()["score"]["current_score"]
        assert final_score == 82
        overview = api.get(f"{BASE_URL}/api/overview", headers=auth_headers).json()
        assert overview["score"]["current_score"] == 82
        for aid in SARAH_ACTIONS:
            r = api.patch(
                f"{BASE_URL}/api/actions/{aid}",
                headers=auth_headers,
                json={"status": "Open"},
            )
            assert r.status_code == 200
        overview = api.get(f"{BASE_URL}/api/overview", headers=auth_headers).json()
        assert overview["score"]["current_score"] == 64

    def test_unknown_action_404(self, api, auth_headers):
        r = api.patch(
            f"{BASE_URL}/api/actions/unknown-action-id",
            headers=auth_headers,
            json={"status": "Completed"},
        )
        assert r.status_code == 404


# ----- Search + insights ----------------------------------------------

class TestSearchInsights:
    def test_search_acme(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/search?q=acme", headers=auth_headers)
        assert r.status_code == 200
        results = r.json()["results"]
        kinds = {row["kind"] for row in results}
        assert "client" in kinds

    def test_insights_sarah(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/insights/sarah-mitchell", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["summary"], list) and len(d["summary"]) >= 2
        assert d["confidence"] > 0


# ----- CSV import -----------------------------------------------------

class TestImport:
    def test_import_valid_csv(self, api, auth_headers):
        csv_body = "name,role,team\nTEST_Alice Example,QA Lead,Quality\n"
        files = {"file": ("people.csv", io.BytesIO(csv_body.encode()), "text/csv")}
        headers = {"Authorization": auth_headers["Authorization"]}
        r = requests.post(f"{BASE_URL}/api/import/people", files=files, headers=headers)
        assert r.status_code == 200, r.text
        assert r.json()["imported"] == 1

    def test_import_bad_extension(self, api, auth_headers):
        files = {"file": ("people.txt", io.BytesIO(b"nope"), "text/plain")}
        headers = {"Authorization": auth_headers["Authorization"]}
        r = requests.post(f"{BASE_URL}/api/import/people", files=files, headers=headers)
        assert r.status_code == 400

    def test_import_missing_columns(self, api, auth_headers):
        files = {"file": ("bad.csv", io.BytesIO(b"foo,bar\n1,2\n"), "text/csv")}
        headers = {"Authorization": auth_headers["Authorization"]}
        r = requests.post(f"{BASE_URL}/api/import/people", files=files, headers=headers)
        assert r.status_code == 400


# ----- Cleanup (canonical demo state) ---------------------------------

class TestZCleanup:
    """Runs last thanks to naming order - restores canonical demo state."""

    def test_reset_knowledge_and_imports(self, api, auth_headers):
        result = _mongo_cleanup()
        assert result.returncode == 0, result.stderr

        # Verify Sarah is back to 87 and org back to 64
        detail = api.get(f"{BASE_URL}/api/people/sarah-mitchell", headers=auth_headers).json()
        assert detail["person"]["dependency_score"] == 87

        overview = api.get(f"{BASE_URL}/api/overview", headers=auth_headers).json()
        assert overview["score"]["current_score"] == 64
        assert overview["organization"]["counts"]["employees"] == 47
