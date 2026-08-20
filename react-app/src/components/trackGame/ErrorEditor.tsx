import { Box } from '@mui/material';
import type { ErrorDraft, GamePlayerInfo } from '../../domain/gameEvents';
import { sortGamePlayerInfos } from '../../domain/gameElimination';
import {
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
  const offender = players.find((row) => row.gamePlayerId === draft.offenderGamePlayerId);
  const showBothTeams = !noBlockingMode && !draft.offenderGamePlayerId;
  const pendingOffender = !noBlockingMode && !draft.offenderGamePlayerId;
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

  const toggleOffenseChoice = (index: number) => {
    const choice = otherOffenseUiOrder[index];
    if (!choice) return;
    if (choice.kind === 'noBlocking') {
      onChange(
        draft.noBlockingStarted
          ? { ...draft, noBlockingStarted: false }
          : { offenderGamePlayerId: '', offenseId: null, noBlockingStarted: true },
      );
      return;
    }
    onChange({
      ...draft,
      noBlockingStarted: false,
      offenseId: draft.offenseId === choice.offenseId ? null : choice.offenseId,
    });
  };

  return (
    <EditorGrid>
      {!noBlockingMode ? (
        <>
          <EditorLabel gridColumn={showBothTeams ? undefined : offender?.teamHome ? '1' : '2'}>
            Offender
          </EditorLabel>
          {showBothTeams ? <Box /> : null}
        </>
      ) : (
        <EditorLabel gridColumn="1 / -1">Game event</EditorLabel>
      )}
      <EditorLabel>{noBlockingMode ? '' : 'Mistake'}</EditorLabel>

      {!noBlockingMode && showBothTeams ? (
        <>
          <TeamBanner name={homeTeamName} teamHome />
          <TeamBanner name={awayTeamName} teamHome={false} />
          <Box />
        </>
      ) : null}
      {!noBlockingMode && !showBothTeams ? (
        <>
          {offender?.teamHome ? (
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
        </>
      ) : null}

      {!noBlockingMode && showBothTeams ? (
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

      {!noBlockingMode && !showBothTeams ? (
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
                      offenderGamePlayerId: '',
                      offenseId: draft.offenseId,
                      noBlockingStarted: false,
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
                      offenderGamePlayerId: '',
                      offenseId: draft.offenseId,
                      noBlockingStarted: false,
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

      {noBlockingMode ? (
        <Box gridColumn="1 / -1" />
      ) : null}

      <EditorChoiceStack
        pending={pendingMistake && !noBlockingMode}
        gridColumn={noBlockingMode ? '1 / -1' : 3}
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
    </EditorGrid>
  );
}
