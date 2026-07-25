"""Test NASA Images API to understand the response format for exoplanet searches."""
import requests
import json

# Test 1: Search for an exoplanet artist concept
url = "https://images-api.nasa.gov/search"
params = {"q": "Proxima Centauri artist concept", "media_type": "image"}
resp = requests.get(url, params=params, timeout=20)
data = resp.json()
items = data.get("collection", {}).get("items", [])
print(f"=== Test 1: 'Proxima Centauri artist concept' ===")
print(f"Total items found: {len(items)}")
if items:
    item = items[0]
    print(f"Item data[0].title: {item.get('data', [{}])[0].get('title', 'N/A')}")
    print(f"Item data[0].description: {item.get('data', [{}])[0].get('description', 'N/A')[:200]}")
    print(f"Item links: {json.dumps(item.get('links', []), indent=2)[:300]}")

# Test 2: Try following the manifest URL
if items and "links" in item and len(item["links"]) > 0:
    manifest_url = item["links"][0]["href"]
    print(f"\n=== Test 2: Manifest URL ===")
    print(f"Manifest URL: {manifest_url}")
    try:
        manifest_resp = requests.get(manifest_url, timeout=20)
        manifest_data = manifest_resp.json()
        print(f"Manifest contains {len(manifest_data)} keys")
        # The response might be a list of image URLs
        if isinstance(manifest_data, list):
            print(f"First URL: {manifest_data[0]}")
            print(f"Last URL: {manifest_data[-1]}")
        else:
            print(f"Response: {json.dumps(manifest_data, indent=2)[:500]}")
    except Exception as e:
        print(f"Failed to fetch manifest: {e}")

# Test 3: Search for exoplanet artist impressions more broadly
params2 = {"q": "exoplanet artist concept", "media_type": "image"}
resp2 = requests.get(url, params=params2, timeout=20)
data2 = resp2.json()
items2 = data2.get("collection", {}).get("items", [])
print(f"\n=== Test 3: 'exoplanet artist concept' ===")
print(f"Total items found: {len(items2)}")
if items2:
    item2 = items2[0]
    title = item2.get("data", [{}])[0].get("title", "N/A")
    print(f"First item title: {title}")
    if "links" in item2 and len(item2["links"]) > 0:
        print(f"Has link: {item2['links'][0]['href'][:100]}...")

# Test 4: Check the /asset endpoint
if items2 and "data" in items2[0]:
    nasa_id = items2[0]["data"][0].get("nasa_id", "")
    if nasa_id:
        print(f"\n=== Test 4: /asset endpoint ===")
        asset_url = f"https://images-api.nasa.gov/asset/{nasa_id}"
        print(f"Asset URL: {asset_url}")
        try:
            asset_resp = requests.get(asset_url, timeout=20)
            asset_data = asset_resp.json()
            asset_items = asset_data.get("collection", {}).get("items", [])
            print(f"Asset has {len(asset_items)} items")
            if asset_items:
                print(f"First asset URL: {asset_items[0]}")
        except Exception as e:
            print(f"Failed: {e}")

# Test 5: Wikimedia Commons for exoplanet category
print(f"\n=== Test 5: Wikimedia Commons - category search ===")
wiki_url = "https://commons.wikimedia.org/w/api.php"
wiki_params = {
    "action": "query",
    "format": "json",
    "list": "categorymembers",
    "cmtitle": "Category:Artist's_impressions_of_exoplanets",
    "cmlimit": "5",
    "cmtype": "file"
}
try:
    wiki_resp = requests.get(wiki_url, params=wiki_params, timeout=20)
    wiki_data = wiki_resp.json()
    pages = wiki_data.get("query", {}).get("categorymembers", [])
    print(f"Files in category: {len(pages)}")
    if pages:
        print(f"First: {pages[0].get('title', 'N/A')}")
        # Get image URL for first
        img_params = {
            "action": "query",
            "format": "json",
            "titles": pages[0]["title"],
            "prop": "imageinfo",
            "iiprop": "url"
        }
        img_resp = requests.get(wiki_url, params=img_params, timeout=20)
        img_data = img_resp.json()
        for pid, page_data in img_data.get("query", {}).get("pages", {}).items():
            if "imageinfo" in page_data:
                print(f"Image URL: {page_data['imageinfo'][0]['url']}")
except Exception as e:
    print(f"Wikimedia error: {e}")
