# -*- coding: utf-8 -*-
"""
1. Creates Supabase auth accounts for each associate (placeholder emails).
2. Caches geocoded coords already in the DB so we don't re-geocode.
3. Deletes all existing leads.
4. Re-imports from XLSX with correct sales_associate_id.

Run: python scripts/assign-associates.py
"""

import pandas as pd
import requests
import re
import time
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env.local'))

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
XLSX_PATH = r"C:\Users\allstarcode\Downloads\Posana Tracking Sheet.xlsx"

# Placeholder emails — real ones can be updated later via Admin panel or Supabase dashboard
ASSOCIATES = {
    "Reagan":    "reagan@posana.internal",
    "Ronghe":    "ronghegnyc@gmail.com",      # existing account
    "Nathaniel": "nathaniel@posana.internal",
    "Ethan":     "ethan@posana.internal",
    "Ryan":      "ryan@posana.internal",
    "Roy":       "roy@posana.internal",
}
TEMP_PASSWORD = os.environ["SUPABASE_TEMP_PASSWORD"]

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

# ─── Helpers ─────────────────────────────────────────────────────────────────

def normalize_status(raw):
    if not raw or str(raw).strip() == "":
        return "not_contacted"
    s = str(raw).strip().lower()
    if any(x in s for x in ["purchase made", "closed", "actively selling"]):
        return "actively_selling"
    if any(x in s for x in ["declined", "dead", "cold"]):
        return "declined"
    if any(x in s for x in ["samples delivered", "following up", "4 -"]):
        return "samples_shipped"
    if any(x in s for x in ["in contact", "reached out", "emailed", "dmed", "visited",
                              "2 -", "3 -", "no response", "draft saved", "contact form"]):
        return "in_contact"
    return "not_contacted"

TYPE_MAP = {
    "grocer": "specialty_grocer", "grocery": "specialty_grocer",
    "specialty": "specialty_grocer", "deli": "local_deli",
    "cafe": "coffee_shop", "coffee": "coffee_shop",
    "smoothie": "smoothie_shop", "juice": "smoothie_shop",
    "fitness": "gym_fitness", "gym": "gym_fitness",
    "health": "gym_fitness", "wellness": "gym_fitness",
    "yoga": "gym_fitness", "pilates": "gym_fitness",
}

def normalize_store_type(raw):
    if not raw or str(raw).strip().lower() in ("", "nan", "none"):
        return "other"
    s = str(raw).strip().lower()
    for k, v in TYPE_MAP.items():
        if k in s:
            return v
    return "other"

def normalize_chain_type(raw):
    if raw is None or str(raw).strip().lower() in ("", "nan", "none"):
        return None
    s = str(raw).strip().lower()
    if s in ("true", "yes", "1"):
        return "corporate_chain"
    if s in ("false", "no", "0"):
        return "local"
    return None

def parse_date(raw):
    if raw is None or str(raw).strip().lower() in ("", "nat", "nan", "none"):
        return None
    try:
        if isinstance(raw, (datetime, pd.Timestamp)):
            return str(raw.date())
        return str(pd.to_datetime(raw).date())
    except:
        return None

def parse_sheet(df, associate_id):
    cols = [str(c).strip() for c in df.columns]
    df.columns = cols
    def col(patterns):
        for p in patterns:
            for c in cols:
                if p.lower() in c.lower():
                    return c
        return None

    name_col         = col(["name"])
    addr_col         = col(["address", "addr"])
    type_col         = col(["type", "fitness/gym", "fitness"])
    franchise_col    = col(["franchise"])
    status_col       = col(["status"])
    contact_col      = col(["contact"])
    notes_col        = col(["notes"])
    date_col         = col(["last contact", "last_contact"])
    neighborhood_col = col(["borough", "neighborhood"])

    leads = []
    for _, row in df.iterrows():
        name = str(row.get(name_col, "") or "").strip() if name_col else ""
        if not name or name.lower() in ("nan", "none", "name", ""):
            continue

        lead = {
            "store_name":          name,
            "address":             str(row.get(addr_col, "") or "").strip() if addr_col else None,
            "store_type":          normalize_store_type(row.get(type_col) if type_col else None),
            "chain_type":          normalize_chain_type(row.get(franchise_col) if franchise_col else None),
            "status":              normalize_status(row.get(status_col) if status_col else None),
            "sales_associate_id":  associate_id,
            "contact_name":        None,
            "contact_phone":       None,
            "contact_email":       None,
            "neighborhood":        str(row.get(neighborhood_col, "") or "").strip() if neighborhood_col else None,
            "notes":               str(row.get(notes_col, "") or "").strip() if notes_col else None,
            "last_contacted_date": parse_date(row.get(date_col) if date_col else None),
            "city":                "nyc",
            "lat":                 None,
            "lng":                 None,
        }
        for k, v in lead.items():
            if isinstance(v, str) and v.lower() in ("nan", "none", ""):
                lead[k] = None

        if contact_col:
            raw_c = str(row.get(contact_col, "") or "").strip()
            emails = re.findall(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", raw_c)
            phones = re.findall(r"[\+\(]?[\d\(\)\-\s\.]{7,}", raw_c)
            if emails:
                lead["contact_email"] = emails[0]
            if phones:
                lead["contact_phone"] = phones[0].strip()

        leads.append(lead)
    return leads

# ─── Step 1: Cache geocoded coords from existing DB leads ─────────────────────

def fetch_geocode_cache():
    print("Fetching existing geocoded coords from DB...")
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/leads?select=store_name,address,lat,lng&limit=1000",
        headers=HEADERS,
    )
    cache = {}
    for row in r.json():
        if row.get("lat") and row.get("lng"):
            key = (str(row.get("store_name", "") or "").strip(),
                   str(row.get("address", "") or "").strip())
            cache[key] = (row["lat"], row["lng"])
    print(f"  Cached {len(cache)} geocoded locations")
    return cache

# ─── Step 2: Create/update associate profiles ─────────────────────────────────

def ensure_profiles():
    print("\nSetting up associate profiles...")

    # Fetch existing users by email
    r = requests.get(f"{SUPABASE_URL}/auth/v1/admin/users?per_page=100", headers=HEADERS)
    existing = {u["email"]: u["id"] for u in r.json().get("users", [])}

    profile_map = {}  # associate_name -> profile_id

    for name, email in ASSOCIATES.items():
        if email in existing:
            uid = existing[email]
            print(f"  {name}: existing user {uid}")
            # Update profile name
            requests.patch(
                f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{uid}",
                headers=HEADERS,
                json={"name": name},
            )
        else:
            # Create new auth user
            resp = requests.post(
                f"{SUPABASE_URL}/auth/v1/admin/users",
                headers=HEADERS,
                json={
                    "email": email,
                    "password": TEMP_PASSWORD,
                    "email_confirm": True,
                    "user_metadata": {"name": name},
                },
            )
            if resp.status_code in (200, 201):
                uid = resp.json()["id"]
                print(f"  {name}: created user {uid}")
                # Ensure profile exists (trigger may fire async)
                time.sleep(0.5)
                requests.post(
                    f"{SUPABASE_URL}/rest/v1/profiles",
                    headers={**HEADERS, "Prefer": "resolution=ignore-duplicates,return=minimal"},
                    json={"id": uid, "name": name, "role": "associate"},
                )
            else:
                print(f"  {name}: ERROR creating user - {resp.status_code} {resp.text[:200]}")
                uid = None

        if uid:
            profile_map[name] = uid

    return profile_map

# ─── Step 3: Delete all existing leads ───────────────────────────────────────

def delete_all_leads():
    print("\nDeleting existing leads...")
    r = requests.delete(
        f"{SUPABASE_URL}/rest/v1/leads?id=neq.00000000-0000-0000-0000-000000000000",
        headers=HEADERS,
    )
    print(f"  Done (status {r.status_code})")

# ─── Step 4: Re-import with correct associate IDs ────────────────────────────

def reimport(profile_map, geocode_cache):
    print("\nRe-importing leads with associate assignments...")
    xl = pd.ExcelFile(XLSX_PATH)
    target_sheets = [s for s in xl.sheet_names if "Sales" in s or "S.A" in s]

    all_leads = []
    for sheet in target_sheets:
        df = pd.read_excel(xl, sheet_name=sheet)
        if df.empty:
            continue
        associate_name = re.sub(r"\s*\(.*\)\s*$", "", sheet).strip()
        associate_id = profile_map.get(associate_name)
        if not associate_id:
            print(f"  WARNING: No profile found for '{associate_name}', leads will be unassigned")
        leads = parse_sheet(df, associate_id)

        # Apply cached geocoded coords
        for lead in leads:
            key = (lead["store_name"], str(lead.get("address") or ""))
            if key in geocode_cache:
                lead["lat"], lead["lng"] = geocode_cache[key]

        print(f"  {sheet}: {len(leads)} leads -> {associate_name} ({associate_id})")
        all_leads.extend(leads)

    # Insert in batches
    print(f"\nInserting {len(all_leads)} leads...")
    batch_size = 50
    inserted = 0
    for i in range(0, len(all_leads), batch_size):
        batch = all_leads[i:i + batch_size]
        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/leads",
            headers=HEADERS,
            json=batch,
        )
        if r.status_code in (200, 201):
            inserted += len(batch)
        else:
            print(f"  ERROR on batch {i // batch_size + 1}: {r.status_code} {r.text[:300]}")

    print(f"Done! {inserted}/{len(all_leads)} leads inserted with correct associate IDs.")

# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    geocode_cache = fetch_geocode_cache()
    profile_map   = ensure_profiles()
    delete_all_leads()
    reimport(profile_map, geocode_cache)
