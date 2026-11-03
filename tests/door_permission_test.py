"""Door permission tests against a stand-in ZKBio. Run: python tests/door_permission_test.py"""
import os, sys, tempfile
# Throw-away database: these tests must never touch the real gym_access.db
os.environ["GYM_DB_PATH"] = os.path.join(tempfile.mkdtemp(), "test.db")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import os, sys, json
os.environ.setdefault("ZKBIO_ENABLED", "true")
import httpx
import zkbio_client
levels = {}          # pin -> set(level ids)
calls = []

class R:
    def __init__(self, d): self._d = d
    def json(self): return self._d

def fake_post(url, params=None, json=None, timeout=None):
    path = url.split("/api/", 1)[1]
    p = params or {}
    calls.append(path)
    pin = p.get("pin"); ids = {x for x in (p.get("levelIds") or "").split(",") if x}
    if path == "accLevel/addLevelPerson": levels.setdefault(pin, set()).update(ids)
    elif path == "accLevel/deleteLevel": levels.setdefault(pin, set()).difference_update(ids)
    elif path == "accLevel/syncPerson": levels.setdefault(pin, set()).update(ids)   # real server re-adds
    elif path == "accLevel/syncLevel": pass
    return R({"code": 0, "message": "success", "data": None})

def fake_get(url, params=None, timeout=None):
    if url.endswith("/accLevel/list"):
        return R({"code": 0, "data": [{"id": "D", "name": "Day scholar boys"}, {"id": "H", "name": "Hostel boys"}]})
    if url.endswith("/door/list"):
        return R({"code": 0, "data": [{"id": "d1", "name": "Gym Entrance-IN"}]})
    if "transaction/list" in url:
        return R({"code": 0, "data": [{"pin": "T3", "eventName": "Normal Verify Open", "devName": "machine-1"}, {"pin": "OTHER"}]})
    pin = url.rsplit("/", 1)[1]
    return R({"code": 0, "data": {"pin": pin, "deptCode": "7", "accLevelIds": ",".join(sorted(levels.get(pin, ()))) or None}})

zkbio_client.ZKBIO_ENABLED = True
httpx.post = fake_post; httpx.get = fake_get
import main
from database import init_db, SessionLocal
from models import Student, PaymentStatus
init_db()
db = SessionLocal()
db.query(Student).delete(); db.commit()
LEVEL = "D"
db.add(Student(roll_no="T1", name="t", room_no="N/A", category="Day Scholar Boys",
               payment_status=PaymentStatus.PAID, access_enabled=True)); db.commit()
db.add(Student(roll_no="T2", name="unpaid", room_no="N/A", category="Day Scholar Boys",
               payment_status=PaymentStatus.UNPAID, access_enabled=False)); db.commit()
db.add(Student(roll_no="T3", name="hosteller", room_no="N/A", category="Hosteller Boys",
               payment_status=PaymentStatus.NOT_REQUIRED, access_enabled=True)); db.commit()
from fastapi.testclient import TestClient
c = TestClient(main.app)
fail = 0
def check(name, ok, extra=""):
    global fail
    print(("PASS " if ok else "FAIL ") + name + (" " + str(extra) if extra and not ok else ""))
    fail += 0 if ok else 1

has = lambda pin: bool(levels.get(pin))
levels["T1"] = {LEVEL}                                    # starts with the level (like today)
r = c.put("/api/students/T1/gate?debug=true", json={"open": False}).json()
check("gate OFF removes the level and it STAYS removed", not has("T1"), r)
check("gate OFF did not call syncPerson", "accLevel/syncPerson" not in calls[-6:], calls[-6:])
r = c.put("/api/students/T1/gate", json={"open": True}).json()
check("gate ON adds the level", has("T1"), r)
r = c.put("/api/students/T1/gate?debug=true", json={"open": False}).json()
check("gate OFF again removes it", not has("T1"))
r = c.put("/api/students/T1/gate?debug=true", json={"open": False}).json()
check("gate OFF twice is harmless", not has("T1") and r["device_ok"])
r = c.put("/api/students/T2/gate", json={"open": True})
check("unpaid student cannot be switched ON (409)", r.status_code == 409 and not has("T2"), r.text)
check("unknown student gives 404", c.put("/api/students/NOPE/gate", json={"open": True}).status_code == 404)
# payment with grant_device=false must not give the level
body = {"payment_status": "paid", "payment_valid_from": "2026-01-01", "payment_valid_until": "2027-01-01", "grant_device": False}
c.patch("/api/students/T1/payment", json=body)
check("payment with grant_device=false does NOT grant the level", not has("T1"))
body["grant_device"] = True
c.patch("/api/students/T1/payment", json=body)
check("payment with grant_device=true still grants (old behaviour)", has("T1"))
# expiry revoke must really remove it now
c.patch("/api/students/T1/payment", json={"payment_status": "expired"})
check("expired payment really removes the level", not has("T1"))
# face registration must not re-grant when grant_device=false
db.query(Student).filter(Student.roll_no == "T1").update({"access_enabled": True}); db.commit()
zkbio_client.upload_person_photo = lambda **k: None
c.post("/api/students/T1/register-face", json={"photo_base64": "AAAA", "grant_device": False})
check("register-face with grant_device=false does NOT re-grant", not has("T1"))
# a hosteller who holds the DAY SCHOLAR level (not their own hostel level) must still lose access on OFF
levels["T3"] = {"D"}
r = c.put("/api/students/T3/gate", json={"open": False}).json()
check("hosteller holding the day scholar level: OFF removes it", not has("T3"), (r, levels))
levels["T3"] = {"D", "H", "OTHER_LEVEL"}
c.put("/api/students/T3/gate", json={"open": False})
check("OFF removes every gym level but keeps a non-gym level", levels["T3"] == {"OTHER_LEVEL"}, levels["T3"])
c.put("/api/students/T3/gate", json={"open": True})
check("ON gives the category level (hostel)", "H" in levels["T3"], levels["T3"])
d = c.get("/api/zkbio/diagnose?roll_no=T3").json()
check("diagnose lists levels, doors, person and only that student's events",
      len(d["levels_in_zkbio"]) == 2 and len(d["doors"]) == 1 and d["person"]["pin"] == "T3" and len(d["recent_events"]) == 1, d)
print("FAILED" if fail else "ALL PASSED", fail)
sys.exit(1 if fail else 0)
