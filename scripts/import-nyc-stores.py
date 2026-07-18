# -*- coding: utf-8 -*-
"""
Imports the second batch of new stores (NYC) from the July 2026 tracking sheet screenshot.
Geocodes each address via Nominatim, skips duplicates by store_name, inserts as
status=actively_selling, sales_associate=Adi, city=nyc.

Run: python scripts/import-nyc-stores.py
"""

import os, json, time, requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env.local'))

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
KEY = os.environ["SUPABASE_SECRET_KEY"]
HEADERS = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

ADI_ID = "d92a0119-4008-4bda-ac5e-82e5b4af84ab"
DATA_PATH = r"C:\Users\ALLSTA~1\AppData\Local\Temp\claude\C--Users-allstarcode-Documents-Posana-Dashboard\693526fc-e1fe-43c9-a965-4b9e9d84ac23\scratchpad\nyc_leads.json"


def geocode(query):
    try:
        url = f"https://nominatim.openstreetmap.org/search?format=json&q={requests.utils.quote(query)}&limit=1"
        res = requests.get(url, headers={"User-Agent": "PosanaDashboard/1.0"})
        data = res.json()
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception as e:
        print(f"  geocode error for {query!r}: {e}")
    return None


def main():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        stores = json.load(f)

    existing = requests.get(f"{SUPABASE_URL}/rest/v1/leads?select=store_name,address", headers=HEADERS).json()
    existing_pairs = {(e["store_name"].strip().lower(), (e["address"] or "").strip().lower()) for e in existing}

    inserted, skipped = 0, []
    for store in stores:
        key = (store["store_name"].strip().lower(), (store.get("address") or "").strip().lower())
        if key in existing_pairs:
            print(f"  SKIP {store['store_name']} @ {store.get('address')} (already exists)")
            continue

        lat = lng = None
        if store.get("address"):
            coords = geocode(store["address"])
            if coords:
                lat, lng = coords
            time.sleep(1)

        payload = {
            "store_name": store["store_name"],
            "address": store.get("address"),
            "lat": lat,
            "lng": lng,
            "store_type": store.get("store_type"),
            "chain_type": store.get("chain_type"),
            "status": "actively_selling",
            "sales_associate_id": ADI_ID,
            "contact_name": store.get("contact_name"),
            "contact_phone": store.get("contact_phone"),
            "contact_email": store.get("contact_email"),
            "neighborhood": store.get("neighborhood"),
            "notes": store.get("notes"),
            "city": "nyc",
        }

        r = requests.post(f"{SUPABASE_URL}/rest/v1/leads", headers=HEADERS, json=payload)
        if r.status_code in (200, 201):
            inserted += 1
            print(f"  OK  {store['store_name']} @ {store.get('address')}")
        else:
            skipped.append((store["store_name"], r.status_code, r.text))
            print(f"  FAIL {store['store_name']}: {r.status_code} {r.text[:200]}")

    print(f"\nInserted {inserted}/{len(stores)} stores.")
    if skipped:
        print("Failed:")
        for name, code, text in skipped:
            print(f"  - {name}: {code} {text[:200]}")


if __name__ == "__main__":
    main()
