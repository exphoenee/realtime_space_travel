#!/usr/bin/env python3

import requests
import pandas as pd

QUERY = """
SELECT
    pl_name,
    hostname,
    sy_dist,
    disc_year,
    discoverymethod,
    pl_bmasse,
    pl_rade,
    pl_orbper,
    pl_eqt
FROM ps
WHERE sy_dist IS NOT NULL
ORDER BY sy_dist ASC
"""

URL = (
    "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"
)

response = requests.get(
    URL,
    params={
        "query": QUERY,
        "format": "json"
    },
    timeout=60
)

response.raise_for_status()

df = pd.DataFrame(response.json())

df = df.drop_duplicates(subset=["pl_name"])

df = df.head(100)

df["Distance (ly)"] = (df["sy_dist"] * 3.26156).round(2)

columns = [
    "pl_name",
    "hostname",
    "sy_dist",
    "Distance (ly)",
    "disc_year",
    "discoverymethod",
    "pl_bmasse",
    "pl_rade",
    "pl_orbper",
    "pl_eqt",
]

df = df[columns]

rename = {
    "pl_name": "Planet",
    "hostname": "Star",
    "sy_dist": "Distance (pc)",
    "disc_year": "Discovery",
    "discoverymethod": "Method",
    "pl_bmasse": "Mass (Earth)",
    "pl_rade": "Radius (Earth)",
    "pl_orbper": "Orbital Period (days)",
    "pl_eqt": "Equilibrium Temp (K)",
}

df.rename(columns=rename, inplace=True)

markdown = "# 100 Nearest Confirmed Exoplanets\n\n"
markdown += df.to_markdown(index=True)

with open("nearest_exoplanets.md", "w", encoding="utf-8") as f:
    f.write(markdown)

print("Generated nearest_exoplanets.md")