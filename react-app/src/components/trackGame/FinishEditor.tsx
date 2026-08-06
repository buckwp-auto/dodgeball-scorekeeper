import { GameEventFinishResult } from '../../domain/statistics/constants';
import type { FinishDraft } from '../../domain/gameEvents';
import { finishResultLabels } from '../../domain/gameEvents';
import { HotkeyBadge } from '../HotkeyBadge';
import {
  EditorChoiceButton,
  EditorChoiceStack,
  EditorGridFinish,
  EditorLabel,
} from './EditorGrid';
import { Stack, Typography } from '@mui/material';

export function FinishEditor({
  draft,
  homeTeamName,
  awayTeamName,
  onChange,
  confirmHint = false,
}: {
  draft: FinishDraft;
  homeTeamName: string;
  awayTeamName: string;
  onChange: (draft: FinishDraft) => void;
  /** Show Enter-to-confirm hint (team wipe prompt). */
  confirmHint?: boolean;
}) {
  const choices: { id: GameEventFinishResult; label: string }[] = [
    { id: GameEventFinishResult.WinHome, label: homeTeamName },
    { id: GameEventFinishResult.WinAway, label: awayTeamName },
    { id: GameEventFinishResult.Tie, label: finishResultLabels[GameEventFinishResult.Tie] },
  ];

  return (
    <EditorGridFinish>
      <EditorLabel>Winner</EditorLabel>
      <EditorChoiceStack pending={draft.resultId === null}>
        {choices.map((choice) => (
          <EditorChoiceButton
            key={choice.id}
            selected={draft.resultId === choice.id}
            onClick={() =>
              onChange({
                resultId: draft.resultId === choice.id ? null : choice.id,
              })
            }
          >
            {choice.label}
          </EditorChoiceButton>
        ))}
      </EditorChoiceStack>
      {confirmHint && draft.resultId !== null ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 2 }}>
          <HotkeyBadge hotkey="Enter" />
          <Typography variant="body2" color="text.secondary">
            Confirm result
          </Typography>
        </Stack>
      ) : null}
    </EditorGridFinish>
  );
}
