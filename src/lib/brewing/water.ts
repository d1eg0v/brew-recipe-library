// Water chemistry calculator.
//
// Given a source-water mineral profile and salt additions, computes the
// resulting mineral profile, residual alkalinity, and estimated mash pH.
//
// Residual alkalinity (RA) uses the standard Kolbach formula:
//   RA (as CaCO₃ ppm) = Alkalinity_as_CaCO₃ - 0.714 × Ca²⁺ - 0.585 × Mg²⁺
//
// Mash pH is estimated from residual alkalinity:
//   estimated_mash_pH ≈ 5.4 + RA × 0.002
//
// This is a simplified model suitable for a standalone tool. A precise mash pH
// prediction requires the full grain bill and malt-specific pH data.

import { roundTo } from "./units";

// ---------------------------------------------------------------------------
// Salt definitions — ionic mass fractions (mg of ion per mg of salt)
// ---------------------------------------------------------------------------

export interface SaltDefinition {
  label: string;
  formula: string;
  ca: number;
  mg: number;
  na: number;
  so4: number;
  cl: number;
  hco3: number;
}

export type SaltType =
  | "gypsum"
  | "calciumChloride"
  | "epsomSalt"
  | "canningSalt"
  | "bakingSoda"
  | "chalk";

export const SALT_DEFINITIONS: Record<SaltType, SaltDefinition> = {
  gypsum: {
    label: "Gypsum",
    formula: "CaSO₄·2H₂O",
    ca: 232.8,
    mg: 0,
    na: 0,
    so4: 558.0,
    cl: 0,
    hco3: 0,
  },
  calciumChloride: {
    label: "Calcium chloride",
    formula: "CaCl₂·2H₂O",
    ca: 272.6,
    mg: 0,
    na: 0,
    so4: 0,
    cl: 482.2,
    hco3: 0,
  },
  epsomSalt: {
    label: "Epsom salt",
    formula: "MgSO₄·7H₂O",
    ca: 0,
    mg: 98.6,
    na: 0,
    so4: 389.8,
    cl: 0,
    hco3: 0,
  },
  canningSalt: {
    label: "Canning salt",
    formula: "NaCl",
    ca: 0,
    mg: 0,
    na: 393.4,
    so4: 0,
    cl: 606.6,
    hco3: 0,
  },
  bakingSoda: {
    label: "Baking soda",
    formula: "NaHCO₃",
    ca: 0,
    mg: 0,
    na: 273.7,
    so4: 0,
    cl: 0,
    hco3: 726.3,
  },
  chalk: {
    label: "Chalk",
    formula: "CaCO₃",
    ca: 400.4,
    mg: 0,
    na: 0,
    so4: 0,
    cl: 0,
    hco3: 0,
  },
};

export const SALT_TYPES = Object.keys(SALT_DEFINITIONS) as SaltType[];

// ---------------------------------------------------------------------------
// Common source-water profiles (ppm / mg/L)
// ---------------------------------------------------------------------------

export interface WaterProfile {
  calcium: number;
  magnesium: number;
  sodium: number;
  sulfate: number;
  chloride: number;
  bicarbonate: number;
}

export interface NamedWaterProfile extends WaterProfile {
  name: string;
  description: string;
}

export const BUILT_IN_PROFILES: NamedWaterProfile[] = [
  {
    name: "RO / Distilled",
    description: "Virtually pure water — no minerals. Build from scratch.",
    calcium: 0,
    magnesium: 0,
    sodium: 0,
    sulfate: 0,
    chloride: 0,
    bicarbonate: 0,
  },
  {
    name: "Pilsen (soft)",
    description: "Very soft water from the Czech Republic. Ideal for pale lagers.",
    calcium: 7,
    magnesium: 2,
    sodium: 2,
    sulfate: 5,
    chloride: 2,
    bicarbonate: 10,
  },
  {
    name: "Yellow balanced",
    description: "A balanced pale-ale profile with moderate everything.",
    calcium: 50,
    magnesium: 10,
    sodium: 20,
    sulfate: 75,
    chloride: 50,
    bicarbonate: 30,
  },
  {
    name: "London",
    description: "Moderately hard, suits dark milds and brown ales.",
    calcium: 50,
    magnesium: 5,
    sodium: 30,
    sulfate: 30,
    chloride: 30,
    bicarbonate: 120,
  },
  {
    name: "Munich",
    description: "Moderate hardness, suits amber and dark lagers.",
    calcium: 80,
    magnesium: 18,
    sodium: 2,
    sulfate: 6,
    chloride: 2,
    bicarbonate: 160,
  },
  {
    name: "Burton-on-Trent",
    description: "Very hard, high sulfate. Classic for pale ales and IPAs.",
    calcium: 295,
    magnesium: 45,
    sodium: 55,
    sulfate: 725,
    chloride: 35,
    bicarbonate: 140,
  },
  {
    name: "Dublin",
    description: "Very hard alkaline water. Traditional for stouts.",
    calcium: 120,
    magnesium: 5,
    sodium: 12,
    sulfate: 55,
    chloride: 19,
    bicarbonate: 320,
  },
];

// ---------------------------------------------------------------------------
// Pure calculation functions
// ---------------------------------------------------------------------------

export interface SaltAddition {
  saltType: SaltType;
  grams: number;
}

export interface WaterChemistryInput {
  source: WaterProfile;
  additions: SaltAddition[];
  volumeLiters: number;
}

export interface SaltContribution {
  saltType: SaltType;
  grams: number;
  label: string;
  formula: string;
  calcium: number;
  magnesium: number;
  sodium: number;
  sulfate: number;
  chloride: number;
  bicarbonate: number;
}

export interface WaterChemistryResult {
  source: WaterProfile;
  additions: SaltAddition[];
  volumeLiters: number;
  resultingProfile: WaterProfile;
  contributions: SaltContribution[];
  alkalinityAsCaCO3: number;
  residualAlkalinity: number;
  estimatedMashPh: number;
  sulfateChlorideRatio: number | null;
}

function zeroProfile(): WaterProfile {
  return { calcium: 0, magnesium: 0, sodium: 0, sulfate: 0, chloride: 0, bicarbonate: 0 };
}

function addProfiles(a: WaterProfile, b: WaterProfile): WaterProfile {
  return {
    calcium: a.calcium + b.calcium,
    magnesium: a.magnesium + b.magnesium,
    sodium: a.sodium + b.sodium,
    sulfate: a.sulfate + b.sulfate,
    chloride: a.chloride + b.chloride,
    bicarbonate: a.bicarbonate + b.bicarbonate,
  };
}

function contributionFromAddition(
  saltType: SaltType,
  grams: number,
  volumeLiters: number,
): WaterProfile {
  const def = SALT_DEFINITIONS[saltType];
  const factor = grams / volumeLiters;
  return {
    calcium: def.ca * factor,
    magnesium: def.mg * factor,
    sodium: def.na * factor,
    sulfate: def.so4 * factor,
    chloride: def.cl * factor,
    bicarbonate: def.hco3 * factor,
  };
}

export function alkalinityAsCaCO3(bicarbonatePpm: number): number {
  return bicarbonatePpm * 0.82;
}

export function residualAlkalinity(profile: WaterProfile): number {
  const alk = alkalinityAsCaCO3(profile.bicarbonate);
  return alk - 0.714 * profile.calcium - 0.585 * profile.magnesium;
}

export function estimateMashPh(ra: number): number {
  return 5.4 + ra * 0.002;
}

export function computeWaterChemistry(input: WaterChemistryInput): WaterChemistryResult {
  if (!(input.volumeLiters > 0)) {
    throw new Error("volumeLiters must be greater than 0");
  }

  const contributions: SaltContribution[] = input.additions.map((a) => {
    const def = SALT_DEFINITIONS[a.saltType];
    const c = contributionFromAddition(a.saltType, a.grams, input.volumeLiters);
    return {
      saltType: a.saltType,
      grams: a.grams,
      label: def.label,
      formula: def.formula,
      calcium: roundTo(c.calcium, 1),
      magnesium: roundTo(c.magnesium, 1),
      sodium: roundTo(c.sodium, 1),
      sulfate: roundTo(c.sulfate, 1),
      chloride: roundTo(c.chloride, 1),
      bicarbonate: roundTo(c.bicarbonate, 1),
    };
  });

  const totalFromSalts = input.additions.reduce(
    (acc, a) => addProfiles(acc, contributionFromAddition(a.saltType, a.grams, input.volumeLiters)),
    zeroProfile(),
  );

  const resultingProfile = addProfiles(input.source, totalFromSalts);
  const alk = alkalinityAsCaCO3(resultingProfile.bicarbonate);
  const ra = residualAlkalinity(resultingProfile);
  const mashPh = estimateMashPh(ra);

  let sclRatio: number | null = null;
  if (resultingProfile.sulfate > 0 || resultingProfile.chloride > 0) {
    sclRatio = roundTo(resultingProfile.sulfate / Math.max(resultingProfile.chloride, 0.1), 1);
  }

  return {
    source: input.source,
    additions: input.additions,
    volumeLiters: input.volumeLiters,
    resultingProfile: {
      calcium: roundTo(resultingProfile.calcium, 1),
      magnesium: roundTo(resultingProfile.magnesium, 1),
      sodium: roundTo(resultingProfile.sodium, 1),
      sulfate: roundTo(resultingProfile.sulfate, 1),
      chloride: roundTo(resultingProfile.chloride, 1),
      bicarbonate: roundTo(resultingProfile.bicarbonate, 1),
    },
    contributions,
    alkalinityAsCaCO3: roundTo(alk, 1),
    residualAlkalinity: roundTo(ra, 1),
    estimatedMashPh: roundTo(Math.max(3.5, Math.min(7.0, mashPh)), 2),
    sulfateChlorideRatio: sclRatio,
  };
}
