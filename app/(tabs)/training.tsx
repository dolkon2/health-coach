/**
 * Training — the workshop, not the archive (rework Session 4,
 * planning/rework/tabs/training-tab.md). One scrolling screen: recent-
 * template chips, the template library (search appears ≥10 items, cards,
 * "+ New template"), then Progress/Import/Benchmarks tap-ins. History stays
 * pinned at the bottom untouched (T4's removal is gated on Profile's logbook
 * pass — Session 7's hard gate).
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
  Field,
  SessionCard,
  SwipeToDelete,
  TemplateCard,
} from '@/components';
import { iconFor } from '@/components/activityIcons';
import { useTheme } from '@/theme';
import { reveal } from '@core/stimulus';
import { useSessionHistory } from '@/hooks/useSessionHistory';
import { deleteObservation } from '@/storage/observations';
import { deleteHealthKitExport } from '@/lib/healthkit/writer';
import { listTemplates, deleteTemplate } from '@/storage/sessionTemplates';
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

const RECENT_TEMPLATE_COUNT = 3;
const SEARCH_THRESHOLD = 10;

export default function TrainingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { sessions, reload } = useSessionHistory();
  const [templates, setTemplates] = useState<SessionTemplate[] | null>(null);
  const [search, setSearch] = useState('');
  const [showReview, setShowReview] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  const reloadTemplates = useCallback(async () => {
    setTemplates(await listTemplates());
  }, []);

  // Re-fetch whenever the tab regains focus — after the logger or the
  // template editor saves, or a delete.
  useFocusEffect(
    useCallback(() => {
      reload();
      reloadTemplates();
    }, [reload, reloadTemplates])
  );

  // The engine's "what this contributed" line per session (same source as Home).
  const contributions = useMemo(() => {
    const out: Record<string, string> = {};
    for (const s of sessions) out[s.id] = reveal(s);
    return out;
  }, [sessions]);

  const removeAndReload = useCallback(
    async (id: string) => {
      await deleteObservation(id);
      // Fire-and-forget: propagates the delete to Apple Health if this
      // session was ever exported; never blocks the local delete.
      void deleteHealthKitExport(id).catch(() => {});
      reload();
    },
    [reload]
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

  return (
    <Screen
      scroll
      footer={<Button label="Log Body Session" onPress={() => setPickerVisible(true)} />}
    >
      <Text variant="label" color={theme.colors.accent}>
        Training
      </Text>
      <Text variant="displayLg" style={{ marginTop: theme.spacing[2] }}>
        Your library
      </Text>

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

      {/* Library — shared 3a/3b skeleton (training-tab.md § 3 B): search only
          past the clutter threshold, cards, last-used sort (listTemplates'
          default order), "+ New template". */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: theme.spacing[8],
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

      {/* Progress & tools (training-tab.md § 3 D) — plain link rows. */}
      <Text variant="label" style={{ marginTop: theme.spacing[8], marginBottom: theme.spacing[2] }}>
        Progress & tools
      </Text>
      <View style={{ gap: theme.spacing[2] }}>
        <LinkRow label="Benchmarks →" onPress={() => router.push('/benchmarks')} />
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

      {/* History — stays here, unchanged, until Profile's logbook pass ships
          (T4's hard gate, Session 7). */}
      <Text
        variant="label"
        style={{ marginTop: theme.spacing[8], marginBottom: theme.spacing[2] }}
      >
        History
      </Text>
      {sessions.length > 0 ? (
        <View style={{ gap: theme.spacing[3] }}>
          {sessions.map((session) => (
            <SwipeToDelete
              key={session.id}
              onDelete={() => removeAndReload(session.id)}
              confirmTitle="Delete session?"
              confirmMessage={`${session.payload.modality} — permanent.`}
            >
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/log-session',
                    params: { editId: session.id },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`Edit ${session.payload.modality} session`}
              >
                <SessionCard session={session} contribution={contributions[session.id]} />
              </Pressable>
            </SwipeToDelete>
          ))}
        </View>
      ) : (
        <Card>
          <Text variant="body" color={theme.colors.textMuted}>
            No sessions logged yet.
          </Text>
        </Card>
      )}

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
  const Icon = iconFor(activity?.icon ?? 'dumbbell');
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
