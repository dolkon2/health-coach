/**
 * useFoodLog — orchestrates the food-logging flow (Pass 2.5).
 *
 * Thin glue over tested pure logic (lib/foodLog) and the lookup service
 * (lib/foodSearch): debounced search → resolve a candidate (weighed) or a parsed
 * phrase (described) into a FoodItem → accumulate a meal → log it as a foodEntry
 * Observation, or save it as a MealTemplate. All the real decisions (parsing,
 * rollup, composite fidelity, the build) live in the pure, tested functions.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FoodItem } from '@core/observation';
import { blendComposite } from '@core/nutrition/fidelity';
import {
  searchFoods,
  getUsdaFood,
  createDebouncedSearch,
  type FoodCandidate,
} from '@/lib/foodSearch';
import {
  parseDescribed,
  describedExtraction,
  describedQuantityG,
  buildMealLog,
  mealTemplateFrom,
  rollupMacros,
  type MacroRollup,
} from '@/lib/foodLog';
import type { MealTemplate } from '@core/observation';
import { createObservation } from '@/storage/observations';
import { createMealTemplate, listMealTemplates } from '@/storage/mealTemplates';
import { uuidv7 } from '@/lib/id';
import { deviceTz } from '@/lib/date';
import { USDA_API_KEY } from '@/lib/config';

export type FoodLogMode = 'weigh' | 'describe';

export interface FoodLogPreview {
  rollup: MacroRollup;
  fidelity: number; // composite — drives the visual treatment only, never shown as a number
}

export function useFoodLog() {
  const [mode, setMode] = useState<FoodLogMode>('weigh');
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<FoodCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMeals, setSavedMeals] = useState<MealTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(null);

  const refreshSavedMeals = useCallback(async () => {
    try {
      setSavedMeals(await listMealTemplates());
    } catch {
      /* storage may be unavailable in some envs (e.g. web) — leave the list empty */
    }
  }, []);
  useEffect(() => {
    void refreshSavedMeals();
  }, [refreshSavedMeals]);

  const deps = useMemo(() => ({ usdaApiKey: USDA_API_KEY }), []);
  const runSearch = useMemo(
    () => createDebouncedSearch((cands) => { setCandidates(cands); setSearching(false); }, deps),
    [deps]
  );

  // Weigh mode searches as you type (debounced); describe mode resolves on submit.
  useEffect(() => {
    if (mode !== 'weigh') return;
    const q = query.trim();
    if (!q) { setCandidates([]); setSearching(false); return; }
    setSearching(true);
    runSearch(q);
  }, [query, mode, runSearch]);

  const addWeighed = useCallback(
    async (candidate: FoodCandidate, grams: number) => {
      setBusy(true);
      setError(null);
      try {
        const item = await getUsdaFood(
          candidate.foodId,
          { method: 'weighed', quantityG: grams, quantityMethod: 'measured' },
          deps
        );
        if (!item) { setError('Could not load that food.'); return; }
        setItems((xs) => [...xs, item]);
        setDescription((d) => d || candidate.description);
        setQuery('');
        setCandidates([]);
      } finally {
        setBusy(false);
      }
    },
    [deps]
  );

  const addDescribed = useCallback(
    async (text: string) => {
      setBusy(true);
      setError(null);
      try {
        const parsed = parseDescribed(text);
        const cands = await searchFoods(parsed.foodText, deps);
        if (cands.length === 0) { setError(`No match for "${parsed.foodText}".`); return; }
        const item = await getUsdaFood(
          cands[0].foodId,
          {
            method: 'described',
            quantityG: describedQuantityG(parsed),
            quantityMethod: 'estimated',
            extraction: describedExtraction(parsed),
          },
          deps
        );
        if (!item) { setError('Could not load that food.'); return; }
        setItems((xs) => [...xs, item]);
        setDescription((d) => d || text.trim());
      } finally {
        setBusy(false);
      }
    },
    [deps]
  );

  const removeItem = useCallback((index: number) => {
    setItems((xs) => xs.filter((_, i) => i !== index));
  }, []);

  /** Load a saved meal's items to re-log it — the re-log carries its templateId. */
  const loadSavedMeal = useCallback((t: MealTemplate) => {
    setItems(t.canonicalItems);
    setTemplateId(t.id);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setItems([]);
    setDescription('');
    setQuery('');
    setCandidates([]);
    setError(null);
    setTemplateId(null);
  }, []);

  const logMeal = useCallback(async (): Promise<boolean> => {
    if (items.length === 0) return false;
    const obs = buildMealLog(
      {
        description: description || 'Meal',
        items,
        inputMethod: mode === 'weigh' ? 'weighed' : 'described',
        ...(templateId ? { templateId } : {}),
      },
      { id: uuidv7(), now: new Date().toISOString(), tz: deviceTz() }
    );
    await createObservation(obs);
    reset();
    return true;
  }, [items, description, mode, templateId, reset]);

  const saveMeal = useCallback(async (): Promise<boolean> => {
    if (items.length === 0) return false;
    const id = uuidv7();
    await createMealTemplate(mealTemplateFrom(items, { id, now: new Date().toISOString(), name: description }));
    setTemplateId(id); // a subsequent Log records the first occurrence of this template
    void refreshSavedMeals();
    return true;
  }, [items, refreshSavedMeals]);

  const preview: FoodLogPreview | null = items.length
    ? { rollup: rollupMacros(items), fidelity: blendComposite(items) }
    : null;

  return {
    mode, setMode,
    query, setQuery, candidates, searching,
    items, description, setDescription, addWeighed, addDescribed, removeItem,
    savedMeals, loadSavedMeal,
    logMeal, saveMeal, reset, preview, busy, error,
  };
}
