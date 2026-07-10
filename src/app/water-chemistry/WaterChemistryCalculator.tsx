"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  NamedProfile,
  SaltAdditionInput,
  SaltType,
  WaterChemistryResult,
  WaterChemistryResponse,
} from "@/lib/ui/types";

// ---------------------------------------------------------------------------
// Salt options the user can add
// ---------------------------------------------------------------------------

const SALT_OPTIONS: { value: SaltType; label: string; hint: string }[] = [
  { value: "gypsum", label: "Gypsum", hint: "Ca²⁺ + SO₄²⁻ — adds hardness, accentuates hop bitterness" },
  { value: "calciumChloride", label: "Calcium chloride", hint: "Ca²⁺ + Cl⁻ — adds body, rounds malt flavour" },
  { value: "epsomSalt", label: "Epsom salt", hint: "Mg²⁺ + SO₄²⁻ — magnesium source, can add sourness" },
  { value: "canningSalt", label: "Canning salt", hint: "Na⁺ + Cl⁻ — sodium, rounds flavour" },
  { value: "bakingSoda", label: "Baking soda", hint: "Na⁺ + HCO₃⁻ — raises alkalinity, dark beer profile" },
  { value: "chalk", label: "Chalk", hint: "Ca²⁺ + CO₃²⁻ — raises alkalinity, poorly soluble" },
];

const DEFAULT_VOLUME = 20;

export default function WaterChemistryCalculator() {
  const [selectedProfile, setSelectedProfile] = useState<string>("RO / Distilled");
  const [profiles, setProfiles] = useState<NamedProfile[]>([]);

  const [volumeInput, setVolumeInput] = useState<string>(String(DEFAULT_VOLUME));

  const [salts, setSalts] = useState<SaltAdditionInput[]>([]);
  const [newSaltType, setNewSaltType] = useState<SaltType>("gypsum");
  const [newSaltGrams, setNewSaltGrams] = useState<string>("");

  const [result, setResult] = useState<WaterChemistryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const volumeLiters = Number.parseFloat(volumeInput);

  const currentProfile = useMemo(() => {
    return profiles.find((p) => p.name === selectedProfile) ?? profiles[0];
  }, [profiles, selectedProfile]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (currentProfile) {
      params.set("calcium", String(currentProfile.calcium));
      params.set("magnesium", String(currentProfile.magnesium));
      params.set("sodium", String(currentProfile.sodium));
      params.set("sulfate", String(currentProfile.sulfate));
      params.set("chloride", String(currentProfile.chloride));
      params.set("bicarbonate", String(currentProfile.bicarbonate));
    }
    if (Number.isFinite(volumeLiters) && volumeLiters > 0) {
      params.set("volumeLiters", String(volumeLiters));
    }
    if (salts.length > 0) {
      params.set("additions", JSON.stringify(salts));
    }
    return params.toString();
  }, [currentProfile, volumeLiters, salts]);

  const addSalt = useCallback(() => {
    const grams = Number.parseFloat(newSaltGrams);
    if (!Number.isFinite(grams) || grams <= 0) return;
    setSalts((prev) => [...prev, { saltType: newSaltType, grams }]);
    setNewSaltGrams("");
  }, [newSaltType, newSaltGrams]);

  const removeSalt = useCallback((index: number) => {
    setSalts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const fetchResult = useCallback(async (q: string) => {
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/water-chemistry?${q}`, { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(
          body?.error?.message ?? `request failed: ${res.status}`,
        );
      }
      const body = (await res.json()) as WaterChemistryResponse;
      setResult(body.data.result);
      if (body.data.profiles.length > 0 && profiles.length === 0) {
        setProfiles(body.data.profiles);
      }
    } catch (err) {
      console.error("water-chemistry fetch failed", err);
      setError(err instanceof Error ? err.message : "failed to load result");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [profiles.length]);

  // Fetch on mount to get profiles
  useEffect(() => {
    if (profiles.length === 0) {
      fetchResult(`volumeLiters=${DEFAULT_VOLUME}`);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce input-driven refetches
  useEffect(() => {
    if (profiles.length === 0) return;
    const handle = setTimeout(() => {
      fetchResult(query);
    }, 200);
    return () => clearTimeout(handle);
  }, [query, fetchResult, profiles.length]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6 items-start">
      <FormSection
        selectedProfile={selectedProfile}
        onProfileChange={setSelectedProfile}
        profiles={profiles}
        volumeInput={volumeInput}
        onVolumeChange={setVolumeInput}
        salts={salts}
        newSaltType={newSaltType}
        onNewSaltTypeChange={setNewSaltType}
        newSaltGrams={newSaltGrams}
        onNewSaltGramsChange={setNewSaltGrams}
        onAddSalt={addSalt}
        onRemoveSalt={removeSalt}
      />

      <ResultSection
        result={result}
        loading={loading}
        error={error}
        profileName={selectedProfile}
        volumeLiters={volumeLiters}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form section
// ---------------------------------------------------------------------------

interface FormSectionProps {
  selectedProfile: string;
  onProfileChange: (n: string) => void;
  profiles: NamedProfile[];
  volumeInput: string;
  onVolumeChange: (s: string) => void;
  salts: SaltAdditionInput[];
  newSaltType: SaltType;
  onNewSaltTypeChange: (t: SaltType) => void;
  newSaltGrams: string;
  onNewSaltGramsChange: (s: string) => void;
  onAddSalt: () => void;
  onRemoveSalt: (i: number) => void;
}

function FormSection({
  selectedProfile,
  onProfileChange,
  profiles,
  volumeInput,
  onVolumeChange,
  salts,
  newSaltType,
  onNewSaltTypeChange,
  newSaltGrams,
  onNewSaltGramsChange,
  onAddSalt,
  onRemoveSalt,
}: FormSectionProps) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 space-y-5">
      {/* Source-water profile */}
      <div className="space-y-2">
        <label
          htmlFor="source-profile"
          className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] block"
        >
          Source-water profile
        </label>
        <select
          id="source-profile"
          value={selectedProfile}
          onChange={(e) => onProfileChange(e.target.value)}
          className="w-full border border-[var(--border)] rounded-md px-3 py-2 bg-[var(--background)] text-[var(--foreground)] font-mono text-sm"
          data-testid="profile-select"
        >
          {profiles.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
        {profiles.find((p) => p.name === selectedProfile) && (
          <p className="text-xs text-[var(--muted-foreground)]">
            {profiles.find((p) => p.name === selectedProfile)!.description}
          </p>
        )}
      </div>

      {/* Volume */}
      <div className="space-y-2">
        <label
          htmlFor="volume"
          className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] block"
        >
          Volume (litres)
        </label>
        <input
          id="volume"
          type="number"
          min="0.1"
          step="0.1"
          value={volumeInput}
          onChange={(e) => onVolumeChange(e.target.value)}
          className="w-full border border-[var(--border)] rounded-md px-3 py-2 bg-[var(--background)] text-[var(--foreground)] font-mono"
          data-testid="volume-input"
        />
      </div>

      {/* Salt additions */}
      <div className="space-y-3">
        <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] block">
          Salt additions
        </span>

        {salts.length > 0 && (
          <ul className="space-y-1.5" data-testid="salt-list">
            {salts.map((s, i) => {
              const opt = SALT_OPTIONS.find((o) => o.value === s.saltType);
              return (
                <li
                  key={`${s.saltType}-${i}`}
                  className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium">{opt?.label ?? s.saltType}</span>
                    <span className="ml-2 text-[var(--muted-foreground)]">
                      {s.grams.toFixed(1)} g
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveSalt(i)}
                    className="text-xs px-2 py-1 rounded border border-[var(--border)] hover:bg-[var(--muted)] text-[var(--muted-foreground)]"
                    aria-label={`Remove ${opt?.label}`}
                    data-testid={`remove-salt-${i}`}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <select
              value={newSaltType}
              onChange={(e) => onNewSaltTypeChange(e.target.value as SaltType)}
              className="w-full border border-[var(--border)] rounded-md px-3 py-2 bg-[var(--background)] text-[var(--foreground)] text-sm"
              data-testid="new-salt-select"
            >
              {SALT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="w-24 space-y-1">
            <input
              type="number"
              min="0"
              step="0.5"
              value={newSaltGrams}
              onChange={(e) => onNewSaltGramsChange(e.target.value)}
              placeholder="g"
              className="w-full border border-[var(--border)] rounded-md px-3 py-2 bg-[var(--background)] text-[var(--foreground)] font-mono text-sm"
              data-testid="new-salt-grams"
            />
          </div>
          <button
            type="button"
            onClick={onAddSalt}
            disabled={!newSaltGrams || Number.parseFloat(newSaltGrams) <= 0}
            className="px-3 py-2 rounded-md border border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)] text-sm font-medium disabled:opacity-40"
            data-testid="add-salt-btn"
          >
            Add
          </button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Result section
// ---------------------------------------------------------------------------

function formatIon(value: number): string {
  return `${value.toFixed(1)} ppm`;
}

interface ResultSectionProps {
  result: WaterChemistryResult | null;
  loading: boolean;
  error: string | null;
  profileName: string;
  volumeLiters: number;
}

function ResultSection({ result, loading, error, profileName, volumeLiters }: ResultSectionProps) {
  if (error) {
    return (
      <section
        className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] p-5 text-sm text-[var(--error-fg)]"
        data-testid="result-error"
      >
        <h2 className="text-base font-semibold mb-1">Couldn&apos;t compute</h2>
        <p>{error}</p>
      </section>
    );
  }

  if (!result) {
    return (
      <section
        className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5"
        data-testid="result-empty"
      >
        <p className="text-sm text-[var(--muted-foreground)]">
          {loading ? "Calculating…" : "Select a profile and volume to begin."}
        </p>
      </section>
    );
  }

  const p = result.resultingProfile;
  const profileLabel = profileName && volumeLiters > 0
    ? `${profileName} · ${volumeLiters.toFixed(1)} L`
    : "";

  return (
    <section
      className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-5 space-y-5"
      data-testid="result-card"
    >
      <div>
        <h2 className="text-base font-semibold">Mineral profile</h2>
        {profileLabel && (
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            {profileLabel}
          </p>
        )}
      </div>

      {/* Mineral profile grid */}
      <div className="rounded-md border border-[var(--border)] bg-[var(--background)] p-4">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 text-center">
          <IonStat label="Ca²⁺" value={formatIon(p.calcium)} color="var(--accent)" />
          <IonStat label="Mg²⁺" value={formatIon(p.magnesium)} color="var(--accent)" />
          <IonStat label="Na⁺" value={formatIon(p.sodium)} color="var(--accent)" />
          <IonStat label="SO₄²⁻" value={formatIon(p.sulfate)} color="var(--secondary)" />
          <IonStat label="Cl⁻" value={formatIon(p.chloride)} color="var(--secondary)" />
          <IonStat label="HCO₃⁻" value={formatIon(p.bicarbonate)} color="var(--secondary)" />
        </div>
      </div>

      {/* Key metrics */}
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <Stat label="Alkalinity (as CaCO₃)" value={`${result.alkalinityAsCaCO3.toFixed(1)} ppm`} />
        <Stat label="Residual alkalinity" value={`${result.residualAlkalinity.toFixed(1)} ppm`} />
        <Stat
          label="Est. mash pH"
          value={result.estimatedMashPh.toFixed(2)}
          accent
        />
        <Stat
          label="SO₄²⁻ / Cl⁻"
          value={result.sulfateChlorideRatio != null ? result.sulfateChlorideRatio.toFixed(1) : "—"}
        />
      </dl>

      {/* Per-salt breakdown */}
      {result.contributions.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-wide text-[var(--muted-foreground)] block">
            Salt contributions
          </span>
          <div className="space-y-1">
            {result.contributions.map((c, i) => (
              <details key={i} className="rounded-md border border-[var(--border)] bg-[var(--background)]">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-[var(--foreground)]">
                  {c.label} · {c.grams.toFixed(1)} g
                  <span className="ml-2 text-xs text-[var(--muted-foreground)]">
                    {c.formula}
                  </span>
                </summary>
                <div className="px-3 pb-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {c.calcium > 0 && <span>Ca²⁺: {c.calcium.toFixed(1)} ppm</span>}
                  {c.magnesium > 0 && <span>Mg²⁺: {c.magnesium.toFixed(1)} ppm</span>}
                  {c.sodium > 0 && <span>Na⁺: {c.sodium.toFixed(1)} ppm</span>}
                  {c.sulfate > 0 && <span>SO₄²⁻: {c.sulfate.toFixed(1)} ppm</span>}
                  {c.chloride > 0 && <span>Cl⁻: {c.chloride.toFixed(1)} ppm</span>}
                  {c.bicarbonate > 0 && <span>HCO₃⁻: {c.bicarbonate.toFixed(1)} ppm</span>}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-[var(--muted-foreground)]">
        Mash pH is estimated from residual alkalinity using a simplified model.
        For a precise prediction, measure the pH of a lab mash or enter your
        full grain bill in the recipe editor.
      </p>
    </section>
  );
}

function IonStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <dt
        className="text-[10px] uppercase tracking-wide font-semibold"
        style={{ color }}
      >
        {label}
      </dt>
      <dd className="font-mono text-sm mt-0.5">{value}</dd>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </dt>
      <dd
        className={`font-mono text-base ${accent ? "text-lg font-semibold text-[var(--accent)]" : ""}`}
        data-testid={label.replace(/\s+/g, "-").toLowerCase()}
      >
        {value}
      </dd>
    </div>
  );
}
