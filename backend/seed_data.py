"""Deterministic Northstar Labs dataset for Continuum.

Counts are fixed by the product spec: 47 employees, 18 processes, 12 clients,
7 vendors, 11 systems. Every score in the product is derived from this data.
"""

ORGANIZATION = {
    "id": "northstar-labs",
    "name": "Northstar Labs",
    "industry": "B2B Technology",
    "headcount": 47,
    "workspace": "Operations workspace",
}

TEAMS = [
    {"id": "team-operations", "name": "Operations"},
    {"id": "team-finance", "name": "Finance"},
    {"id": "team-engineering", "name": "Engineering"},
    {"id": "team-client-success", "name": "Client Success"},
    {"id": "team-people", "name": "People & Talent"},
    {"id": "team-legal", "name": "Legal"},
]

KEY_PEOPLE = [
    {
        "id": "sarah-mitchell",
        "name": "Sarah Mitchell",
        "role": "Senior Client Operations Manager",
        "team": "Operations",
        "manager": "David Chen",
        "tenure": "6y 4m",
        "email": "sarah.mitchell@northstar.example",
        "location": "Jakarta",
    },
    {
        "id": "david-chen",
        "name": "David Chen",
        "role": "Operations Director",
        "team": "Operations",
        "manager": "Maya Patel",
        "tenure": "4y 8m",
        "email": "david.chen@northstar.example",
        "location": "Singapore",
    },
    {
        "id": "michael-wong",
        "name": "Michael Wong",
        "role": "Systems Lead",
        "team": "Engineering",
        "manager": "Maya Patel",
        "tenure": "3y 2m",
        "email": "michael.wong@northstar.example",
        "location": "Singapore",
    },
    {
        "id": "priya-raman",
        "name": "Priya Raman",
        "role": "Financial Controller",
        "team": "Finance",
        "manager": "Maya Patel",
        "tenure": "2y 11m",
        "email": "priya.raman@northstar.example",
        "location": "Bengaluru",
    },
    {
        "id": "elena-vasquez",
        "name": "Elena Vasquez",
        "role": "Head of Client Success",
        "team": "Client Success",
        "manager": "Maya Patel",
        "tenure": "3y 7m",
        "email": "elena.vasquez@northstar.example",
        "location": "Madrid",
    },
    {
        "id": "maya-patel",
        "name": "Maya Patel",
        "role": "Chief Operating Officer",
        "team": "Operations",
        "manager": "Board",
        "tenure": "5y 1m",
        "email": "maya.patel@northstar.example",
        "location": "Jakarta",
    },
]

GENERATED_NAMES = [
    "Aisha Rahman", "Ben Carter", "Chloe Novak", "Daniel Okafor", "Elif Demir",
    "Farid Hassan", "Grace Lim", "Hugo Martins", "Ines Duarte", "Jonas Weber",
    "Kiran Nair", "Lena Sorensen", "Marco Bianchi", "Nadia Petrova", "Omar Haddad",
    "Paula Reyes", "Quentin Blake", "Rina Tanaka", "Samir Chaudhry", "Tara Boyle",
    "Umar Siddiq", "Vera Kowalski", "Wesley Adjei", "Xenia Marou", "Yusuf Kaya",
    "Zara Ahmed", "Adam Novotny", "Bianca Rossi", "Caleb Mensah", "Divya Rao",
    "Eero Virtanen", "Fatima Zahra", "Gustav Lindqvist", "Hana Kim", "Ivan Petrov",
    "Julia Santos", "Kwame Boateng", "Liam Doyle", "Mona Farouk", "Nils Andersen",
    "Olivia Grant",
]

GENERATED_ROLES = [
    ("Operations Analyst", "Operations"),
    ("Finance Analyst", "Finance"),
    ("Backend Engineer", "Engineering"),
    ("Client Success Manager", "Client Success"),
    ("Recruiter", "People & Talent"),
    ("Contracts Specialist", "Legal"),
    ("Support Engineer", "Engineering"),
]

# name, owner, backup_owner, criticality, documentation_status
PROCESSES = [
    ("Client Onboarding", "sarah-mitchell", None, "Critical", "Partial"),
    ("Renewal Operations", "sarah-mitchell", None, "Critical", "Partial"),
    ("Pricing Exception Handling", "sarah-mitchell", None, "Critical", "Missing"),
    ("Escalation Management", "sarah-mitchell", None, "Critical", "Missing"),
    ("Monthly Client Reporting", "sarah-mitchell", None, "Critical", "Documented"),
    ("Access Provisioning", "michael-wong", None, "Critical", "Partial"),
    ("Month-End Close", "priya-raman", None, "Critical", "Missing"),
    ("Vendor Handover", "michael-wong", "david-chen", "High", "Documented"),
    ("Release Coordination", "michael-wong", "maya-patel", "High", "Documented"),
    ("Invoice Reconciliation", "priya-raman", "david-chen", "High", "Partial"),
    ("Payroll Operations", "priya-raman", "maya-patel", "High", "Documented"),
    ("Quarterly Business Review", "david-chen", "elena-vasquez", "High", "Documented"),
    ("Contract Review", "david-chen", "priya-raman", "Medium", "Documented"),
    ("Procurement", "david-chen", "michael-wong", "Medium", "Partial"),
    ("Internal Reporting", "david-chen", "priya-raman", "Medium", "Documented"),
    ("Client Health Reviews", "elena-vasquez", "david-chen", "High", "Partial"),
    ("Onboarding Handover", "elena-vasquez", "sarah-mitchell", "Medium", "Documented"),
    ("Renewal Forecasting", "elena-vasquez", "david-chen", "Medium", "Partial"),
]

# upstream process -> downstream process (impact propagation)
PROCESS_DEPENDENCIES = [
    ("process-client-onboarding", "process-onboarding-handover"),
    ("process-renewal-operations", "process-renewal-forecasting"),
]

# name, owner, annual revenue, tier
CLIENTS = [
    ("Acme Corp", "sarah-mitchell", 820000, "Strategic"),
    ("Helio Systems", "sarah-mitchell", 610000, "Strategic"),
    ("Northwind Health", "sarah-mitchell", 440000, "Strategic"),
    ("Lumen Retail", "elena-vasquez", 380000, "Growth"),
    ("Vertex Freight", "elena-vasquez", 295000, "Growth"),
    ("Solaris Energy", "elena-vasquez", 260000, "Growth"),
    ("Bluepeak Media", "elena-vasquez", 190000, "Core"),
    ("Cedar Analytics", "elena-vasquez", 165000, "Core"),
    ("Harbor Logistics", "david-chen", 210000, "Core"),
    ("Ridgeline Foods", "david-chen", 180000, "Core"),
    ("Kestrel Insurance", "priya-raman", 155000, "Core"),
    ("Astra Manufacturing", "priya-raman", 140000, "Core"),
]

# name, owner, category, criticality
VENDORS = [
    ("Vendor X Consulting", "sarah-mitchell", "Strategic services", "High"),
    ("Atlas Logistics", "sarah-mitchell", "Fulfillment", "High"),
    ("Corvus Cloud", "michael-wong", "Infrastructure", "High"),
    ("Halcyon Security", "michael-wong", "Security", "Medium"),
    ("Nimbus Data", "michael-wong", "Data platform", "Medium"),
    ("Ledgerly", "priya-raman", "Accounting", "Medium"),
    ("Beacon Support", "elena-vasquez", "Outsourced support", "Medium"),
]

# name, owner, secondary_admin, criticality
SYSTEMS = [
    ("Northstar CRM", "sarah-mitchell", None, "Critical"),
    ("Identity Console", "michael-wong", None, "Critical"),
    ("Deployment Pipeline", "michael-wong", None, "High"),
    ("Observability Stack", "michael-wong", None, "Medium"),
    ("Billing Ledger", "priya-raman", None, "Critical"),
    ("Client Health Portal", "elena-vasquez", None, "High"),
    ("Finance Hub", "priya-raman", "david-chen", "High"),
    ("Contract Vault", "david-chen", "priya-raman", "Medium"),
    ("Vendor Portal", "david-chen", "michael-wong", "Medium"),
    ("Internal Wiki", "michael-wong", "maya-patel", "Medium"),
    ("Support Desk", "michael-wong", "elena-vasquez", "Medium"),
]

# title, person, domain, coverage, criticality, status
KNOWLEDGE = [
    ("Acme Corp escalation history", "sarah-mitchell", "Client history", 38, "Critical", "Partial"),
    ("Vendor X negotiation history", "sarah-mitchell", "Negotiation", 61, "High", "Inferred"),
    ("Monthly reporting playbook", "sarah-mitchell", "Reporting", 91, "Medium", "Documented"),
    ("Pricing exception rules", "sarah-mitchell", "Exception handling", 21, "Critical", "Missing"),
    ("Renewal negotiation tactics", "sarah-mitchell", "Negotiation", 34, "Critical", "Missing"),
    ("Helio Systems relationship context", "sarah-mitchell", "Client history", 27, "Critical", "Missing"),
    ("Onboarding edge cases", "sarah-mitchell", "Process judgment", 45, "High", "Partial"),
    ("Northwind Health billing quirks", "sarah-mitchell", "Client history", 18, "Critical", "Missing"),
    ("CRM configuration knowledge", "sarah-mitchell", "Systems", 34, "High", "Partial"),
    ("Identity provisioning rules", "michael-wong", "Systems", 42, "Critical", "Partial"),
    ("Release rollback procedure", "michael-wong", "Systems", 55, "High", "Partial"),
    ("Cloud cost model", "michael-wong", "Vendor management", 47, "High", "Partial"),
    ("Month-end close judgment", "priya-raman", "Finance", 30, "Critical", "Missing"),
    ("Revenue recognition edge cases", "priya-raman", "Finance", 44, "Critical", "Partial"),
    ("Payroll exception handling", "priya-raman", "Finance", 46, "High", "Partial"),
    ("Client health scoring logic", "elena-vasquez", "Client history", 40, "High", "Partial"),
    ("Renewal forecast assumptions", "elena-vasquez", "Reporting", 55, "High", "Partial"),
    ("Escalation routing preferences", "elena-vasquez", "Process judgment", 55, "Medium", "Partial"),
    ("Quarterly review narrative", "david-chen", "Reporting", 68, "Medium", "Partial"),
    ("Contract negotiation guardrails", "david-chen", "Legal", 74, "Medium", "Documented"),
    ("Procurement approval matrix", "david-chen", "Vendor management", 71, "Medium", "Documented"),
]

ROUTINE_KNOWLEDGE_TITLES = [
    "Expense policy", "Laptop provisioning", "Onboarding checklist", "Support macros",
    "Meeting cadence", "Travel booking", "Offboarding checklist", "Brand guidelines",
    "Incident comms template", "Data retention policy", "Interview scorecards",
    "Vendor onboarding form", "Access request flow", "Release notes template",
    "Client kickoff deck", "Refund policy", "Invoice template", "QA checklist",
    "Security awareness guide", "Performance review guide", "Timesheet policy",
    "Purchase order steps", "Helpdesk triage guide", "Password rotation guide",
    "Backup verification steps", "Content style guide", "Localization workflow",
    "Analytics tagging guide", "Uptime reporting steps", "SLA definitions",
    "Client survey process", "Reference call script", "Escalation contact list",
    "Legal review intake", "NDA templates", "Payroll calendar", "Benefits overview",
    "Recruiting pipeline guide", "Interview logistics", "Workspace booking",
    "Equipment return steps", "Software licence registry", "Change log policy",
    "Runbook index", "Monitoring alert map", "On-call rotation guide",
    "Client reporting cadence", "Renewal paperwork steps", "Discount approval steps",
    "Data export procedure", "Sandbox reset guide", "Training library index",
    "Documentation standards", "Knowledge review cadence",
]

MITIGATION_ACTIONS = [
    {
        "id": "action-backup-owner-acme",
        "person_id": "sarah-mitchell",
        "title": "Assign David Chen as validated secondary owner for Acme Corp",
        "type": "Backup owner",
        "priority": "Critical",
        "effort": "Low",
        "scenario_reduction": 18,
        "org_uplift": 8,
        "owner": "David Chen",
        "due_in_days": 14,
        "linked_finding": "process-continuity",
        "rationale": "Acme Corp, Helio Systems and Northwind Health all sit behind one operator with no validated backup.",
    },
    {
        "id": "action-capture-exception-rules",
        "person_id": "sarah-mitchell",
        "title": "Capture pricing exception rules and escalation history",
        "type": "Knowledge capture",
        "priority": "High",
        "effort": "Low",
        "scenario_reduction": 14,
        "org_uplift": 6,
        "owner": "Sarah Mitchell",
        "due_in_days": 21,
        "linked_finding": "undocumented-knowledge",
        "rationale": "Pricing exceptions sit at 21% coverage and are used in every renewal negotiation.",
    },
    {
        "id": "action-shadow-vendor-negotiation",
        "person_id": "sarah-mitchell",
        "title": "Shadow Sarah through the next Vendor X negotiation cycle",
        "type": "Shadowing",
        "priority": "High",
        "effort": "Medium",
        "scenario_reduction": 11,
        "org_uplift": 4,
        "owner": "Elena Vasquez",
        "due_in_days": 30,
        "linked_finding": "client-concentration",
        "rationale": "Negotiation context is inferred rather than documented, so it transfers only through observation.",
    },
    {
        "id": "action-identity-runbook",
        "person_id": "michael-wong",
        "title": "Document identity provisioning rules and add a second admin",
        "type": "Knowledge capture",
        "priority": "High",
        "effort": "Medium",
        "scenario_reduction": 15,
        "org_uplift": 5,
        "owner": "Michael Wong",
        "due_in_days": 21,
        "linked_finding": "sole-system-access",
        "rationale": "Identity Console has a single administrator and partially documented rules.",
    },
    {
        "id": "action-close-checklist",
        "person_id": "priya-raman",
        "title": "Write the month-end close checklist with review sign-off",
        "type": "Knowledge capture",
        "priority": "High",
        "effort": "Medium",
        "scenario_reduction": 13,
        "org_uplift": 4,
        "owner": "Priya Raman",
        "due_in_days": 30,
        "linked_finding": "undocumented-knowledge",
        "rationale": "Month-end close judgment is undocumented and blocks reporting when unavailable.",
    },
]

DEMO_USER = {
    "id": "user-demo-operator",
    "email": "demo@northstar.example",
    "name": "Demo Operator",
    "role": "Owner",
    "organization_id": ORGANIZATION["id"],
}


def slug(value: str) -> str:
    return "".join(c if c.isalnum() else "-" for c in value.lower()).strip("-")


def initials(name: str) -> str:
    parts = [p for p in name.split() if p]
    return (parts[0][0] + parts[-1][0]).upper() if parts else "?"


def build_people() -> list[dict]:
    people = []
    for person in KEY_PEOPLE:
        people.append({**person, "initials": initials(person["name"]), "employment": "Full-time"})
    for index, name in enumerate(GENERATED_NAMES):
        role, team = GENERATED_ROLES[index % len(GENERATED_ROLES)]
        people.append({
            "id": slug(name),
            "name": name,
            "role": role,
            "team": team,
            "manager": "Maya Patel",
            "tenure": f"{1 + index % 4}y {index % 12}m",
            "email": f"{slug(name)}@northstar.example",
            "location": ["Jakarta", "Singapore", "Madrid", "Bengaluru"][index % 4],
            "initials": initials(name),
            "employment": "Full-time",
        })
    return people


def build_processes() -> list[dict]:
    rows = []
    for name, owner, backup, criticality, documentation in PROCESSES:
        rows.append({
            "id": f"process-{slug(name)}",
            "name": name,
            "owner_id": owner,
            "backup_owner_id": backup,
            "criticality": criticality,
            "documentation_status": documentation,
        })
    return rows


def build_clients() -> list[dict]:
    return [
        {
            "id": f"client-{slug(name)}",
            "name": name,
            "owner_id": owner,
            "annual_revenue": revenue,
            "tier": tier,
            "criticality": "Critical" if tier == "Strategic" else "Medium",
        }
        for name, owner, revenue, tier in CLIENTS
    ]


def build_vendors() -> list[dict]:
    return [
        {
            "id": f"vendor-{slug(name)}",
            "name": name,
            "owner_id": owner,
            "category": category,
            "criticality": criticality,
        }
        for name, owner, category, criticality in VENDORS
    ]


def build_systems() -> list[dict]:
    return [
        {
            "id": f"system-{slug(name)}",
            "name": name,
            "owner_id": owner,
            "secondary_admin_id": secondary,
            "criticality": criticality,
        }
        for name, owner, secondary, criticality in SYSTEMS
    ]


def build_knowledge(people: list[dict]) -> list[dict]:
    items = []
    for title, person_id, domain, coverage, criticality, status in KNOWLEDGE:
        items.append({
            "id": f"knowledge-{slug(title)}",
            "title": title,
            "primary_person_id": person_id,
            "domain": domain,
            "coverage_score": coverage,
            "criticality": criticality,
            "status": status,
            "confidence": round(0.72 + (coverage % 23) / 100, 2),
        })
    routine_holders = [p["id"] for p in people if p["id"] not in {row[1] for row in KNOWLEDGE}]
    for index, title in enumerate(ROUTINE_KNOWLEDGE_TITLES):
        coverage = 88 + (index * 7) % 11
        items.append({
            "id": f"knowledge-{slug(title)}",
            "title": title,
            "primary_person_id": routine_holders[index % len(routine_holders)],
            "domain": "Operating documentation",
            "coverage_score": coverage,
            "criticality": "Low",
            "status": "Documented",
            "confidence": 0.97,
        })
    return items
