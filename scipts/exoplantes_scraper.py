import os
import json
import random
import time

import requests
import pandas as pd
from tqdm import tqdm


OUTPUT = "output"
TOP = 100

os.makedirs(OUTPUT, exist_ok=True)


# ==================================================
# NASA EXOPLANET ARCHIVE
# ==================================================

NASA_QUERY = """
SELECT
pl_name,
hostname,
sy_dist,
ra,
dec,

disc_year,
discoverymethod,
disc_facility,

pl_bmasse,
pl_rade,
pl_dens,
pl_orbper,
pl_orbsmax,
pl_orbeccen,
pl_eqt,
pl_insol,

st_teff,
st_rad,
st_mass,
st_age,
st_spectype,

sy_pnum

FROM ps

WHERE sy_dist IS NOT NULL

ORDER BY sy_dist ASC
"""


def get_exoplanets():

    url = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"

    response = requests.get(
        url,
        params={
            "query": NASA_QUERY,
            "format": "json"
        },
        timeout=120
    )

    response.raise_for_status()

    df = pd.DataFrame(
        response.json()
    )

    df = df.drop_duplicates(
        subset=["pl_name"]
    )

    return df.head(TOP)



# ==================================================
# IMAGE SEARCH
# ==================================================

NASA_IMAGE_CACHE = {}
# Track which generic NASA images we've already assigned to planets
# so they get distributed rather than all getting the same image.
_USED_GENERIC_NASA_IDS = set()


def _resolve_nasa_image_url(item):
    """Resolve a NASA search result item to an actual image URL.

    The NASA Images API search returns items with a manifest URL.
    We must fetch that manifest to get the actual downloadable image URL.
    """
    # Check cache first (many planets share same star system)
    nasa_id = item.get("data", [{}])[0].get("nasa_id", "")
    if nasa_id in NASA_IMAGE_CACHE:
        return NASA_IMAGE_CACHE[nasa_id]

    data_meta = item.get("data", [{}])[0]
    title = data_meta.get("title", "")

    # Try the /asset endpoint first (more reliable)
    if nasa_id:
        try:
            asset_url = f"https://images-api.nasa.gov/asset/{nasa_id}"
            resp = requests.get(asset_url, timeout=20)
            resp.raise_for_status()
            asset_data = resp.json()
            asset_items = (
                asset_data
                .get("collection", {})
                .get("items", [])
            )
            if asset_items:
                # Return the original (largest) image - usually last
                image_urls = [u for u in asset_items if isinstance(u, str) and u.endswith((".jpg", ".png", ".jpeg"))]
                if image_urls:
                    # Prefer ~orig.jpg, fall back to the largest available
                    orig = [u for u in image_urls if "~orig." in u]
                    url = orig[-1] if orig else image_urls[-1]
                    result = {
                        "url": url,
                        "type": "artist_concept",
                        "source": "NASA",
                        "title": title
                    }
                    NASA_IMAGE_CACHE[nasa_id] = result
                    return result
        except Exception:
            pass

    # Fallback: use thumbnail from search result links
    links = item.get("links", [])
    for link in links:
        href = link.get("href", "")
        if href.endswith((".jpg", ".png", ".jpeg")):
            result = {
                "url": href,
                "type": "artist_concept",
                "source": "NASA",
                "title": title
            }
            NASA_IMAGE_CACHE[nasa_id] = result
            return result
    return None


def nasa_image(query, planet_name=""):
    """Search NASA Images API for exoplanet artist concepts.

    Returns a dict with url, type, source, or None.
    """
    url = "https://images-api.nasa.gov/search"

    # Try progressively broader search terms
    search_terms = []

    # If query contains a specific planet, try specific searches first
    if planet_name:
        search_terms = [
            f"{query} artist concept",
            f"{query} artist impression",
            f"{query} illustration",
            f"{query} exoplanet"
        ]

    # Broader fallback searches
    search_terms.append(f"exoplanet artist concept")
    search_terms.append(f"exoplanet illustration")
    search_terms.append(f"exoplanet")

    seen_nasa_ids = set()

    for term in search_terms:
        try:
            response = requests.get(
                url,
                params={
                    "q": term,
                    "media_type": "image"
                },
                timeout=20
            )
            response.raise_for_status()

            data = response.json()
            items = (
                data
                .get("collection", {})
                .get("items", [])
            )

            for item in items:
                nasa_id = item.get("data", [{}])[0].get("nasa_id", "")
                if nasa_id in seen_nasa_ids:
                    continue
                seen_nasa_ids.add(nasa_id)

                title = (
                    item
                    .get("data", [{}])[0]
                    .get("title", "")
                    .lower()
                )
                description = (
                    item
                    .get("data", [{}])[0]
                    .get("description", "")
                    .lower()[:200]
                )

                # Check if this image is relevant to our query
                # For specific planet searches, require a strong match
                if planet_name:
                    query_lower = query.lower()
                    name_parts = query_lower.split()
                    is_relevant = any(
                        part in title or part in description
                        for part in name_parts[:3]
                    )
                    if not is_relevant:
                        continue

                # Check if it's an artist concept/illustration
                if any(
                    key in title or key in description
                    for key in [
                        "artist",
                        "concept",
                        "illustration",
                        "impression",
                        "exoplanet"
                    ]
                ):
                    # For specific planet searches, resolve directly
                    if planet_name:
                        result = _resolve_nasa_image_url(item)
                    else:
                        # For generic fallback, check _USED_GENERIC_NASA_IDS
                        # to distribute different images across planets
                        if nasa_id in _USED_GENERIC_NASA_IDS:
                            continue
                        result = _resolve_nasa_image_url(item)
                        if result:
                            _USED_GENERIC_NASA_IDS.add(nasa_id)
                    if result:
                        return result

        except Exception:
            continue

    return None


def esa_image(query):
    return {
        "url":
        "https://www.esa.int/Search?q="
        +
        query.replace(
            " ",
            "+"
        ),
        "type":
        "artist_impression",
        "source":
        "ESA"
    }


WIKIMEDIA_CATEGORY_CACHE = None


def _get_wikimedia_category_images():
    """Get all images from the Artist's impressions of exoplanets category."""
    global WIKIMEDIA_CATEGORY_CACHE
    if WIKIMEDIA_CATEGORY_CACHE is not None:
        return WIKIMEDIA_CATEGORY_CACHE

    url = "https://commons.wikimedia.org/w/api.php"
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
        resp = requests.get(url, params=params, timeout=20)
        resp.raise_for_status()
        data = resp.json()
        members = data.get("query", {}).get("categorymembers", [])

        # Get image URLs for all members
        titles = [m["title"] for m in members if "title" in m]
        for title in titles:
            try:
                img_params = {
                    "action": "query",
                    "format": "json",
                    "titles": title,
                    "prop": "imageinfo",
                    "iiprop": "url|extmetadata"
                }
                img_resp = requests.get(url, params=img_params, timeout=20)
                img_data = img_resp.json()
                for pid, page_data in img_data.get("query", {}).get("pages", {}).items():
                    if "imageinfo" in page_data:
                        info = page_data["imageinfo"][0]
                        image_url = info.get("url", "")
                        desc = info.get("extmetadata", {}).get("ImageDescription", {}).get("value", "")
                        images.append({
                            "url": image_url,
                            "description": desc,
                            "title": title.replace("File:", "").replace("_", " ").rsplit(".", 1)[0]
                        })
            except Exception:
                continue

    except Exception:
        pass

    WIKIMEDIA_CATEGORY_CACHE = images
    return images


def wikimedia_image(query):
    """Search Wikimedia Commons for exoplanet images.

    First tries specific search by planet name, then falls back
    to the Artist's impressions of exoplanets category.
    """
    api_url = "https://commons.wikimedia.org/w/api.php"

    # Try specific searches first
    searches = [
        query,
        f"{query} exoplanet",
        f"{query} planet"
    ]

    for search in searches:
        try:
            response = requests.get(
                api_url,
                params={
                    "action": "query",
                    "generator": "search",
                    "gsrsearch": search,
                    "gsrnamespace": 6,
                    "gsrlimit": 5,
                    "prop": "imageinfo",
                    "iiprop": "url|extmetadata",
                    "format": "json"
                },
                timeout=20
            )
            response.raise_for_status()

            data = response.json()
            pages = (
                data
                .get("query", {})
                .get("pages", {})
            )

            for page in pages.values():
                info = page.get("imageinfo")
                if info and info[0].get("url", "").endswith((".jpg", ".png", ".jpeg")):
                    return {
                        "url": info[0]["url"],
                        "type": "illustration",
                        "source": "Wikimedia"
                    }

        except Exception:
            continue

    return None


def wikimedia_fallback():
    """Fallback: return a random Wikimedia Commons exoplanet art image."""
    images = _get_wikimedia_category_images()
    if images:
        img = random.choice(images)
        return {
            "url": img["url"],
            "type": "illustration",
            "source": "Wikimedia"
        }
    return None


def find_images(planet, star):
    """Find images for an exoplanet from multiple sources.

    Strategy:
    1. Try specific planet name with NASA (most authoritative)
    2. Try specific planet name with Wikimedia
    3. Try broader star + exoplanet search with NASA
    4. Fall back to generic Wikimedia Commons exoplanet art
    5. Always include an ESA search link as fallback
    """
    result = {
        "NASA": None,
        "ESA": None,
        "Wikipedia": None
    }

    # Generate queries from most specific to most general
    queries = [
        planet,
        planet.replace(" Cen", " Centauri"),
        f"{star} exoplanet"
    ]

    for query in queries:
        # Try NASA with current query
        if not result["NASA"]:
            result["NASA"] = nasa_image(query, planet_name=planet)
            time.sleep(0.3)  # Rate limiting courtesy

        # Try Wikimedia with current query
        if not result["Wikipedia"]:
            result["Wikipedia"] = wikimedia_image(query)
            time.sleep(0.3)  # Rate limiting courtesy

        # If we found a NASA image, we're done searching specific images
        if result["NASA"]:
            break

    # If nothing specific found, try generic Wikimedia Commons exoplanet art
    if not result["Wikipedia"] and not result["NASA"]:
        result["Wikipedia"] = wikimedia_fallback()

    # Always include ESA search link as fallback
    result["ESA"] = esa_image(planet)

    return result



# ==================================================
# BUILD DATABASE
# ==================================================

def clean(value):

    if pd.isna(value):
        return None

    return value



def build_database(df):

    planets = []


    for _, row in tqdm(
        df.iterrows(),
        total=len(df),
        desc="Collecting planets"
    ):


        distance = None

        if pd.notna(row.sy_dist):

            distance = round(
                row.sy_dist * 3.26156,
                3
            )


        name = row.pl_name
        star = row.hostname


        planet = {


            "name": name,


            "distance": {

                "parsec":
                    clean(row.sy_dist),

                "lightYears":
                    distance

            },


            "coordinates": {

                "ra":
                    clean(row.ra),

                "dec":
                    clean(row.dec)

            },


            "star": {

                "name":
                    star,

                "temperature":
                    clean(row.st_teff),

                "mass":
                    clean(row.st_mass),

                "radius":
                    clean(row.st_rad),

                "age":
                    clean(row.st_age),

                "spectralType":
                    clean(row.st_spectype)

            },


            "planet": {

                "massEarth":
                    clean(row.pl_bmasse),

                "radiusEarth":
                    clean(row.pl_rade),

                "density":
                    clean(row.pl_dens),

                "orbitalPeriodDays":
                    clean(row.pl_orbper),

                "semiMajorAxisAU":
                    clean(row.pl_orbsmax),

                "eccentricity":
                    clean(row.pl_orbeccen),

                "temperatureK":
                    clean(row.pl_eqt),

                "insolationEarth":
                    clean(row.pl_insol)

            },


            "discovery": {

                "year":
                    clean(row.disc_year),

                "method":
                    clean(row.discoverymethod),

                "facility":
                    clean(row.disc_facility)

            },


            "images":
                find_images(
                    name,
                    star
                ),


            "links": {

                "NASA":
                f"https://exoplanetarchive.ipac.caltech.edu/overview/{name}",

                "ESA":
                f"https://www.esa.int/Search?q={name.replace(' ', '+')}"

            }

        }


        planets.append(
            planet
        )


    return planets



# ==================================================
# EXPORT
# ==================================================

def save(planets):


    with open(
        f"{OUTPUT}/exoplanets.json",
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            planets,
            f,
            indent=2,
            ensure_ascii=False
        )



    with open(
        f"{OUTPUT}/exoplanets.md",
        "w",
        encoding="utf-8"
    ) as md:


        md.write(
            "# Nearest Known Exoplanets\n\n"
        )


        for i,p in enumerate(planets,1):

            md.write(
                f"---\n\n# {i}. {p['name']}\n\n"
            )


            md.write(
                f"Distance: {p['distance']['lightYears']} ly\n\n"
            )


            md.write(
                "## Planet\n\n"
            )

            md.write(
                "| Property | Value |\n"
                "|---|---|\n"
            )

            for k,v in p["planet"].items():

                md.write(
                    f"| {k} | {v if v is not None else '-'} |\n"
                )


            md.write(
                "\n## Images\n\n"
            )


            for source,image in p["images"].items():

                if image:

                    md.write(
                        f"- {source}: {image['url']} "
                        f"({image['type']})\n"
                    )

                else:

                    md.write(
                        f"- {source}: not found\n"
                    )


            md.write("\n")



# ==================================================

if __name__ == "__main__":

    print(
        "Downloading exoplanets..."
    )


    df = get_exoplanets()


    print(
        f"Found {len(df)} planets"
    )


    planets = build_database(
        df
    )


    save(
        planets
    )


    print(
        "Done. Files saved in output/"
    )