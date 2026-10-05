"""
ZKBio CVSecurity API client.

Wraps all HTTP calls to the ZKBio face recognition device.
Passes access_token as a query parameter on every request.
All methods are no-ops when ZKBIO_ENABLED is false.
"""

import logging
import os
from datetime import datetime
from typing import Any, Optional

import httpx

logger = logging.getLogger("zkbio_client")

# ── Config from env ───────────────────────────────────────────────
ZKBIO_ENABLED = os.getenv("ZKBIO_ENABLED", "false").lower() == "true"
ZKBIO_BASE_URL = os.getenv("ZKBIO_BASE_URL", "http://192.168.1.100").rstrip("/")
ZKBIO_ACCESS_TOKEN = os.getenv("ZKBIO_ACCESS_TOKEN", "")
ZKBIO_LEVEL_IDS = os.getenv("ZKBIO_LEVEL_IDS", "1")
ZKBIO_DEPT_CODE = os.getenv("ZKBIO_DEPT_CODE", "1")
ZKBIO_POLL_INTERVAL = int(os.getenv("ZKBIO_POLL_INTERVAL", "5"))
ZKBIO_ENTRY_EXIT_MODE = os.getenv("ZKBIO_ENTRY_EXIT_MODE", "two_readers")
# Parse comma-separated strings into lists (e.g., "0,2" -> [0, 2])
ZKBIO_ENTRY_READERS = [int(r.strip()) for r in os.getenv("ZKBIO_ENTRY_READER", "0").split(",") if r.strip()]
ZKBIO_EXIT_READERS = [int(r.strip()) for r in os.getenv("ZKBIO_EXIT_READER", "1").split(",") if r.strip()]
ZKBIO_ENTRY_DOOR_IDS = [d.strip() for d in os.getenv("ZKBIO_ENTRY_DOOR_ID", "1").split(",") if d.strip()]
ZKBIO_EXIT_DOOR_IDS = [d.strip() for d in os.getenv("ZKBIO_EXIT_DOOR_ID", "2").split(",") if d.strip()]

TIMEOUT = 10.0  # seconds


def _url(path: str) -> str:
    """Build full URL for a ZKBio API path."""
    return f"{ZKBIO_BASE_URL}{path}"


def _params(**extra) -> dict[str, Any]:
    """Build query params dict with access_token always included."""
    base = {"access_token": ZKBIO_ACCESS_TOKEN}
    base.update(extra)
    return base


def _log_disabled():
    logger.debug("ZKBio integration disabled, skipping device call.")


# ══════════════════════════════════════════════════════════════════
#  Person Management
# ══════════════════════════════════════════════════════════════════

def add_person(pin: str, name: str, last_name: str = "", dept_code: str | None = None) -> dict[str, Any] | None:
    """Register a person on the ZKBio device."""
    if not ZKBIO_ENABLED:
        _log_disabled()
        return None
    payload = {
        "pin": pin,
        "name": name,
        "lastName": last_name,
        "deptCode": dept_code or ZKBIO_DEPT_CODE,
        "accLevelIds": ZKBIO_LEVEL_IDS,
    }
    try:
        resp = httpx.post(
            _url("/api/person/add"),
            params=_params(),
            json=payload,
            timeout=TIMEOUT,
        )
        data = resp.json()
        logger.info(f"add_person({pin}): {data}")
        return data
    except Exception as e:
        logger.error(f"add_person({pin}) failed: {e}")
        return None


def get_person(pin: str) -> dict[str, Any] | None:
    """Get person record from the ZKBio device (tries v1 path, then v1 query, then v2 list)."""
    if not ZKBIO_ENABLED:
        _log_disabled()
        return None
    # 1. GET /api/person/get/{pin}
    try:
        resp = httpx.get(
            _url(f"/api/person/get/{pin}"),
            params=_params(),
            timeout=TIMEOUT,
        )
        data = resp.json()
        if data.get("code") == 0 and data.get("data"):
            return data
    except Exception as e:
        logger.error(f"get_person({pin}) [path] failed: {e}")
    # 2. GET /api/person/get?pin={pin}
    try:
        resp = httpx.get(
            _url("/api/person/get"),
            params=_params(pin=pin),
            timeout=TIMEOUT,
        )
        data = resp.json()
        if data.get("code") == 0 and data.get("data"):
            return data
    except Exception as e:
        logger.error(f"get_person({pin}) [query] failed: {e}")
    # 3. POST /api/v2/person/getPersonList (pins filter)
    try:
        resp = httpx.post(
            _url("/api/v2/person/getPersonList"),
            params=_params(),
            json={"pins": pin, "pageNo": 1, "pageSize": 5},
            timeout=TIMEOUT,
        )
        data = resp.json()
        if data.get("code") == 0:
            payload = data.get("data", {})
            items = payload.get("data", []) if isinstance(payload, dict) else payload
            if isinstance(items, list) and items:
                return {"code": 0, "message": "success", "data": items[0]}
    except Exception as e:
        logger.error(f"get_person({pin}) [v2 list] failed: {e}")
    return None


def delete_person(pin: str) -> dict[str, Any] | None:
    """Delete a person from the ZKBio device."""
    if not ZKBIO_ENABLED:
        _log_disabled()
        return None
    try:
        resp = httpx.request(
            "DELETE",
            _url(f"/api/person/delete/{pin}"),
            params=_params(),
            timeout=TIMEOUT,
        )
        data = resp.json()
        logger.info(f"delete_person({pin}): {data}")
        return data
    except Exception as e:
        logger.error(f"delete_person({pin}) failed: {e}")
        return None


# ══════════════════════════════════════════════════════════════════
#  Face Enrollment (photo → device portal)
# ══════════════════════════════════════════════════════════════════

def detect_face(photo_base64: str) -> dict[str, Any] | None:
    """
    Ask ZKBio whether a face template can be extracted from the photo.
    POST /api/v2/person/detectFace  { personPhoto: <base64> }
    Returns raw device JSON (code==0 means extractable).
    """
    if not ZKBIO_ENABLED:
        _log_disabled()
        return None
    try:
        resp = httpx.post(
            _url("/api/v2/person/detectFace"),
            params=_params(),
            json={"personPhoto": photo_base64},
            timeout=TIMEOUT,
        )
        data = resp.json()
        logger.info(f"detect_face: {data}")
        return data
    except Exception as e:
        logger.error(f"detect_face failed: {e}")
        return None


def update_personnel_photo(pin: str, photo_base64: str) -> dict[str, Any] | None:
    """
    Upload/replace the comparison (vislight) photo for an existing person.
    POST /api/person/updatePersonnelPhoto  { pin, personPhoto }
    """
    if not ZKBIO_ENABLED:
        _log_disabled()
        return None
    try:
        resp = httpx.post(
            _url("/api/person/updatePersonnelPhoto"),
            params=_params(),
            json={"pin": pin, "personPhoto": photo_base64},
            timeout=TIMEOUT,
        )
        data = resp.json()
        logger.info(f"update_personnel_photo({pin}): {data}")
        return data
    except Exception as e:
        logger.error(f"update_personnel_photo({pin}) failed: {e}")
        return None


def register_face(
    pin: str,
    photo_base64: str,
    name: str = "",
    dept_code: str | None = None,
) -> dict[str, Any]:
    """
    Full face-registration flow against the ZKBio device portal.

    Steps (per ZKBio CVSecurity manual):
      1. detectFace — validate a face can be extracted (soft-fail: warn only,
         some firmware returns non-zero for valid photos).
      2. Ensure person exists — get_person, else add_person with personPhoto.
      3. updatePersonnelPhoto — push the new comparison photo.
      4. syncPerson — push person data down to the physical turnstile.
      5. get_person — verify vislightPhoto / vislightPhotoPath present.

    Returns dict with keys: ok, enrolled, message, steps.
    """
    steps: dict[str, Any] = {}

    # 1. Face detection (validation only — don't hard-fail)
    detected = detect_face(photo_base64)
    steps["detectFace"] = detected
    if detected is not None and detected.get("code") not in (0, None):
        logger.warning(f"register_face({pin}): detectFace returned {detected}")

    # 2. Ensure person exists
    person = get_person(pin)
    steps["personExistsBefore"] = bool(person and person.get("code") == 0)
    if not steps["personExistsBefore"]:
        created = add_person_with_photo(
            pin=pin, name=name or pin, dept_code=dept_code, photo_base64=photo_base64
        )
        steps["addPerson"] = created
        if created is None or (isinstance(created, dict) and created.get("code") not in (0, None)):
            return {
                "ok": False,
                "enrolled": False,
                "message": f"Failed to create person {pin} on device portal",
                "steps": steps,
            }
    else:
        # Person exists — push new photo
        updated = update_personnel_photo(pin, photo_base64)
        steps["updatePhoto"] = updated
        if updated is None or (isinstance(updated, dict) and updated.get("code") not in (0, None)):
            # Fallback: re-add person with photo (add is upsert on most firmware)
            readded = add_person_with_photo(
                pin=pin, name=name or pin, dept_code=dept_code, photo_base64=photo_base64
            )
            steps["reAddPerson"] = readded
            if readded is None or (isinstance(readded, dict) and readded.get("code") not in (0, None)):
                return {
                    "ok": False,
                    "enrolled": False,
                    "message": f"Device rejected face photo for {pin}",
                    "steps": steps,
                }

    # 3. Grant access level THEN sync down to the physical device.
    # NOTE: syncPerson alone does NOT grant door permission. Without
    # addLevelPerson the portal shows the person but the turnstile
    # reports "person not registered" / "no access".
    # (Payment-gated: callers that want unpaid users to have no access
    #  should revoke afterwards via PATCH /payment — but the default
    #  gym flow needs the level present so the gate recognises the face.)
    level_res = add_level_person(pin)
    steps["addLevelPerson"] = level_res
    synced = sync_person(pin)
    steps["syncPerson"] = synced

    # 4. Verify enrollment: portal photo + door level + bio template
    verify = get_person(pin)
    steps["verify"] = (verify.get("data") if isinstance(verify, dict) else None)
    enrolled = _has_face_template(verify)

    # Bio-template cross-check (bioType 9 == vislight face)
    bio = get_bio_templates(pin)
    steps["bioTemplates"] = bio
    has_bio_face = False
    try:
        if isinstance(bio, dict) and bio.get("code") == 0:
            payload = bio.get("data", [])
            items = payload if isinstance(payload, list) else payload.get("data", []) if isinstance(payload, dict) else []
            if isinstance(items, list):
                for t in items:
                    if isinstance(t, dict) and t.get("bioType") in (9, "9"):
                        has_bio_face = True
                        break
    except Exception:
        pass
    if has_bio_face:
        enrolled = True

    # Level cross-check — warn loudly if the configured level is missing
    portal_levels = ""
    try:
        if isinstance(verify, dict) and verify.get("code") == 0:
            d = verify.get("data", {})
            if isinstance(d, dict):
                portal_levels = str(d.get("accLevelIds", "") or "")
    except Exception:
        pass
    steps["portalAccLevelIds"] = portal_levels
    steps["configuredLevelIds"] = ZKBIO_LEVEL_IDS
    level_ok = bool(portal_levels) and ZKBIO_LEVEL_IDS in portal_levels
    if isinstance(level_res, dict) and level_res.get("code") not in (0, None):
        level_ok = False

    if enrolled and not level_ok:
        return {
            "ok": False,
            "enrolled": True,
            "message": (
                f"Face photo is on the portal for {pin}, but door access level "
                f"'{ZKBIO_LEVEL_IDS}' is NOT assigned (portal has '{portal_levels or 'none'}'). "
                f"The turnstile will say 'person not registered' until you set the real "
                f"ZKBIO_LEVEL_IDS (see GET /api/zkbio/levels) and re-register."
            ),
            "steps": steps,
        }

    return {
        "ok": enrolled,
        "enrolled": enrolled,
        "message": (
            f"Face registered for {pin} and synced to device gate."
            if enrolled
            else f"Photo pushed for {pin} but device does not yet report a face template — it may sync shortly."
        ),
        "steps": steps,
    }


def add_person_with_photo(
    pin: str,
    name: str,
    dept_code: str | None = None,
    photo_base64: str | None = None,
) -> dict[str, Any] | None:
    """Register a person on the device including the comparison photo (upsert)."""
    if not ZKBIO_ENABLED:
        _log_disabled()
        return None
    payload: dict[str, Any] = {
        "pin": pin,
        "name": name,
        "deptCode": dept_code or ZKBIO_DEPT_CODE,
        "accLevelIds": ZKBIO_LEVEL_IDS,
    }
    if photo_base64:
        payload["personPhoto"] = photo_base64
    try:
        resp = httpx.post(
            _url("/api/person/add"),
            params=_params(),
            json=payload,
            timeout=TIMEOUT,
        )
        data = resp.json()
        logger.info(f"add_person_with_photo({pin}): code={data.get('code')}")
        return data
    except Exception as e:
        logger.error(f"add_person_with_photo({pin}) failed: {e}")
        return None


def _has_face_template(person_data: dict[str, Any] | None) -> bool:
    """True if ZKBio person payload reports a vislight face photo/template."""
    if not person_data or person_data.get("code") != 0:
        return False
    details = person_data.get("data", {})
    if not isinstance(details, dict):
        return False
    if bool(details.get("vislightPhoto") or details.get("vislightPhotoPath")):
        return True
    templates = details.get("biometricTemplates", [])
    if isinstance(templates, list) and any(t.get("bioType") == 9 for t in templates):
        return True
    return False


# ══════════════════════════════════════════════════════════════════
#  Access Level Management
# ══════════════════════════════════════════════════════════════════

def list_access_levels(page_no: int = 1, page_size: int = 50) -> dict[str, Any] | None:
    """List access levels configured on the portal.

    Use this to discover the REAL level UUID (e.g. 8a888e23...)
    — the placeholder ZKBIO_LEVEL_IDS=1 almost never exists on a
    real system and is the #1 cause of 'person not registered' on
    the terminal. GET /api/v2/accLevel/list
    """
    if not ZKBIO_ENABLED:
        _log_disabled()
        return None
    try:
        resp = httpx.get(
            _url("/api/v2/accLevel/list"),
            params=_params(pageNo=page_no, pageSize=page_size),
            timeout=TIMEOUT,
        )
        data = resp.json()
        logger.info(f"list_access_levels: {str(data)[:500]}")
        return data
    except Exception as e:
        logger.error(f"list_access_levels failed: {e}")
        return None


def get_bio_templates(pin: str) -> dict[str, Any] | None:
    """Retrieve face/fingerprint templates for a PIN.

    Tries v2 first, then v1. A vislight face template shows up with
    bioType 9. If this is empty, the terminal has nothing to match
    against and will report 'person not registered'.
    POST /api/v2/bioTemplate/getFgListByPin / POST /api/bioTemplate/getFgListByPin/{pin}
    """
    if not ZKBIO_ENABLED:
        _log_disabled()
        return None
    # v2 (query-param style)
    try:
        resp = httpx.post(
            _url("/api/v2/bioTemplate/getFgListByPin"),
            params=_params(pin=pin),
            timeout=TIMEOUT,
        )
        data = resp.json()
        if data.get("code") == 0:
            logger.info(f"get_bio_templates({pin}) [v2]: found")
            return data
    except Exception as e:
        logger.error(f"get_bio_templates({pin}) [v2] failed: {e}")
    # v1 (path style)
    try:
        resp = httpx.post(
            _url(f"/api/bioTemplate/getFgListByPin/{pin}"),
            params=_params(),
            timeout=TIMEOUT,
        )
        data = resp.json()
        logger.info(f"get_bio_templates({pin}) [v1]: {str(data)[:300]}")
        return data
    except Exception as e:
        logger.error(f"get_bio_templates({pin}) [v1] failed: {e}")
    return None

def add_level_person(pin: str, level_ids: str | None = None) -> dict[str, Any] | None:
    """Grant access level to a person on the device."""
    if not ZKBIO_ENABLED:
        _log_disabled()
        return None
    ids = level_ids or ZKBIO_LEVEL_IDS
    try:
        resp = httpx.post(
            _url("/api/accLevel/addLevelPerson"),
            params=_params(pin=pin, levelIds=ids),
            timeout=TIMEOUT,
        )
        data = resp.json()
        logger.info(f"add_level_person({pin}, {ids}): {data}")
        return data
    except Exception as e:
        logger.error(f"add_level_person({pin}) failed: {e}")
        return None


def delete_level(pin: str, level_ids: str | None = None) -> dict[str, Any] | None:
    """Revoke access level from a person on the device."""
    if not ZKBIO_ENABLED:
        _log_disabled()
        return None
    ids = level_ids or ZKBIO_LEVEL_IDS
    try:
        resp = httpx.post(
            _url("/api/accLevel/deleteLevel"),
            params=_params(pin=pin, levelIds=ids),
            timeout=TIMEOUT,
        )
        data = resp.json()
        logger.info(f"delete_level({pin}, {ids}): {data}")
        return data
    except Exception as e:
        logger.error(f"delete_level({pin}) failed: {e}")
        return None


def sync_person(pin: str, level_ids: str | None = None) -> dict[str, Any] | None:
    """Sync person data to the physical device."""
    if not ZKBIO_ENABLED:
        _log_disabled()
        return None
    ids = level_ids or ZKBIO_LEVEL_IDS
    try:
        resp = httpx.post(
            _url("/api/accLevel/syncPerson"),
            params=_params(pin=pin, levelIds=ids),
            timeout=TIMEOUT,
        )
        data = resp.json()
        logger.info(f"sync_person({pin}, {ids}): {data}")
        return data
    except Exception as e:
        logger.error(f"sync_person({pin}) failed: {e}")
        return None


# ══════════════════════════════════════════════════════════════════
#  Transactions (Entry/Exit events from device)
# ══════════════════════════════════════════════════════════════════

def get_transactions(
    start_date: str,
    end_date: str,
    page_no: int = 1,
    page_size: int = 50,
) -> list[dict[str, Any]]:
    """
    Fetch transactions from the ZKBio device.

    Args:
        start_date: "YYYY-MM-DD HH:MM:SS"
        end_date:   "YYYY-MM-DD HH:MM:SS"
        page_no:    Page number (1-based, mandatory)
        page_size:  Items per page (mandatory)

    Returns:
        List of transaction dicts. Each has at minimum:
        - pin: person identifier
        - event_time: timestamp string
        - reader / door info for entry/exit detection
    """
    if not ZKBIO_ENABLED:
        _log_disabled()
        return []
    try:
        resp = httpx.get(
            _url("/api/v2/transaction/list"),
            params=_params(
                startDate=start_date,
                endDate=end_date,
                pageNo=page_no,
                pageSize=page_size,
            ),
            timeout=TIMEOUT,
        )
        data = resp.json()
        if data.get("code") == 0:
            payload = data.get("data", [])
            # Handle paginated wrapper objects
            if isinstance(payload, dict):
                # The actual list is usually inside 'data' or 'list'
                payload = payload.get("data", payload.get("list", []))
            
            if isinstance(payload, list):
                return payload
            
        logger.warning(f"get_transactions unexpected response: {data}")
        return []
    except Exception as e:
        logger.error(f"get_transactions failed: {e}")
        return []


# ══════════════════════════════════════════════════════════════════
#  Door Management
# ══════════════════════════════════════════════════════════════════

def get_doors(page_no: int = 1, page_size: int = 50) -> list[dict[str, Any]]:
    """List configured doors on the device."""
    if not ZKBIO_ENABLED:
        _log_disabled()
        return []
    try:
        resp = httpx.get(
            _url("/api/v2/door/list"),
            params=_params(pageNo=page_no, pageSize=page_size),
            timeout=TIMEOUT,
        )
        data = resp.json()
        if data.get("code") == 0:
            return data.get("data", [])
        return []
    except Exception as e:
        logger.error(f"get_doors failed: {e}")
        return []


def get_door_state(door_id: str) -> dict[str, Any] | None:
    """Get current state of a specific door."""
    if not ZKBIO_ENABLED:
        _log_disabled()
        return None
    try:
        resp = httpx.get(
            _url("/api/door/doorStateById"),
            params=_params(doorId=door_id),
            timeout=TIMEOUT,
        )
        return resp.json()
    except Exception as e:
        logger.error(f"get_door_state({door_id}) failed: {e}")
        return None


def remote_open_door(door_id: str, interval: int = 5) -> dict[str, Any] | None:
    """Remotely open a door for a given interval (seconds)."""
    if not ZKBIO_ENABLED:
        _log_disabled()
        return None
    try:
        resp = httpx.post(
            _url("/api/door/remoteOpenById"),
            params=_params(doorId=door_id, interval=interval),
            timeout=TIMEOUT,
        )
        return resp.json()
    except Exception as e:
        logger.error(f"remote_open_door({door_id}) failed: {e}")
        return None


def remote_close_door(door_id: str) -> dict[str, Any] | None:
    """Remotely close a door."""
    if not ZKBIO_ENABLED:
        _log_disabled()
        return None
    try:
        resp = httpx.post(
            _url("/api/door/remoteoffById"),
            params=_params(doorId=door_id),
            timeout=TIMEOUT,
        )
        return resp.json()
    except Exception as e:
        logger.error(f"remote_close_door({door_id}) failed: {e}")
        return None


def determine_event_type(transaction: dict) -> str:
    """
    Determine if a transaction is an 'entry' or 'exit' based on config mode.

    Supports three modes configured via ZKBIO_ENTRY_EXIT_MODE:
    - two_readers: reader index determines direction
    - two_doors: door ID determines direction
    - toggle: not used in real-time, fallback to 'entry'
    """
    if ZKBIO_ENTRY_EXIT_MODE == "two_readers":
        reader = transaction.get("reader", transaction.get("readerNo", 0))
        try:
            reader_int = int(reader)
        except (TypeError, ValueError):
            reader_int = 0
        return "entry" if reader_int in ZKBIO_ENTRY_READERS else "exit"

    elif ZKBIO_ENTRY_EXIT_MODE == "two_doors":
        door_id = str(transaction.get("doorId", transaction.get("door_id", "")))
        return "entry" if door_id in ZKBIO_ENTRY_DOOR_IDS else "exit"

    else:
        # toggle or unknown — default to entry
        return "entry"
