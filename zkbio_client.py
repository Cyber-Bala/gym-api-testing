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
    """Get person record from the ZKBio device."""
    if not ZKBIO_ENABLED:
        _log_disabled()
        return None
    try:
        resp = httpx.get(
            _url(f"/api/person/get/{pin}"),
            params=_params(),
            timeout=TIMEOUT,
        )
        data = resp.json()
        return data
    except Exception as e:
        logger.error(f"get_person({pin}) failed: {e}")
        return None


# ══════════════════════════════════════════════════════════════════
#  Access Level Management
# ══════════════════════════════════════════════════════════════════

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


def upload_person_photo(pin: str, photo_base64: str):
    """Upload face photo for a person to ZKBio device server."""
    if not ZKBIO_ENABLED:
        _log_disabled()
        return None

    if "," in photo_base64:
        photo_base64 = photo_base64.split(",", 1)[1]

    payload = {
        "pin": pin,
        "personPhoto": photo_base64,
    }
    try:
        resp = httpx.post(
            _url("/api/person/updatePersonnelPhoto"),
            params=_params(),
            json=payload,
            timeout=TIMEOUT,
        )
        data = resp.json()
        logger.info("upload_person_photo %s: %s", pin, data)

        if data.get("code") != 0:
            p_data = get_person(pin)
            p_name = pin
            p_dept = ZKBIO_DEPT_CODE
            if p_data and p_data.get("code") == 0 and "data" in p_data:
                p_name = p_data["data"].get("name", pin)
                p_dept = p_data["data"].get("deptCode", ZKBIO_DEPT_CODE)
            add_resp = httpx.post(
                _url("/api/person/add"),
                params=_params(),
                json={
                    "pin": pin,
                    "name": p_name,
                    "deptCode": p_dept,
                    "personPhoto": photo_base64,
                },
                timeout=TIMEOUT,
            )
            data = add_resp.json()
            logger.info("add_person photo fallback %s: %s", pin, data)

        return data
    except Exception as e:
        logger.error("upload_person_photo %s failed: %s", pin, e)
        return None
