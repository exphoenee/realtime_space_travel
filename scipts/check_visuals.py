"""Check how many planets have visual data in output/exoplanets.json."""
import json

with open("output/exoplanets.json", "r", encoding="utf-8") as f:
    planets = json.load(f)

has_visual = [p for p in planets if "visual" in p]
print(f"Total planets: {len(planets)}")
print(f"Planets with visual: {len(has_visual)}")

if has_visual:
    print(f"\nFirst planet with visual: {has_visual[0]['name']}")
    print(f"First visual: {json.dumps(has_visual[0]['visual'], indent=2)[:200]}")
    print(f"\nLast planet with visual: {has_visual[-1]['name']}")
