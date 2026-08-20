"""Continuum backend integration tests.

Covers magic-link auth, seed integrity, deterministic scoring,
absence simulation, action center math, search/insights, and CSV import.
"""
import io
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback: read from frontend/.env
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
    def test_list_people(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/people", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == 47
        assert len(data["people"]) == 47
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

    def test_unknown_person_404(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/people/unknown-id", headers=auth_headers)
        assert r.status_code == 404


# ----- Simulation ------------------------------------------------------

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

    def test_other_person(self, api, auth_headers):
        r = api.post(
            f"{BASE_URL}/api/scenarios/simulate",
            headers=auth_headers,
            json={"person_id": "michael-wong", "duration_days": 90},
        )
        assert r.status_code == 200
        d = r.json()
        assert d["baseline_score"] == 64
        assert d["simulated_score"] != 39 or d["counts"]["processes"] != 7

    def test_unknown_person_simulate_404(self, api, auth_headers):
        r = api.post(
            f"{BASE_URL}/api/scenarios/simulate",
            headers=auth_headers,
            json={"person_id": "nope", "duration_days": 90},
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
        # Complete
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
        # Verify overview reflects it
        overview = api.get(f"{BASE_URL}/api/overview", headers=auth_headers).json()
        assert overview["score"]["current_score"] == 82
        # Reopen
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
        assert "knowledge" in kinds

    def test_insights_sarah(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/insights/sarah-mitchell", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["summary"], list) and len(d["summary"]) >= 2
        assert d["confidence"] > 0
        assert isinstance(d["evidence"], list)


# ----- CSV import -----------------------------------------------------

class TestImport:
    def test_import_valid_csv(self, api, auth_headers):
        csv_body = "name,role,team\nTEST_Alice Example,QA Lead,Quality\n"
        files = {"file": ("people.csv", io.BytesIO(csv_body.encode()), "text/csv")}
        headers = {"Authorization": auth_headers["Authorization"]}
        r = requests.post(f"{BASE_URL}/api/import/people", files=files, headers=headers)
        assert r.status_code == 200, r.text
        assert r.json()["imported"] == 1
        # Verify appears in list
        listing = api.get(f"{BASE_URL}/api/people?search=TEST_Alice", headers=auth_headers).json()
        assert any(p["id"] == "test-alice-example" for p in listing["people"])

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
