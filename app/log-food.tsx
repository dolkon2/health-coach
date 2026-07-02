/**
 * Log Food — a modal from Today (Pass 2.5).
 *
 * Two input methods the free data layer fully supports today: **Search & weigh**
 * (USDA/OFF search → pick → enter the mass; high fidelity) and **Describe**
 * (type "8 oz ribeye" → parse → DB match; fidelity from what the parser got).
 * Foods accumulate into a meal you can Log or Save as a template.
 *
 * Layout: saved meals are a persistent horizontal row at the top (re-log a
 * template in one tap). The Log / Save buttons sit in a sticky footer so the
 * commit action is always one tap away regardless of scroll position. Fidelity
 * shows only as a visual treatment — the hero block's opacity and a dot marker,
 * never a number. All the logic lives in the tested lib/foodLog +
 * hooks/useFoodLog; this screen is a thin consumer.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, View, Pressable, ActivityIndicator, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Text, Button, Card, Field, ChipSelect, FidelityTreatment, type ChipOption } from '@/components';
import { useTheme } from '@/theme';
import { useSettings } from '@/settings/useSettings';
import { useFoodLog, type FoodLogMode } from '@/hooks/useFoodLog';
import { resolveBarcode, BARCODE_DEFAULT_G } from '@/lib/foodBarcode';
import { noonOfLocalDate } from '@/lib/date';
import { heroNumber, fidelityTreatment, mealItemsLabel, itemMacroSummary, scaleMacros, recomputeKcal, type NutritionFocus } from '@/lib/foodLog';
import type { FoodCandidate } from '@/lib/foodSearch';
import type { FoodItem, MealTemplate } from '@core/observation';

const MODE_OPTIONS: ChipOption<FoodLogMode>[] = [
  { value: 'weigh', label: 'Search & weigh' },
  { value: 'describe', label: 'Describe' },
  { value: 'scan', label: 'Scan' },
  { value: 'photo', label: 'Photo' },
];
// A scanned UPC is near-exact on identity; the honesty lives in the portion.
// "As labeled" keeps the declared basis (quantityMethod 'package'); "I estimated
// it" records an eyeballed amount (quantityMethod 'estimated').
type PortionBasis = 'labeled' | 'estimated';
const PORTION_OPTIONS: ChipOption<PortionBasis>[] = [
  { value: 'labeled', label: 'As labeled' },
  { value: 'estimated', label: 'I estimated it' },
];
const FOCUS_OPTIONS: ChipOption<NutritionFocus>[] = [
  { value: 'calories', label: 'Calories' },
  { value: 'protein', label: 'Protein' },
  { value: 'carbs', label: 'Carbs' },
  { value: 'fat', label: 'Fat' },
];

const macroStr = (v: number | null | undefined): string => (v == null ? '—' : String(Math.round(v)));

function Macro({ label, value }: { label: string; value: number | null | undefined }) {
  const theme = useTheme();
  return (
    <View>
      <Text variant="data">{macroStr(value)}</Text>
      <Text variant="label" color={theme.colors.textSecondary}>{label}</Text>
    </View>
  );
}

/** Field <-> nullable-number bridges for the estimate editor. Empty = null
 *  (honesty: a blank macro is "not captured", never 0). */
const numToField = (v: number | null | undefined): string => (v == null ? '' : String(v));
const fieldToNum = (s: string): number | null => {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/**
 * EstimateItemEditor — inline editor for one keyless estimate row (Decision E).
 * Reuses Field for every value. Editing a macro recomputes calories (4/4/9 +
 * alcohol) ONLY when protein, carbs, and fat are all present — a blank macro
 * stays null and never zero-fills the calorie total (null ≠ 0). Mirrors the
 * Search & weigh detail pane; commits on Done.
 */
function EstimateItemEditor({
  item,
  onSave,
  onRemove,
}: {
  item: FoodItem;
  onSave: (patch: Partial<FoodItem>) => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const [name, setName] = useState(item.description ?? '');
  const [portion, setPortion] = useState(item.portionText ?? '');
  const [kcal, setKcal] = useState(numToField(item.kcal));
  const [protein, setProtein] = useState(numToField(item.proteinG));
  const [carbs, setCarbs] = useState(numToField(item.carbsG));
  const [fat, setFat] = useState(numToField(item.fatG));

  // Recompute calories from the edited macros — guarded so a blank macro never
  // becomes a fake 0 in the total. When any macro is blank, calories stay as set.
  const recompute = (p: string, c: string, f: string) => {
    const k = recomputeKcal({
      proteinG: fieldToNum(p),
      carbsG: fieldToNum(c),
      fatG: fieldToNum(f),
      alcoholG: item.alcoholG,
    });
    if (k != null) setKcal(String(k));
  };

  // The macros' implied calories (Atwater 4/4/9 + alcohol). Two roles:
  //   1. a hazed placeholder while the calorie field is empty — a live preview of
  //      "what the macros add up to";
  //   2. the value committed on Done when calories is left blank (see onSave) — a
  //      typed number is authoritative ("fact"), a blank field falls back to this.
  // null when a macro is blank, so a genuinely unknown calorie stays null — never a
  // fake 0; the ghost simply doesn't show rather than inventing a number.
  const derivedKcal = recomputeKcal({
    proteinG: fieldToNum(protein),
    carbsG: fieldToNum(carbs),
    fatG: fieldToNum(fat),
    alcoholG: item.alcoholG,
  });

  return (
    <Card raised style={{ gap: theme.spacing[3] }}>
      <Field label="Food" value={name} onChangeText={setName} keyboardType="default" />
      <Field label="Portion" value={portion} onChangeText={setPortion} placeholder="e.g. 2 eggs" keyboardType="default" />
      <View style={{ flexDirection: 'row', gap: theme.spacing[4] }}>
        <Field
          label="Calories"
          value={kcal}
          onChangeText={setKcal}
          placeholder={derivedKcal != null ? String(derivedKcal) : undefined}
          style={{ flex: 1 }}
        />
        <Field
          label="Protein"
          value={protein}
          onChangeText={(v) => { setProtein(v); recompute(v, carbs, fat); }}
          suffix="g"
          style={{ flex: 1 }}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: theme.spacing[4] }}>
        <Field
          label="Carbs"
          value={carbs}
          onChangeText={(v) => { setCarbs(v); recompute(protein, v, fat); }}
          suffix="g"
          style={{ flex: 1 }}
        />
        <Field
          label="Fat"
          value={fat}
          onChangeText={(v) => { setFat(v); recompute(protein, carbs, v); }}
          suffix="g"
          style={{ flex: 1 }}
        />
      </View>
      <Text variant="bodySm" color={theme.colors.textSecondary}>
        {itemMacroSummary({
          kcal: fieldToNum(kcal),
          proteinG: fieldToNum(protein),
          carbsG: fieldToNum(carbs),
          fatG: fieldToNum(fat),
        })}
      </Text>
      <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
        <Button
          label="Done"
          onPress={() =>
            onSave({
              description: name.trim() || item.description,
              portionText: portion.trim() || undefined,
              // Empty calories commit the macro-derived value (the hazed ghost); a
              // typed number wins ("fact"). Stays null only when macros can't imply
              // a value (derivedKcal null) — a real unknown, never a fake 0.
              kcal: fieldToNum(kcal) ?? derivedKcal,
              proteinG: fieldToNum(protein),
              carbsG: fieldToNum(carbs),
              fatG: fieldToNum(fat),
            })
          }
          style={{ flex: 1 }}
        />
        <Button label="Remove" variant="outline" onPress={onRemove} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

/**
 * SavedMealsRow — horizontal row of meal-template cards above the search field.
 *
 * Tapping a card loads its items into the in-flight meal; we gate visibility on
 * `items.length === 0` so a tap can't silently discard a meal in progress (the
 * loadSavedMeal call replaces `items`). Hidden in edit mode — when editing one
 * meal, re-logging a different template isn't a sensible action.
 */
function SavedMealsRow({
  saved,
  onPick,
  onDelete,
}: {
  saved: MealTemplate[];
  onPick: (t: MealTemplate) => void;
  onDelete: (id: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing[2] }}>
      <Text variant="label" color={theme.colors.textSecondary}>Saved meals</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing[3], paddingRight: theme.spacing[4] }}
      >
        {saved.map((t) => {
          const count = t.canonicalItems.length;
          const label = t.name || mealItemsLabel(t.canonicalItems) || `${count} item${count === 1 ? '' : 's'}`;
          return (
            <Pressable key={t.id} onPress={() => onPick(t)} accessibilityRole="button">
              <Card style={{ width: 160 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>{label}</Text>
                  <Pressable
                    onPress={(e) => { e.stopPropagation(); onDelete(t.id); }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Delete saved meal"
                  >
                    <Text variant="bodySm" color={theme.colors.textMuted}>✕</Text>
                  </Pressable>
                </View>
                <Text variant="bodySm" color={theme.colors.textMuted}>
                  {count} item{count === 1 ? '' : 's'}
                </Text>
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function LogFood() {
  const theme = useTheme();
  const router = useRouter();
  const settings = useSettings();
  const insets = useSafeAreaInsets();
  const { editId, date: dateParam } = useLocalSearchParams<{ editId?: string; date?: string }>();
  // When the Nutrition tab opens this screen from a past or future day,
  // it passes ?date=YYYY-MM-DD — default the meal's occurredAt to noon of
  // that day. Today's "Log food" passes no `date`, so this stays undefined
  // and useFoodLog falls through to "now" (preserves Pass 1 behavior).
  const defaultOccurredAt = useMemo(
    () => (dateParam ? noonOfLocalDate(dateParam) : undefined),
    [dateParam]
  );
  const fl = useFoodLog(editId, defaultOccurredAt);
  const scrollRef = useRef<ScrollView>(null);
  const [focus, setFocus] = useState<NutritionFocus>(settings.nutritionFocus);
  const [grams, setGrams] = useState('');
  const [selected, setSelected] = useState<FoodCandidate | null>(null);
  const [describeText, setDescribeText] = useState('');
  // Android renders DateTimePicker as a modal opened on tap; iOS uses the
  // inline compact button. The state only gates the Android branch.
  const [showPicker, setShowPicker] = useState(false);
  // Which estimate row is open in the inline editor (Decision E), or null.
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Scan mode (Pass 2.7b): camera → OFF lookup → confirm portion → add. The
  // scanned code drives one lookup; the resolution card lets the user set the
  // portion before adding, honestly recording whether it was labeled or eyeballed.
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<'idle' | 'resolving' | 'found' | 'not-found'>('idle');
  const [scanProduct, setScanProduct] = useState<FoodItem | null>(null); // basis @ 100 g, for the live preview
  const [barcodeGrams, setBarcodeGrams] = useState(String(BARCODE_DEFAULT_G));
  const [portionBasis, setPortionBasis] = useState<PortionBasis>('labeled');
  // The product's serving size (grams, or a drink's ml), or null when OFF has
  // none. When known, the user can log in servings (e.g. 1.5 drinks) and the
  // grams amount follows; the meal row then reads "1.5 servings".
  const [scanServingAmount, setScanServingAmount] = useState<number | null>(null);
  const [servings, setServings] = useState('1');
  // Single-fire guard: CameraView fires onBarcodeScanned continuously; latch on
  // the first read so one scan triggers exactly one lookup until we reset.
  const scanningRef = useRef(false);

  const resetScan = useCallback(() => {
    scanningRef.current = false;
    setScannedCode(null);
    setScanStatus('idle');
    setScanProduct(null);
    setBarcodeGrams(String(BARCODE_DEFAULT_G));
    setPortionBasis('labeled');
    setScanServingAmount(null);
    setServings('1');
  }, []);

  const onBarcode = useCallback(async (code: string) => {
    if (scanningRef.current) return;
    scanningRef.current = true;
    setScannedCode(code);
    setScanStatus('resolving');
    // OFF needs no key, so no deps — matches the app's keyless barcode path.
    const res = await resolveBarcode(code, { grams: BARCODE_DEFAULT_G, method: 'package' });
    if (res.status === 'found') {
      setScanProduct(res.item);
      // Default the amount to one labeled serving (grams, or a drink's ml
      // quantity); fall back to the 100 g basis when the label states none.
      setScanServingAmount(res.servingAmount);
      setServings('1');
      setBarcodeGrams(String(res.servingAmount ?? BARCODE_DEFAULT_G));
      setScanStatus('found');
    } else {
      setScanStatus('not-found');
    }
  }, []);

  // Servings ↔ grams stay in sync while the product has a known serving size,
  // so the user can log by serving count and see the resulting amount/macros.
  const onChangeServings = useCallback((s: string) => {
    setServings(s);
    const n = Number(s);
    if (scanServingAmount && Number.isFinite(n) && n > 0) {
      setBarcodeGrams(String(Math.round(scanServingAmount * n)));
    }
  }, [scanServingAmount]);

  const onChangeBarcodeGrams = useCallback((g: string) => {
    setBarcodeGrams(g);
    const n = Number(g);
    if (scanServingAmount && Number.isFinite(n) && n > 0) {
      setServings(String(Math.round((n / scanServingAmount) * 100) / 100));
    }
  }, [scanServingAmount]);

  // Photo mode (Pass 2.8a): camera → capture a still → Claude estimates the plate
  // → editable keyless rows. No new native module: expo-camera's takePictureAsync
  // returns base64 directly, which Claude's API accepts. Photo fidelity is LOW by
  // nature (~0.35), so every resulting row renders dashed and stays editable.
  const cameraRef = useRef<CameraView>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  // Once the meal has rows, the live camera collapses to a button so the results
  // are the focus; tapping it re-opens the camera to add another plate.
  const [cameraOpen, setCameraOpen] = useState(false);

  const resetPhoto = useCallback(() => {
    setPhotoUri(null);
  }, []);

  const onCapture = useCallback(async () => {
    const cam = cameraRef.current;
    if (!cam) return;
    // quality ~0.4: vision accuracy doesn't need full-res, and it keeps the base64
    // payload (and token cost) sane. (A later hardening pass adds image-manipulator
    // downscaling + secure-store for the key — deferred here, no new native module.)
    const shot = await cam.takePictureAsync({ base64: true, quality: 0.4 });
    if (!shot?.base64) return;
    // Capturing IS the commit: show the still, then estimate it with no extra tap.
    // addPhoto returns [] → one blank manual row on no key / offline / failure, so
    // the logger keeps working; either way the estimated rows land in the list
    // below. Bad shot? Remove those rows and shoot again.
    setPhotoUri(shot.uri);
    await fl.addPhoto(shot.base64, 'image/jpeg');
    resetPhoto();
    setCameraOpen(false);
  }, [fl.addPhoto, resetPhoto]);

  const onAddBarcode = useCallback(async () => {
    const g = Number(barcodeGrams);
    if (!scannedCode || !(g > 0)) return;
    const res = await resolveBarcode(scannedCode, { grams: g, method: portionBasis === 'estimated' ? 'estimated' : 'package' });
    if (res.status !== 'found') return;
    // When logged by serving count, show it as "1.5 servings" in the meal row
    // (display-only); otherwise the row falls back to the logged grams.
    const sv = Number(servings);
    const item = scanServingAmount && Number.isFinite(sv) && sv > 0
      ? { ...res.item, portionText: `${sv} serving${sv === 1 ? '' : 's'}` }
      : res.item;
    fl.addBarcode(item);
    resetScan();
  }, [scannedCode, barcodeGrams, portionBasis, servings, scanServingAmount, fl.addBarcode, resetScan]);

  // Dismissal that survives a missing back-stack (e.g. when the screen was
  // deep-linked or opened with no parent route) — fall back to the Today tab
  // instead of dispatching a GO_BACK action no navigator can handle.
  const dismiss = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const onLog = async () => {
    if (await fl.logMeal()) dismiss();
  };

  const onPickSavedMeal = useCallback((t: MealTemplate) => {
    fl.loadSavedMeal(t);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [fl.loadSavedMeal]);

  const showSavedMealsRow = !fl.isEdit && fl.savedMeals.length > 0 && fl.items.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <Stack.Screen
        options={{
          title: fl.isEdit ? 'Edit meal' : 'Log food',
          // Explicit dismiss affordance — the modal swipe-down can be missed,
          // and a corrupted nav stack would leave a back-gesture stranded.
          headerLeft: () => (
            <Pressable onPress={dismiss} accessibilityRole="button" hitSlop={12}>
              <Text variant="body" color={theme.colors.sandstone}>Cancel</Text>
            </Pressable>
          ),
        }}
      />

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: theme.spacing[6], paddingTop: theme.spacing[4], paddingBottom: theme.spacing[4] }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {showSavedMealsRow ? (
          <>
            <SavedMealsRow saved={fl.savedMeals} onPick={onPickSavedMeal} onDelete={fl.deleteSavedMeal} />
            <View style={{ height: theme.spacing[4] }} />
          </>
        ) : null}

        <ChipSelect options={MODE_OPTIONS} value={fl.mode} columns={2} onChange={(m) => { fl.setMode(m); setSelected(null); setEditingIndex(null); resetScan(); resetPhoto(); }} />
        <View style={{ height: theme.spacing[4] }} />

        {fl.mode === 'weigh' ? (
          <View style={{ gap: theme.spacing[3] }}>
            <Field
              label="Search a food"
              value={fl.query}
              onChangeText={(t) => { fl.setQuery(t); setSelected(null); }}
              placeholder="e.g. cheddar cheese"
              keyboardType="default"
              autoFocus
            />
            {fl.searching ? <Text variant="bodySm" color={theme.colors.textMuted}>Searching…</Text> : null}
            {!selected && fl.recents.length > 0 && (
              <View style={{ gap: theme.spacing[2] }}>
                <Text variant="label" color={theme.colors.textSecondary}>Recent</Text>
                {fl.recents.map((r) => (
                  <Pressable key={`recent:${r.item.foodId}`} onPress={() => fl.addRecent(r.item)}>
                    <Card>
                      <Text variant="body">{r.item.description} · {Math.round(r.item.quantity)} g</Text>
                    </Card>
                  </Pressable>
                ))}
              </View>
            )}
            {!selected &&
              fl.candidates.map((c) => (
                <Pressable key={`${c.sourceDb}:${c.foodId}`} onPress={() => { setSelected(c); fl.selectFood(c); }}>
                  <Card>
                    <Text variant="body">{c.description}</Text>
                    {c.brand ? <Text variant="bodySm" color={theme.colors.textMuted}>{c.brand}</Text> : null}
                  </Card>
                </Pressable>
              ))}
            {selected ? (
              <Card raised style={{ gap: theme.spacing[3] }}>
                <Text variant="body">{selected.description}</Text>
                <Field label="Amount" value={grams} onChangeText={setGrams} suffix="g" autoFocus />
                {/* Live "what this portion gives you" — updates as you type the amount. */}
                {Number(grams) > 0 && fl.selectedBasis ? (
                  <Text variant="data" color={theme.colors.textSecondary}>
                    {itemMacroSummary(scaleMacros(fl.selectedBasis, Number(grams)))}
                  </Text>
                ) : null}
                <Button
                  label="Add to meal"
                  onPress={async () => {
                    const g = Number(grams);
                    if (g > 0) { await fl.addWeighed(selected, g); setSelected(null); setGrams(''); }
                  }}
                  disabled={!(Number(grams) > 0)}
                  loading={fl.busy}
                />
              </Card>
            ) : null}
          </View>
        ) : fl.mode === 'scan' ? (
          <View style={{ gap: theme.spacing[3] }}>
            {!permission ? (
              <Text variant="bodySm" color={theme.colors.textMuted}>Checking camera permission…</Text>
            ) : !permission.granted ? (
              <View style={{ gap: theme.spacing[3] }}>
                <Text variant="bodySm" color={theme.colors.textMuted}>
                  Scanning needs the camera. Nothing is recorded until you add a food to the meal.
                </Text>
                <Button label="Allow camera" onPress={requestPermission} />
              </View>
            ) : scanStatus === 'found' && scanProduct ? (
              <Card raised style={{ gap: theme.spacing[3] }}>
                <Text variant="body">{scanProduct.description ?? 'Scanned product'}</Text>
                {/* Servings input when the label declares a serving size — type
                    1.5 for a serving and a half; the amount below follows. */}
                {scanServingAmount != null ? (
                  <Field label="Servings" value={servings} onChangeText={onChangeServings} autoFocus />
                ) : null}
                <Field
                  label="Amount"
                  value={barcodeGrams}
                  onChangeText={onChangeBarcodeGrams}
                  suffix="g"
                  autoFocus={scanServingAmount == null}
                />
                {/* Live "what this portion gives you" — updates as you type the amount. */}
                {Number(barcodeGrams) > 0 ? (
                  <Text variant="data" color={theme.colors.textSecondary}>
                    {itemMacroSummary(scaleMacros(scanProduct, Number(barcodeGrams)))}
                  </Text>
                ) : null}
                <ChipSelect options={PORTION_OPTIONS} value={portionBasis} onChange={setPortionBasis} />
                <Button
                  label="Add to meal"
                  onPress={onAddBarcode}
                  disabled={!(Number(barcodeGrams) > 0)}
                />
                <Pressable onPress={resetScan} accessibilityRole="button" hitSlop={6}>
                  <Text variant="bodySm" color={theme.colors.sandstone}>Scan another</Text>
                </Pressable>
              </Card>
            ) : scanStatus === 'not-found' ? (
              <View style={{ gap: theme.spacing[3] }}>
                <Text variant="bodySm" color={theme.colors.text}>
                  No match for that barcode. You can describe it instead — no number is ever invented.
                </Text>
                <Button label="Describe it instead" onPress={() => { resetScan(); fl.setMode('describe'); }} />
                <Pressable onPress={resetScan} accessibilityRole="button" hitSlop={6}>
                  <Text variant="bodySm" color={theme.colors.sandstone}>Scan again</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: theme.spacing[3] }}>
                <View
                  style={{
                    width: '100%',
                    aspectRatio: 3 / 4,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    overflow: 'hidden',
                  }}
                >
                  <CameraView
                    style={{ flex: 1 }}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ['ean13', 'upc_a', 'ean8'] }}
                    onBarcodeScanned={scanStatus === 'idle' ? (r) => { void onBarcode(r.data); } : undefined}
                  />
                </View>
                {scanStatus === 'resolving' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
                    <ActivityIndicator color={theme.colors.sandstone} />
                    <Text variant="bodySm" color={theme.colors.textMuted}>Looking up {scannedCode}…</Text>
                  </View>
                ) : (
                  <Text variant="bodySm" color={theme.colors.textMuted}>Point the camera at a product barcode.</Text>
                )}
              </View>
            )}
          </View>
        ) : fl.mode === 'photo' ? (
          <View style={{ gap: theme.spacing[3] }}>
            {!permission ? (
              <Text variant="bodySm" color={theme.colors.textMuted}>Checking camera permission…</Text>
            ) : !permission.granted ? (
              <View style={{ gap: theme.spacing[3] }}>
                <Text variant="bodySm" color={theme.colors.textMuted}>
                  A photo needs the camera. Nothing is recorded until you log the meal.
                </Text>
                <Button label="Allow camera" onPress={requestPermission} />
              </View>
            ) : photoUri ? (
              // Captured — preview the still, then estimate or retake.
              <View style={{ gap: theme.spacing[3] }}>
                <Image
                  source={{ uri: photoUri }}
                  style={{ width: '100%', aspectRatio: 1, borderRadius: 12 }}
                  resizeMode="cover"
                />
                {fl.busy ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] }}>
                    <ActivityIndicator color={theme.colors.sandstone} />
                    <Text variant="bodySm" color={theme.colors.textMuted}>Estimating the plate…</Text>
                  </View>
                ) : (
                  <Pressable onPress={resetPhoto} accessibilityRole="button" hitSlop={6}>
                    <Text variant="bodySm" color={theme.colors.sandstone}>Retake</Text>
                  </Pressable>
                )}
              </View>
            ) : (fl.items.length === 0 || cameraOpen) ? (
              // Live camera — point at the plate and capture a still.
              <View style={{ gap: theme.spacing[3] }}>
                <View
                  style={{
                    width: '100%',
                    aspectRatio: 1,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    overflow: 'hidden',
                  }}
                >
                  <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
                </View>
                <Button label="Take photo" onPress={onCapture} />
                <Text variant="bodySm" color={theme.colors.textMuted}>
                  Photo estimates are rough — every item stays editable, and macros left blank stay unknown, never zero.
                </Text>
              </View>
            ) : (
              // Meal already has rows — collapse the camera; one tap brings it back.
              <Button label="Take another photo" variant="outline" onPress={() => setCameraOpen(true)} />
            )}
          </View>
        ) : (
          <View style={{ gap: theme.spacing[3] }}>
            <Field
              label="Describe a food"
              value={describeText}
              onChangeText={setDescribeText}
              placeholder={'e.g. "8 oz ribeye"'}
              keyboardType="default"
              autoFocus
            />
            <Button
              label="Add to meal"
              onPress={async () => { if (describeText.trim()) { await fl.addDescribed(describeText); setDescribeText(''); } }}
              disabled={!describeText.trim()}
              loading={fl.busy}
            />
          </View>
        )}

        {fl.error ? (
          <Text variant="bodySm" color={theme.colors.clay} style={{ marginTop: theme.spacing[2] }}>{fl.error}</Text>
        ) : null}

        {fl.preview ? (
          <Card style={{ marginTop: theme.spacing[5], gap: theme.spacing[3] }}>
            {/* Optional meal name. Blank by default — the display layer falls back
                to "First item + N more" via mealDisplayName, so an unnamed meal
                never masquerades as one ingredient on the cards. */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing[2] }}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Name this meal"
                  value={fl.description}
                  onChangeText={fl.setDescription}
                  placeholder="optional"
                />
              </View>
              <View style={{ paddingBottom: theme.spacing[2] }}>
                <FidelityTreatment fidelity={fl.preview.fidelity} />
              </View>
            </View>

            {/* When? — defaults to now / noon of the chosen day / original eaten time
                (edit mode), adjustable via the native picker. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] }}>
              <Text variant="label" color={theme.colors.textSecondary}>When?</Text>
              {Platform.OS === 'ios' ? (
                <DateTimePicker
                  value={new Date(fl.occurredAt)}
                  mode="datetime"
                  display="compact"
                  themeVariant="dark"
                  onChange={(_e, d) => {
                    if (d) fl.setOccurredAt(d.toISOString());
                  }}
                />
              ) : (
                <>
                  <Pressable onPress={() => setShowPicker(true)} accessibilityRole="button">
                    <Text variant="body">
                      {new Date(fl.occurredAt).toLocaleString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                  </Pressable>
                  {showPicker ? (
                    <DateTimePicker
                      value={new Date(fl.occurredAt)}
                      mode="datetime"
                      display="default"
                      onChange={(_e, d) => {
                        setShowPicker(false);
                        if (d) fl.setOccurredAt(d.toISOString());
                      }}
                    />
                  ) : null}
                </>
              )}
            </View>

            <ChipSelect options={FOCUS_OPTIONS} value={focus} onChange={setFocus} />

            {/* Hero + macros treated by fidelity opacity: solid data looks solid, rough looks rough. */}
            <View style={{ opacity: fidelityTreatment(fl.preview.fidelity).opacity, gap: theme.spacing[3] }}>
              <View>
                <Text variant="displayLg" style={{ fontSize: 40, lineHeight: 48 }}>{macroStr(heroNumber(fl.preview.rollup, focus).value)}</Text>
                <Text variant="label" color={theme.colors.textSecondary}>
                  {heroNumber(fl.preview.rollup, focus).label} ({heroNumber(fl.preview.rollup, focus).unit})
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: theme.spacing[5] }}>
                <Macro label="Cal" value={fl.preview.rollup.kcal} />
                <Macro label="P" value={fl.preview.rollup.proteinG} />
                <Macro label="C" value={fl.preview.rollup.carbsG} />
                <Macro label="F" value={fl.preview.rollup.fatG} />
              </View>
            </View>

            {fl.items.map((it, i) => {
              const isEstimate = it.foodId == null;
              if (isEstimate && editingIndex === i) {
                return (
                  <EstimateItemEditor
                    key={i}
                    item={it}
                    onSave={(patch) => { fl.updateItem(i, patch); setEditingIndex(null); }}
                    onRemove={() => { fl.removeItem(i); setEditingIndex(null); }}
                  />
                );
              }
              // Per-row fidelity opacity: an estimate looks rough, a weighed item solid.
              return (
                <View key={i} style={{ gap: 2, opacity: fidelityTreatment(it.fidelity).opacity }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing[3] }}>
                    <Text variant="bodySm" color={theme.colors.text} style={{ flex: 1 }} numberOfLines={1}>
                      {it.description ? `${it.description} · ` : ''}{it.portionText ?? `${Math.round(it.quantity)} g`}
                    </Text>
                    {isEstimate ? (
                      <Pressable onPress={() => setEditingIndex(i)} accessibilityRole="button" hitSlop={6}>
                        <Text variant="bodySm" color={theme.colors.sandstone}>Edit</Text>
                      </Pressable>
                    ) : null}
                    <Pressable onPress={() => { fl.removeItem(i); setEditingIndex(null); }} accessibilityRole="button" hitSlop={6}>
                      <Text variant="bodySm" color={theme.colors.clay}>Remove</Text>
                    </Pressable>
                  </View>
                  <Text variant="bodySm" color={theme.colors.textSecondary}>{itemMacroSummary(it)}</Text>
                </View>
              );
            })}
          </Card>
        ) : null}
      </ScrollView>

      {/* Sticky CTA — the commit action is always one tap away. Only renders
          when there's something to log; the hairline border + bg color keep it
          legible against the scroll content underneath. */}
      {fl.preview ? (
        <View
          style={{
            paddingHorizontal: theme.spacing[6],
            paddingTop: theme.spacing[3],
            paddingBottom: insets.bottom + theme.spacing[3],
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
            backgroundColor: theme.colors.bg,
          }}
        >
          {fl.isEdit ? (
            <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
              <Button label="Save changes" onPress={onLog} style={{ flex: 1 }} />
              <Button label="Save as meal" variant="outline" onPress={() => fl.saveMeal()} style={{ flex: 1 }} />
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: theme.spacing[3] }}>
              <Button label="Log meal" onPress={onLog} style={{ flex: 1 }} />
              <Button label="Save meal" variant="outline" onPress={() => fl.saveMeal()} style={{ flex: 1 }} />
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}
