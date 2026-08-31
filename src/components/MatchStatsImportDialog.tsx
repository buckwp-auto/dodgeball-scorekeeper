import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import type { ImportMatchSeriesInput } from '../domain/statistics/importedMatchStats';
import {
  parseLegacyStatisticsCsv,
  suggestSeriesFromLegacyCsv,
} from '../domain/statistics/legacyCsvImport';

type MatchStatsImportDialogProps = {
  open: boolean;
  homeTeamName: string;
  awayTeamName: string;
  csvText: string;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (series: ImportMatchSeriesInput) => void;
};

export function MatchStatsImportDialog({
  open,
  homeTeamName,
  awayTeamName,
  csvText,
  busy = false,
  error = null,
  onClose,
  onConfirm,
}: MatchStatsImportDialogProps) {
  const parsed = useMemo(() => {
    try {
      return { rows: parseLegacyStatisticsCsv(csvText).rows, error: null as string | null };
    } catch (parseError) {
      const message = parseError instanceof Error ? parseError.message : 'Could not parse CSV';
      return { rows: [], error: message };
    }
  }, [csvText]);

  const hint = useMemo(() => {
    if (parsed.error || parsed.rows.length === 0) return null;
    try {
      return suggestSeriesFromLegacyCsv(
        { rows: parsed.rows },
        homeTeamName,
        awayTeamName,
      );
    } catch {
      return null;
    }
  }, [parsed.error, parsed.rows, homeTeamName, awayTeamName]);

  const [homeWins, setHomeWins] = useState('0');
  const [awayWins, setAwayWins] = useState('0');
  const [ties, setTies] = useState('0');
  const [matchFinished, setMatchFinished] = useState(true);

  useEffect(() => {
    if (!open) return;
    setHomeWins(String(hint?.homeGameWins ?? 0));
    setAwayWins(String(hint?.awayGameWins ?? 0));
    setTies(String(hint?.tiedGames ?? 0));
    setMatchFinished(true);
  }, [open, hint?.awayGameWins, hint?.homeGameWins, hint?.tiedGames]);

  const parseSeries = (): ImportMatchSeriesInput | null => {
    const homeGameWins = Number(homeWins);
    const awayGameWins = Number(awayWins);
    const tiedGames = Number(ties);
    if (
      !Number.isInteger(homeGameWins) ||
      !Number.isInteger(awayGameWins) ||
      !Number.isInteger(tiedGames) ||
      homeGameWins < 0 ||
      awayGameWins < 0 ||
      tiedGames < 0
    ) {
      return null;
    }
    return {
      homeGameWins,
      awayGameWins,
      tiedGames,
      matchFinished,
    };
  };

  const series = parseSeries();
  const canSubmit = Boolean(series) && !parsed.error && parsed.rows.length > 0 && !busy;

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Import match statistics</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {parsed.error ? <Alert severity="error">{parsed.error}</Alert> : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
          {!parsed.error ? (
            <Typography variant="body2" color="text.secondary">
              {parsed.rows.length} player row{parsed.rows.length === 1 ? '' : 's'} from CSV.
              Team names must match {homeTeamName} (home) and {awayTeamName} (away).
            </Typography>
          ) : null}
          <Typography variant="subtitle2">Match game score</Typography>
          <Typography variant="body2" color="text.secondary">
            Legacy CSV does not include the team series score. Enter the home/away game wins
            {hint ? ' (suggested from player game rows — confirm or edit)' : ''}.
          </Typography>
          <Stack direction="row" spacing={1}>
            <TextField
              label={`${homeTeamName} game wins`}
              type="number"
              size="small"
              value={homeWins}
              onChange={(event) => setHomeWins(event.target.value)}
              slotProps={{ htmlInput: { min: 0, step: 1 } }}
              fullWidth
            />
            <TextField
              label={`${awayTeamName} game wins`}
              type="number"
              size="small"
              value={awayWins}
              onChange={(event) => setAwayWins(event.target.value)}
              slotProps={{ htmlInput: { min: 0, step: 1 } }}
              fullWidth
            />
            <TextField
              label="Ties"
              type="number"
              size="small"
              value={ties}
              onChange={(event) => setTies(event.target.value)}
              slotProps={{ htmlInput: { min: 0, step: 1 } }}
              sx={{ width: 96 }}
            />
          </Stack>
          <FormControlLabel
            control={
              <Checkbox
                checked={matchFinished}
                onChange={(event) => setMatchFinished(event.target.checked)}
              />
            }
            label="Match finished"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!canSubmit}
          onClick={() => {
            if (!series) return;
            onConfirm(series);
          }}
        >
          Import statistics
        </Button>
      </DialogActions>
    </Dialog>
  );
}
