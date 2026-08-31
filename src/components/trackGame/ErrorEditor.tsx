import { Box } from '@mui/material';
import {
  errorDraftNeedsThrower,
  resolveErrorThrowingHome,
  type ErrorDraft,
  type GamePlayerInfo,
} from '../../domain/gameEvents';
import { sortGamePlayerInfos } from '../../domain/gameElimination';
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
  onChange,
}: {
  draft: ErrorDraft;
  players: GamePlayerInfo[];
  homeTeamName: string;
  awayTeamName: string;
  eliminatedGamePlayerIds: ReadonlySet<string>;
  onChange: (draft: ErrorDraft) => void;
}) {
  const hotkeys = buildPermanentPlayerHotkeys(players);
  const noBlockingMode = Boolean(draft.noBlockingStarted);
  const illegalBlock = errorDraftNeedsThrower(draft);
  const throwingHome = resolveErrorThrowingHome(draft, players);
  const offender = players.find((row) => row.gamePlayerId === draft.offenderGamePlayerId);
  const thrower = players.find((row) => row.gamePlayerId === draft.throwerGamePlayerId);
  const showBothTeamsAsOffender = !noBlockingMode && !illegalBlock && !draft.offenderGamePlayerId;
  const pendingOffender =
    !noBlockingMode && !illegalBlock && !draft.offenderGamePlayerId;
  const pendingMistake =
    !noBlockingMode && draft.offenseId === null && !draft.noBlockingStarted;

  const homePlayers = sortGamePlayerInfos(
    players.filter((row) => row.teamHome),
    eliminatedGamePlayerIds,
  );
  const awayPlayers = sortGamePlayerInfos(
    players.filter((row) => !row.teamHome),
    eliminatedGamePlayerIds,
  );

  const isOut = (id: string) => eliminatedGamePlayerIds.has(id);

  const label = (row: GamePlayerInfo) =>
    isOut(row.gamePlayerId) ? `${row.playerName} (out)` : row.playerName;

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
      : sortGamePlayerInfos(
          players.filter((row) => row.teamHome === throwingHome),
          eliminatedGamePlayerIds,
        );
  const defendingHome = throwingHome === null ? null : !throwingHome;
  const defendingPlayers =
    defendingHome === null
      ? []
      : sortGamePlayerInfos(
          players.filter((row) => row.teamHome === defendingHome),
          eliminatedGamePlayerIds,
        );

  return (
    <EditorGrid>
      {noBlockingMode ? (
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
      ) : (
        <>
          <EditorLabel gridColumn={showBothTeamsAsOffender ? undefined : offender?.teamHome ? '1' : '2'}>
            Offender
          </EditorLabel>
          {showBothTeamsAsOffender ? <Box /> : null}
        </>
      )}
      <EditorLabel>{noBlockingMode ? '' : 'Mistake'}</EditorLabel>

      {noBlockingMode ? null : illegalBlock && !showIllegalBlockSides ? (
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

      {!noBlockingMode && !illegalBlock && showBothTeamsAsOffender ? (
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

      {!noBlockingMode && !illegalBlock && !showBothTeamsAsOffender ? (
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

      {noBlockingMode ? <Box sx={{ gridColumn: '1 / -1' }} /> : null}

      <Box data-tour="other-offenses" sx={{ gridColumn: noBlockingMode ? '1 / -1' : 3 }}>
      <EditorChoiceStack
        pending={pendingMistake && !noBlockingMode}
      >
        {otherOffenseUiOrder.map((choice, index) => (
          <EditorChoiceButton
            key={choice.kind === 'noBlocking' ? 'noBlocking' : choice.offenseId}
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
