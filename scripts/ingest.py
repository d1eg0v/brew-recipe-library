#!/usr/bin/env python3
"""FermentDB ingestion helpers.

Normalizes existing Brew Library seed JSON and BeerJSON-like recipe payloads
into the app's recipe shape. Optional URL scraping is deliberately lightweight:
it extracts JSON/CSV links from a page so a curator can review the source before
importing it into Prisma via the TypeScript app.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any


BEVERAGE_TYPES = {"beer", "mead", "wine", "cider", "other"}


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_beverage_type(value: Any) -> str:
    raw = str(value or "beer").strip().lower()
    if raw in {"ale", "lager", "extract", "all grain", "partial mash"}:
        return "beer"
    return raw if raw in BEVERAGE_TYPES else "other"


def normalize_recipe(recipe: dict[str, Any]) -> dict[str, Any]:
    beverage_type = normalize_beverage_type(
        recipe.get("beverageType")
        or recipe.get("beverage_type")
        or recipe.get("category")
        or recipe.get("type")
    )
    out = dict(recipe)
    out["category"] = beverage_type
    out["beverageType"] = beverage_type

    if "target_ph" in out and "targetPh" not in out:
        out["targetPh"] = out.pop("target_ph")

    for yeast in out.get("yeasts", []) or []:
        if "abv_tolerance" in yeast and "abvTolerancePct" not in yeast:
            yeast["abvTolerancePct"] = yeast.pop("abv_tolerance")

    return out


def beerjson_to_recipe(recipe: dict[str, Any]) -> dict[str, Any]:
    style = recipe.get("style") if isinstance(recipe.get("style"), dict) else {}
    batch = recipe.get("batch") if isinstance(recipe.get("batch"), dict) else {}
    ingredients = recipe.get("ingredients") if isinstance(recipe.get("ingredients"), dict) else {}

    out = {
        "title": recipe.get("name") or recipe.get("title") or "Imported recipe",
        "author": recipe.get("author") or recipe.get("brewer"),
        "description": recipe.get("description"),
        "notes": recipe.get("notes"),
        "category": normalize_beverage_type(recipe.get("type") or style.get("type")),
        "styleName": style.get("name") or recipe.get("styleName"),
        "bjcpCategory": style.get("category") or recipe.get("bjcpCategory"),
        "batchSizeLiters": batch.get("volume_l") or recipe.get("batchSizeLiters") or 20,
        "boilTimeMinutes": recipe.get("boil_time") or recipe.get("boilTimeMinutes") or 60,
        "targetOg": recipe.get("original_gravity") or recipe.get("targetOg"),
        "targetFg": recipe.get("final_gravity") or recipe.get("targetFg"),
        "targetPh": recipe.get("target_ph") or recipe.get("targetPh"),
        "targetAbv": recipe.get("abv") or recipe.get("targetAbv"),
        "fermentables": ingredients.get("fermentable_additions") or recipe.get("fermentables") or [],
        "hops": ingredients.get("hop_additions") or recipe.get("hops") or [],
        "yeasts": ingredients.get("culture_additions") or recipe.get("yeasts") or [],
        "mashSteps": recipe.get("mashSteps") or [],
        "processSteps": recipe.get("processSteps") or [],
        "additions": ingredients.get("miscellaneous_additions") or recipe.get("additions") or [],
    }
    return normalize_recipe({k: v for k, v in out.items() if v is not None})


def load_recipes(path: Path, fmt: str) -> list[dict[str, Any]]:
    if fmt == "csv":
        with path.open("r", encoding="utf-8", newline="") as f:
            return [normalize_recipe(row) for row in csv.DictReader(f)]

    data = read_json(path)
    if isinstance(data, dict) and "recipes" in data:
        data = data["recipes"]
    if not isinstance(data, list):
        raise ValueError("input must be a JSON array, BeerJSON object with recipes[], or CSV")
    if fmt == "beerjson":
        return [beerjson_to_recipe(r) for r in data]
    return [normalize_recipe(r) for r in data]


def scrape_links(url: str) -> list[str]:
    try:
        import requests
        from bs4 import BeautifulSoup
    except ImportError as exc:
        raise SystemExit("Install requests and beautifulsoup4 to use --scrape-url") from exc

    html = requests.get(url, timeout=20).text
    soup = BeautifulSoup(html, "html.parser")
    links: list[str] = []
    for a in soup.find_all("a"):
        href = a.get("href")
        if href and any(href.lower().endswith(ext) for ext in (".csv", ".json", ".zip")):
            links.append(href)
    return links


def main() -> None:
    parser = argparse.ArgumentParser(description="Normalize FermentDB seed data")
    parser.add_argument("input", nargs="?", type=Path, help="JSON/CSV/BeerJSON input file")
    parser.add_argument("--format", choices=["seed", "beerjson", "csv"], default="seed")
    parser.add_argument("--output", type=Path, help="write normalized recipes to this JSON file")
    parser.add_argument("--scrape-url", help="list CSV/JSON/ZIP links from a baseline dataset page")
    args = parser.parse_args()

    if args.scrape_url:
      print(json.dumps({"links": scrape_links(args.scrape_url)}, indent=2))
      return

    if args.input is None:
        parser.error("input is required unless --scrape-url is provided")

    recipes = load_recipes(args.input, args.format)
    text = json.dumps(recipes, indent=2, ensure_ascii=False)
    if args.output:
        args.output.write_text(text + "\n", encoding="utf-8")
    else:
        print(text)


if __name__ == "__main__":
    main()
