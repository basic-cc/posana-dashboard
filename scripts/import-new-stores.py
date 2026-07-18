# -*- coding: utf-8 -*-
"""
Imports the batch of new stores from the July 2026 tracking sheet screenshot.
- Geocodes each store address via Nominatim (skips stores with no address).
- Geocodes a center point for every new city (for the map fly-to on the City filter).
- Inserts each store as a lead: status=actively_selling, sales_associate=Adi.

Run: python scripts/import-new-stores.py
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

DATA_PATH = r"C:\Users\ALLSTA~1\AppData\Local\Temp\claude\C--Users-allstarcode-Documents-Posana-Dashboard\693526fc-e1fe-43c9-a965-4b9e9d84ac23\scratchpad\new_leads.json"

CITY_QUERY = {
    "berkeley": "Berkeley, CA",
    "grass-valley": "Grass Valley, CA",
    "sacramento": "Sacramento, CA",
    "arbuckle": "Arbuckle, CA",
    "oakland": "Oakland, CA",
    "menlo-park": "Menlo Park, CA",
    "bakersfield": "Bakersfield, CA",
    "laguna-beach": "Laguna Beach, CA",
    "stockton": "Stockton, CA",
    "stanford": "Stanford, CA",
    "raleigh": "Raleigh, NC",
    "arvada": "Arvada, CO",
    "santa-monica": "Santa Monica, CA",
    "new-orleans": "New Orleans, LA",
    "sand-city": "Sand City, CA",
    "lafayette": "Lafayette, Contra Costa County, CA",
    "redwood-city": "Redwood City, CA",
    "redondo-beach": "Redondo Beach, CA",
    "bloomfield": "Bloomfield, NJ",
}
CITY_STATE = {
    "berkeley": "CA", "grass-valley": "CA", "sacramento": "CA", "arbuckle": "CA",
    "oakland": "CA", "menlo-park": "CA", "bakersfield": "CA", "laguna-beach": "CA",
    "stockton": "CA", "stanford": "CA", "santa-monica": "CA", "sand-city": "CA",
    "lafayette": "CA", "redwood-city": "CA", "redondo-beach": "CA",
    "raleigh": "NC", "arvada": "CO", "new-orleans": "LA", "bloomfield": "NJ",
    "unknown": "Other",
}
CITY_LABEL = {
    "berkeley": "Berkeley", "grass-valley": "Grass Valley", "sacramento": "Sacramento",
    "arbuckle": "Arbuckle", "oakland": "Oakland", "menlo-park": "Menlo Park",
    "bakersfield": "Bakersfield", "laguna-beach": "Laguna Beach", "stockton": "Stockton",
    "stanford": "Stanford", "santa-monica": "Santa Monica", "sand-city": "Sand City",
    "lafayette": "Lafayette", "redwood-city": "Redwood City", "redondo-beach": "Redondo Beach",
    "raleigh": "Raleigh", "arvada": "Arvada", "new-orleans": "New Orleans",
    "bloomfield": "Bloomfield", "unknown": "Unconfirmed",
}


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

    # 1. Geocode city centers
    print("Geocoding city centers...")
    city_coords = {}
    for slug, query in CITY_QUERY.items():
        coords = geocode(query)
        city_coords[slug] = coords
        print(f"  {slug}: {coords}")
        time.sleep(1)

    with open(os.path.join(os.path.dirname(DATA_PATH), "city_coords.json"), "w", encoding="utf-8") as f:
        json.dump(
            {
                slug: {
                    "label": CITY_LABEL[slug],
                    "state": CITY_STATE[slug],
                    "lat": coords[0] if coords else None,
                    "lng": coords[1] if coords else None,
                }
                for slug, coords in city_coords.items()
            },
            f,
            indent=2,
        )
    print("Wrote city_coords.json")

    # 2. Geocode + insert stores
    print("\nInserting stores...")
    existing = requests.get(f"{SUPABASE_URL}/rest/v1/leads?select=store_name", headers=HEADERS).json()
    existing_names = {e["store_name"].strip().lower() for e in existing}

    inserted, skipped = 0, []
    for store in stores:
        if store["store_name"].strip().lower() in existing_names:
            print(f"  SKIP {store['store_name']} (already exists in DB)")
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
            "notes": store.get("notes"),
            "city": store["city"],
        }

        r = requests.post(f"{SUPABASE_URL}/rest/v1/leads", headers=HEADERS, json=payload)
        if r.status_code in (200, 201):
            inserted += 1
            print(f"  OK  {store['store_name']}")
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
