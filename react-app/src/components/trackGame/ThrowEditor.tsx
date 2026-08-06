import { Box, Button, IconButton, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  DeflectionResult,
  ThrowResult,
} from '../../domain/statistics/constants';
import type { GamePlayerInfo, ThrowDraft } from '../../domain/gameEvents';
import {
  deflectionResultLabels,
  deflectionResultUiOrder,
  throwResultAllowsDeflections,
  throwResultLabels,
  throwResultUiOrder,
  throwDraftNeedsRecovered,
} from '../../domain/gameEvents';
import {
  buildPermanentPlayerHotkeys,
  findGamePlayerIdByHotkey,
  getThrowResultForKey,
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
  TeamBanner,
} from './EditorGrid';

function resolveThrowingHome(
  draft: ThrowDraft,
  players: GamePlayerInfo[],
): boolean {
  if (draft.throwerGamePlayerId) {
    return players.find((row) => row.gamePlayerId === draft.throwerGamePlayerId)?.teamHome ?? true;
  }
  if (draft.targetGamePlayerId) {
    const targetHome = players.find((row) => row.gamePlayerId === draft.targetGamePlayerId)?.teamHome;
    return targetHome === undefined ? true : !targetHome;
  }
  return true;
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

function SingleThrowEditor({
  draft,
  players,
  homeTeamName,
  awayTeamName,
  onChange,
  onDelete,
  canDelete,
  eliminatedGamePlayerIds,
  hotkeys,
}: {
  draft: ThrowDraft;
  players: GamePlayerInfo[];
  homeTeamName: string;
  awayTeamName: string;
  onChange: (next: ThrowDraft) => void;
  onDelete?: () => void;
  canDelete: boolean;
  eliminatedGamePlayerIds: ReadonlySet<string>;
  hotkeys: ReadonlyMap<string, string>;
}) {
  const homePlayers = sortGamePlayerInfos(
    players.filter((row) => row.teamHome),
    eliminatedGamePlayerIds,
  );
  const awayPlayers = sortGamePlayerInfos(
    players.filter((row) => !row.teamHome),
    eliminatedGamePlayerIds,
  );
  const throwingHome = resolveThrowingHome(draft, players);
  const defendingHome = !throwingHome;
  const throwingPlayers = sortGamePlayerInfos(
    players.filter((row) => row.teamHome === throwingHome),
    eliminatedGamePlayerIds,
  );
  const defendingPlayers = sortGamePlayerInfos(
    players.filter((row) => row.teamHome === defendingHome),
    eliminatedGamePlayerIds,
  );
  const showTarget = Boolean(draft.throwerGamePlayerId || draft.targetGamePlayerId);
  const isOut = (gamePlayerId: string) => eliminatedGamePlayerIds.has(gamePlayerId);
  const playerLabel = (row: GamePlayerInfo): string =>
    isOut(row.gamePlayerId) ? `${row.playerName} (out)` : row.playerName;

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

  const pendingThrower = !draft.throwerGamePlayerId && !draft.targetGamePlayerId;
  const pendingTarget = showTarget && !draft.targetGamePlayerId;
  const pendingResult = draft.resultId === null;

  const setThrower = (gamePlayerId: string) => {
    if (gamePlayerId && isOut(gamePlayerId)) return;
    // Toggle off when clearing via empty id or same player handled by callers.
    onChange({
      ...draft,
      throwerGamePlayerId: gamePlayerId,
      targetGamePlayerId: '',
      // Keep result so result can be chosen before thrower.
      deflections: throwResultAllowsDeflections(draft.resultId) ? draft.deflections : [],
      recoveredId:
        draft.resultId === ThrowResult.Catch ||
        draft.deflections.some((row) => row.resultId === DeflectionResult.Catch)
          ? draft.recoveredId
          : undefined,
    });
  };

  const setTarget = (gamePlayerId: string) => {
    if (gamePlayerId && isOut(gamePlayerId)) return;
    onChange({
      ...draft,
      targetGamePlayerId: gamePlayerId,
      deflections: throwResultAllowsDeflections(draft.resultId) ? draft.deflections : [],
    });
  };

  const setResult = (resultId: ThrowResult | null) => {
    if (resultId === null) {
      onChange({ ...draft, resultId: null, deflections: [], recoveredId: undefined });
      return;
    }
    const allowsDeflection = throwResultAllowsDeflections(resultId);
    onChange({
      ...draft,
      resultId,
      deflections: allowsDeflection ? draft.deflections : [],
      recoveredId: resultId === ThrowResult.Catch ? draft.recoveredId : undefined,
    });
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

  return (
    <Box sx={{ mb: 3, position: 'relative' }}>
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
            <TeamBanner name={homeTeamName} />
            <TeamBanner name={awayTeamName} />
            <Box />
          </>
        ) : (
          <>
            <TeamBanner name={throwingHome ? homeTeamName : awayTeamName} />
            <TeamBanner name={defendingHome ? homeTeamName : awayTeamName} />
            <Box />
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
            <EditorChoiceStack pending={pendingResult} gridColumn={3}>
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
          </>
        ) : (
          <>
            <EditorChoiceStack pending={pendingThrower} gridColumn={1}>
              {draft.throwerGamePlayerId ? (
                <EditorChipButton
                  hotkey={hotkeyForGamePlayer(hotkeys, draft.throwerGamePlayerId)}
                  onClick={() => setThrower('')}
                >
                  {throwingPlayers.find((row) => row.gamePlayerId === draft.throwerGamePlayerId)
                    ?.playerName ?? '?'}
                </EditorChipButton>
              ) : (
                throwingPlayers.map((row) => (
                  <EditorChoiceButton
                    key={row.gamePlayerId}
                    hotkey={hotkeyForGamePlayer(hotkeys, row.gamePlayerId)}
                    eliminated={isOut(row.gamePlayerId)}
                    onClick={() => setThrower(row.gamePlayerId)}
                  >
                    {playerLabel(row)}
                  </EditorChoiceButton>
                ))
              )}
            </EditorChoiceStack>
            <EditorChoiceStack pending={pendingTarget} gridColumn={2}>
              {draft.targetGamePlayerId ? (
                <EditorChipButton
                  hotkey={hotkeyForGamePlayer(hotkeys, draft.targetGamePlayerId)}
                  onClick={() => setTarget('')}
                >
                  {defendingPlayers.find((row) => row.gamePlayerId === draft.targetGamePlayerId)
                    ?.playerName ?? '?'}
                </EditorChipButton>
              ) : (
                targetCandidates.map((row) => (
                  <EditorChoiceButton
                    key={row.gamePlayerId}
                    hotkey={hotkeyForGamePlayer(hotkeys, row.gamePlayerId)}
                    eliminated={isOut(row.gamePlayerId)}
                    onClick={() => setTarget(row.gamePlayerId)}
                  >
                    {playerLabel(row)}
                  </EditorChoiceButton>
                ))
              )}
            </EditorChoiceStack>
            <EditorChoiceStack pending={pendingResult} gridColumn={3}>
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
          </>
        )}
      </EditorGrid>

      {showTarget && draft.resultId !== null && throwResultAllowsDeflections(draft.resultId) ? (
        <Box sx={{ mt: 2 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2">Deflection</Typography>
            <IconButton size="small" onClick={addDeflection} aria-label="Add deflection">
              <AddIcon fontSize="small" />
            </IconButton>
          </Stack>
          {draft.deflections.map((deflection, index) => (
            <EditorGrid key={index}>
              <Box />
              <EditorChoiceStack pending={!deflection.receiverGamePlayerId}>
                {deflection.receiverGamePlayerId ? (
                  <EditorChipButton
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
                      onClick={() => updateDeflection(index, { receiverGamePlayerId: row.gamePlayerId })}
                    >
                      {playerLabel(row)}
                    </EditorChoiceButton>
                  ))
                )}
              </EditorChoiceStack>
              <EditorChoiceStack>
                {deflectionResultUiOrder.map((resultId) => (
                  <EditorChoiceButton
                    key={resultId}
                    selected={deflection.resultId === resultId}
                    startIcon={renderResultIcon(resultId as unknown as ThrowResult)}
                    onClick={() => {
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
                      onChange({ ...draft, deflections: next });
                    }}
                  >
                    {deflectionResultLabels[resultId]}
                  </EditorChoiceButton>
                ))}
              </EditorChoiceStack>
              <IconButton onClick={() => removeDeflection(index)}>
                <DeleteIcon />
              </IconButton>
            </EditorGrid>
          ))}
        </Box>
      ) : null}

      {showTarget && throwDraftNeedsRecovered(draft) ? (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Recovered
          </Typography>
          <EditorGrid>
            <Box />
            <EditorChoiceStack pending={draft.recoveredId === undefined}>
              <EditorChoiceButton
                hotkey={RECOVERED_NONE_HOTKEY}
                selected={draft.recoveredId === null}
                onClick={() =>
                  onChange({
                    ...draft,
                    recoveredId: draft.recoveredId === null ? undefined : null,
                  })
                }
              >
                None
              </EditorChoiceButton>
              {recoveredCandidates.map((row) => (
                <EditorChoiceButton
                  key={row.gamePlayerId}
                  hotkey={hotkeyForGamePlayer(hotkeys, row.gamePlayerId)}
                  selected={draft.recoveredId === row.gamePlayerId}
                  onClick={() =>
                    onChange({
                      ...draft,
                      recoveredId:
                        draft.recoveredId === row.gamePlayerId ? undefined : row.gamePlayerId,
                    })
                  }
                >
                  {playerLabel(row)}
                </EditorChoiceButton>
              ))}
            </EditorChoiceStack>
            <Box />
          </EditorGrid>
        </Box>
      ) : null}
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
  return (
    <Box>
      {drafts.map((draft, index) => (
        <SingleThrowEditor
          key={index}
          draft={draft}
          players={players}
          homeTeamName={homeTeamName}
          awayTeamName={awayTeamName}
          eliminatedGamePlayerIds={eliminatedGamePlayerIds}
          hotkeys={hotkeys}
          canDelete={drafts.length > 1}
          onDelete={() => onChange(drafts.filter((_, i) => i !== index))}
          onChange={(next) => onChange(drafts.map((row, i) => (i === index ? next : row)))}
        />
      ))}
      <Button
        startIcon={<AddIcon />}
        className="bw-button bw-button--text"
        onClick={() =>
          onChange([
            ...drafts,
            {
              throwerGamePlayerId: '',
              targetGamePlayerId: '',
              resultId: null,
              deflections: [],
              recoveredId: undefined,
            },
          ])
        }
      >
        Add Throw
      </Button>
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
  eliminatedGamePlayerIds: ReadonlySet<string> = new Set(),
): ThrowDraft[] | null {
  if (drafts.length === 0) return null;
  const draft = drafts[drafts.length - 1];
  const last = drafts.length - 1;
  const patch = (next: ThrowDraft): ThrowDraft[] =>
    drafts.map((row, i) => (i === last ? next : row));

  const resultId = getThrowResultForKey(key);
  if (resultId !== null) {
    if (draft.resultId === resultId) {
      return patch({ ...draft, resultId: null, deflections: [], recoveredId: undefined });
    }
    const allowsDeflection = throwResultAllowsDeflections(resultId);
    return patch({
      ...draft,
      resultId,
      deflections: allowsDeflection ? draft.deflections : [],
      recoveredId: resultId === ThrowResult.Catch ? draft.recoveredId : undefined,
    });
  }

  const throwingHome = resolveThrowingHome(draft, players);

  if (throwDraftNeedsRecovered(draft) && key.toLowerCase() === RECOVERED_NONE_HOTKEY) {
    if (draft.recoveredId === null) {
      return patch({ ...draft, recoveredId: undefined });
    }
    return patch({ ...draft, recoveredId: null });
  }

  const hotkeys = buildPermanentPlayerHotkeys(players);
  const gamePlayerId = findGamePlayerIdByHotkey(hotkeys, key);
  if (!gamePlayerId) return null;
  const hit = players.find((row) => row.gamePlayerId === gamePlayerId);
  if (!hit) return null;

  // Catch recovery: defending teammates (including out) are selectable
  if (throwDraftNeedsRecovered(draft) && isRecoveredCandidate(draft, hit, throwingHome)) {
    if (draft.recoveredId === hit.gamePlayerId) {
      return patch({ ...draft, recoveredId: undefined });
    }
    return patch({ ...draft, recoveredId: hit.gamePlayerId });
  }

  if (eliminatedGamePlayerIds.has(hit.gamePlayerId)) {
    return null;
  }

  const showTarget = Boolean(draft.throwerGamePlayerId || draft.targetGamePlayerId);

  // Phase 1: any player key picks/toggles thrower
  if (!showTarget) {
    if (draft.throwerGamePlayerId === hit.gamePlayerId) {
      return patch({ ...draft, throwerGamePlayerId: '', targetGamePlayerId: '' });
    }
    return patch({
      ...draft,
      throwerGamePlayerId: hit.gamePlayerId,
      targetGamePlayerId: '',
    });
  }

  // Phase 2: throwing side = thrower, defending side = target (by person, not display column)
  if (hit.teamHome === throwingHome) {
    if (draft.throwerGamePlayerId === hit.gamePlayerId) {
      return patch({ ...draft, throwerGamePlayerId: '', targetGamePlayerId: '' });
    }
    return patch({
      ...draft,
      throwerGamePlayerId: hit.gamePlayerId,
      targetGamePlayerId: '',
    });
  }

  if (draft.targetGamePlayerId === hit.gamePlayerId) {
    return patch({ ...draft, targetGamePlayerId: '' });
  }
  return patch({ ...draft, targetGamePlayerId: hit.gamePlayerId });
}
