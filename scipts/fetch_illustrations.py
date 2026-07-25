"""
fetch_illustrations.py — Exobolygó illusztráció kereső

Cél: A meglévő output/exoplanets.json fájlt egészíti ki valódi
illusztrációkkal (artist concept / artist impression képek).

Források prioritási sorrendben:
  1. NASA Exoplanet Exploration Gallery (science.nasa.gov)
  2. NASA Images and Video Library API (images-api.nasa.gov)
  3. ESO (European Southern Observatory) gallery
  4. ESA website search
  5. Wikimedia Commons (API + kategória alapú fallback)
  6. Procedurális generálás (ha egyik sem talált semmit)

Használat:
    python scipts/fetch_illustrations.py

Az eredmény az output/ mappába kerül: exoplanets.json (frissítve)
és egy kép-statisztika a konzolra.

Cache: a script létrehoz egy .image_cache.json fájlt, hogy újrafuttatáskor
ne kelljen újra lekérdezni a már megtalált képeket.
"""

import os
import json
import hashlib
import random
import time
from urllib.parse import quote

import requests

# ─── Konfiguráció ─────────────────────────────────────────────────

INPUT_FILE = os.path.join("output", "exoplanets.json")
OUTPUT_FILE = os.path.join("output", "exoplanets.json")
CACHE_FILE = os.path.join("output", ".image_cache.json")
RATE_LIMIT = 0.25  # másodperc kérések között
REQUEST_TIMEOUT = 20

# Ismert exobolygók, amelyekhez van NASA Exoplanet Exploration galéria kép
# Ezeket közvetlenül a science.nasa.gov-ról tudjuk letölteni
KNOWN_EXOPLANET_GALLERY = {
    "proxima centauri b": {
        "url": "https://science.nasa.gov/wp-content/uploads/2023/04/exoplanet-29-proxima-centauri-b-2400x1800-1.jpg",
        "source": "NASA Exoplanet Exploration",
        "type": "artist_concept"
    },
    "proxima centauri d": {
        "url": "https://science.nasa.gov/wp-content/uploads/2023/04/exoplanet-29-proxima-centauri-b-2400x1800-1.jpg",
        "source": "NASA Exoplanet Exploration",
        "type": "artist_concept"
    },
    "trappist-1 b": {
        "url": "https://science.nasa.gov/wp-content/uploads/2023/04/exoplanet-28-trappist-1-2400x1800-1.jpg",
        "source": "NASA Exoplanet Exploration",
        "type": "artist_concept"
    },
    "trappist-1 c": {
        "url": "https://science.nasa.gov/wp-content/uploads/2023/04/exoplanet-28-trappist-1-2400x1800-1.jpg",
        "source": "NASA Exoplanet Exploration",
        "type": "artist_concept"
    },
    "trappist-1 d": {
        "url": "https://science.nasa.gov/wp-content/uploads/2023/04/exoplanet-28-trappist-1-2400x1800-1.jpg",
        "source": "NASA Exoplanet Exploration",
        "type": "artist_concept"
    },
    "trappist-1 e": {
        "url": "https://science.nasa.gov/wp-content/uploads/2023/04/exoplanet-28-trappist-1-2400x1800-1.jpg",
        "source": "NASA Exoplanet Exploration",
        "type": "artist_concept"
    },
    "trappist-1 f": {
        "url": "https://science.nasa.gov/wp-content/uploads/2023/04/exoplanet-28-trappist-1-2400x1800-1.jpg",
        "source": "NASA Exoplanet Exploration",
        "type": "artist_concept"
    },
    "trappist-1 g": {
        "url": "https://science.nasa.gov/wp-content/uploads/2023/04/exoplanet-28-trappist-1-2400x1800-1.jpg",
        "source": "NASA Exoplanet Exploration",
        "type": "artist_concept"
    },
    "trappist-1 h": {
        "url": "https://science.nasa.gov/wp-content/uploads/2023/04/exoplanet-28-trappist-1-2400x1800-1.jpg",
        "source": "NASA Exoplanet Exploration",
        "type": "artist_concept"
    },
    "kepler-452 b": {
        "url": "https://science.nasa.gov/wp-content/uploads/2023/04/exoplanet-5-kepler-452-b-2400x1800-1.jpg",
        "source": "NASA Exoplanet Exploration",
        "type": "artist_concept"
    },
    "hd 219134 b": {
        "url": "https://science.nasa.gov/wp-content/uploads/2023/04/exoplanet-2-55-cancri-e-2400x1800-1.jpg",
        "source": "NASA Exoplanet Exploration",
        "type": "artist_concept"
    },
    "hd 219134 c": {
        "url": "https://science.nasa.gov/wp-content/uploads/2023/04/exoplanet-2-55-cancri-e-2400x1800-1.jpg",
        "source": "NASA Exoplanet Exploration",
        "type": "artist_concept"
    },
    "gj 1132 b": {
        "url": "https://science.nasa.gov/wp-content/uploads/2023/04/exoplanet-27-gj-1132-b-2400x1800-1.jpg",
        "source": "NASA Exoplanet Exploration",
        "type": "artist_concept"
    },
    "lhs 1140 b": {
        "url": "https://science.nasa.gov/wp-content/uploads/2023/04/exoplanet-30-lhs-1140-b-2400x1800-1.jpg",
        "source": "NASA Exoplanet Exploration",
        "type": "artist_concept"
    },
    "gj 667 c": {
        "url": "https://science.nasa.gov/wp-content/uploads/2023/04/exoplanet-32-gj-667-c-2400x1800-1.jpg",
        "source": "NASA Exoplanet Exploration",
        "type": "artist_concept"
    },
    "gj 667 e": {
        "url": "https://science.nasa.gov/wp-content/uploads/2023/04/exoplanet-32-gj-667-c-2400x1800-1.jpg",
        "source": "NASA Exoplanet Exploration",
        "type": "artist_concept"
    },
    "gj 667 f": {
        "url": "https://science.nasa.gov/wp-content/uploads/2023/04/exoplanet-32-gj-667-c-2400x1800-1.jpg",
        "source": "NASA Exoplanet Exploration",
        "type": "artist_concept"
    },
    "barnard's star b": {
        "url": "https://science.nasa.gov/wp-content/uploads/2023/04/exoplanet-31-barnards-star-b-2400x1800-1.jpg",
        "source": "NASA Exoplanet Exploration",
        "type": "artist_concept"
    },
    "55 cancri e": {
        "url": "https://science.nasa.gov/wp-content/uploads/2023/04/exoplanet-2-55-cancri-e-2400x1800-1.jpg",
        "source": "NASA Exoplanet Exploration",
        "type": "artist_concept"
    },
    "kepler-1649 c": {
        "url": "https://images-assets.nasa.gov/image/PIA23689/PIA23689~large.jpg",
        "source": "NASA Exoplanet Exploration",
        "type": "artist_concept"
    },
    "wasp-18 b": {
        "url": "https://images-assets.nasa.gov/image/PIA22087/PIA22087~large.jpg",
        "source": "NASA Exoplanet Exploration",
        "type": "artist_concept"
    },
    "toi 700 d": {
        "url": "https://images-assets.nasa.gov/image/PIA23408/PIA23408~orig.jpg",
        "source": "NASA Exoplanet Exploration",
        "type": "artist_concept"
    },
    "k2-33 b": {
        "url": "https://images-assets.nasa.gov/image/PIA20690/PIA20690~large.jpg",
        "source": "NASA Exoplanet Exploration",
        "type": "artist_concept"
    },
    "gj 504 b": {
        "url": "https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001417/GSFC_20171208_Archive_e001417~large.jpg",
        "source": "NASA Exoplanet Exploration",
        "type": "artist_concept"
    },
    "hd 106906 b": {
        "url": "https://images-assets.nasa.gov/image/art002e012476/art002e012476~large.jpg",
        "source": "NASA Exoplanet Exploration",
        "type": "artist_concept"
    },
}

# Szavak, amelyeket KIZÁRUNK a NASA találatokból (nem artist concept)
NASA_EXCLUDE_KEYWORDS = [
    "telescope", "observation", "spectrum", "diagram", "chart",
    "graph", "infographic", "timeline", "equipment", "tool",
    "satellite", "iss", "astronaut", "rocket", "launch",
    "testing", "simulation", "conference", "meeting", "portrait",
    "histogram", "timelapse", "screenshot", "schematic",
    "blueprint", "logo", "patch", "emblem", "hubble",
    "jwst", "webb", "spitzer", "kepler spacecraft",
    "photo", "photograph"
]

# ─── Image cache ───────────────────────────────────────────────────

def load_cache():
    """Betölti a korábban megtalált képek cache-ét."""
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return {}

def save_cache(cache):
    """Elmenti a cache-t."""
    os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, indent=2, ensure_ascii=False)

def cache_key(name):
    """Egyedi kulcs a cache-hez a bolygó nevéből."""
    return hashlib.md5(name.encode()).hexdigest()


# ─── 1. NASA Exoplanet Exploration Gallery ─────────────────────

def try_nasa_gallery(planet_name):
    """Ellenőrzi, hogy a bolygó szerepel-e az ismert NASA galéria listában."""
    key = planet_name.lower().strip()
    result = KNOWN_EXOPLANET_GALLERY.get(key)
    if result:
        return {
            "url": result["url"],
            "type": result["type"],
            "source": result["source"],
            "confidence": "high",
            "direct": True
        }

    # Részleges egyezés: pl. "Proxima Cen b" → "proxima centauri b"
    words = key.replace("-", " ").split()
    for known_key, known_data in KNOWN_EXOPLANET_GALLERY.items():
        known_words = known_key.split()
        # Ha a bolygó összes szava szerepel az ismert kulcsban
        if all(w in known_words for w in words):
            return {
                "url": known_data["url"],
                "type": known_data["type"],
                "source": known_data["source"],
                "confidence": "medium",
                "direct": True
            }

    return None


# ─── 2. NASA Images API ─────────────────────────────────────────

NASA_IMAGE_CACHE = {}  # nasa_id → resolved URL
_USED_GENERIC_NASA = set()  # generic image deduplication


def _resolve_nasa_asset(nasa_id, title):
    """NASA manifest URL feloldása valódi kép URL-ré."""
    if nasa_id in NASA_IMAGE_CACHE:
        return NASA_IMAGE_CACHE[nasa_id]

    try:
        asset_url = f"https://images-api.nasa.gov/asset/{nasa_id}"
        resp = requests.get(asset_url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        items = data.get("collection", {}).get("items", [])

        image_urls = [
            u for u in items
            if isinstance(u, str) and u.endswith((".jpg", ".png"))
        ]
        if image_urls:
            # Prefer original, fall back to largest
            orig = [u for u in image_urls if "~orig." in u]
            url = orig[-1] if orig else image_urls[-1]
            result = {
                "url": url,
                "type": "artist_concept",
                "source": "NASA Images",
                "confidence": "medium",
                "title": title
            }
            NASA_IMAGE_CACHE[nasa_id] = result
            return result
    except Exception:
        pass
    return None


def _is_artist_concept(title, description):
    """Ellenőrzi, hogy a NASA kép artist concept-e vagy sem."""
    text = (title + " " + description).lower()

    # Kizáró kulcsszavak
    if any(kw in text for kw in NASA_EXCLUDE_KEYWORDS):
        return False

    # Elfogadó kulcsszavak
    accept_keywords = [
        "artist", "concept", "illustration", "impression",
        "exoplanet", "extrasolar", "planet", "surface",
        "atmosphere", "system", "world", "landscape",
        "rendition", "visualization", "artwork",
        "rendering"
    ]
    return any(kw in text for kw in accept_keywords)


def search_nasa_api(query, specific=True):
    """Keresés a NASA Images API-ban.

    Args:
        query: keresőkifejezés
        specific: True = pontos egyezést várunk (bolygónév), False = generikus

    Returns:
        dict vagy None
    """
    url = "https://images-api.nasa.gov/search"

    # Keresési kifejezések
    if specific:
        terms = [
            f"{query} artist concept",
            f"{query} artist impression",
            f"{query} illustration",
            f"{query} exoplanet",
        ]
    else:
        terms = [
            "exoplanet artist concept",
            "exoplanet artist impression",
            "exoplanet illustration",
        ]

    seen_ids = set()

    for term in terms:
        try:
            resp = requests.get(url, params={
                "q": term,
                "media_type": "image"
            }, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
            items = data.get("collection", {}).get("items", [])

            for item in items:
                item_data = item.get("data", [{}])[0]
                nasa_id = item_data.get("nasa_id", "")
                if not nasa_id or nasa_id in seen_ids:
                    continue
                seen_ids.add(nasa_id)

                title = item_data.get("title", "").lower()
                description = (item_data.get("description", "") or "")[:300].lower()

                # Ha specifikus keresés, ellenőrizzük a relevanciát
                if specific:
                    query_parts = query.lower().split()
                    relevant = any(
                        part in title or part in description
                        for part in query_parts[:3]
                    )
                    if not relevant:
                        continue

                # Artist concept szűrés
                if not _is_artist_concept(title, description):
                    continue

                # Generikus képek deduplikációja
                if not specific and nasa_id in _USED_GENERIC_NASA:
                    continue

                # URL feloldása
                result = _resolve_nasa_asset(nasa_id, title)
                if result:
                    if not specific:
                        _USED_GENERIC_NASA.add(nasa_id)
                    return result

            time.sleep(RATE_LIMIT)

        except requests.RequestException:
            time.sleep(RATE_LIMIT)
            continue

    return None


# ─── 3. ESO ─────────────────────────────────────────────────────

ESO_CACHE = None


def search_eso(query):
    """Keresés az ESO oldalán exobolygó illusztrációkra.

    Az ESO-nak nincs hivatalos képek API-ja, ezért a galéria feed-et
    használjuk és megpróbálunk a bolygó / csillag nevére illeszkedő
    képeket találni. Fallback: ismert ESO exoplanet art URL-ek.
    """
    global ESO_CACHE

    if ESO_CACHE is None:
        # Ismert, stabil ESO exoplanet art URL-ek
        ESO_CACHE = {
            "proxima centauri": "https://cdn.eso.org/images/screen/eso1629a.jpg",
            "proxima cen": "https://cdn.eso.org/images/screen/eso1629a.jpg",
            "barnard": "https://cdn.eso.org/images/screen/eso1825a.jpg",
            "trappist-1": "https://cdn.eso.org/images/screen/eso1705a.jpg",
            "trappist": "https://cdn.eso.org/images/screen/eso1705a.jpg",
            "gj 1132": "https://cdn.eso.org/images/screen/eso1527a.jpg",
            "lhs 1140": "https://cdn.eso.org/images/screen/eso1706a.jpg",
            "55 cancri": "https://cdn.eso.org/images/screen/eso1507a.jpg",
            "hd 219134": "https://cdn.eso.org/images/screen/eso1526a.jpg",
        }

    query_lower = query.lower()
    for key, url in ESO_CACHE.items():
        if key in query_lower:
            return {
                "url": url,
                "type": "artist_impression",
                "source": "ESO",
                "confidence": "high"
            }

    return None


# ─── 4. ESA ──────────────────────────────────────────────────────

ESA_CACHE = None


def search_esa(query):
    """ESA kép keresés — ismert exoplanet art-okra épít."""
    global ESA_CACHE

    if ESA_CACHE is None:
        ESA_CACHE = {
            "proxima centauri": (
                "https://www.esa.int/var/esa/storage/images/"
                "esa_multimedia/images/2016/08/"
                "artist_s_impression_of_proxima_b/"
                "16175788-1-eng-GB/"
                "Artist_s_impression_of_Proxima_b.jpg"
            ),
            "proxima cen": (
                "https://www.esa.int/var/esa/storage/images/"
                "esa_multimedia/images/2016/08/"
                "artist_s_impression_of_proxima_b/"
                "16175788-1-eng-GB/"
                "Artist_s_impression_of_Proxima_b.jpg"
            ),
            "trappist-1": (
                "https://www.esa.int/var/esa/storage/images/"
                "esa_multimedia/images/2017/02/"
                "artist_s_impression_of_the_trappist-1_planets/"
                "17018037-1-eng-GB/"
                "Artist_s_impression_of_the_TRAPPIST-1_planets.jpg"
            ),
        }

    query_lower = query.lower()
    for key, url in ESA_CACHE.items():
        if key in query_lower:
            return {
                "url": url,
                "type": "artist_impression",
                "source": "ESA",
                "confidence": "medium"
            }

    # Fallback: ESA kereső link (mint a scraperben)
    return {
        "url": f"https://www.esa.int/Search?q={quote(query)}",
        "type": "artist_impression",
        "source": "ESA",
        "confidence": "low",
        "search_link": True
    }


# ─── 5. Wikimedia Commons ────────────────────────────────────────

WIKI_CATEGORY_CACHE = None


def _load_wiki_category():
    """Betölti az 'Artist's impressions of exoplanets' kategória képeit."""
    global WIKI_CATEGORY_CACHE
    if WIKI_CATEGORY_CACHE is not None:
        return WIKI_CATEGORY_CACHE

    api = "https://commons.wikimedia.org/w/api.php"
    images = []

    params = {
        "action": "query",
        "format": "json",
        "list": "categorymembers",
        "cmtitle": "Category:Artist's_impressions_of_exoplanets",
        "cmlimit": "50",
        "cmtype": "file"
    }

    try:
        resp = requests.get(api, params=params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        members = data.get("query", {}).get("categorymembers", [])

        titles = [m["title"] for m in members if "title" in m]
        for title in titles:
            try:
                img_params = {
                    "action": "query",
                    "format": "json",
                    "titles": title,
                    "prop": "imageinfo",
                    "iiprop": "url"
                }
                img_resp = requests.get(api, params=img_params, timeout=REQUEST_TIMEOUT)
                img_data = img_resp.json()
                for pid, page_data in img_data.get("query", {}).get("pages", {}).items():
                    if "imageinfo" in page_data:
                        url = page_data["imageinfo"][0].get("url", "")
                        if url.endswith((".jpg", ".png", ".jpeg")):
                            images.append({
                                "url": url,
                                "title": title.replace("File:", "")
                            })
                    time.sleep(RATE_LIMIT)
            except Exception:
                continue
    except Exception:
        pass

    WIKI_CATEGORY_CACHE = images
    return images


def search_wikimedia(query):
    """Specifikus Wikimedia keresés a bolygó nevére."""
    api = "https://commons.wikimedia.org/w/api.php"

    searches = [query, f"{query} exoplanet", f"{query} planet"]
    for search in searches:
        try:
            resp = requests.get(api, params={
                "action": "query",
                "generator": "search",
                "gsrsearch": search,
                "gsrnamespace": 6,
                "gsrlimit": 5,
                "prop": "imageinfo",
                "iiprop": "url",
                "format": "json"
            }, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
            pages = data.get("query", {}).get("pages", {})

            for page in pages.values():
                info = page.get("imageinfo")
                if info:
                    url = info[0].get("url", "")
                    if url.endswith((".jpg", ".png", ".jpeg")):
                        return {
                            "url": url,
                            "type": "illustration",
                            "source": "Wikimedia",
                            "confidence": "medium"
                        }
            time.sleep(RATE_LIMIT)
        except Exception:
            time.sleep(RATE_LIMIT)
            continue
    return None


def wikimedia_fallback():
    """Végső Wikimedia fallback: random kép a kategóriából."""
    images = _load_wiki_category()
    if images:
        img = random.choice(images)
        return {
            "url": img["url"],
            "type": "illustration",
            "source": "Wikimedia Commons",
            "confidence": "low"
        }
    return None


# ─── 6. Procedurális generálás ────────────────────────────────────

def generate_procedural(planet_data):
    """Procedurális bolygókép generálása a fizikai paraméterekből.

    Nem hoz létre tényleges képet, hanem metaadatot ad hozzá,
    amit a frontend Canvas shader-e renderelhet.

    A seed a bolygó nevéből + paramétereiből számítódik,
    így determinisztikus (újrafuttatáskor ugyanaz).
    """
    name = planet_data.get("name", "unknown")
    pl = planet_data.get("planet", {})
    seed_material = f"{name}:{pl.get('radiusEarth', 1)}:{pl.get('temperatureK', 300)}:{pl.get('massEarth', 1)}"
    seed = hashlib.md5(seed_material.encode()).hexdigest()[:8]
    seed_int = int(seed, 16)

    # Bolygó típus meghatározása a paraméterekből
    radius = pl.get("radiusEarth") or 1
    temp = pl.get("temperatureK") or 300
    mass = pl.get("massEarth") or 1

    if radius < 0.8:
        body_type = "rocky"
    elif radius < 1.5:
        body_type = "super_earth"
    elif radius < 3:
        body_type = "mini_neptune"
    else:
        body_type = "gas_giant"

    # Színséma a hőmérséklet alapján
    if temp > 1000:
        palette = "hot"       # vörös/narancs
    elif temp > 500:
        palette = "warm"      # narancs/sárga
    elif temp > 200:
        palette = "temperate" # kék/zöld
    else:
        palette = "cold"      # kék/fehér (jég)

    # Víz jelenléte (becslés)
    has_water = 150 < temp < 400 and 0.5 < radius < 2.0

    # Légkör becslése
    has_atmosphere = mass > 0.5 and temp > 100
    # Felhőzet becslése
    clouds = 0.0
    if has_water and has_atmosphere:
        clouds = 0.6 + (seed_int % 30) / 100  # 0.6-0.9
    elif has_atmosphere:
        clouds = 0.2 + (seed_int % 30) / 100  # 0.2-0.5
    # Vulkanizmus (kis, forró bolygók)
    lava = radius < 1.2 and temp > 500 and mass > 0.8
    # Jégsapka (hideg bolygók vízzel)
    ice_cap = temp < 250 and has_water

    return {
        "source": "procedural",
        "type": "artist_concept",
        "seed": seed,
        "body_type": body_type,
        "palette": palette,
        "has_water": has_water,
        "has_atmosphere": has_atmosphere,
        "clouds": round(clouds, 2),
        "lava": lava,
        "ice_cap": ice_cap,
        "confidence": "procedural"
    }


# ─── Fő pipeline ─────────────────────────────────────────────────

def find_best_image(planet):
    """Végigmegy az összes forráson prioritási sorrendben.

    Visszaadja a legjobb találatot, vagy None-t (ekkor procedural).
    """
    name = planet["name"]
    star = planet.get("star", {}).get("name", "")

    # 1. NASA Exoplanet Exploration Gallery (legpontosabb)
    result = try_nasa_gallery(name)
    if result:
        return result
    # Próbáljuk csillagnévvel is
    if star:
        result = try_nasa_gallery(star)
        if result:
            return result

    # 2. NASA Images API — specifikus keresés
    for query in [name, name.replace(" Cen", " Centauri"), f"{star} exoplanet"]:
        result = search_nasa_api(query, specific=True)
        if result:
            return result
        time.sleep(RATE_LIMIT)

    # 3. ESO
    result = search_eso(name)
    if result:
        return result
    if star:
        result = search_eso(star)
        if result:
            return result

    # 4. ESA
    result = search_esa(name)
    if result:
        return result

    # 5. Wikimedia specifikus keresés
    for query in [name, name.replace(" Cen", " Centauri"), f"{star} exoplanet"]:
        result = search_wikimedia(query)
        if result:
            return result
        time.sleep(RATE_LIMIT)

    # 6. NASA Images API — generikus fallback
    result = search_nasa_api("exoplanet", specific=False)
    if result:
        return result
    time.sleep(RATE_LIMIT)

    # 7. Wikimedia Commons kategória fallback
    result = wikimedia_fallback()
    if result:
        return result

    # 8. Procedurális generálás — ha minden más hiányzott
    return None


def process_planets():
    """Feldolgozza az összes bolygót és hozzáadja az illusztrációkat."""
    # Betöltés
    if not os.path.exists(INPUT_FILE):
        print(f"❌ Nincs input fájl: {INPUT_FILE}")
        print("   Futtasd először az exoplantes_scraper.py-t!")
        return

    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        planets = json.load(f)

    print(f"📂 Betöltve: {len(planets)} bolygó\n")

    # Cache betöltése
    cache = load_cache()

    stats = {
        "nasa_gallery": 0,
        "nasa_api": 0,
        "eso": 0,
        "esa": 0,
        "wikimedia": 0,
        "procedural": 0,
        "total": len(planets)
    }

    for i, planet in enumerate(planets):
        name = planet["name"]
        ck = cache_key(name)

        # Cache-ből
        if ck in cache:
            planet["visual"] = cache[ck]
            source = cache[ck].get("source", "unknown")
            if "procedural" in source or source == "procedural":
                stats["procedural"] += 1
            elif "NASA" in source:
                stats["nasa_gallery" if cache[ck].get("direct") else "nasa_api"] += 1
            elif source == "ESO":
                stats["eso"] += 1
            elif source == "ESA":
                stats["esa"] += 1
            else:
                stats["wikimedia"] += 1
            print(f"  [{i+1}/{len(planets)}] ⏺ {name} — cached: {source}")
            continue

        # Keresés
        result = find_best_image(planet)

        if result is None:
            # Procedurális generálás
            result = generate_procedural(planet)
            stats["procedural"] += 1
            marker = "🎨"
            src = "procedural"
        elif result.get("source") == "NASA Exoplanet Exploration":
            stats["nasa_gallery"] += 1
            marker = "🖼️"
            src = "NASA Gallery"
        elif result.get("source") == "NASA Images":
            stats["nasa_api"] += 1
            marker = "🌌"
            src = "NASA API"
        elif result.get("source") == "ESO":
            stats["eso"] += 1
            marker = "🔭"
            src = "ESO"
        elif result.get("source") == "ESA":
            stats["esa"] += 1
            marker = "🌍"
            src = "ESA"
        else:
            stats["wikimedia"] += 1
            marker = "📖"
            src = "Wikimedia"

        # Mentés
        planet["visual"] = result
        cache[ck] = result

        print(f"  [{i+1}/{len(planets)}] {marker} {name} — {src}")

        # Incrementális mentés minden 5. bolygó után (hogy időtúllépés se vesszen el)
        if (i + 1) % 5 == 0 or (i + 1) == len(planets):
            with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                json.dump(planets, f, indent=2, ensure_ascii=False)
            save_cache(cache)

        time.sleep(RATE_LIMIT)

    # Biztos, ami biztos: végső mentés
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(planets, f, indent=2, ensure_ascii=False)

    save_cache(cache)

    # Statisztika
    print("\n" + "=" * 50)
    print("📊 STATISZTIKA")
    print("=" * 50)
    print(f"  NASA Exoplanet Gallery:  {stats['nasa_gallery']:3d} / {stats['total']}")
    print(f"  NASA Images API:         {stats['nasa_api']:3d} / {stats['total']}")
    print(f"  ESO:                     {stats['eso']:3d} / {stats['total']}")
    print(f"  ESA:                     {stats['esa']:3d} / {stats['total']}")
    print(f"  Wikimedia Commons:       {stats['wikimedia']:3d} / {stats['total']}")
    print(f"  Procedurális:            {stats['procedural']:3d} / {stats['total']}")
    print(f"  ─────────────────────────────")
    found = stats['total'] - stats['procedural']
    print(f"  ✅ Valódi illusztráció:  {found:3d} / {stats['total']} ({found*100//stats['total']}%)")
    print(f"  🎨 Procedurális:         {stats['procedural']:3d} / {stats['total']} ({stats['procedural']*100//stats['total']}%)")
    print(f"\n📁 Eredmény: {OUTPUT_FILE}")


# ─── Indítás ──────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 50)
    print("🖼️  Exobolygó illusztráció kereső")
    print("=" * 50)
    print()
    print("Források sorrendje:")
    print("  1. NASA Exoplanet Exploration Gallery")
    print("  2. NASA Images API")
    print("  3. ESO (European Southern Observatory)")
    print("  4. ESA")
    print("  5. Wikimedia Commons")
    print("  6. Procedurális generálás (ha nincs valódi kép)")
    print()
    process_planets()
