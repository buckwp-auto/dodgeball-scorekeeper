import { Box } from '@mui/material';
import { GameEventErrorOffense } from '../../domain/statistics/constants';
import type { ErrorDraft, GamePlayerInfo } from '../../domain/gameEvents';
import { errorOffenseLabels } from '../../domain/gameEvents';
import { sortGamePlayerInfos } from '../../domain/gameElimination';
import {
  buildPermanentPlayerHotkeys,
  hotkeyForGamePlayer,
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
  const offender = players.find((row) => row.gamePlayerId === draft.offenderGamePlayerId);
  const showBothTeams = !draft.offenderGamePlayerId;
  const pendingOffender = !draft.offenderGamePlayerId;
  const pendingMistake = draft.offenseId === null;

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

  return (
    <EditorGrid>
      <EditorLabel gridColumn={showBothTeams ? undefined : offender?.teamHome ? '1' : '2'}>
        Offender
      </EditorLabel>
      {showBothTeams ? <Box /> : null}
      <EditorLabel>Mistake</EditorLabel>

      {showBothTeams ? (
        <>
          <TeamBanner name={homeTeamName} teamHome />
          <TeamBanner name={awayTeamName} teamHome={false} />
          <Box />
        </>
      ) : (
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
      )}

      {showBothTeams ? (
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
      ) : (
        <>
          {offender?.teamHome ? (
            <EditorChoiceStack pending={pendingOffender}>
              {draft.offenderGamePlayerId ? (
                <EditorChipButton
                  hotkey={hotkeyForGamePlayer(hotkeys, draft.offenderGamePlayerId)}
                  playerId={offender.playerId}
                  teamHome={offender.teamHome}
                  onClick={() => onChange({ offenderGamePlayerId: '', offenseId: draft.offenseId })}
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
                  onClick={() => onChange({ offenderGamePlayerId: '', offenseId: draft.offenseId })}
                >
                  {label(offender!)}
                </EditorChipButton>
              ) : null}
            </EditorChoiceStack>
          ) : (
            <Box />
          )}
        </>
      )}

      <EditorChoiceStack pending={pendingMistake} gridColumn={3}>
        {draft.offenseId !== null ? (
          <EditorChipButton onClick={() => onChange({ ...draft, offenseId: null })}>
            {errorOffenseLabels[draft.offenseId]}
          </EditorChipButton>
        ) : (
          (Object.entries(errorOffenseLabels) as [string, string][]).map(([value, labelText]) => (
            <EditorChoiceButton
              key={value}
              onClick={() =>
                onChange({ ...draft, offenseId: Number(value) as GameEventErrorOffense })
              }
            >
              {labelText}
            </EditorChoiceButton>
          ))
        )}
      </EditorChoiceStack>
    </EditorGrid>
  );
}
