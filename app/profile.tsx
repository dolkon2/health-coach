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
  BenchmarkGroupSheet,
} from '@/components';
import { useTheme } from '@/theme';
import { ELEMENT_ORDER, type Activity } from '@/lib/activity';
import { dayNavLabel, todayLocalDate } from '@/lib/date';
import { useSessionHistory } from '@/hooks/useSessionHistory';
import { useWeightTrend } from '@/hooks/useWeightTrend';
import { useExpenditure } from '@/hooks/useExpenditure';
import { useSettings } from '@/settings/useSettings';
import { reveal } from '@core/stimulus';
import { localDayOf } from '@core/timeline';
import { deleteObservation } from '@/storage/observations';
import { deleteHealthKitExport } from '@/lib/healthkit/writer';
import { listBenchmarks } from '@/storage/benchmarks';
import { listBenchmarkGroupsWithCounts } from '@/storage/benchmarkGroups';
import { summarizeBenchmark } from '@/lib/benchmarkForm';
import { listGear, type GearRecord } from '@/storage/gear';
import { sessionGearIds } from '@core/gear';
import type { ObservationOf } from '@core/observation';
import type { Benchmark } from '@core/benchmark';
import type { BenchmarkGroup } from '@core/benchmarkGroup';
import type { WeightUnit } from '@/lib/units';

// The logbook is the canonical home of the *full* training history — not a
// recent-activity feed — so it reaches back past useSessionHistory's 365-day
// default (the calendar can page to any month). Effectively unbounded for any
// real user; the query is still date-floored, never a full-table scan.
const LOGBOOK_WINDOW_DAYS = 365 * 100;

type LogbookView = 'list' | 'calendar';

const VIEW_OPTIONS: Array<{ value: LogbookView; label: string }> = [
  { value: 'list', label: 'List' },
  { value: 'calendar', label: 'Calendar' },
];

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { weightUnit } = useSettings();
  const { sessions, reload } = useSessionHistory(LOGBOOK_WINDOW_DAYS);
  const [view, setView] = useState<LogbookView>('list');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [benchmarks, setBenchmarks] = useState<Benchmark[] | null>(null);
  const [gearItems, setGearItems] = useState<GearRecord[] | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [groups, setGroups] = useState<Array<BenchmarkGroup & { memberCount: number }>>([]);
  const [groupSheetId, setGroupSheetId] = useState<string | 'new' | null>(null);

  // The detail sheet needs these for its outcome faces; nothing else on this
  // screen consumes them (same pattern as benchmarks.tsx).
  const { points: trendPoints } = useWeightTrend();
  const { measured } = useExpenditure(trendPoints);

  const reloadModules = useCallback(async () => {
    // A failed read leaves the module absent (null), never a fabricated zero.
    const [bm, gear, grp] = await Promise.all([
      listBenchmarks().catch(() => null),
      listGear().catch(() => null),
      listBenchmarkGroupsWithCounts().catch(() => []),
    ]);
    setBenchmarks(bm);
    setGearItems(gear);
    setGroups(grp);
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

  // "What did I use last time" — the quiver module's last-used preview
  // (profile spec §3, P9's read-model track): the newest logbook session
  // tagging any quiver item, named. Direct refs only — the preview names what
  // the user tagged; inherited component wear is the quiver screen's story.
  const gearLastUsed = useMemo(() => {
    if (gearItems == null || gearItems.length === 0) return undefined;
    const byId = new Map(gearItems.map((g) => [g.id, g]));
    for (const s of sessions) {
      // sessions arrive newest-first — the first hit is the answer.
      const named = sessionGearIds(s.payload).filter((id) => byId.has(id));
      if (named.length > 0) {
        return {
          names: named.map((id) => byId.get(id)!.name),
          day: localDayOf(s.occurredAt, s.tz),
        };
      }
    }
    return undefined;
  }, [gearItems, sessions]);

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

  // One logbook entry — shared by the chronological list and the calendar's
  // day view (same swipe-to-delete + tap-to-open idiom Training used).
  function renderSessionEntry(session: ObservationOf<'session'>) {
    return (
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
    );
  }

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
          {sessions.map(renderSessionEntry)}
        </View>
      ) : (
        <View style={{ marginTop: theme.spacing[4], gap: theme.spacing[4] }}>
          <LogbookCalendar
            markedDays={markedDays}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
          {selectedDay && daySessions.length > 0 ? (
            <View style={{ gap: theme.spacing[3] }}>
              <Text variant="label" color={theme.colors.textMuted}>
                {dayNavLabel(selectedDay, todayLocalDate())}
              </Text>
              {daySessions.map(renderSessionEntry)}
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

      {/* ── Benchmark groups (P4-3 / B4, ⚑5 interim placement: Profile) ──── */}
      {/* Pausing a group drops its members from Home's glance and Reflect's
          browse lens without touching any member's own status/pinned row —
          no celebration on resume, this is bookkeeping, not a streak. */}
      {activeBenchmarks.length > 0 || groups.length > 0 ? (
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
              Benchmark groups
            </Text>
            <Pressable
              onPress={() => setGroupSheetId('new')}
              accessibilityRole="button"
              accessibilityLabel="New benchmark group"
              hitSlop={8}
            >
              <Text variant="label" color={theme.colors.textMuted}>
                + New →
              </Text>
            </Pressable>
          </View>
          {groups.length === 0 ? (
            <Card>
              <Text variant="body" color={theme.colors.textMuted}>
                Group benchmarks you want to pause together — nothing groups
                automatically.
              </Text>
            </Card>
          ) : (
            <View style={{ gap: theme.spacing[3] }}>
              {groups.map((g) => (
                <Pressable
                  key={g.id}
                  onPress={() => setGroupSheetId(g.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${g.title}`}
                >
                  <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ gap: theme.spacing[1] }}>
                      <Text variant="body">{g.title}</Text>
                      <Text variant="bodySm" color={theme.colors.textMuted}>
                        {g.memberCount} {g.memberCount === 1 ? 'benchmark' : 'benchmarks'}
                      </Text>
                    </View>
                    {g.paused ? (
                      <Text variant="dataSm" color={theme.colors.textMuted}>
                        paused
                      </Text>
                    ) : null}
                  </Card>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ) : null}

      {/* ── Gear quiver (P5 + P9's last-used preview) ────────────────────── */}
      {/* Preview only: item count + last-used, tap-through to the quiver.
          Absent when empty; wear-vs-threshold stays quiver-side (shown only
          when the quiver is opened — profile spec §2). */}
      {gearItems != null && gearItems.length > 0 ? (
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
                {gearItems.length} {gearItems.length === 1 ? 'item' : 'items'} in your quiver
              </Text>
              {gearLastUsed != null ? (
                <Text variant="bodySm" color={theme.colors.textSecondary}>
                  Last used: {gearLastUsed.names.join(', ')} — {dayNavLabel(gearLastUsed.day, todayLocalDate())}
                </Text>
              ) : null}
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

      <BenchmarkGroupSheet
        groupId={groupSheetId}
        benchmarks={activeBenchmarks}
        onClose={() => setGroupSheetId(null)}
        onChanged={reloadModules}
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
