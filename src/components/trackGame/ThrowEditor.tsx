import { Box, Button, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  DeflectionResult,
  ThrowResult,
} from '../../domain/statistics/constants';
import type { GamePlayerInfo, ThrowDraft } from '../../domain/gameEvents';
import {
  deflectionResultLabels,
  deflectionResultUiOrder,
  emptyThrowDraft,
  throwResultAllowsDeflections,
  throwResultLabels,
  throwResultUiOrder,
  throwDraftNeedsRecovered,
} from '../../domain/gameEvents';
import {
  buildPermanentPlayerHotkeys,
  findGamePlayerIdByHotkey,
  getDeflectionResultForKey,
  getThrowResultForKey,
  hotkeyForDeflectionResult,
  hotkeyForGamePlayer,
  hotkeyForResult,
  RECOVERED_NONE_HOTKEY,
} from '../../domain/hotkeys';
import { sortGamePlayerInfos } from '../../domain/gameElimination';
import { getThrowResultIcon } from '../../domain/throwResultIcons';
import {
  EditorChoiceButton,
  EditorChoiceStack,
  EditorChipButton,
  EditorGrid,
  EditorLabel,
  EditorStackedActions,
  TeamBanner,
  TeamBannerSpacer,
  useEditorDensity,
} from './EditorGrid';

const TEAM_THROW_HELP =
  'Group throws released at the same moment by the same team. Throws from the opposing team belong in their own event, even when they happen simultaneously.';

/**
 * Side throwing in a group of simultaneous throws, or null while undecided.
 * One group is always one team, so every draft follows the first pick.
 */
export function resolveGroupThrowingHome(
  drafts: ThrowDraft[],
  players: GamePlayerInfo[],
): boolean | null {
  for (const draft of drafts) {
    if (draft.throwerGamePlayerId) {
      const throwerHome = players.find(
        (row) => row.gamePlayerId === draft.throwerGamePlayerId,
      )?.teamHome;
      if (throwerHome !== undefined) return throwerHome;
    }
    if (draft.targetGamePlayerId) {
      const targetHome = players.find(
        (row) => row.gamePlayerId === draft.targetGamePlayerId,
      )?.teamHome;
      if (targetHome !== undefined) return !targetHome;
    }
  }
  return null;
}

function isRecoveredCandidate(
  draft: ThrowDraft,
  player: GamePlayerInfo,
  throwingHome: boolean,
): boolean {
  if (player.teamHome === throwingHome) return false;
  if (player.gamePlayerId === draft.targetGamePlayerId) return false;
  if (draft.deflections.some((row) => row.receiverGamePlayerId === player.gamePlayerId)) {
    return false;
  }
  return true;
}

function withThrower(draft: ThrowDraft, gamePlayerId: string): ThrowDraft {
  // The target stays put: the group's throwing side fixes which team each column holds
  return {
    ...draft,
    throwerGamePlayerId: gamePlayerId,
    deflections: throwResultAllowsDeflections(draft.resultId)
      ? draft.deflections
      : [],
    recoveredId:
      draft.resultId === ThrowResult.Catch ||
      draft.deflections.some((row) => row.resultId === DeflectionResult.Catch)
        ? draft.recoveredId
        : undefined,
  };
}

function withTarget(draft: ThrowDraft, gamePlayerId: string): ThrowDraft {
  return {
    ...draft,
    targetGamePlayerId: gamePlayerId,
    deflections: throwResultAllowsDeflections(draft.resultId)
      ? draft.deflections
      : [],
  };
}

function withResult(
  draft: ThrowDraft,
  resultId: ThrowResult | null,
): ThrowDraft {
  if (resultId === null) {
    return {
      ...draft,
      resultId: null,
      deflections: [],
      recoveredId: undefined,
    };
  }
  return {
    ...draft,
    resultId,
    deflections: throwResultAllowsDeflections(resultId)
      ? draft.deflections
      : [],
    recoveredId:
      resultId === ThrowResult.Catch ? draft.recoveredId : undefined,
  };
}

function withToggledRecovery(
  draft: ThrowDraft,
  recoveredId: string | null,
): ThrowDraft {
  return {
    ...draft,
    recoveredId:
      draft.recoveredId === recoveredId ? undefined : recoveredId,
  };
}

/** Last pending deflection, else the last row once one exists (after `Z`). */
export function focusedDeflectionIndex(draft: ThrowDraft): number {
  if (
    !throwResultAllowsDeflections(draft.resultId) ||
    draft.deflections.length === 0
  ) {
    return -1;
  }
  const pending = draft.deflections.findIndex((row) => !row.receiverGamePlayerId);
  if (pending >= 0) return pending;
  return draft.deflections.length - 1;
}

function withDeflectionResult(
  draft: ThrowDraft,
  index: number,
  resultId: DeflectionResult,
): ThrowDraft {
  let next = draft.deflections.map((row, i) =>
    i === index ? { ...row, resultId } : row,
  );
  if (resultId === DeflectionResult.Catch) {
    next = next.map((row, i) =>
      i !== index && row.resultId === DeflectionResult.Catch
        ? { ...row, resultId: DeflectionResult.Hit }
        : row,
    );
  }
  return { ...draft, deflections: next };
}

function SingleThrowEditor({
  draft,
  players,
  homeTeamName,
  awayTeamName,
  onChange,
  onDelete,
  canDelete,
  eliminatedGamePlayerIds,
  groupThrowingHome,
  hotkeys,
  section = 'all',
  throwLabel,
}: {
  draft: ThrowDraft;
  players: GamePlayerInfo[];
  homeTeamName: string;
  awayTeamName: string;
  onChange: (next: ThrowDraft) => void;
  onDelete?: () => void;
  canDelete: boolean;
  eliminatedGamePlayerIds: ReadonlySet<string>;
  groupThrowingHome: boolean | null;
  hotkeys: ReadonlyMap<string, string>;
  section?: 'all' | 'players' | 'actions';
  throwLabel?: string;
}) {
  const homePlayers = sortGamePlayerInfos(
    players.filter((row) => row.teamHome),
    eliminatedGamePlayerIds,
  );
  const awayPlayers = sortGamePlayerInfos(
    players.filter((row) => !row.teamHome),
    eliminatedGamePlayerIds,
  );
  const throwingHome = groupThrowingHome ?? true;
  const defendingHome = !throwingHome;
  const throwingPlayers = sortGamePlayerInfos(
    players.filter((row) => row.teamHome === throwingHome),
    eliminatedGamePlayerIds,
  );
  const defendingPlayers = sortGamePlayerInfos(
    players.filter((row) => row.teamHome === defendingHome),
    eliminatedGamePlayerIds,
  );
  const showTarget = groupThrowingHome !== null;
  const isOut = (gamePlayerId: string) => eliminatedGamePlayerIds.has(gamePlayerId);
  const playerLabel = (row: GamePlayerInfo): string =>
    isOut(row.gamePlayerId) ? `${row.playerName} (out)` : row.playerName;
  const chipLabel = (pool: GamePlayerInfo[], gamePlayerId: string): string => {
    const row = pool.find((entry) => entry.gamePlayerId === gamePlayerId);
    return row ? playerLabel(row) : '?';
  };

  const excludedFromTarget = new Set<string>([
    draft.throwerGamePlayerId,
    ...draft.deflections.map((row) => row.receiverGamePlayerId),
  ]);
  const targetCandidates = sortGamePlayerInfos(
    defendingPlayers.filter(
      (row) => !excludedFromTarget.has(row.gamePlayerId) || row.gamePlayerId === draft.targetGamePlayerId,
    ),
    eliminatedGamePlayerIds,
  );

  const pendingThrower = !draft.throwerGamePlayerId;
  const pendingTarget = showTarget && !draft.targetGamePlayerId;
  const pendingResult = draft.resultId === null;
  const deflectionFocusIndex = focusedDeflectionIndex(draft);

  const setThrower = (gamePlayerId: string) => {
    onChange(withThrower(draft, gamePlayerId));
  };

  const setTarget = (gamePlayerId: string) => {
    onChange(withTarget(draft, gamePlayerId));
  };

  const setResult = (resultId: ThrowResult | null) => {
    onChange(withResult(draft, resultId));
  };

  const addDeflection = () => {
    onChange({
      ...draft,
      deflections: [
        ...draft.deflections,
        { receiverGamePlayerId: '', resultId: DeflectionResult.Hit },
      ],
    });
  };

  const updateDeflection = (index: number, patch: Partial<ThrowDraft['deflections'][0]>) => {
    onChange({
      ...draft,
      deflections: draft.deflections.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    });
  };

  const removeDeflection = (index: number) => {
    onChange({ ...draft, deflections: draft.deflections.filter((_, i) => i !== index) });
  };

  const recoveredCandidates = defendingPlayers.filter(
    (row) =>
      row.gamePlayerId !== draft.targetGamePlayerId &&
      !draft.deflections.some((d) => d.receiverGamePlayerId === row.gamePlayerId),
  );

  const renderResultIcon = (resultId: ThrowResult) => {
    const Icon = getThrowResultIcon(resultId);
    return <Icon fontSize="small" />;
  };

  const density = useEditorDensity();
  const compact = density === 'compact';
  const stacked = compact && section !== 'all';
  const showPlayers = section === 'all' || section === 'players';
  const showActions = section === 'all' || section === 'actions';

  const resultStack = (
    <EditorChoiceStack pending={pendingResult} gridColumn={stacked ? undefined : 3}>
      {draft.resultId !== null ? (
        <EditorChipButton
          hotkey={hotkeyForResult(draft.resultId)}
          onClick={() => setResult(null)}
        >
          {throwResultLabels[draft.resultId]}
        </EditorChipButton>
      ) : (
        throwResultUiOrder.map((resultId) => (
          <EditorChoiceButton
            key={resultId}
            hotkey={hotkeyForResult(resultId)}
            startIcon={renderResultIcon(resultId)}
            onClick={() => setResult(resultId)}
          >
            {throwResultLabels[resultId]}
          </EditorChoiceButton>
        ))
      )}
    </EditorChoiceStack>
  );

  const deflectionBlock =
    showTarget && draft.resultId !== null && throwResultAllowsDeflections(draft.resultId) ? (
      <Box sx={{ mt: stacked ? 1 : 2 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
          <Typography variant={stacked ? 'caption' : 'subtitle2'} sx={{ fontWeight: 700 }}>
            Deflection
          </Typography>
          <IconButton size="small" onClick={addDeflection} aria-label="Add deflection">
            <AddIcon fontSize="small" />
          </IconButton>
        </Stack>
        {draft.deflections.map((deflection, index) => (
          <Box key={index} sx={{ mb: 0.5 }}>
            <EditorGrid stacked={stacked}>
              {!stacked ? <Box /> : null}
              <EditorChoiceStack pending={!deflection.receiverGamePlayerId} gridColumn={stacked ? 1 : 2}>
                {deflection.receiverGamePlayerId ? (
                  <EditorChipButton
                    hotkey={hotkeyForGamePlayer(hotkeys, deflection.receiverGamePlayerId)}
                    playerId={
                      defendingPlayers.find(
                        (row) => row.gamePlayerId === deflection.receiverGamePlayerId,
                      )?.playerId
                    }
                    teamHome={defendingHome}
                    onClick={() => updateDeflection(index, { receiverGamePlayerId: '' })}
                  >
                    {defendingPlayers.find((row) => row.gamePlayerId === deflection.receiverGamePlayerId)?.playerName ?? '?'}
                  </EditorChipButton>
                ) : (
                  defendingPlayers.map((row) => (
                    <EditorChoiceButton
                      key={row.gamePlayerId}
                      hotkey={hotkeyForGamePlayer(hotkeys, row.gamePlayerId)}
                      eliminated={isOut(row.gamePlayerId)}
                      playerId={row.playerId}
                      teamHome={row.teamHome}
                      onClick={() => updateDeflection(index, { receiverGamePlayerId: row.gamePlayerId })}
                    >
                      {playerLabel(row)}
                    </EditorChoiceButton>
                  ))
                )}
              </EditorChoiceStack>
              <EditorChoiceStack
                pending={index === deflectionFocusIndex && !deflection.receiverGamePlayerId}
                gridColumn={stacked ? 2 : 3}
              >
                {deflectionResultUiOrder.map((resultId) => (
                  <EditorChoiceButton
                    key={resultId}
                    hotkey={hotkeyForDeflectionResult(resultId)}
                    selected={deflection.resultId === resultId}
                    startIcon={renderResultIcon(resultId as unknown as ThrowResult)}
                    onClick={() => onChange(withDeflectionResult(draft, index, resultId))}
                  >
                    {deflectionResultLabels[resultId]}
                  </EditorChoiceButton>
                ))}
              </EditorChoiceStack>
            </EditorGrid>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <IconButton size="small" onClick={() => removeDeflection(index)} aria-label="Remove deflection">
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        ))}
      </Box>
    ) : null;

  const recoveredBlock =
    showTarget && throwDraftNeedsRecovered(draft) ? (
      <Box sx={{ mt: stacked ? 1 : 2 }}>
        <Typography variant={stacked ? 'caption' : 'subtitle2'} sx={{ fontWeight: 700, mb: 0.5 }}>
          Recovered
        </Typography>
        <EditorGrid stacked={stacked}>
          {!stacked ? <Box /> : null}
          <EditorChoiceStack
            pending={draft.recoveredId === undefined}
            gridColumn={stacked ? '1 / -1' : 2}
          >
            <EditorChoiceButton
              hotkey={RECOVERED_NONE_HOTKEY}
              selected={draft.recoveredId === null}
              onClick={() => onChange(withToggledRecovery(draft, null))}
            >
              None
            </EditorChoiceButton>
            {recoveredCandidates.map((row) => (
              <EditorChoiceButton
                key={row.gamePlayerId}
                hotkey={hotkeyForGamePlayer(hotkeys, row.gamePlayerId)}
                selected={draft.recoveredId === row.gamePlayerId}
                playerId={row.playerId}
                teamHome={row.teamHome}
                onClick={() => onChange(withToggledRecovery(draft, row.gamePlayerId))}
              >
                {playerLabel(row)}
              </EditorChoiceButton>
            ))}
          </EditorChoiceStack>
          {!stacked ? <Box /> : null}
        </EditorGrid>
      </Box>
    ) : null;

  if (section === 'actions') {
    return (
      <Box sx={{ mb: 1, position: 'relative' }}>
        {throwLabel ? (
          <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.25 }}>
            {throwLabel}
          </Typography>
        ) : null}
        {canDelete && onDelete ? (
          <IconButton
            size="small"
            sx={{ position: 'absolute', right: 0, top: throwLabel ? 0 : -4 }}
            onClick={onDelete}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        ) : null}
        <EditorStackedActions>
          <EditorLabel centered>Result</EditorLabel>
          {resultStack}
        </EditorStackedActions>
        {deflectionBlock}
        {recoveredBlock}
      </Box>
    );
  }

  if (section === 'players') {
    return (
      <EditorGrid stacked>
        {showTarget ? (
          <>
            <EditorLabel gridColumn={1} centered>
              Thrower
            </EditorLabel>
            <EditorLabel gridColumn={2} centered>
              Target
            </EditorLabel>
          </>
        ) : (
          <>
            <EditorLabel gridColumn={1} centered>
              Home
            </EditorLabel>
            <EditorLabel gridColumn={2} centered>
              Away
            </EditorLabel>
          </>
        )}

        {!showTarget ? (
          <>
            <TeamBanner name={homeTeamName} teamHome centered />
            <TeamBanner name={awayTeamName} teamHome={false} centered />
          </>
        ) : (
          <>
            <TeamBanner
              name={throwingHome ? homeTeamName : awayTeamName}
              teamHome={throwingHome}
              centered
            />
            <TeamBanner
              name={defendingHome ? homeTeamName : awayTeamName}
              teamHome={defendingHome}
              centered
            />
          </>
        )}

        {!showTarget ? (
          <>
            <EditorChoiceStack pending={pendingThrower} gridColumn={1}>
              {homePlayers.map((row) => (
                <EditorChoiceButton
                  key={row.gamePlayerId}
                  hotkey={hotkeyForGamePlayer(hotkeys, row.gamePlayerId)}
                  eliminated={isOut(row.gamePlayerId)}
                  playerId={row.playerId}
                  teamHome={row.teamHome}
                  onClick={() =>
                    setThrower(
                      draft.throwerGamePlayerId === row.gamePlayerId ? '' : row.gamePlayerId,
                    )
                  }
                >
                  {playerLabel(row)}
                </EditorChoiceButton>
              ))}
            </EditorChoiceStack>
            <EditorChoiceStack pending={pendingThrower} gridColumn={2}>
              {awayPlayers.map((row) => (
                <EditorChoiceButton
                  key={row.gamePlayerId}
                  hotkey={hotkeyForGamePlayer(hotkeys, row.gamePlayerId)}
                  eliminated={isOut(row.gamePlayerId)}
                  playerId={row.playerId}
                  teamHome={row.teamHome}
                  onClick={() =>
                    setThrower(
                      draft.throwerGamePlayerId === row.gamePlayerId ? '' : row.gamePlayerId,
                    )
                  }
                >
                  {playerLabel(row)}
                </EditorChoiceButton>
              ))}
            </EditorChoiceStack>
          </>
        ) : (
          <>
            <EditorChoiceStack
              pending={pendingThrower}
              gridColumn={1}
            >
              {draft.throwerGamePlayerId ? (
                <EditorChipButton
                  hotkey={hotkeyForGamePlayer(hotkeys, draft.throwerGamePlayerId)}
                  playerId={
                    throwingPlayers.find((row) => row.gamePlayerId === draft.throwerGamePlayerId)
                      ?.playerId
                  }
                  teamHome={throwingHome}
                  onClick={() => setThrower('')}
                >
                  {chipLabel(throwingPlayers, draft.throwerGamePlayerId)}
                </EditorChipButton>
              ) : (
                throwingPlayers.map((row) => (
                  <EditorChoiceButton
                    key={row.gamePlayerId}
                    hotkey={hotkeyForGamePlayer(hotkeys, row.gamePlayerId)}
                    eliminated={isOut(row.gamePlayerId)}
                    playerId={row.playerId}
                    teamHome={row.teamHome}
                    onClick={() => setThrower(row.gamePlayerId)}
                  >
                    {playerLabel(row)}
                  </EditorChoiceButton>
                ))
              )}
            </EditorChoiceStack>
            <EditorChoiceStack
              pending={pendingTarget}
              gridColumn={2}
            >
              {draft.targetGamePlayerId ? (
                <EditorChipButton
                  hotkey={hotkeyForGamePlayer(hotkeys, draft.targetGamePlayerId)}
                  playerId={
                    defendingPlayers.find((row) => row.gamePlayerId === draft.targetGamePlayerId)
                      ?.playerId
                  }
                  teamHome={defendingHome}
                  onClick={() => setTarget('')}
                >
                  {chipLabel(defendingPlayers, draft.targetGamePlayerId)}
                </EditorChipButton>
              ) : (
                targetCandidates.map((row) => (
                  <EditorChoiceButton
                    key={row.gamePlayerId}
                    hotkey={hotkeyForGamePlayer(hotkeys, row.gamePlayerId)}
                    eliminated={isOut(row.gamePlayerId)}
                    playerId={row.playerId}
                    teamHome={row.teamHome}
                    onClick={() => setTarget(row.gamePlayerId)}
                  >
                    {playerLabel(row)}
                  </EditorChoiceButton>
                ))
              )}
            </EditorChoiceStack>
          </>
        )}
      </EditorGrid>
    );
  }

  return (
    <Box sx={{ mb: compact ? 1 : 3, position: 'relative' }}>
      {canDelete && onDelete ? (
        <IconButton size="small" sx={{ position: 'absolute', right: 0, top: 0 }} onClick={onDelete}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      ) : null}
      <EditorGrid>
        {showTarget ? (
          <>
            <EditorLabel gridColumn={1}>Thrower</EditorLabel>
            <EditorLabel gridColumn={2}>Target</EditorLabel>
            <EditorLabel gridColumn={3}>Result</EditorLabel>
          </>
        ) : (
          <>
            <EditorLabel gridColumn="1 / 3">Thrower</EditorLabel>
            <EditorLabel gridColumn={3}>Result</EditorLabel>
          </>
        )}

        {!showTarget ? (
          <>
            <TeamBanner name={homeTeamName} teamHome />
            <TeamBanner name={awayTeamName} teamHome={false} />
            <TeamBannerSpacer />
          </>
        ) : (
          <>
            <TeamBanner
              name={throwingHome ? homeTeamName : awayTeamName}
              teamHome={throwingHome}
            />
            <TeamBanner
              name={defendingHome ? homeTeamName : awayTeamName}
              teamHome={defendingHome}
            />
            <TeamBannerSpacer />
          </>
        )}

        {!showTarget ? (
          <>
            <EditorChoiceStack pending={pendingThrower} gridColumn={1} distribute>
              {homePlayers.map((row) => (
                <EditorChoiceButton
                  key={row.gamePlayerId}
                  hotkey={hotkeyForGamePlayer(hotkeys, row.gamePlayerId)}
                  eliminated={isOut(row.gamePlayerId)}
                  playerId={row.playerId}
                  teamHome={row.teamHome}
                  onClick={() =>
                    setThrower(
                      draft.throwerGamePlayerId === row.gamePlayerId ? '' : row.gamePlayerId,
                    )
                  }
                >
                  {playerLabel(row)}
                </EditorChoiceButton>
              ))}
            </EditorChoiceStack>
            <EditorChoiceStack pending={pendingThrower} gridColumn={2} distribute>
              {awayPlayers.map((row) => (
                <EditorChoiceButton
                  key={row.gamePlayerId}
                  hotkey={hotkeyForGamePlayer(hotkeys, row.gamePlayerId)}
                  eliminated={isOut(row.gamePlayerId)}
                  playerId={row.playerId}
                  teamHome={row.teamHome}
                  onClick={() =>
                    setThrower(
                      draft.throwerGamePlayerId === row.gamePlayerId ? '' : row.gamePlayerId,
                    )
                  }
                >
                  {playerLabel(row)}
                </EditorChoiceButton>
              ))}
            </EditorChoiceStack>
            {resultStack}
          </>
        ) : (
          <>
            <EditorChoiceStack
              pending={pendingThrower}
              gridColumn={1}
              distribute={!draft.throwerGamePlayerId}
            >
              {draft.throwerGamePlayerId ? (
                <EditorChipButton
                  hotkey={hotkeyForGamePlayer(hotkeys, draft.throwerGamePlayerId)}
                  playerId={
                    throwingPlayers.find((row) => row.gamePlayerId === draft.throwerGamePlayerId)
                      ?.playerId
                  }
                  teamHome={throwingHome}
                  onClick={() => setThrower('')}
                >
                  {chipLabel(throwingPlayers, draft.throwerGamePlayerId)}
                </EditorChipButton>
              ) : (
                throwingPlayers.map((row) => (
                  <EditorChoiceButton
                    key={row.gamePlayerId}
                    hotkey={hotkeyForGamePlayer(hotkeys, row.gamePlayerId)}
                    eliminated={isOut(row.gamePlayerId)}
                    playerId={row.playerId}
                    teamHome={row.teamHome}
                    onClick={() => setThrower(row.gamePlayerId)}
                  >
                    {playerLabel(row)}
                  </EditorChoiceButton>
                ))
              )}
            </EditorChoiceStack>
            <EditorChoiceStack
              pending={pendingTarget}
              gridColumn={2}
              distribute={!draft.targetGamePlayerId}
            >
              {draft.targetGamePlayerId ? (
                <EditorChipButton
                  hotkey={hotkeyForGamePlayer(hotkeys, draft.targetGamePlayerId)}
                  playerId={
                    defendingPlayers.find((row) => row.gamePlayerId === draft.targetGamePlayerId)
                      ?.playerId
                  }
                  teamHome={defendingHome}
                  onClick={() => setTarget('')}
                >
                  {chipLabel(defendingPlayers, draft.targetGamePlayerId)}
                </EditorChipButton>
              ) : (
                targetCandidates.map((row) => (
                  <EditorChoiceButton
                    key={row.gamePlayerId}
                    hotkey={hotkeyForGamePlayer(hotkeys, row.gamePlayerId)}
                    eliminated={isOut(row.gamePlayerId)}
                    playerId={row.playerId}
                    teamHome={row.teamHome}
                    onClick={() => setTarget(row.gamePlayerId)}
                  >
                    {playerLabel(row)}
                  </EditorChoiceButton>
                ))
              )}
            </EditorChoiceStack>
            {resultStack}
          </>
        )}
      </EditorGrid>

      {showActions ? deflectionBlock : null}
      {showActions ? recoveredBlock : null}
    </Box>
  );
}

export function ThrowEditor({
  drafts,
  players,
  homeTeamName,
  awayTeamName,
  onChange,
  eliminatedGamePlayerIds,
}: {
  drafts: ThrowDraft[];
  players: GamePlayerInfo[];
  homeTeamName: string;
  awayTeamName: string;
  onChange: (drafts: ThrowDraft[]) => void;
  eliminatedGamePlayerIds: ReadonlySet<string>;
}) {
  const hotkeys = buildPermanentPlayerHotkeys(players);
  const groupThrowingHome = resolveGroupThrowingHome(drafts, players);
  const density = useEditorDensity();
  const compact = density === 'compact';

  const addTeamThrowButton = (
    <Stack direction="row" sx={{ alignItems: 'center', mt: compact ? 0.5 : 0 }}>
      <Button
        startIcon={<AddIcon />}
        size={compact ? 'small' : 'medium'}
        className="bw-button bw-button--text"
        data-tour="team-throw"
        onClick={() => onChange([...drafts, emptyThrowDraft()])}
      >
        Add Team Throw
      </Button>
      <Tooltip title={TEAM_THROW_HELP}>
        <IconButton size="small" aria-label={TEAM_THROW_HELP}>
          <InfoOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );

  if (compact) {
    const activeIndex = Math.max(0, drafts.length - 1);
    const activeDraft = drafts[activeIndex] ?? emptyThrowDraft();
    return (
      <Box
        className="sk-throw-editor"
        sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
      >
        <Box sx={{ flexShrink: 0 }}>
          <SingleThrowEditor
            section="players"
            draft={activeDraft}
            players={players}
            homeTeamName={homeTeamName}
            awayTeamName={awayTeamName}
            eliminatedGamePlayerIds={eliminatedGamePlayerIds}
            groupThrowingHome={groupThrowingHome}
            hotkeys={hotkeys}
            canDelete={false}
            onChange={(next) =>
              onChange(drafts.map((row, i) => (i === activeIndex ? next : row)))
            }
          />
        </Box>
        <Box
          className="sk-throw-editor-scroll"
          sx={{ flex: 1, minHeight: 0, overflow: 'auto', pt: 0.5 }}
        >
          {drafts.map((draft, index) => (
            <SingleThrowEditor
              key={index}
              section="actions"
              throwLabel={drafts.length > 1 ? `Throw ${index + 1}` : undefined}
              draft={draft}
              players={players}
              homeTeamName={homeTeamName}
              awayTeamName={awayTeamName}
              eliminatedGamePlayerIds={eliminatedGamePlayerIds}
              groupThrowingHome={groupThrowingHome}
              hotkeys={hotkeys}
              canDelete={drafts.length > 1}
              onDelete={() => onChange(drafts.filter((_, i) => i !== index))}
              onChange={(next) => onChange(drafts.map((row, i) => (i === index ? next : row)))}
            />
          ))}
          {addTeamThrowButton}
        </Box>
      </Box>
    );
  }

  return (
    <Box data-tour="throw-editor">
      {drafts.map((draft, index) => (
        <SingleThrowEditor
          key={index}
          draft={draft}
          players={players}
          homeTeamName={homeTeamName}
          awayTeamName={awayTeamName}
          eliminatedGamePlayerIds={eliminatedGamePlayerIds}
          groupThrowingHome={groupThrowingHome}
          hotkeys={hotkeys}
          canDelete={drafts.length > 1}
          onDelete={() => onChange(drafts.filter((_, i) => i !== index))}
          onChange={(next) => onChange(drafts.map((row, i) => (i === index ? next : row)))}
        />
      ))}
      {addTeamThrowButton}
    </Box>
  );
}

export function addDeflectionToDrafts(drafts: ThrowDraft[]): ThrowDraft[] {
  if (drafts.length === 0) return drafts;
  const lastIndex = drafts.length - 1;
  const draft = drafts[lastIndex];
  if (!throwResultAllowsDeflections(draft.resultId)) return drafts;
  return drafts.map((row, i) =>
    i === lastIndex
      ? {
          ...row,
          deflections: [
            ...row.deflections,
            { receiverGamePlayerId: '', resultId: DeflectionResult.Hit },
          ],
        }
      : row,
  );
}

export function applyPlayerHotkeyToThrowDrafts(
  drafts: ThrowDraft[],
  players: GamePlayerInfo[],
  key: string,
): ThrowDraft[] | null {
  if (drafts.length === 0) return null;
  const draft = drafts[drafts.length - 1];
  const last = drafts.length - 1;
  const patch = (next: ThrowDraft): ThrowDraft[] =>
    drafts.map((row, i) => (i === last ? next : row));

  const deflectionIndex = focusedDeflectionIndex(draft);
  const deflectionResultId = getDeflectionResultForKey(key);
  if (deflectionIndex >= 0 && deflectionResultId !== null) {
    return patch(withDeflectionResult(draft, deflectionIndex, deflectionResultId));
  }

  const resultId = getThrowResultForKey(key);
  if (resultId !== null) {
    return patch(withResult(draft, draft.resultId === resultId ? null : resultId));
  }

  const groupThrowingHome = resolveGroupThrowingHome(drafts, players);
  const throwingHome = groupThrowingHome ?? true;

  if (throwDraftNeedsRecovered(draft) && key.toLowerCase() === RECOVERED_NONE_HOTKEY) {
    return patch(withToggledRecovery(draft, null));
  }

  const hotkeys = buildPermanentPlayerHotkeys(players);
  const gamePlayerId = findGamePlayerIdByHotkey(hotkeys, key);
  if (!gamePlayerId) return null;
  const hit = players.find((row) => row.gamePlayerId === gamePlayerId);
  if (!hit) return null;

  const pendingDeflection =
    deflectionIndex >= 0 && !draft.deflections[deflectionIndex].receiverGamePlayerId;
  if (pendingDeflection && hit.teamHome !== throwingHome) {
    return patch({
      ...draft,
      deflections: draft.deflections.map((row, i) =>
        i === deflectionIndex ? { ...row, receiverGamePlayerId: hit.gamePlayerId } : row,
      ),
    });
  }

  // Catch recovery: defending teammates (including out) are selectable
  if (throwDraftNeedsRecovered(draft) && isRecoveredCandidate(draft, hit, throwingHome)) {
    return patch(withToggledRecovery(draft, hit.gamePlayerId));
  }

  // Phase 1: with no side chosen yet, any player key picks/toggles thrower
  if (groupThrowingHome === null) {
    if (draft.throwerGamePlayerId === hit.gamePlayerId) {
      return patch(withThrower(draft, ''));
    }
    return patch(withThrower(draft, hit.gamePlayerId));
  }

  // Phase 2: throwing side = thrower, defending side = target (by person, not display column)
  if (hit.teamHome === throwingHome) {
    if (draft.throwerGamePlayerId === hit.gamePlayerId) {
      return patch(withThrower(draft, ''));
    }
    return patch(withThrower(draft, hit.gamePlayerId));
  }

  if (draft.targetGamePlayerId === hit.gamePlayerId) {
    return patch(withTarget(draft, ''));
  }
  return patch(withTarget(draft, hit.gamePlayerId));
}
