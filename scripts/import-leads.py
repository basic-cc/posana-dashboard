# -*- coding: utf-8 -*-
"""
Import leads from Posana Tracking Sheet.xlsx into Supabase.
Only reads sheets containing "Sales" or "S.A" in their name.
Run: python scripts/import-leads.py

Requirements: pip install pandas openpyxl requests python-dotenv
"""

import pandas as pd
import requests
import time
import os
import json
import re
from datetime import datetime

SUPABASE_URL = "https://mititnoiwyeiwrunotew.supabase.co"
# Use your Supabase service role key (not the publishable key) for server-side inserts
# Get it from: Supabase dashboard → Project Settings → API → service_role
SUPABASE_SERVICE_KEY = "literal:REDACTED"

XLSX_PATH = r"C:\Users\allstarcode\Downloads\Posana Tracking Sheet.xlsx"

HEADERS = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

# ─── Status mapping ──────────────────────────────────────────────────────────

def normalize_status(raw):
    if not raw or str(raw).strip() == "":
        return "not_contacted"
    s = str(raw).strip().lower()

    # Actively selling
    if any(x in s for x in ["purchase made", "closed", "actively selling"]):
        return "actively_selling"

    # Declined
    if any(x in s for x in ["declined", "dead", "cold"]):
        return "declined"

    # Samples shipped / following up
    if any(x in s for x in ["samples delivered", "following up", "4 -"]):
        return "samples_shipped"

    # In contact
    if any(x in s for x in [
        "in contact", "reached out", "emailed", "dmed", "visited",
        "2 -", "3 -", "no response", "draft saved", "contact form",
    ]):
        return "in_contact"

    return "not_contacted"


# ─── Store type mapping ───────────────────────────────────────────────────────

TYPE_MAP = {
    "grocer": "specialty_grocer",
    "grocery": "specialty_grocer",
    "specialty": "specialty_grocer",
    "deli": "local_deli",
    "cafe": "coffee_shop",
    "coffee": "coffee_shop",
    "smoothie": "smoothie_shop",
    "juice": "smoothie_shop",
    "fitness": "gym_fitness",
    "gym": "gym_fitness",
    "health": "gym_fitness",
    "wellness": "gym_fitness",
    "yoga": "gym_fitness",
    "pilates": "gym_fitness",
}

def normalize_store_type(raw):
    if not raw or str(raw).strip().lower() in ("", "nan", "none"):
        return "other"
    s = str(raw).strip().lower()
    for keyword, mapped in TYPE_MAP.items():
        if keyword in s:
            return mapped
    return "other"


# ─── Chain type ───────────────────────────────────────────────────────────────

def normalize_chain_type(raw):
    if raw is None or str(raw).strip().lower() in ("", "nan", "none"):
        return None
    s = str(raw).strip().lower()
    if s in ("true", "yes", "1"):
        return "corporate_chain"
    if s in ("false", "no", "0"):
        return "local"
    return None


# ─── Date parsing ─────────────────────────────────────────────────────────────

def parse_date(raw):
    if raw is None or str(raw).strip().lower() in ("", "nat", "nan", "none"):
        return None
    try:
        if isinstance(raw, (datetime, pd.Timestamp)):
            return str(raw.date())
        return str(pd.to_datetime(raw).date())
    except:
        return None


# ─── Geocoding ────────────────────────────────────────────────────────────────

geocode_cache = {}

def geocode(address):
    if not address or str(address).strip() in ("", "nan"):
        return None, None
    address = str(address).strip()
    if address in geocode_cache:
        return geocode_cache[address]

    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {"q": address, "format": "json", "limit": 1}
        r = requests.get(url, params=params, headers={"User-Agent": "PosanaDashboard/1.0"}, timeout=10)
        data = r.json()
        if data:
            lat, lng = float(data[0]["lat"]), float(data[0]["lon"])
            geocode_cache[address] = (lat, lng)
            return lat, lng
    except Exception as e:
        print(f"  Geocode error for '{address}': {e}")

    geocode_cache[address] = (None, None)
    return None, None


# ─── Associate name → Supabase profile ID ────────────────────────────────────

def fetch_profiles():
    r = requests.get(f"{SUPABASE_URL}/rest/v1/profiles?select=id,name", headers=HEADERS)
    return {p["name"].lower(): p["id"] for p in r.json()}


# ─── Sheet parsing ────────────────────────────────────────────────────────────

def parse_sheet(df, associate_name, profiles):
    """Normalize a sheet's DataFrame into a list of lead dicts."""
    cols = [str(c).strip() for c in df.columns]
    df.columns = cols

    # Map column names (case-insensitive fuzzy)
    def col(patterns):
        for p in patterns:
            for c in cols:
                if p.lower() in c.lower():
                    return c
        return None

    name_col    = col(["name"])
    addr_col    = col(["address", "addr"])
    type_col    = col(["type", "fitness/gym", "fitness"])
    franchise_col = col(["franchise"])
    status_col  = col(["status"])
    contact_col = col(["contact"])
    notes_col   = col(["notes"])
    date_col    = col(["last contact", "last_contact"])
    neighborhood_col = col(["borough", "neighborhood"])

    associate_id = profiles.get(associate_name.lower())

    leads = []
    for _, row in df.iterrows():
        name = str(row.get(name_col, "") or "").strip() if name_col else ""
        if not name or name.lower() in ("nan", "none", "name", ""):
            continue

        lead = {
            "store_name":         name,
            "address":            str(row.get(addr_col, "") or "").strip() if addr_col else None,
            "store_type":         normalize_store_type(row.get(type_col) if type_col else None),
            "chain_type":         normalize_chain_type(row.get(franchise_col) if franchise_col else None),
            "status":             normalize_status(row.get(status_col) if status_col else None),
            "sales_associate_id": associate_id,
            "contact_name":       None,
            "contact_phone":      None,
            "contact_email":      None,
            "neighborhood":       str(row.get(neighborhood_col, "") or "").strip() if neighborhood_col else None,
            "notes":              str(row.get(notes_col, "") or "").strip() if notes_col else None,
            "last_contacted_date": parse_date(row.get(date_col) if date_col else None),
            "city":               "nyc",
            "lat":                None,
            "lng":                None,
        }

        # Blank out "nan" strings
        for k, v in lead.items():
            if isinstance(v, str) and v.lower() in ("nan", "none", ""):
                lead[k] = None

        # Parse contact info
        if contact_col:
            raw_contact = str(row.get(contact_col, "") or "").strip()
            emails = re.findall(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", raw_contact)
            phones = re.findall(r"[\+\(]?[\d\(\)\-\s\.]{7,}", raw_contact)
            if emails:
                lead["contact_email"] = emails[0]
            if phones:
                lead["contact_phone"] = phones[0].strip()

        leads.append(lead)

    return leads


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("Fetching profiles from Supabase...")
    profiles = fetch_profiles()
    print(f"  Found profiles: {list(profiles.keys())}")

    print(f"\nLoading {XLSX_PATH}...")
    xl = pd.ExcelFile(XLSX_PATH)
    target_sheets = [s for s in xl.sheet_names if "Sales" in s or "S.A" in s]
    print(f"  Target sheets: {target_sheets}")

    all_leads = []
    for sheet in target_sheets:
        df = pd.read_excel(xl, sheet_name=sheet)
        if df.empty:
            print(f"  Skipping empty sheet: {sheet}")
            continue

        # Extract associate name from sheet title, e.g. "Reagan (Sales)" → "Reagan"
        associate_name = re.sub(r"\s*\(.*\)\s*$", "", sheet).strip()
        print(f"\nParsing '{sheet}' -> associate: {associate_name}")

        leads = parse_sheet(df, associate_name, profiles)
        print(f"  {len(leads)} leads parsed")
        all_leads.extend(leads)

    print(f"\nTotal leads to geocode and insert: {len(all_leads)}")

    # Geocode
    print("\nGeocoding addresses (1 req/sec per Nominatim policy)...")
    geocoded = 0
    for i, lead in enumerate(all_leads):
        addr = lead.get("address")
        if addr:
            lat, lng = geocode(addr)
            lead["lat"] = lat
            lead["lng"] = lng
            if lat:
                geocoded += 1
                print(f"  [{i+1}/{len(all_leads)}] {lead['store_name']}: {lat:.4f}, {lng:.4f}")
            else:
                print(f"  [{i+1}/{len(all_leads)}] {lead['store_name']}: no coords")
            time.sleep(1.1)  # Nominatim rate limit: 1 req/sec

    print(f"\nGeocoded {geocoded}/{len(all_leads)} leads")

    # Insert in batches of 50
    print("\nInserting into Supabase...")
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
            print(f"  Inserted batch {i // batch_size + 1} ({len(batch)} leads)")
        else:
            print(f"  ERROR on batch {i // batch_size + 1}: {r.status_code} {r.text[:300]}")

    print(f"\nDone! {inserted}/{len(all_leads)} leads inserted.")


if __name__ == "__main__":
    main()
