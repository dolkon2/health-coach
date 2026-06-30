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
import type { FoodItem, ObservationOf } from '@core/observation';
import { blendComposite } from '@core/nutrition/fidelity';
import {
  getUsdaFood,
  createDebouncedSearch,
  type FoodCandidate,
} from '@/lib/foodSearch';
import {
  buildMealLog,
  mealTemplateFrom,
  rollupMacros,
  type FoodLogInput,
  type MacroRollup,
} from '@/lib/foodLog';
import { estimateMeal, describedToItems, ESTIMATOR_MODEL } from '@/lib/foodEstimate';
import type { MealTemplate } from '@core/observation';
import { createObservation, getObservationById, updateObservation, getRecentFoodItems, type RecentFoodItem } from '@/storage/observations';
import { createMealTemplate, deleteMealTemplate, listMealTemplates } from '@/storage/mealTemplates';
import { uuidv7 } from '@/lib/id';
import { deviceTz } from '@/lib/date';
import { USDA_API_KEY } from '@/lib/config';

export type FoodLogMode = 'weigh' | 'describe';

export interface FoodLogPreview {
  rollup: MacroRollup;
  fidelity: number; // composite — drives the visual treatment only, never shown as a number
}

export function useFoodLog(editId?: string, defaultOccurredAt?: string) {
  const isEdit = typeof editId === 'string' && editId.length > 0;
  const [original, setOriginal] = useState<ObservationOf<'foodEntry'> | null>(null);
  const [mode, setMode] = useState<FoodLogMode>('weigh');
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<FoodCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [items, setItems] = useState<FoodItem[]>([]);
  const [recents, setRecents] = useState<RecentFoodItem[]>([]);
  const [selectedBasis, setSelectedBasis] = useState<FoodItem | null>(null);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMeals, setSavedMeals] = useState<MealTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(null);
  // When the meal was/will be eaten. Three sources of truth, in priority order:
  //   1. Picker — the user changes it (setOccurredAt below).
  //   2. defaultOccurredAt — caller passes one (Nutrition tab → noon of the
  //      selected past/future day).
  //   3. Modal open time — falls through to "now" when neither above applies.
  // In edit mode the original meal's occurredAt overrides on hydrate.
  const [occurredAt, setOccurredAt] = useState<string>(
    () => defaultOccurredAt ?? new Date().toISOString()
  );

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

  // Edit mode: hydrate the editor from the meal being edited (items, name, method).
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    getObservationById(editId!)
      .then((obs) => {
        if (cancelled || !obs || obs.kind !== 'foodEntry') return;
        const m = obs as ObservationOf<'foodEntry'>;
        setOriginal(m);
        setItems(m.payload.items);
        setDescription(m.payload.description);
        setMode(m.payload.inputMethod === 'described' ? 'describe' : 'weigh');
        setTemplateId(m.payload.templateId ?? null);
        setOccurredAt(m.occurredAt);
      })
      .catch(() => setError('Could not load meal.'));
    return () => {
      cancelled = true;
    };
  }, [editId, isEdit]);

  const deps = useMemo(() => ({ usdaApiKey: USDA_API_KEY }), []);
  const runSearch = useMemo(
    () => createDebouncedSearch((cands) => { setCandidates(cands); setSearching(false); }, deps),
    [deps]
  );

  // Weigh mode searches as you type (debounced); describe mode resolves on submit.
  useEffect(() => {
    if (mode !== 'weigh') return;
    const q = query.trim();
    if (!q) { setCandidates([]); setRecents([]); setSearching(false); return; }
    setSearching(true);
    runSearch(q);
    let cancelled = false;
    getRecentFoodItems(q).then((r) => { if (!cancelled) setRecents(r); }).catch(() => {});
    return () => { cancelled = true; };
  }, [query, mode, runSearch]);

  /** Pre-fetch a candidate's macros (at 100 g) when it's selected, so the amount
   *  field can preview "what this portion gives you" live, before adding. */
  const selectFood = useCallback(
    async (candidate: FoodCandidate) => {
      setSelectedBasis(null);
      const basis = await getUsdaFood(
        candidate.foodId,
        { method: 'weighed', quantityG: 100, quantityMethod: 'measured' },
        deps
      );
      setSelectedBasis(basis);
    },
    [deps]
  );

  const addRecent = useCallback(
    (item: FoodItem) => {
      setItems((xs) => [...xs, item]);
      setQuery('');
      setCandidates([]);
      setRecents([]);
    },
    []
  );

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
      const trimmed = text.trim();
      if (!trimmed) return;
      setBusy(true);
      setError(null);
      try {
        // Claude estimates the whole meal directly — segments it into distinct
        // foods AND estimates each (calories + macros + portion), no USDA lookup.
        // estimateMeal returns [] on no key / offline / timeout / any failure;
        // describedToItems then yields ONE keyless row with null macros from the
        // regex parse, which the user fills in — so the logger works without a key.
        const estimates = await estimateMeal(trimmed);
        const newItems = describedToItems(estimates, trimmed);
        if (newItems.length === 0) {
          setError(`Couldn't read a food from "${text}".`);
          return;
        }
        setItems((xs) => [...xs, ...newItems]);
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const removeItem = useCallback((index: number) => {
    setItems((xs) => xs.filter((_, i) => i !== index));
  }, []);

  /** Load a saved meal's items to re-log it — the re-log carries its templateId and
   *  inherits the saved name (so a re-log reads as its name, not the generic "Meal"). */
  const loadSavedMeal = useCallback((t: MealTemplate) => {
    setItems(t.canonicalItems);
    setTemplateId(t.id);
    setDescription(t.name ?? '');
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
    const input: FoodLogInput = {
      description: description || 'Meal',
      items,
      inputMethod: mode === 'weigh' ? 'weighed' : 'described',
      // Keyless items are LLM estimates — stamp the model so the meal's source
      // reads { type: 'estimate', modelVersion } instead of a fake foodapi lineage.
      ...(items.some((it) => it.foodId == null) ? { estimateModel: ESTIMATOR_MODEL } : {}),
      ...(templateId ? { templateId } : {}),
    };
    if (isEdit && original) {
      // Rebuild macros + fidelity from the edited items. Identity (id, tz,
      // loggedAt) carries from the original; occurredAt may have been
      // changed via the picker, so it comes from state.
      const obs = buildMealLog(input, { id: original.id, now: occurredAt, tz: original.tz });
      await updateObservation({ ...obs, loggedAt: original.loggedAt });
    } else {
      const obs = buildMealLog(input, { id: uuidv7(), now: occurredAt, tz: deviceTz() });
      await createObservation(obs);
    }
    reset();
    return true;
  }, [items, description, mode, templateId, isEdit, original, occurredAt, reset]);

  const deleteSavedMeal = useCallback(async (id: string): Promise<void> => {
    await deleteMealTemplate(id);
    void refreshSavedMeals();
  }, [refreshSavedMeals]);

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
    query, setQuery, candidates, recents, searching,
    items, description, setDescription, addRecent, addWeighed, addDescribed, removeItem,
    selectedBasis, selectFood,
    savedMeals, loadSavedMeal, deleteSavedMeal,
    occurredAt, setOccurredAt,
    logMeal, saveMeal, reset, preview, busy, error,
    isEdit,
  };
}
