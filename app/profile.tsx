/**
 * Profile — the identity + history surface (planning/rework/tabs/profile-settings.md).
 * The persistent top-right avatar pushes here from every tab.
 *
 * What ships now:
 *   - Identity header (avatar, name, blurb, element-identity strip — mechanics
 *     only, locked #13). Still read-only; name/blurb/element editing + module
 *     removability are P5's other half and stay deferred.
 *   - Logbook (P2): the full training history, chronological list + Strong-style
 *     calendar, one toggle. Moved off Training — this pass unblocks Training's
 *     history removal (T4). Entry tap → the session detail/editor; swipe deletes.
 *
 * Constitution: Profile renders only things that exist in the world — no badge,
 * rank, score, streak-as-identity, or completion meter. Empty days on the
 * calendar are neutral, never red. Logging never routes *through* Profile
 * (locked #6): the empty-state affordance opens the same element picker the log
 * bar does — Profile owns the read path, not a new write path.
 */
import { useCallback, useMemo, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { User } from 'lucide-react-native';
import {
  Screen,
  Text,
  Card,
  Button,
  ChipSelect,
  DimensionTag,
  SessionCard,
  SwipeToDelete,
  LogbookCalendar,
  ElementPickerSheet,
  BenchmarkDetailSheet,
} from '@/components';
import { useTheme } from '@/theme';
import { ELEMENT_ORDER, type Activity } from '@/lib/activity';
import { useSessionHistory } from '@/hooks/useSessionHistory';
import { useWeightTrend } from '@/hooks/useWeightTrend';
import { useExpenditure } from '@/hooks/useExpenditure';
import { useSettings } from '@/settings/useSettings';
import { reveal } from '@core/stimulus';
import { localDayOf } from '@core/timeline';
import { deleteObservation } from '@/storage/observations';
import { deleteHealthKitExport } from '@/lib/healthkit/writer';
import { listBenchmarks } from '@/storage/benchmarks';
import { summarizeBenchmark } from '@/lib/benchmarkForm';
import { listGear } from '@/storage/gear';
import type { ObservationOf } from '@core/observation';
import type { Benchmark } from '@core/benchmark';
import type { WeightUnit } from '@/lib/units';

type LogbookView = 'list' | 'calendar';

const VIEW_OPTIONS: Array<{ value: LogbookView; label: string }> = [
  { value: 'list', label: 'List' },
  { value: 'calendar', label: 'Calendar' },
];

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { weightUnit } = useSettings();
  const { sessions, reload } = useSessionHistory();
  const [view, setView] = useState<LogbookView>('list');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [benchmarks, setBenchmarks] = useState<Benchmark[] | null>(null);
  const [gearCount, setGearCount] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  // The detail sheet needs these for its outcome faces; nothing else on this
  // screen consumes them (same pattern as benchmarks.tsx).
  const { points: trendPoints } = useWeightTrend();
  const { measured } = useExpenditure(trendPoints);

  const reloadModules = useCallback(async () => {
    // A failed read leaves the module absent (null), never a fabricated zero.
    const [bm, gear] = await Promise.all([
      listBenchmarks().catch(() => null),
      listGear().catch(() => null),
    ]);
    setBenchmarks(bm);
    setGearCount(gear ? gear.length : null);
  }, []);

  // Re-fetch on focus — after the detail/editor saves, or a delete elsewhere.
  useFocusEffect(
    useCallback(() => {
      reload();
      void reloadModules();
    }, [reload, reloadModules])
  );

  const activeBenchmarks = useMemo(
    () => (benchmarks ?? []).filter((b) => b.status === 'active'),
    [benchmarks]
  );
  const pastBenchmarks = useMemo(
    () => (benchmarks ?? []).filter((b) => b.status !== 'active'),
    [benchmarks]
  );

  // The engine's per-session "what this contributed" line (same source as
  // Training/Home) — the card renders it; it never authors its own.
  const contributions = useMemo(() => {
    const out: Record<string, string> = {};
    for (const s of sessions) out[s.id] = reveal(s);
    return out;
  }, [sessions]);

  // Sessions bucketed by their own local civil day, for the calendar.
  const sessionsByDay = useMemo(() => {
    const m = new Map<string, ObservationOf<'session'>[]>();
    for (const s of sessions) {
      const day = localDayOf(s.occurredAt, s.tz);
      const list = m.get(day);
      if (list) list.push(s);
      else m.set(day, [s]);
    }
    return m;
  }, [sessions]);

  const markedDays = useMemo(() => new Set(sessionsByDay.keys()), [sessionsByDay]);

  const removeAndReload = useCallback(
    async (id: string) => {
      await deleteObservation(id);
      // Fire-and-forget: propagates the delete to Apple Health if this session
      // was ever exported; never blocks the local delete.
      void deleteHealthKitExport(id).catch(() => {});
      reload();
    },
    [reload]
  );

  function openActivityLogger(activity: Activity) {
    setPickerVisible(false);
    router.push({ pathname: '/log-session', params: { activity: activity.id } });
  }
  function openBodyLogger() {
    setPickerVisible(false);
    router.push('/training');
  }

  // The day whose entries the calendar view shows beneath the grid.
  const daySessions = selectedDay ? (sessionsByDay.get(selectedDay) ?? []) : [];

  return (
    <Screen scroll>
      {/* ── Identity header ──────────────────────────────────────────────── */}
      <View style={{ alignItems: 'center', gap: theme.spacing[3], marginTop: theme.spacing[2] }}>
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: theme.radius.full,
            borderWidth: 1,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <User size={40} color={theme.colors.textMuted} strokeWidth={1.5} />
        </View>
        <Text variant="displayMd">You</Text>
        <Text variant="body" color={theme.colors.textMuted}>
          Add a blurb in your profile
        </Text>
      </View>

      {/* Element-identity strip — mechanics only (locked #13): names the four
          dimensions, tinted by the element token group. Not a claim or badge. */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: theme.spacing[2],
          marginTop: theme.spacing[4],
        }}
      >
        {ELEMENT_ORDER.map((element) => (
          <DimensionTag key={element} element={element} />
        ))}
      </View>

      {/* ── Logbook (P2) ─────────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: theme.spacing[10],
        }}
      >
        <Text variant="label" color={theme.colors.textMuted}>
          Logbook
        </Text>
        {sessions.length > 0 ? (
          <ChipSelect options={VIEW_OPTIONS} value={view} onChange={setView} />
        ) : null}
      </View>

      {sessions.length === 0 ? (
        <Card style={{ marginTop: theme.spacing[3], gap: theme.spacing[3] }}>
          <Text variant="body" color={theme.colors.textMuted}>
            Nothing logged yet. Every session you log — across all four dimensions —
            lands here, chronological and on a calendar.
          </Text>
          <Button
            label="Log a session"
            variant="outline"
            onPress={() => setPickerVisible(true)}
          />
        </Card>
      ) : view === 'list' ? (
        <View style={{ marginTop: theme.spacing[4], gap: theme.spacing[3] }}>
          {sessions.map((session) => (
            <SwipeToDelete
              key={session.id}
              onDelete={() => removeAndReload(session.id)}
              confirmTitle="Delete session?"
              confirmMessage={`${session.payload.modality} — permanent.`}
            >
              <Pressable
                onPress={() =>
                  router.push({ pathname: '/log-session', params: { editId: session.id } })
                }
                accessibilityRole="button"
                accessibilityLabel={`Open ${session.payload.modality} session`}
              >
                <SessionCard session={session} contribution={contributions[session.id]} />
              </Pressable>
            </SwipeToDelete>
          ))}
        </View>
      ) : (
        <View style={{ marginTop: theme.spacing[4], gap: theme.spacing[4] }}>
          <LogbookCalendar
            markedDays={markedDays}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
          {selectedDay ? (
            <View style={{ gap: theme.spacing[3] }}>
              <Text variant="label" color={theme.colors.textMuted}>
                {selectedDay}
              </Text>
              {daySessions.map((session) => (
                <SwipeToDelete
                  key={session.id}
                  onDelete={() => removeAndReload(session.id)}
                  confirmTitle="Delete session?"
                  confirmMessage={`${session.payload.modality} — permanent.`}
                >
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: '/log-session', params: { editId: session.id } })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${session.payload.modality} session`}
                  >
                    <SessionCard session={session} contribution={contributions[session.id]} />
                  </Pressable>
                </SwipeToDelete>
              ))}
            </View>
          ) : (
            <Text variant="bodySm" color={theme.colors.textMuted}>
              Tap a marked day to see that day's sessions.
            </Text>
          )}
        </View>
      )}

      {/* ── Current benchmarks (P5) ──────────────────────────────────────── */}
      {/* Absent, not empty (Home's rule): the module renders only when the user
          has active benchmarks. Display only — management is the detail sheet. */}
      {activeBenchmarks.length > 0 ? (
        <View style={{ marginTop: theme.spacing[10] }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: theme.spacing[2],
            }}
          >
            <Text variant="label" color={theme.colors.textMuted}>
              Working toward
            </Text>
            {/* Profile is Reflect's only door (locked, Dylan 2026-07-11): the
                browsable entry across active benchmarks. */}
            <Pressable
              onPress={() => router.push('/reflect')}
              accessibilityRole="button"
              accessibilityLabel="Open Reflect"
              hitSlop={8}
            >
              <Text variant="label" color={theme.colors.textMuted}>
                Reflect →
              </Text>
            </Pressable>
          </View>
          <View style={{ gap: theme.spacing[3] }}>
            {activeBenchmarks.map((b) => (
              <BenchmarkRow
                key={b.id}
                benchmark={b}
                weightUnit={weightUnit}
                onPress={() => setDetailId(b.id)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* ── Gear quiver (P5) ─────────────────────────────────────────────── */}
      {/* Preview only: item count + tap-through to the quiver. Absent when
          empty; last-used / wear-vs-threshold read models are P9's track. */}
      {gearCount != null && gearCount > 0 ? (
        <View style={{ marginTop: theme.spacing[10] }}>
          <Text variant="label" color={theme.colors.textMuted} style={{ marginBottom: theme.spacing[2] }}>
            Gear
          </Text>
          <Pressable
            onPress={() => router.push('/gear')}
            accessibilityRole="button"
            accessibilityLabel="Open your gear quiver"
          >
            <Card>
              <Text variant="body">
                {gearCount} {gearCount === 1 ? 'item' : 'items'} in your quiver
              </Text>
              <Text variant="bodySm" color={theme.colors.textMuted}>
                Tap to open →
              </Text>
            </Card>
          </Pressable>
        </View>
      ) : null}

      {/* ── Past benchmarks (P5, profile ⚑1) ─────────────────────────────── */}
      {/* The arc of past goals lives on Profile; tapping one opens its
          Reflect-rendered story (Dylan 2026-07-11). Absent when none. */}
      {pastBenchmarks.length > 0 ? (
        <View style={{ marginTop: theme.spacing[10] }}>
          <Text variant="label" color={theme.colors.textMuted} style={{ marginBottom: theme.spacing[2] }}>
            Past benchmarks
          </Text>
          <View style={{ gap: theme.spacing[3] }}>
            {pastBenchmarks.map((b) => (
              <BenchmarkRow
                key={b.id}
                benchmark={b}
                weightUnit={weightUnit}
                muted
                onPress={() => router.push({ pathname: '/reflect', params: { benchmarkId: b.id } })}
              />
            ))}
          </View>
        </View>
      ) : null}

      <ElementPickerSheet
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        mostRecent={{}}
        onPickActivity={openActivityLogger}
        onPickBody={openBodyLogger}
      />

      <BenchmarkDetailSheet
        benchmarkId={detailId}
        onClose={() => setDetailId(null)}
        onChanged={reloadModules}
        trendPoints={trendPoints}
        measured={measured}
      />

      <View style={{ height: theme.spacing[10] }} />
    </Screen>
  );
}

/** A benchmark in the user's own words + its current standing. Display only. */
function BenchmarkRow({
  benchmark,
  weightUnit,
  muted,
  onPress,
}: {
  benchmark: Benchmark;
  weightUnit: WeightUnit;
  muted?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${benchmark.title}`}>
      <Card style={{ gap: theme.spacing[1] }}>
        <Text variant="body" color={muted ? theme.colors.textMuted : theme.colors.text}>
          {benchmark.title}
        </Text>
        <Text variant="bodySm" color={theme.colors.textMuted}>
          {summarizeBenchmark(benchmark, weightUnit)}
        </Text>
      </Card>
    </Pressable>
  );
}
