import { Box } from '@mui/material';
import {
  errorDraftIsDeparture,
  errorDraftIsMarker,
  errorDraftNeedsThrower,
  resolveErrorThrowingHome,
  type ErrorDraft,
  type GamePlayerInfo,
} from '../../domain/gameEvents';
import { formatEliminatedPlayerLabel } from '../../domain/gameElimination';
import {
  formatDepartedPlayerLabel,
  sortGamePlayerInfosWithDepartures,
} from '../../domain/playerDeparture';
import {
  applyOtherOffenseHotkey,
  buildPermanentPlayerHotkeys,
  hotkeyForGamePlayer,
  hotkeyForOtherOffenseIndex,
  isOtherOffenseChoiceActive,
  labelForOtherOffenseChoice,
  otherOffenseUiOrder,
} from '../../domain/hotkeys';
import {
  EditorChoiceButton,
  EditorChoiceStack,
  EditorChipButton,
  EditorGrid,
  EditorLabel,
  TeamBanner,
  TeamBannerSpacer,
} from './EditorGrid';

export function ErrorEditor({
  draft,
  players,
  homeTeamName,
  awayTeamName,
  eliminatedGamePlayerIds,
  softExitedGamePlayerIds = new Set<string>(),
  eliminationOrder = new Map(),
  onChange,
}: {
  draft: ErrorDraft;
  players: GamePlayerInfo[];
  homeTeamName: string;
  awayTeamName: string;
  eliminatedGamePlayerIds: ReadonlySet<string>;
  softExitedGamePlayerIds?: ReadonlySet<string>;
  eliminationOrder?: ReadonlyMap<string, number>;
  onChange: (draft: ErrorDraft) => void;
}) {
  const hotkeys = buildPermanentPlayerHotkeys(players);
  const markerMode = errorDraftIsMarker(draft);
  const departureMode = errorDraftIsDeparture(draft);
  const illegalBlock = errorDraftNeedsThrower(draft);
  const throwingHome = resolveErrorThrowingHome(draft, players);
  const offender = players.find((row) => row.gamePlayerId === draft.offenderGamePlayerId);
  const thrower = players.find((row) => row.gamePlayerId === draft.throwerGamePlayerId);
  const showBothTeamsAsOffender =
    !markerMode && !illegalBlock && !departureMode && !draft.offenderGamePlayerId;
  const pendingOffender =
    !markerMode && !illegalBlock && !departureMode && !draft.offenderGamePlayerId;
  const pendingMistake =
    !markerMode &&
    draft.offenseId === null &&
    draft.departureKind == null &&
    !draft.noBlockingStarted &&
    !draft.timeoutStarted &&
    !draft.timeoutEnded;

  const sortPlayers = (rows: GamePlayerInfo[]) =>
    sortGamePlayerInfosWithDepartures(
      rows,
      softExitedGamePlayerIds,
      eliminatedGamePlayerIds,
      eliminationOrder,
    );
  const homePlayers = sortPlayers(players.filter((row) => row.teamHome));
  const awayPlayers = sortPlayers(players.filter((row) => !row.teamHome));

  const isDeparted = (id: string) => softExitedGamePlayerIds.has(id);
  const isOut = (id: string) => eliminatedGamePlayerIds.has(id) || isDeparted(id);

  const label = (row: GamePlayerInfo) => {
    if (isDeparted(row.gamePlayerId)) {
      return formatDepartedPlayerLabel(row.playerName, draft.departureKind ?? undefined);
    }
    if (eliminatedGamePlayerIds.has(row.gamePlayerId)) {
      return formatEliminatedPlayerLabel(
        row.playerName,
        eliminationOrder.get(row.gamePlayerId),
      );
    }
    return row.playerName;
  };

  const chipLabel = (row: GamePlayerInfo | undefined) =>
    row ? label(row) : '?';

  const toggleOffenseChoice = (index: number) => {
    const choice = otherOffenseUiOrder[index];
    if (!choice) return;
    onChange(applyOtherOffenseHotkey(draft, choice));
  };

  const setThrower = (gamePlayerId: string) => {
    onChange({ ...draft, throwerGamePlayerId: gamePlayerId });
  };

  const setOffender = (gamePlayerId: string) => {
    onChange({ ...draft, offenderGamePlayerId: gamePlayerId });
  };

  const showIllegalBlockSides = illegalBlock && throwingHome !== null;
  const pendingThrower = illegalBlock && !draft.throwerGamePlayerId;
  const pendingIllegalOffender = illegalBlock && !draft.offenderGamePlayerId;
  const throwingPlayers =
    throwingHome === null
      ? []
      : sortPlayers(players.filter((row) => row.teamHome === throwingHome));
  const defendingHome = throwingHome === null ? null : !throwingHome;
  const defendingPlayers =
    defendingHome === null
      ? []
      : sortPlayers(players.filter((row) => row.teamHome === defendingHome));

  return (
    <EditorGrid>
      {markerMode ? (
        <EditorLabel gridColumn="1 / -1">Game event</EditorLabel>
      ) : illegalBlock ? (
        showIllegalBlockSides ? (
          <>
            <EditorLabel gridColumn={1}>Thrower</EditorLabel>
            <EditorLabel gridColumn={2}>Offender</EditorLabel>
          </>
        ) : (
          <EditorLabel gridColumn="1 / 3">Thrower</EditorLabel>
        )
      ) : departureMode ? (
        <>
          <EditorLabel gridColumn={showBothTeamsAsOffender ? undefined : offender?.teamHome ? '1' : '2'}>
            Player
          </EditorLabel>
          {showBothTeamsAsOffender ? <Box /> : null}
        </>
      ) : (
        <>
          <EditorLabel gridColumn={showBothTeamsAsOffender ? undefined : offender?.teamHome ? '1' : '2'}>
            Offender
          </EditorLabel>
          {showBothTeamsAsOffender ? <Box /> : null}
        </>
      )}
      <EditorLabel>{markerMode ? '' : departureMode ? 'Reason' : 'Mistake'}</EditorLabel>

      {markerMode ? null : illegalBlock && !showIllegalBlockSides ? (
        <>
          <TeamBanner name={homeTeamName} teamHome />
          <TeamBanner name={awayTeamName} teamHome={false} />
          <TeamBannerSpacer />
        </>
      ) : illegalBlock && showIllegalBlockSides ? (
        <>
          <TeamBanner
            name={throwingHome ? homeTeamName : awayTeamName}
            teamHome={Boolean(throwingHome)}
          />
          <TeamBanner
            name={defendingHome ? homeTeamName : awayTeamName}
            teamHome={Boolean(defendingHome)}
          />
          <TeamBannerSpacer />
        </>
      ) : showBothTeamsAsOffender ? (
        <>
          <TeamBanner name={homeTeamName} teamHome />
          <TeamBanner name={awayTeamName} teamHome={false} />
          <Box />
        </>
      ) : offender?.teamHome ? (
        <>
          <TeamBanner name={homeTeamName} teamHome />
          <Box />
          <Box />
        </>
      ) : (
        <>
          <Box />
          <TeamBanner name={awayTeamName} teamHome={false} />
          <Box />
        </>
      )}

      {illegalBlock && !showIllegalBlockSides ? (
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
                {label(row)}
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
                {label(row)}
              </EditorChoiceButton>
            ))}
          </EditorChoiceStack>
        </>
      ) : null}

      {illegalBlock && showIllegalBlockSides ? (
        <>
          <EditorChoiceStack
            pending={pendingThrower}
            gridColumn={1}
            distribute={!draft.throwerGamePlayerId}
          >
            {draft.throwerGamePlayerId ? (
              <EditorChipButton
                hotkey={hotkeyForGamePlayer(hotkeys, draft.throwerGamePlayerId)}
                playerId={thrower?.playerId}
                teamHome={Boolean(throwingHome)}
                onClick={() => setThrower('')}
              >
                {chipLabel(thrower)}
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
                  {label(row)}
                </EditorChoiceButton>
              ))
            )}
          </EditorChoiceStack>
          <EditorChoiceStack
            pending={pendingIllegalOffender}
            gridColumn={2}
            distribute={!draft.offenderGamePlayerId}
          >
            {draft.offenderGamePlayerId ? (
              <EditorChipButton
                hotkey={hotkeyForGamePlayer(hotkeys, draft.offenderGamePlayerId)}
                playerId={offender?.playerId}
                teamHome={Boolean(defendingHome)}
                onClick={() => setOffender('')}
              >
                {chipLabel(offender)}
              </EditorChipButton>
            ) : (
              defendingPlayers.map((row) => (
                <EditorChoiceButton
                  key={row.gamePlayerId}
                  hotkey={hotkeyForGamePlayer(hotkeys, row.gamePlayerId)}
                  eliminated={isOut(row.gamePlayerId)}
                  playerId={row.playerId}
                  teamHome={row.teamHome}
                  onClick={() => setOffender(row.gamePlayerId)}
                >
                  {label(row)}
                </EditorChoiceButton>
              ))
            )}
          </EditorChoiceStack>
        </>
      ) : null}

      {!markerMode && !illegalBlock && (showBothTeamsAsOffender || departureMode) ? (
        <>
          <EditorChoiceStack pending={pendingOffender}>
            {homePlayers.map((row) => (
              <EditorChoiceButton
                key={row.gamePlayerId}
                hotkey={hotkeyForGamePlayer(hotkeys, row.gamePlayerId)}
                eliminated={isOut(row.gamePlayerId)}
                playerId={row.playerId}
                teamHome={row.teamHome}
                onClick={() =>
                  onChange({
                    ...draft,
                    offenderGamePlayerId:
                      draft.offenderGamePlayerId === row.gamePlayerId ? '' : row.gamePlayerId,
                  })
                }
              >
                {label(row)}
              </EditorChoiceButton>
            ))}
          </EditorChoiceStack>
          <EditorChoiceStack pending={pendingOffender}>
            {awayPlayers.map((row) => (
              <EditorChoiceButton
                key={row.gamePlayerId}
                hotkey={hotkeyForGamePlayer(hotkeys, row.gamePlayerId)}
                eliminated={isOut(row.gamePlayerId)}
                playerId={row.playerId}
                teamHome={row.teamHome}
                onClick={() =>
                  onChange({
                    ...draft,
                    offenderGamePlayerId:
                      draft.offenderGamePlayerId === row.gamePlayerId ? '' : row.gamePlayerId,
                  })
                }
              >
                {label(row)}
              </EditorChoiceButton>
            ))}
          </EditorChoiceStack>
        </>
      ) : null}

      {!markerMode &&
      !illegalBlock &&
      (departureMode ? Boolean(draft.offenderGamePlayerId) : !showBothTeamsAsOffender) ? (
        <>
          {offender?.teamHome ? (
            <EditorChoiceStack pending={pendingOffender}>
              {draft.offenderGamePlayerId ? (
                <EditorChipButton
                  hotkey={hotkeyForGamePlayer(hotkeys, draft.offenderGamePlayerId)}
                  playerId={offender.playerId}
                  teamHome={offender.teamHome}
                  onClick={() =>
                    onChange({
                      ...draft,
                      offenderGamePlayerId: '',
                    })
                  }
                >
                  {label(offender)}
                </EditorChipButton>
              ) : null}
            </EditorChoiceStack>
          ) : (
            <Box />
          )}
          {!offender?.teamHome ? (
            <EditorChoiceStack pending={pendingOffender}>
              {draft.offenderGamePlayerId ? (
                <EditorChipButton
                  hotkey={hotkeyForGamePlayer(hotkeys, draft.offenderGamePlayerId)}
                  playerId={offender!.playerId}
                  teamHome={offender!.teamHome}
                  onClick={() =>
                    onChange({
                      ...draft,
                      offenderGamePlayerId: '',
                    })
                  }
                >
                  {label(offender!)}
                </EditorChipButton>
              ) : null}
            </EditorChoiceStack>
          ) : (
            <Box />
          )}
        </>
      ) : null}

      {markerMode ? <Box sx={{ gridColumn: '1 / -1' }} /> : null}

      <Box data-tour="other-offenses" sx={{ gridColumn: markerMode ? '1 / -1' : 3 }}>
      <EditorChoiceStack
        pending={pendingMistake && !markerMode}
      >
        {otherOffenseUiOrder.map((choice, index) => (
          <EditorChoiceButton
            key={
              choice.kind === 'offense' ? choice.offenseId : choice.kind
            }
            hotkey={hotkeyForOtherOffenseIndex(index)}
            selected={isOtherOffenseChoiceActive(draft, choice)}
            onClick={() => toggleOffenseChoice(index)}
          >
            {labelForOtherOffenseChoice(choice)}
          </EditorChoiceButton>
        ))}
      </EditorChoiceStack>
      </Box>
    </EditorGrid>
  );
}
