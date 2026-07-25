import os
import json
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

def nasa_image(query):

    url = "https://images-api.nasa.gov/search"

    search_terms = [
        f"{query} artist concept",
        f"{query} artist impression",
        f"{query} illustration",
        f"{query} exoplanet"
    ]


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


            data = response.json()


            items = (
                data
                .get("collection", {})
                .get("items", [])
            )


            for item in items:

                title = (
                    item
                    .get("data", [{}])[0]
                    .get("title", "")
                    .lower()
                )


                if any(
                    key in title
                    for key in [
                        "artist",
                        "concept",
                        "illustration",
                        "impression"
                    ]
                ):

                    links = item.get(
                        "links",
                        []
                    )

                    if links:

                        return {
                            "url": links[0]["href"],
                            "type": "artist_concept",
                            "source": "NASA"
                        }


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



def wikimedia_image(query):

    url = "https://commons.wikimedia.org/w/api.php"


    searches = [
        f"{query} artist impression",
        f"{query} exoplanet illustration",
        f"{query} planet concept"
    ]


    for search in searches:

        try:

            response = requests.get(
                url,
                params={
                    "action": "query",
                    "generator": "search",
                    "gsrsearch": search,
                    "gsrnamespace": 6,
                    "gsrlimit": 5,
                    "prop": "imageinfo",
                    "iiprop": "url",
                    "format": "json"
                },
                timeout=20
            )


            data = response.json()


            pages = (
                data
                .get("query", {})
                .get("pages", {})
            )


            for page in pages.values():

                title = (
                    page
                    .get("title", "")
                    .lower()
                )


                if any(
                    x in title
                    for x in [
                        "artist",
                        "concept",
                        "illustration",
                        "impression"
                    ]
                ):

                    info = page.get(
                        "imageinfo"
                    )


                    if info:

                        return {

                            "url":
                            info[0]["url"],

                            "type":
                            "illustration",

                            "source":
                            "Wikimedia"

                        }


        except Exception:

            continue


    return None



def find_images(planet, star):

    result = {

        "NASA": None,
        "ESA": None,
        "Wikipedia": None

    }


    queries = [

        planet,

        planet.replace(
            " Cen",
            " Centauri"
        ),

        f"{star} exoplanet"

    ]


    for query in queries:


        if not result["NASA"]:

            result["NASA"] = nasa_image(
                query
            )


        if not result["Wikipedia"]:

            result["Wikipedia"] = wikimedia_image(
                query
            )


        if result["NASA"]:

            break



    result["ESA"] = esa_image(
        planet
    )


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