"""API key tests. Run: GYM_API_KEY=test-key python tests/api_key_test.py"""
import os, sys, tempfile
# Throw-away database: these tests must never touch the real gym_access.db
os.environ["GYM_DB_PATH"] = os.path.join(tempfile.mkdtemp(), "test.db")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import os, sys
os.environ["ZKBIO_ENABLED"] = "false"
import main
from database import init_db, SessionLocal
from models import Student, PaymentStatus
from fastapi.testclient import TestClient
init_db()
db = SessionLocal(); db.query(Student).delete(); db.commit()
db.add(Student(roll_no="K1", name="k", room_no="N/A", category="Day Scholar Boys", payment_status=PaymentStatus.PAID, access_enabled=True)); db.commit()
c = TestClient(main.app)
KEY = os.environ["GYM_API_KEY"]
fail = 0
def check(name, ok, extra=""):
    global fail
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else " " + str(extra))); fail += 0 if ok else 1

endpoints = [("get","/api/students"),("get","/api/stats"),("get","/api/access/logs"),("get","/api/zkbio/diagnose"),
             ("put","/api/students/K1/gate"),("patch","/api/students/K1/payment"),("delete","/api/students/K1"),
             ("post","/api/students"),("post","/api/access/log"),("get","/openapi.json"),("get","/docs")]
for m, p in endpoints:
    r = getattr(c, m)(p, **({"json": {}} if m in ("put","patch","post") else {}))
    check(f"{m.upper()} {p} without key -> 401", r.status_code == 401, r.status_code)
for m, p in endpoints[:6]:
    r = getattr(c, m)(p, headers={"X-API-Key": "wrong-key"}, **({"json": {}} if m in ("put","patch","post") else {}))
    check(f"{m.upper()} {p} wrong key -> 401", r.status_code == 401, r.status_code)
check("GET /api/students with right key -> 200", c.get("/api/students", headers={"X-API-Key": KEY}).status_code == 200)
check("GET /api/stats with right key -> 200", c.get("/api/stats", headers={"X-API-Key": KEY}).status_code == 200)
check("PUT gate with right key reaches the endpoint", c.put("/api/students/K1/gate", json={"open": False}, headers={"X-API-Key": KEY}).status_code in (200, 502))
check("openapi with key -> 200", c.get("/openapi.json", headers={"X-API-Key": KEY}).status_code == 200)
check("dashboard page itself loads without key", c.get("/").status_code == 200)
r = c.get("/api/students", headers={"X-API-Key": KEY})
check("security headers present", r.headers.get("x-content-type-options") == "nosniff" and r.headers.get("x-frame-options") == "DENY" and r.headers.get("cache-control") == "no-store", dict(r.headers))
try:
    with c.websocket_connect("/api/access/live") as ws:
        check("websocket without key is refused", False)
except Exception:
    check("websocket without key is refused", True)
try:
    with c.websocket_connect("/api/access/live?key=" + KEY) as ws:
        check("websocket with key is accepted", True)
except Exception as e:
    check("websocket with key is accepted", False, e)
print("FAILED" if fail else "ALL PASSED", fail); sys.exit(1 if fail else 0)
