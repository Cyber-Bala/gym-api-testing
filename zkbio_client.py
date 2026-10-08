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
# NOTE on ZKBIO_BASE_URL: per the CVSecurity manual (§1.2) every endpoint is
# http://serverIP:serverPort/api/... with serverPort e.g. 8088 — the port is
# REQUIRED. Bare "http://192.168.1.100" (port 80) will never answer.
ZKBIO_ENABLED = os.getenv("ZKBIO_ENABLED", "false").lower() == "true"
ZKBIO_BASE_URL = os.getenv("ZKBIO_BASE_URL", "http://192.168.1.100:8088").rstrip("/")
ZKBIO_ACCESS_TOKEN = os.getenv("ZKBIO_ACCESS_TOKEN", "")
ZKBIO_LEVEL_IDS = os.getenv("ZKBIO_LEVEL_IDS", "1")
ZKBIO_DEPT_CODE = os.getenv("ZKBIO_DEPT_CODE", "1")
# 4-way student department routing on the ZKBio admin panel.
# Discover the REAL codes via GET /api/zkbio/departments and paste them here.
# Defaults preserve the legacy behaviour (day scholars share dept 1).
ZKBIO_DEPT_DAY_SCHOLAR_BOYS = os.getenv("ZKBIO_DEPT_DAY_SCHOLAR_BOYS", "1")
ZKBIO_DEPT_DAY_SCHOLAR_GIRLS = os.getenv("ZKBIO_DEPT_DAY_SCHOLAR_GIRLS", "1")
ZKBIO_DEPT_HOSTELLER_BOYS = os.getenv("ZKBIO_DEPT_HOSTELLER_BOYS", "3")
ZKBIO_DEPT_HOSTELLER_GIRLS = os.getenv("ZKBIO_DEPT_HOSTELLER_GIRLS", "2")
ZKBIO_ZONE_CODE = os.getenv("ZKBIO_ZONE_CODE", "")
ZKBIO_POLL_INTERVAL = int(os.getenv("ZKBIO_POLL_INTERVAL", "5"))
ZKBIO_SYNC_INTERVAL = int(os.getenv("ZKBIO_SYNC_INTERVAL", "30"))
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


def list_persons(page_no: int = 1, page_size: int = 100) -> dict[str, Any] | None:
    """List persons on the ZKBio portal (paginated raw response).

    POST /api/v2/person/getPersonList  { pageNo, pageSize }
    Returns the raw device JSON (code==0). Callers unwrap
    data.data / data.list depending on firmware.
    Returns None when disabled or unreachable.
    """
    if not ZKBIO_ENABLED:
        _log_disabled()
        return None
    try:
        resp = httpx.post(
            _url("/api/v2/person/getPersonList"),
            params=_params(),
            json={"pageNo": page_no, "pageSize": page_size},
            timeout=TIMEOUT,
        )
        data = resp.json()
        if data.get("code") != 0:
            logger.warning(f"list_persons(p={page_no}) unexpected: {str(data)[:300]}")
        return data
    except Exception as e:
        logger.error(f"list_persons(p={page_no}) failed: {e}")
        return None


def iter_all_portal_persons(page_size: int = 100, max_pages: int = 50) -> list[dict[str, Any]]:
    """Fetch every person on the portal, following pagination.

    Returns [] when disabled/unreachable (caller must distinguish
    'no data' from 'sync disabled' via ZKBIO_ENABLED).
    """
    result = fetch_all_portal_persons(page_size=page_size, max_pages=max_pages)
    return result["items"]


def fetch_all_portal_persons(
    page_size: int = 100, max_pages: int = 50
) -> dict[str, Any]:
    """Fetch every person on the portal, tracking fetch completeness.

    Returns {"items", "complete", "total", "pages", "error"}.
    `complete` is True only when every fetched page answered code==0 and
    pagination terminated cleanly (short page or reached reported total).
    Callers MUST NOT delete local rows when complete is False — a partial
    fetch would otherwise look like mass portal deletions.
    """
    empty: dict[str, Any] = {"items": [], "complete": False, "total": None, "pages": 0, "error": None}
    if not ZKBIO_ENABLED:
        _log_disabled()
        empty["error"] = "ZKBio disabled"
        return empty
    all_items: list[dict[str, Any]] = []
    reported_total: Any = None
    for page in range(1, max_pages + 1):
        data = list_persons(page_no=page, page_size=page_size)
        if not isinstance(data, dict) or data.get("code") != 0:
            return {
                "items": all_items, "complete": False, "total": reported_total,
                "pages": page - 1,
                "error": f"page {page}: portal did not answer code==0",
            }
        payload = data.get("data", [])
        if isinstance(payload, dict):
            reported_total = payload.get("total", reported_total)
            items = payload.get("data", payload.get("list", []))
            if not isinstance(items, list):
                return {
                    "items": all_items, "complete": False, "total": reported_total,
                    "pages": page, "error": f"page {page}: unexpected payload shape",
                }
            all_items.extend(items)
            try:
                if reported_total is not None and len(all_items) >= int(reported_total):
                    return {
                        "items": all_items, "complete": True, "total": int(reported_total),
                        "pages": page, "error": None,
                    }
            except (TypeError, ValueError):
                pass
            if len(items) < page_size:
                return {
                    "items": all_items, "complete": True, "total": reported_total,
                    "pages": page, "error": None,
                }
        elif isinstance(payload, list):
            all_items.extend(payload)
            if len(payload) < page_size:
                return {
                    "items": all_items, "complete": True, "total": None,
                    "pages": page, "error": None,
                }
        else:
            return {
                "items": all_items, "complete": False, "total": reported_total,
                "pages": page, "error": f"page {page}: unexpected payload shape",
            }
    return {
        "items": all_items, "complete": True, "total": reported_total,
        "pages": max_pages, "error": f"hit max_pages={max_pages} (treated complete)",
    }


def check_person_present(pin: str) -> bool | None:
    """Authoritative per-PIN presence check against the portal.

    Per the CVSecurity manual appendix §3.1, code -22 means
    "The person does not exist" — that is the ONLY non-zero code treated
    as absent. Any other non-zero code (e.g. -40 auth failure, -90 bad
    paging) means "unknown" so a bad token can never look like deletions.

    Returns True  = portal positively reports the person (found),
            False = portal positively reports the person GONE (code -22,
                    or an empty pins-filtered v2 search),
            None  = cannot tell (disabled / transport error / any other
                    portal error — caller must NOT treat as absent).
    """
    if not ZKBIO_ENABLED:
        _log_disabled()
        return None
    absent_votes = 0
    # v1 single-person lookups (manual §2.1.1.4–2.1.1.5, mode GET)
    for label, path, extra in (
        ("path", f"/api/person/get/{pin}", None),
        ("query", "/api/person/get", {"pin": pin}),
    ):
        try:
            if extra is None:
                resp = httpx.get(_url(path), params=_params(), timeout=TIMEOUT)
            else:
                resp = httpx.get(_url(path), params=_params(**extra), timeout=TIMEOUT)
            data = resp.json()
        except Exception as e:
            logger.error(f"check_person_present({pin}) [{label}] failed: {e}")
            continue
        if not isinstance(data, dict) or "code" not in data:
            continue
        if data.get("code") == 0 and data.get("data"):
            return True
        if data.get("code") == -22:
            absent_votes += 1
    # v2 pins-filtered search (manual §2.1.1.12): code==0 + empty list = gone.
    try:
        resp = httpx.post(
            _url("/api/v2/person/getPersonList"),
            params=_params(),
            json={"pins": pin, "pageNo": 1, "pageSize": 5},
            timeout=TIMEOUT,
        )
        data = resp.json()
    except Exception as e:
        logger.error(f"check_person_present({pin}) [v2 list] failed: {e}")
        return None if absent_votes == 0 else False
    if isinstance(data, dict) and data.get("code") == 0:
        payload = data.get("data", {})
        items = payload.get("data", payload.get("list", [])) if isinstance(payload, dict) else payload
        if isinstance(items, list) and items:
            return True
        absent_votes += 1
    elif isinstance(data, dict) and data.get("code") == -22:
        absent_votes += 1
    return False if absent_votes > 0 else None


# ══════════════════════════════════════════════════════════════════
#  Face Enrollment (photo → device portal)
# ══════════════════════════════════════════════════════════════════

def detect_face(photo_base64: str) -> dict[str, Any] | None:
    """
    Ask ZKBio whether a face template can be extracted from the photo.
    Manual §2.1.1.16: POST /api/v2/person/detectFace  { personPhoto: <base64> }
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


# Manual appendix §3.1 — detectFace / photo quality failures worth surfacing
# to the admin (who can then recapture) instead of a bare code number.
FACE_ERROR_MESSAGES: dict[int, str] = {
    -27: "Invalid personnel photo (portal rejected the image).",
    -262: "Photo not qualified — recapture with better framing.",
    -5001: "Picture resolution below 80000 pixels — move closer.",
    -5002: "No face detected — face the camera directly in good light.",
    -5003: "Multiple faces detected — only the student should be in frame.",
    -5005: "Face ratio too small — move closer to the camera.",
    -5006: "Non-color image — use a color camera frame.",
    -5012: "Face stretched too much — keep a neutral straight-on pose.",
    -5013: "Face is blocked (mask/hand/hair) — uncover the face.",
    -5014: "Smiling too much — keep a neutral expression.",
    -5015: "Face deflection angle too large — look straight at the camera.",
    -5016: "Picture is vague/blurry — hold still and recapture.",
    -5009: "Picture overexposed — reduce backlight.",
    -5010: "Picture too dark — add front lighting.",
    -5011: "Picture too noisy — improve lighting and recapture.",
    -5017: "Image brightness critical — fix lighting and recapture.",
    -5018: "Face deflection angle critical — look straight at the camera.",
}


def describe_face_error(detect_result: dict[str, Any] | None) -> str | None:
    """Human-readable reason for a failed detectFace call, if recognised."""
    if not isinstance(detect_result, dict):
        return None
    try:
        code = int(detect_result.get("code"))
    except (TypeError, ValueError):
        return None
    if code == 0:
        return None
    return FACE_ERROR_MESSAGES.get(code)


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
    face_hint = describe_face_error(detected)
    if detected is not None and detected.get("code") not in (0, None):
        logger.warning(f"register_face({pin}): detectFace returned {detected}")
        if face_hint:
            steps["faceHint"] = face_hint

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

    # Bio-template cross-check (secondary face signal)
    bio = get_bio_templates(pin)
    steps["bioTemplates"] = bio
    try:
        has_bio_face = has_face_bio_template(bio)
    except Exception:
        has_bio_face = False
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

    base_msg = (
        f"Face registered for {pin} and synced to device gate."
        if enrolled
        else f"Photo pushed for {pin} but device does not yet report a face template — it may sync shortly."
    )
    if not enrolled and steps.get("faceHint"):
        base_msg += f" Portal hint: {steps['faceHint']}"
    return {
        "ok": enrolled,
        "enrolled": enrolled,
        "message": base_msg,
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


# bioType values are NOT enumerated in the CVSecurity manual (examples only
# show bioType 1 = fingerprint template). Community integrations report 9 for
# vislight face templates, so both the manual-confirmed vislight photo fields
# (primary signal) and bioType 9 (secondary signal) are checked.
FACE_BIO_TYPES = (9, "9")


def extract_bio_items(bio_data: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Normalize a getFgListByPin response payload to a template list.

    The manual (§2.1.4.2/§2.1.4.5) shows `data` as a single template OBJECT,
    but firmware may return a list — accept both, plus the paged wrapper.
    """
    if not isinstance(bio_data, dict) or bio_data.get("code") != 0:
        return []
    payload = bio_data.get("data", [])
    if isinstance(payload, dict):
        inner = payload.get("data", payload.get("list", payload))
        if isinstance(inner, list):
            return [t for t in inner if isinstance(t, dict)]
        return [payload]  # single template object
    if isinstance(payload, list):
        return [t for t in payload if isinstance(t, dict)]
    return []


def has_face_bio_template(bio_data: dict[str, Any] | None) -> bool:
    """True if any template in the payload looks like a face template."""
    return any(t.get("bioType") in FACE_BIO_TYPES for t in extract_bio_items(bio_data))


def get_bio_templates(pin: str) -> dict[str, Any] | None:
    """Retrieve face/fingerprint templates for a PIN.

    Manual §2.1.4.5 (v2) and §2.1.4.2 (v1) are both mode GET:
      GET /api/v2/bioTemplate/getFgListByPin?pin={pin}
      GET /api/bioTemplate/getFgListByPin/{pin}
    Use extract_bio_items()/has_face_bio_template() to read the result —
    `data` may be a single object, a list, or a paged wrapper.
    """
    if not ZKBIO_ENABLED:
        _log_disabled()
        return None
    # v2 (query-param style)
    try:
        resp = httpx.get(
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
        resp = httpx.get(
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
    """Get current state of a specific door.

    Manual §2.2.2.2: GET /api/door/doorStateById?doorId=&timestamp=&... —
    timestamp (ms) is REQUIRED; omit it and the portal answers an error.
    """
    if not ZKBIO_ENABLED:
        _log_disabled()
        return None
    try:
        from datetime import datetime as _dt

        timestamp_ms = int(_dt.now().timestamp() * 1000)
        resp = httpx.get(
            _url("/api/door/doorStateById"),
            params=_params(doorId=door_id, timestamp=timestamp_ms),
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


def _reader_direction_from_name(name: Any) -> str | None:
    """entry/exit from a reader or event-point name, or None if unclear.

    Portal names look like "10.8.14.210-1-In" / "...-Out" (manual §2.2.5),
    and gate readers may use Chinese 入 (in) / 出 (out) (manual §2.9.4.1).
    """
    if not name:
        return None
    text = str(name).strip().lower()
    if text.endswith("-out") or text.endswith(" out") or text.endswith("出"):
        return "exit"
    if text.endswith("-in") or text.endswith(" in") or text.endswith("入"):
        return "entry"
    return None


def determine_event_type(transaction: dict) -> str:
    """
    Determine if a transaction is an 'entry' or 'exit'.

    Real transaction rows (manual §2.2.5) carry readerState (0=in, 1=out
    per §2.2.3), readerName/eventPointName ("...-In" / "...-Out") and
    doorName — NOT a numeric reader index. So prefer portal truth first
    and only fall back to the configured index/door lists:
      1. readerState 0/1 (strongest signal)
      2. readerName, then eventPointName suffix
      3. configured ZKBIO_ENTRY_EXIT_MODE lists (two_readers / two_doors)
      4. default "entry"
    """
    state = transaction.get("readerState")
    try:
        if state is not None and str(state).strip() != "":
            return "exit" if int(state) == 1 else "entry"
    except (TypeError, ValueError):
        pass

    for key in ("readerName", "eventPointName", "reader", "event_point"):
        direction = _reader_direction_from_name(transaction.get(key))
        if direction:
            return direction

    if ZKBIO_ENTRY_EXIT_MODE == "two_readers":
        reader = transaction.get("readerNo", transaction.get("reader", 0))
        try:
            reader_int = int(reader)
        except (TypeError, ValueError):
            reader_int = 0
        return "entry" if reader_int in ZKBIO_ENTRY_READERS else "exit"

    elif ZKBIO_ENTRY_EXIT_MODE == "two_doors":
        door_id = str(
            transaction.get("doorId", transaction.get("door_id", transaction.get("doorName", "")))
        )
        if door_id and door_id not in ("", "None"):
            if door_id in ZKBIO_ENTRY_DOOR_IDS:
                return "entry"
            if door_id in ZKBIO_EXIT_DOOR_IDS:
                return "exit"
        return "entry"

    else:
        # toggle or unknown — default to entry
        return "entry"


def get_who_is_inside(zone_code: str | None = None) -> list[dict[str, Any]]:
    """Who-is-inside-zone query (manual §2.2.6.1).

    GET /api/accAdvanced/getWhoIsInsideByZone?code={zone}&... → list of
    {zoneId, zoneName, pin}. Authoritative device-side occupancy — far more
    reliable than inferring it from our own access logs.
    """
    if not ZKBIO_ENABLED:
        _log_disabled()
        return []
    code = zone_code or ZKBIO_ZONE_CODE
    if not code:
        logger.warning("get_who_is_inside: no zone code (set ZKBIO_ZONE_CODE)")
        return []
    try:
        resp = httpx.get(
            _url("/api/accAdvanced/getWhoIsInsideByZone"),
            params=_params(code=code),
            timeout=TIMEOUT,
        )
        data = resp.json()
        if data.get("code") == 0 and isinstance(data.get("data"), list):
            return data["data"]
        logger.warning(f"get_who_is_inside unexpected response: {str(data)[:300]}")
        return []
    except Exception as e:
        logger.error(f"get_who_is_inside failed: {e}")
        return []
