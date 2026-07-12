/**
 * Training — the workshop, not the archive (rework Session 4,
 * planning/rework/tabs/training-tab.md; Phase 4 item 29 — Templates | Routes
 * splitter added per Dylan, 2026-07-12). A top segmented switch (matching
 * Nutrition's Intake/Trend `ChipSelect`) now divides the recent-template
 * chips + template library from the routes shelf — this supersedes
 * training-tab.md §2's "sections on one screen, no mode toggle" framing
 * (the 2026-07-10 call that killed an earlier Templates/Routes top swap);
 * flagged, not silently reinterpreted — see the dev-log for this session.
 * Progress/Import/Benchmarks tap-ins and the pending-removal review tray stay
 * unconditional below both segments — they aren't a Templates-vs-Routes
 * question. History left for Profile's logbook (T4, Session 7 — its removal
 * was gated on that pass shipping); a small "History →" link keeps a
 * one-tap door to it.
 *
 * Dylan's routing answer (Session 4): "Log Body Session" is a persistent
 * button anchored above the bottom tab bar, not a section inside the scroll.
 * Tapping it browses Body-element activities freely — no template required.
 *
 * ⚑ The button currently opens every activity the old elementSections()
 * picker covered (Body + the Earth/Water Snow Sports and More trays), not
 * literally Body-only. Earth/Sky/Water are now fully reachable from Home's
 * element-picker expand (ElementPickerSheet), which makes Snow Sports/More
 * redundant here — but training-tab.md's ⚑3 (non-GPS Earth/Water routing)
 * is still an open decision, and narrowing this button to strictly Body
 * would drop climb/pool-swim/snow-sport access from Training before that
 * flag resolves. Flagging, not reinterpreting; narrow to Body-only once ⚑3
 * rules on where non-GPS Earth/Water activities live.
 *
 * The Review — pending removal tray (activities awaiting Dylan's delete
 * confirmation) moved down to the Progress & tools section: it's a
 * housekeeping surface, not a Start action, and Home's pickers deliberately
 * exclude it, so it has to stay reachable from Training.
 */
import { useCallback, useMemo, useState } from 'react';
import { View, Pressable, Modal, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  Screen,
  Text,
  Card,
  Button,
  ChipSelect,
  Field,
  SwipeToDelete,
  TemplateCard,
  RouteCard,
  PillActionButton,
  DiamondGlyph,
} from '@/components';
import { iconFor } from '@/components/activityIcons';
import { useTheme } from '@/theme';
import { useSettings } from '@/settings/useSettings';
import { listTemplates, deleteTemplate } from '@/storage/sessionTemplates';
import { listRoutes } from '@/storage/routes';
import { countSessionsByRoute } from '@/storage/observations';
import {
  activitiesForElement,
  activityById,
  elementOf,
  moreDeprioritizedActivities,
  reviewPendingActivities,
  snowSportActivities,
  type Activity,
} from '@/lib/activity';
import type { SessionTemplate } from '@core/sessionTemplate';
import type { Route } from '@core/route';

const RECENT_TEMPLATE_COUNT = 3;
const SEARCH_THRESHOLD = 10;
const ROUTE_SHELF_COUNT = 2;

type SubTab = 'templates' | 'routes';

export default function TrainingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { distanceUnit } = useSettings();
  const [subTab, setSubTab] = useState<SubTab>('templates');
  const [templates, setTemplates] = useState<SessionTemplate[] | null>(null);
  const [search, setSearch] = useState('');
  const [showReview, setShowReview] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [routes, setRoutes] = useState<Route[] | null>(null);
  const [routeEfforts, setRouteEfforts] = useState<Record<string, number>>({});

  const reloadTemplates = useCallback(async () => {
    setTemplates(await listTemplates());
  }, []);

  // Browse-only shelf (training-tab.md §3 C, locked #8) — the 2 most-recent
  // routes. One session-table scan (countSessionsByRoute) covers every
  // route's count; no need to re-scan per visible card.
  const reloadRoutes = useCallback(async () => {
    const [list, counts] = await Promise.all([listRoutes(), countSessionsByRoute()]);
    setRoutes(list);
    const shelf = list.slice(0, ROUTE_SHELF_COUNT);
    setRouteEfforts(Object.fromEntries(shelf.map((r) => [r.id, counts.get(r.id) ?? 0])));
  }, []);

  // Re-fetch whenever the tab regains focus — after the template editor saves
  // or a delete.
  useFocusEffect(
    useCallback(() => {
      reloadTemplates();
      reloadRoutes();
    }, [reloadTemplates, reloadRoutes])
  );

  const removeTemplateAndReload = useCallback(
    async (id: string) => {
      await deleteTemplate(id);
      reloadTemplates();
    },
    [reloadTemplates]
  );

  function logActivity(a: Activity) {
    // Hand the logger the chosen identity; it resolves the surface from the
    // registry and stores the activity on the session.
    setPickerVisible(false);
    router.push({ pathname: '/log-session', params: { activity: a.id } });
  }

  function openTemplate(t: SessionTemplate) {
    // Interim (training-tab.md § 5): opens the logger with the template's
    // activity pre-selected. No prefill yet — templateId back-linking on
    // logged Observations is unbuilt (Pass 3/placement), so `templateId` is
    // carried for whenever that lands, same "ships interim" idiom Home uses.
    router.push({
      pathname: '/log-session',
      params: { activity: t.activity, templateId: t.id },
    });
  }

  const recentTemplates = useMemo(
    () => (templates ?? []).slice(0, RECENT_TEMPLATE_COUNT),
    [templates]
  );

  const filteredTemplates = useMemo(() => {
    if (!templates) return null;
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => t.name.toLowerCase().includes(q));
  }, [templates, search]);

  const reviewPending = reviewPendingActivities();

  // The footer action follows the active segment (Dylan, 2026-07-12): Templates
  // keeps the free-browse Body sheet; Routes offers the one creation door that
  // actually exists today (Import GPX, on the full list) — "+ New Route" stays
  // gated on Map's builder pass (M6). `PillActionButton` + the same generic
  // action glyph for both states (the mockup's own `TrainingActionBar` reuses
  // one diamond regardless of label) — matches Home's log bar and Nutrition's
  // Log food, the same system across all three (Dylan, 2026-07-12).
  // Wrapped in a `flexDirection: 'row'` View even though there's only one
  // button — `PillActionButton`'s `flex: 1` needs a row parent to size
  // itself (RN's default flexDirection is 'column'); without the wrapper
  // the label collapses to zero width and only the icon renders.
  const footerAction = (
    <View style={{ flexDirection: 'row' }}>
      {subTab === 'routes' ? (
        <PillActionButton
          icon={<DiamondGlyph color={theme.colors.textSecondary} />}
          label="Create Route"
          onPress={() => router.push('/routes')}
        />
      ) : (
        <PillActionButton
          icon={<DiamondGlyph color={theme.colors.textSecondary} />}
          label="Log Body Session"
          onPress={() => setPickerVisible(true)}
        />
      )}
    </View>
  );

  return (
    <Screen scroll footer={footerAction}>
      {/* History moved to Profile's logbook (T4); this keeps a one-tap door to
          it — the user never loses access (profile-settings.md §5). */}
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <Text variant="label" color={theme.colors.accent}>
          Training
        </Text>
        <Pressable
          onPress={() => router.push('/profile')}
          accessibilityRole="button"
          accessibilityLabel="Open your history on Profile"
          hitSlop={8}
        >
          <Text variant="label" color={theme.colors.textMuted}>
            History →
          </Text>
        </Pressable>
      </View>
      {/* Templates | Routes segmented switch — mirrors Nutrition's
          Intake/Trend ChipSelect. Defaults to Templates on every mount (no
          re-entry reset needed yet: unlike Nutrition's modal round-trips,
          nothing here navigates away and back mid-flow). */}
      <View style={{ marginTop: theme.spacing[3] }}>
        <ChipSelect
          options={[
            { value: 'templates', label: 'Templates' },
            { value: 'routes', label: 'Routes' },
          ]}
          value={subTab}
          onChange={setSubTab}
          columns={2}
        />
      </View>

      {subTab === 'templates' ? (
        <>
          {/* Recent templates — last-used order (updatedAt desc), ≤3 chips. */}
          {recentTemplates.length > 0 ? (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: theme.spacing[2],
                marginTop: theme.spacing[5],
              }}
            >
              {recentTemplates.map((t) => (
                <RecentTemplateChip key={t.id} template={t} onPress={() => openTemplate(t)} />
              ))}
            </View>
          ) : null}

          {/* Library — shared 3a/3b skeleton (training-tab.md § 3 B): search
              only past the clutter threshold, cards, last-used sort
              (listTemplates' default order), "+ New template". */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: theme.spacing[6],
            }}
          >
            <Text variant="label">Library</Text>
            <Button
              label="+ New template"
              variant="secondary"
              size="sm"
              onPress={() => router.push('/edit-template')}
            />
          </View>

          {templates !== null && templates.length >= SEARCH_THRESHOLD ? (
            <Field
              value={search}
              onChangeText={setSearch}
              placeholder="Search templates"
              keyboardType="default"
              style={{ marginTop: theme.spacing[3] }}
            />
          ) : null}

          <View style={{ marginTop: theme.spacing[3], gap: theme.spacing[3] }}>
            {filteredTemplates === null ? null : filteredTemplates.length === 0 ? (
              <Card>
                <Text variant="body" color={theme.colors.textMuted}>
                  {templates && templates.length > 0
                    ? 'No templates match your search.'
                    : 'Your library is empty. Save a session as a template, or build one from scratch.'}
                </Text>
              </Card>
            ) : (
              filteredTemplates.map((t) => (
                <SwipeToDelete
                  key={t.id}
                  onDelete={() => removeTemplateAndReload(t.id)}
                  confirmTitle="Delete template?"
                  confirmMessage={`${t.name} — permanent.`}
                >
                  <TemplateCard
                    template={t}
                    onPress={() =>
                      router.push({ pathname: '/edit-template', params: { templateId: t.id } })
                    }
                  />
                </SwipeToDelete>
              ))
            )}
          </View>
        </>
      ) : (
        <>
          {/* Routes shelf (training-tab.md § 3 C, locked #8: created on Map,
              browsed here). Browse-only — no "+ New Route" until Map's
              builder (M6, gated on Explore/Phase 4) exists; until then the
              only creation door is Import GPX on the full list
              (app/routes.tsx). No "Routes" section label here (2026-07-12,
              Dylan) — the segmented tab already says that; a bare "See all"
              link avoids repeating it a third time on screen. */}
          <Pressable
            onPress={() => router.push('/routes')}
            accessibilityRole="button"
            accessibilityLabel="See all routes"
            hitSlop={8}
            style={{ alignSelf: 'flex-end', marginTop: theme.spacing[5] }}
          >
            <Text variant="label" color={theme.colors.textMuted}>
              See all →
            </Text>
          </Pressable>
          <View style={{ marginTop: theme.spacing[3], gap: theme.spacing[3] }}>
            {routes === null ? null : routes.length === 0 ? (
              <Card>
                <Text variant="body" color={theme.colors.textMuted}>
                  Import a GPX file to add your first route.
                </Text>
              </Card>
            ) : (
              routes.slice(0, ROUTE_SHELF_COUNT).map((r) => (
                <RouteCard
                  key={r.id}
                  route={r}
                  distanceUnit={distanceUnit}
                  effortCount={routeEfforts[r.id]}
                  onPress={() => router.push({ pathname: '/route/[id]', params: { id: r.id } })}
                />
              ))
            )}
          </View>
        </>
      )}

      {/* Progress & tools (training-tab.md § 3 D) — plain link rows, shown
          regardless of segment: not a Templates-vs-Routes question. */}
      <Text variant="label" style={{ marginTop: theme.spacing[8], marginBottom: theme.spacing[2] }}>
        Progress & tools
      </Text>
      <View style={{ gap: theme.spacing[2] }}>
        <LinkRow label="Benchmarks →" onPress={() => router.push('/benchmarks')} />
        <LinkRow label="Spots →" onPress={() => router.push('/spots')} />
        <LinkRow label="Progress →" onPress={() => router.push('/training-progress')} />
        <LinkRow label="Import training history →" onPress={() => router.push('/import-csv')} />
      </View>

      {/* Pending-delete review (2026-07-09 prune, relocated here Session 4):
          activities not in the Training Database and untouched by the
          dimension builds. Collapsed by default; still loggable until the
          delete is confirmed — nothing removed silently. */}
      <CollapsibleTray
        title="Review — pending removal"
        caption="Not in the Training Database — queued for deletion once you confirm."
        activities={reviewPending}
        expanded={showReview}
        onToggle={() => setShowReview((v) => !v)}
        onLogActivity={logActivity}
      />

      {/* Mounted only while open — cheap here, but the search field above
          re-renders this tree on every keystroke otherwise, and its two
          collapsible trays do their own registry scans on mount. */}
      {pickerVisible ? (
        <BodyActivitySheet
          visible={pickerVisible}
          onClose={() => setPickerVisible(false)}
          onLogActivity={logActivity}
        />
      ) : null}
    </Screen>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8}>
      <Text variant="label" color={theme.colors.textMuted}>
        {label}
      </Text>
    </Pressable>
  );
}

function RecentTemplateChip({
  template,
  onPress,
}: {
  template: SessionTemplate;
  onPress: () => void;
}) {
  const theme = useTheme();
  const activity = activityById(template.activity);
  const tint = theme.colors.element[activity ? elementOf(activity) : 'body'];
  const Icon = iconFor(activity?.icon ?? 'gym');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Start ${template.name}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing[2],
        paddingVertical: theme.spacing[2],
        paddingHorizontal: theme.spacing[3],
        borderRadius: theme.radius.full,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
      }}
    >
      <Icon size={16} color={tint} strokeWidth={1.5} />
      <Text variant="label">{template.name}</Text>
    </Pressable>
  );
}

/**
 * The "Log Body Session" sheet — free browse, no template required. Opened
 * from the anchored footer button. Carries Body's own picker plus the
 * Earth/Water Snow Sports and More trays until ⚑3 (non-GPS Earth/Water
 * routing) rules on their permanent home (see file header).
 */
function BodyActivitySheet({
  visible,
  onClose,
  onLogActivity,
}: {
  visible: boolean;
  onClose: () => void;
  onLogActivity: (a: Activity) => void;
}) {
  const theme = useTheme();
  const [showSnow, setShowSnow] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const bodyActivities = useMemo(() => activitiesForElement('body'), []);
  const snowSports = useMemo(() => snowSportActivities(), []);
  const moreActivitiesList = useMemo(() => moreDeprioritizedActivities(), []);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
        onPress={onClose}
        accessibilityLabel="Close"
      />
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: theme.radius.lg,
          borderTopRightRadius: theme.radius.lg,
          padding: theme.spacing[5],
          maxHeight: '80%',
        }}
      >
        <Text
          variant="label"
          color={theme.colors.textSecondary}
          style={{ marginBottom: theme.spacing[4] }}
        >
          Log a session
        </Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[3] }}>
            {bodyActivities.map((a) => (
              <ActivityTile key={a.id} activity={a} onPress={() => onLogActivity(a)} />
            ))}
          </View>

          <CollapsibleTray
            title="Snow Sports"
            activities={snowSports}
            expanded={showSnow}
            onToggle={() => setShowSnow((v) => !v)}
            onLogActivity={onLogActivity}
          />
          <CollapsibleTray
            title="More"
            activities={moreActivitiesList}
            expanded={showMore}
            onToggle={() => setShowMore((v) => !v)}
            onLogActivity={onLogActivity}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

/**
 * A closeable activity tray — a toggle line plus, when expanded, an optional
 * caption and the tile grid. Renders nothing when there's nothing to show.
 */
function CollapsibleTray({
  title,
  caption,
  activities,
  expanded,
  onToggle,
  onLogActivity,
}: {
  title: string;
  caption?: string;
  activities: Activity[];
  expanded: boolean;
  onToggle: () => void;
  onLogActivity: (a: Activity) => void;
}) {
  const theme = useTheme();
  if (activities.length === 0) return null;
  return (
    <View>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={expanded ? `Hide ${title}` : `Show ${title}`}
        style={{ marginTop: theme.spacing[6] }}
      >
        <Text variant="label" color={theme.colors.textMuted}>
          {title} {expanded ? '▲' : '▼'}
        </Text>
      </Pressable>
      {expanded ? (
        <>
          {caption ? (
            <Text
              variant="bodySm"
              color={theme.colors.textMuted}
              style={{ marginTop: theme.spacing[2] }}
            >
              {caption}
            </Text>
          ) : null}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: theme.spacing[3],
              marginTop: theme.spacing[3],
            }}
          >
            {activities.map((a) => (
              <ActivityTile key={a.id} activity={a} onPress={() => onLogActivity(a)} />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

function ActivityTile({ activity, onPress }: { activity: Activity; onPress: () => void }) {
  const theme = useTheme();
  const Icon = iconFor(activity.icon);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Log ${activity.label}`}
      style={{
        width: '30%',
        aspectRatio: 1,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing[2],
      }}
    >
      <Icon size={24} color={theme.colors.accent} strokeWidth={1.5} />
      <Text variant="label" color={theme.colors.text}>
        {activity.label}
      </Text>
    </Pressable>
  );
}
