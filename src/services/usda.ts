const BASE = 'https://api.nal.usda.gov/fdc/v1';
const API_KEY = '3k16veE4wrwgFVX09MuiByrijHX1jfVmQG1QA33w';

const NID = { ENERGY: 1008, PROTEIN: 1003, CARBS: 1005, FAT: 1004, FIBER: 1079 };

export type Macros = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
};

export type FoodResult = {
  fdcId: number;
  description: string;
  brandOwner?: string;
  dataType: string;
  servingSizeG: number;
  macrosPer100g: Macros;
};

export async function searchFoods(
  query: string,
  pageSize = 20
): Promise<FoodResult[]> {
  const params = new URLSearchParams({
    api_key: API_KEY,
    query: query.trim(),
    dataType: 'SR Legacy,Branded',
    pageSize: String(pageSize),
  });

  const res = await fetch(`${BASE}/foods/search?${params}`);
  if (!res.ok) throw new Error(`USDA ${res.status}`);
  const data = await res.json();

  return (data.foods ?? []).map(parse).filter(Boolean) as FoodResult[];
}

function parse(raw: Record<string, unknown>): FoodResult | null {
  const nutrients = raw.foodNutrients;
  if (!Array.isArray(nutrients)) return null;

  const macros = extractMacros(nutrients);
  if (macros.kcal === 0 && macros.proteinG === 0 && macros.carbsG === 0) {
    return null;
  }

  return {
    fdcId: raw.fdcId as number,
    description: titleCase(String(raw.description ?? '')),
    brandOwner: raw.brandOwner ? String(raw.brandOwner) : undefined,
    dataType: String(raw.dataType ?? ''),
    servingSizeG: (raw.servingSize as number) ?? 100,
    macrosPer100g: macros,
  };
}

function extractMacros(nutrients: Array<Record<string, unknown>>): Macros {
  const get = (id: number) => {
    const n = nutrients.find((x) => x.nutrientId === id);
    return typeof n?.value === 'number' ? n.value : 0;
  };
  const r1 = (v: number) => Math.round(v * 10) / 10;

  return {
    kcal: Math.round(get(NID.ENERGY)),
    proteinG: r1(get(NID.PROTEIN)),
    carbsG: r1(get(NID.CARBS)),
    fatG: r1(get(NID.FAT)),
    fiberG: get(NID.FIBER) > 0 ? r1(get(NID.FIBER)) : undefined,
  };
}

export function scaleMacros(macros: Macros, grams: number): Macros {
  const f = grams / 100;
  return {
    kcal: Math.round(macros.kcal * f),
    proteinG: Math.round(macros.proteinG * f * 10) / 10,
    carbsG: Math.round(macros.carbsG * f * 10) / 10,
    fatG: Math.round(macros.fatG * f * 10) / 10,
    fiberG: macros.fiberG != null ? Math.round(macros.fiberG * f * 10) / 10 : undefined,
  };
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
