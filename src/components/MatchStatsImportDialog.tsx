import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  ListSubheader,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useEffect, useMemo, useState } from 'react';
import { getPlayersForTeam, getTeam, getTeams } from '../domain/database';
import { listMatchLabelSuggestions } from '../domain/matchLabels';
import type { ImportMatchSeriesInput } from '../domain/statistics/importedMatchStats';
import {
  parseStatsCsv,
  suggestSeriesFromCsv,
  type StatsCsvParseResult,
} from '../domain/statistics/statsCsvImport';
import {
  reviewStatsImport,
  rowImportSide,
  setImportPlayerChoice,
  setImportSideTeam,
  suggestStatsImportSelection,
  suggestSubstituteLinks,
  swapImportSides,
  type FixedImportTeams,
  type ImportPlayerChoice,
  type ImportSideKey,
  type ImportTeamChoice,
  type StatsImportSelection,
} from '../domain/statistics/statsCsvImportPlan';
import { useDatabase } from '../state/DatabaseContext';
import { MatchLabelsEditor } from './MatchLabels';

export type MatchStatsImportConfirm = {
  parsed: StatsCsvParseResult;
  selection: StatsImportSelection;
  series: ImportMatchSeriesInput;
  labels: string[];
};

type MatchStatsImportDialogProps = {
  open: boolean;
  csvText: string;
  /** Importing into an existing match: its teams are locked. */
  fixedTeams?: FixedImportTeams | null;
  /** Labels to start from (the existing match's labels when re-importing). */
  initialLabels?: string[];
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (input: MatchStatsImportConfirm) => void;
};

const CREATE_TEAM = '__create__';
const CREATE_PLAYER = '__create__';
const SKIP_PLAYER = '__skip__';
const SUB_PLAYER = '__sub__';
const SUB_LINK_PREFIX = 'sub:';

function teamChoiceValue(choice: ImportTeamChoice): string {
  return choice.kind === 'existing' ? choice.teamId : CREATE_TEAM;
}

function playerChoiceValue(choice: ImportPlayerChoice | undefined): string {
  if (!choice || choice.kind === 'create') return CREATE_PLAYER;
  if (choice.kind === 'skip') return SKIP_PLAYER;
  if (choice.kind === 'substitute') {
    return choice.linkedPlayerId ? `${SUB_LINK_PREFIX}${choice.linkedPlayerId}` : SUB_PLAYER;
  }
  return choice.playerId;
}

function playerChoiceFromValue(value: string): ImportPlayerChoice {
  if (value === CREATE_PLAYER) return { kind: 'create' };
  if (value === SKIP_PLAYER) return { kind: 'skip' };
  if (value === SUB_PLAYER) return { kind: 'substitute' };
  if (value.startsWith(SUB_LINK_PREFIX)) {
    return { kind: 'substitute', linkedPlayerId: value.slice(SUB_LINK_PREFIX.length) };
  }
  return { kind: 'existing', playerId: value };
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function MatchStatsImportDialog({
  open,
  csvText,
  fixedTeams = null,
  initialLabels,
  busy = false,
  error = null,
  onClose,
  onConfirm,
}: MatchStatsImportDialogProps) {
  const { data } = useDatabase();

  const parsed = useMemo(() => {
    try {
      return { result: parseStatsCsv(csvText), error: null as string | null };
    } catch (parseError) {
      const message = parseError instanceof Error ? parseError.message : 'Could not parse CSV';
      return { result: null, error: message };
    }
  }, [csvText]);
  const rows = parsed.result?.rows ?? [];

  const [selection, setSelection] = useState<StatsImportSelection | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [homeWins, setHomeWins] = useState('0');
  const [awayWins, setAwayWins] = useState('0');
  const [ties, setTies] = useState('0');
  const [matchFinished, setMatchFinished] = useState(true);
  const [labels, setLabels] = useState<string[]>([]);
  const labelSuggestions = useMemo(() => listMatchLabelSuggestions(data), [data]);

  useEffect(() => {
    if (open) setLabels(initialLabels ?? []);
    // Seed only when the dialog opens so live sync does not reset the uploader's edits.
  }, [open]);

  const fixedHome = fixedTeams?.homeTeamId;
  const fixedAway = fixedTeams?.awayTeamId;
  useEffect(() => {
    if (!open || !parsed.result) {
      setSelection(null);
      setSelectionError(null);
      return;
    }
    try {
      setSelection(
        suggestStatsImportSelection(
          data,
          parsed.result.rows,
          fixedHome && fixedAway ? { homeTeamId: fixedHome, awayTeamId: fixedAway } : null,
        ),
      );
      setSelectionError(null);
    } catch (suggestError) {
      setSelection(null);
      setSelectionError(
        suggestError instanceof Error ? suggestError.message : 'Could not match teams',
      );
    }
    // Re-suggest only when a file is opened so live sync does not reset the uploader's choices.
  }, [open, parsed.result, fixedHome, fixedAway]);

  const homeCsv = selection?.home.csvTeamName;
  const awayCsv = selection?.away.csvTeamName;
  useEffect(() => {
    if (!open || !homeCsv || !awayCsv) return;
    const hint = suggestSeriesFromCsv(rows, homeCsv, awayCsv);
    setHomeWins(String(hint.homeGameWins));
    setAwayWins(String(hint.awayGameWins));
    setTies(String(hint.tiedGames));
    setMatchFinished(true);
  }, [open, homeCsv, awayCsv]);

  const review = useMemo(
    () => (selection ? reviewStatsImport(data, rows, selection) : null),
    [data, rows, selection],
  );

  const homeSide = selection?.home;
  const awaySide = selection?.away;
  const subLinks = useMemo(
    () =>
      rows.map((row) =>
        homeSide && awaySide
          ? suggestSubstituteLinks(data, { home: homeSide, away: awaySide }, row.playerName)
          : [],
      ),
    [data, rows, homeSide, awaySide],
  );

  const teams = getTeams(data);
  const sideTeamName = (side: ImportSideKey): string => {
    const choice = selection?.[side].team;
    if (!choice) return side === 'home' ? 'Home' : 'Away';
    return choice.kind === 'existing'
      ? (getTeam(data, choice.teamId)?.Name ?? 'Unknown team')
      : choice.name;
  };

  const series = ((): ImportMatchSeriesInput | null => {
    const homeGameWins = Number(homeWins);
    const awayGameWins = Number(awayWins);
    const tiedGames = Number(ties);
    const valid = [homeGameWins, awayGameWins, tiedGames].every(
      (value) => Number.isInteger(value) && value >= 0,
    );
    if (!valid || homeGameWins + awayGameWins + tiedGames < 1) return null;
    return { homeGameWins, awayGameWins, tiedGames, matchFinished };
  })();

  const fatalError = parsed.error ?? selectionError;
  const warningCount =
    (review?.unmatchedTeams.length ?? 0) +
    (review?.unmatchedPlayerRows.length ?? 0) +
    (parsed.result?.missingStats.length ?? 0);
  const canSubmit =
    !fatalError && selection && review && review.errors.length === 0 && series && !busy;

  const unmatchedRows = new Set(review?.unmatchedPlayerRows ?? []);
  const summaryParts = review
    ? [
        review.newTeamNames.length ? `${plural(review.newTeamNames.length, 'new team')}` : null,
        review.newPlayerNames.length
          ? `${plural(review.newPlayerNames.length, 'new player')}`
          : null,
        review.substitutePlayerNames.length
          ? `${plural(review.substitutePlayerNames.length, 'substitute')}`
          : null,
        review.skippedPlayerNames.length
          ? `${plural(review.skippedPlayerNames.length, 'skipped row')}`
          : null,
      ].filter(Boolean)
    : [];
  const importSummary = summaryParts.length ? `This import adds ${summaryParts.join(', ')}.` : null;

  const renderSide = (side: ImportSideKey) => {
    if (!selection) return null;
    const current = selection[side];
    const unmatched = review?.unmatchedTeams.includes(current.csvTeamName) ?? false;
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Typography variant="body2" sx={{ width: 48, fontWeight: 600 }}>
          {side === 'home' ? 'Home' : 'Away'}
        </Typography>
        <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap title={current.csvTeamName}>
          CSV: “{current.csvTeamName}”
        </Typography>
        <TextField
          select
          size="small"
          label={`${side === 'home' ? 'Home' : 'Away'} team`}
          value={teamChoiceValue(current.team)}
          disabled={Boolean(fixedTeams) || busy}
          onChange={(event) => {
            const value = event.target.value;
            const team: ImportTeamChoice =
              value === CREATE_TEAM
                ? { kind: 'create', name: current.csvTeamName }
                : { kind: 'existing', teamId: value };
            setSelection(setImportSideTeam(data, rows, selection, side, team));
          }}
          sx={{ flex: 1, minWidth: 200 }}
        >
          {teams.map((team) => (
            <MenuItem key={team.Id} value={team.Id}>
              {team.Name}
            </MenuItem>
          ))}
          {!fixedTeams ? (
            <MenuItem value={CREATE_TEAM}>Create new team “{current.csvTeamName}”</MenuItem>
          ) : null}
        </TextField>
        {unmatched ? (
          <WarningAmberIcon color="warning" fontSize="small" titleAccess="Name does not match a league team" />
        ) : null}
      </Stack>
    );
  };

  const playerOptions = (teamChoice: ImportTeamChoice) =>
    teamChoice.kind === 'existing' ? getPlayersForTeam(data, teamChoice.teamId) : [];

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>Import match statistics</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {fatalError ? <Alert severity="error">{fatalError}</Alert> : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
          {review?.errors.map((message) => (
            <Alert key={message} severity="error">
              {message}
            </Alert>
          ))}
          {parsed.result ? (
            <Typography variant="body2" color="text.secondary">
              Read {plural(rows.length, 'player row')} (
              {parsed.result.format === 'sectioned'
                ? 'scorekeeper statistics export'
                : 'spreadsheet columns'}
              ).
            </Typography>
          ) : null}

          {selection ? (
            <>
              <Typography variant="subtitle2">Teams</Typography>
              {review && review.unmatchedTeams.length > 0 ? (
                <Alert severity="warning">
                  {review.unmatchedTeams.map((name) => `“${name}”`).join(' and ')}{' '}
                  {review.unmatchedTeams.length === 1 ? "doesn't" : "don't"} match a league team
                  by name.{' '}
                  {fixedTeams
                    ? 'Check that the CSV is for this match, or swap sides.'
                    : 'Pick the right team or create a new one.'}
                </Alert>
              ) : null}
              <Stack spacing={1}>
                {renderSide('home')}
                <Box>
                  <Button
                    size="small"
                    startIcon={<SwapVertIcon />}
                    disabled={busy}
                    onClick={() =>
                      setSelection(swapImportSides(data, rows, selection, fixedTeams))
                    }
                  >
                    Swap home / away
                  </Button>
                </Box>
                {renderSide('away')}
              </Stack>

              <Typography variant="subtitle2">Players</Typography>
              {review && review.unmatchedPlayerRows.length > 0 ? (
                <Alert severity="warning">
                  {plural(review.unmatchedPlayerRows.length, 'player')} didn't match anyone on
                  their team. Choose whether each one is a new player, a substitute (optionally
                  subbing for a player on another team), an existing player, or skipped.
                </Alert>
              ) : null}
              <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
                <Table size="small" stickyHeader className="sk-import-players">
                  <TableHead>
                    <TableRow>
                      <TableCell>Team</TableCell>
                      <TableCell>CSV player</TableCell>
                      <TableCell>Import as</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row, index) => {
                      const side = rowImportSide(selection, row);
                      const options = playerOptions(selection[side].team);
                      const unmatched = unmatchedRows.has(index);
                      return (
                        <TableRow key={`${row.teamName}-${row.playerName}-${index}`}>
                          <TableCell>{sideTeamName(side)}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                              {unmatched ? (
                                <WarningAmberIcon
                                  color="warning"
                                  fontSize="small"
                                  titleAccess="No matching player"
                                />
                              ) : null}
                              <span>{row.playerName}</span>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <TextField
                              select
                              size="small"
                              value={playerChoiceValue(selection.players[index])}
                              disabled={busy}
                              onChange={(event) =>
                                setSelection(
                                  setImportPlayerChoice(
                                    selection,
                                    index,
                                    playerChoiceFromValue(event.target.value),
                                  ),
                                )
                              }
                              slotProps={{
                                htmlInput: { 'aria-label': `Import ${row.playerName} as` },
                              }}
                              sx={{ minWidth: 220 }}
                            >
                              <MenuItem value={CREATE_PLAYER}>
                                Create new player “{row.playerName}”
                              </MenuItem>
                              <MenuItem value={SUB_PLAYER}>
                                Add “{row.playerName}” as a substitute
                              </MenuItem>
                              {options.length > 0 ? (
                                <ListSubheader>{sideTeamName(side)} players</ListSubheader>
                              ) : null}
                              {options.map((player) => (
                                <MenuItem key={player.Id} value={player.Id}>
                                  {player.Name}
                                </MenuItem>
                              ))}
                              {subLinks[index].length > 0 ? (
                                <ListSubheader>Substitute for a player on another team</ListSubheader>
                              ) : null}
                              {subLinks[index].map((candidate) => (
                                <MenuItem
                                  key={candidate.playerId}
                                  value={`${SUB_LINK_PREFIX}${candidate.playerId}`}
                                >
                                  Sub for {candidate.playerName} ({candidate.teamName})
                                </MenuItem>
                              ))}
                              <MenuItem value={SKIP_PLAYER}>Skip this row</MenuItem>
                            </TextField>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Box>
            </>
          ) : null}

          {parsed.result && parsed.result.missingStats.length > 0 ? (
            <Alert severity="warning" className="sk-import-missing-stats">
              These expected stats aren't in the CSV and will be imported as zero:
              <Box component="ul" sx={{ my: 0.5, pl: 2.5 }}>
                {parsed.result.missingStats.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </Box>
            </Alert>
          ) : null}
          {parsed.result?.notes.map((note) => (
            <Alert key={note} severity="info">
              {note}
            </Alert>
          ))}
          {parsed.result && parsed.result.ignoredColumns.length > 0 ? (
            <Typography variant="caption" color="text.secondary">
              Ignored columns: {parsed.result.ignoredColumns.join(', ')}
            </Typography>
          ) : null}

          {selection ? (
            <>
              <Typography variant="subtitle2">Match game score</Typography>
              <Typography variant="body2" color="text.secondary">
                The CSV doesn't include the series score. Enter the home/away game wins
                (suggested from player game records; confirm or edit).
              </Typography>
              <Stack direction="row" spacing={1}>
                <TextField
                  label={`${sideTeamName('home')} game wins`}
                  type="number"
                  size="small"
                  value={homeWins}
                  onChange={(event) => setHomeWins(event.target.value)}
                  slotProps={{ htmlInput: { min: 0, step: 1 } }}
                  fullWidth
                />
                <TextField
                  label={`${sideTeamName('away')} game wins`}
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
              <MatchLabelsEditor
                value={labels}
                suggestions={labelSuggestions}
                onChange={setLabels}
              />
              {importSummary ? (
                <Typography variant="body2" color="text.secondary">
                  {importSummary}
                </Typography>
              ) : null}
            </>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color={warningCount > 0 ? 'warning' : 'primary'}
          disabled={!canSubmit}
          onClick={() => {
            if (!parsed.result || !selection || !series) return;
            onConfirm({ parsed: parsed.result, selection, series, labels });
          }}
        >
          {warningCount > 0 ? 'Import anyway' : 'Import statistics'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
