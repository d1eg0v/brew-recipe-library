"""Portable FermentDB data models for ingestion scripts.

The application source of truth is `prisma/schema.prisma`. These dataclasses
mirror the JSON contract used by `scripts/ingest.py` so offline ingestion jobs
can normalize BeerJSON/Kaggle-style records before handing them to the app.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Fermentable:
    name: str
    type: str = "grain"
    amountKg: float | None = None
    amountLiters: float | None = None
    colorLovibond: float | None = None
    potentialPpg: float | None = None
    notes: str | None = None


@dataclass
class Yeast:
    name: str
    laboratory: str | None = None
    productId: str | None = None
    type: str = "ale"
    form: str = "dry"
    attenuationPct: float | None = None
    abvTolerancePct: float | None = None
    temperatureCMin: float | None = None
    temperatureCMax: float | None = None
    notes: str | None = None


@dataclass
class BatchLog:
    type: str = "note"
    gravity: float | None = None
    ph: float | None = None
    temperatureC: float | None = None
    volumeLiters: float | None = None
    notes: str | None = None


@dataclass
class Recipe:
    title: str
    category: str = "beer"
    beverageType: str = "beer"
    author: str | None = None
    description: str | None = None
    notes: str | None = None
    styleName: str | None = None
    bjcpCategory: str | None = None
    batchSizeLiters: float = 20
    boilTimeMinutes: int = 60
    efficiencyPct: float = 75
    targetOg: float | None = None
    targetFg: float | None = None
    targetPh: float | None = None
    targetAbv: float | None = None
    targetIbu: float | None = None
    targetSrm: float | None = None
    fermentables: list[Fermentable] = field(default_factory=list)
    yeasts: list[Yeast] = field(default_factory=list)
    batchLogs: list[BatchLog] = field(default_factory=list)
