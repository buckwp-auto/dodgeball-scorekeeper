import {
  Alert,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { ImageUrlField } from '../components/ImageUrlField';
import { PageHeader } from '../components/Ui';
import { imageRefFromExternalUrl } from '../domain/imageRef';
import {
  normalizeHighlightQualifiers,
  resolveHighlightQualifiers,
  resolveLeagueStatPolicy,
  setLeagueSettings,
  type HighlightQualifierSettings,
} from '../domain/leagueSettings';
import {
  matchingStatCreditPreset,
  normalizeStatCreditPolicy,
  STAT_CREDIT_PRESET_OPTIONS,
  STAT_CREDIT_PRESETS,
  TEAM_THROW_ASSIST_MODES,
  TEAM_THROW_KILL_CREDIT_MODES,
  type StatCreditPolicy,
  type StatCreditPresetId,
  type TeamThrowAssistMode,
  type TeamThrowKillCreditMode,
} from '../domain/statistics/statCreditPolicy';
import { useDatabase } from '../state/DatabaseContext';
import { useLeague } from '../state/LeagueContext';

const MODE_LABELS: Record<TeamThrowKillCreditMode, string> = {
  legacyPerThrow: 'Legacy (1/N including non-hitters)',
  splitEqual: 'Split equally among hitters',
  fullEach: 'Full credit to each hitter',
  firstWeighted: 'First hitter weighted',
  primaryOnly: 'First hitter only',
};

const ASSIST_LABELS: Record<TeamThrowAssistMode, string> = {
  none: 'None',
  nonKillThrowers: 'Non-hitting teammates',
};

function presetFromSelect(value: string): StatCreditPresetId | 'custom' {
  if (value === 'custom') return 'custom';
  if (value in STAT_CREDIT_PRESETS) return value as StatCreditPresetId;
  return 'custom';
}

export function SettingsPage() {
  const { data, mutate } = useDatabase();
  const {
    activeLeagueId,
    canDeleteMatchesAndGames,
    canOverrideActiveLeague,
    leagues,
    updateLeagueImages,
  } = useLeague();
  const canEdit = canDeleteMatchesAndGames;
  const activeLeague = leagues.find((league) => league.id === activeLeagueId);
  const canEditImages = Boolean(activeLeagueId && canOverrideActiveLeague);
  const savedPolicy = useMemo(() => resolveLeagueStatPolicy(data), [data]);
  const savedQualifiers = useMemo(() => resolveHighlightQualifiers(data), [data]);
  const savedKey = JSON.stringify({ policy: savedPolicy, qualifiers: savedQualifiers });
  const [draft, setDraft] = useState<StatCreditPolicy>(savedPolicy);
  const [qualifiers, setQualifiers] =
    useState<HighlightQualifierSettings>(savedQualifiers);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    const parsed = JSON.parse(savedKey) as {
      policy: StatCreditPolicy;
      qualifiers: HighlightQualifierSettings;
    };
    setDraft(parsed.policy);
    setQualifiers(parsed.qualifiers);
  }, [savedKey]);

  const preset = matchingStatCreditPreset(draft);
  const dirty =
    JSON.stringify(normalizeStatCreditPolicy(draft)) !==
      JSON.stringify(normalizeStatCreditPolicy(savedPolicy)) ||
    JSON.stringify(normalizeHighlightQualifiers(qualifiers)) !==
      JSON.stringify(normalizeHighlightQualifiers(savedQualifiers));

  const update = (patch: Partial<StatCreditPolicy>) => {
    setDraft((current) => normalizeStatCreditPolicy({ ...current, ...patch }));
    setSavedMessage(null);
  };

  const updateQualifiers = (patch: Partial<HighlightQualifierSettings>) => {
    setQualifiers((current) => normalizeHighlightQualifiers({ ...current, ...patch }));
    setSavedMessage(null);
  };

  const onPreset = (id: StatCreditPresetId | 'custom') => {
    if (id === 'custom') return;
    setDraft(STAT_CREDIT_PRESETS[id]);
    setSavedMessage(null);
  };

  const save = () => {
    mutate((draftData) => {
      setLeagueSettings(draftData, draft, qualifiers);
    }, 'Updated league stat settings.');
    setSavedMessage('Saved. Stats recalculate from existing games immediately.');
  };

  const saveLeagueImage = async (field: 'logo' | 'banner', url: string | null) => {
    try {
      setImageError(null);
      const ref = url ? imageRefFromExternalUrl(url) : null;
      await updateLeagueImages({ [field]: ref });
      setSavedMessage(
        field === 'logo' ? 'League logo updated.' : 'League banner updated.',
      );
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Image update failed');
    }
  };

  return (
    <>
      <PageHeader>League Stat Settings</PageHeader>
      <Typography variant="body1" sx={{ mb: 2, maxWidth: 720 }}>
        Configure highlight-leaderboard minimums and how this league awards kill credit for team
        throws, deflections, multi-kills, and catches. Changing settings does not edit scored
        events — leaderboards and CSV recalculate from the games already recorded.
      </Typography>
      {activeLeagueId && !canEdit ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Only the league admin can change league stat settings. You can still view the current
          policy.
        </Alert>
      ) : null}
      {savedMessage ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          {savedMessage}
        </Alert>
      ) : null}
      {imageError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {imageError}
        </Alert>
      ) : null}

      {canEditImages && activeLeague ? (
        <Stack spacing={2} sx={{ mb: 3, maxWidth: 720 }}>
          <Typography variant="h6">League images</Typography>
          <Typography variant="body2" color="text.secondary">
            Paste https URLs for the league logo (directory) and optional banner (Overview).
            File upload comes later with Cloud Storage.
          </Typography>
          <ImageUrlField
            label="Logo URL"
            name={activeLeague.name}
            image={activeLeague.logo}
            onSave={(url) => void saveLeagueImage('logo', url)}
          />
          <ImageUrlField
            label="Banner URL"
            name={activeLeague.name}
            image={activeLeague.banner}
            size={56}
            onSave={(url) => void saveLeagueImage('banner', url)}
          />
        </Stack>
      ) : null}

      <Stack spacing={3} sx={{ maxWidth: 720 }} className="sk-settings">
        <Box className="sk-settings-qualifiers">
          <Typography variant="h6">Leaderboard minimums</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Players must meet every enabled threshold to appear on league highlight leaderboards
            (Caught%, Catch%, Elusiveness%, Efficiency%, Net, VOR, WAR) and to receive VOR/WAR.
            Defaults are on: 15 games, 2 matches, 20 throws and 20 targets.
          </Typography>
          <Stack spacing={2}>
            <FormControlLabel
              disabled={!canEdit}
              control={
                <Switch
                  checked={qualifiers.minGamesEnabled}
                  onChange={(event) =>
                    updateQualifiers({ minGamesEnabled: event.target.checked })
                  }
                />
              }
              label="Require minimum games"
            />
            <TextField
              label="Min games"
              type="number"
              size="small"
              disabled={!canEdit || !qualifiers.minGamesEnabled}
              value={qualifiers.minGames}
              onChange={(event) =>
                updateQualifiers({
                  minGames: Number.parseInt(event.target.value, 10) || 0,
                })
              }
              slotProps={{ htmlInput: { min: 0, max: 999 } }}
              sx={{ width: 160 }}
            />
            <FormControlLabel
              disabled={!canEdit}
              control={
                <Switch
                  checked={qualifiers.minMatchesEnabled}
                  onChange={(event) =>
                    updateQualifiers({ minMatchesEnabled: event.target.checked })
                  }
                />
              }
              label="Require minimum matches"
            />
            <TextField
              label="Min matches"
              type="number"
              size="small"
              disabled={!canEdit || !qualifiers.minMatchesEnabled}
              value={qualifiers.minMatches}
              onChange={(event) =>
                updateQualifiers({
                  minMatches: Number.parseInt(event.target.value, 10) || 0,
                })
              }
              slotProps={{ htmlInput: { min: 0, max: 999 } }}
              sx={{ width: 160 }}
            />
            <FormControlLabel
              disabled={!canEdit}
              control={
                <Switch
                  checked={qualifiers.minVolumeEnabled}
                  onChange={(event) =>
                    updateQualifiers({ minVolumeEnabled: event.target.checked })
                  }
                />
              }
              label="Require minimum throws and targets"
            />
            <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
              <TextField
                label="Min throws"
                type="number"
                size="small"
                disabled={!canEdit || !qualifiers.minVolumeEnabled}
                value={qualifiers.minThrows}
                onChange={(event) =>
                  updateQualifiers({
                    minThrows: Number.parseInt(event.target.value, 10) || 0,
                  })
                }
                slotProps={{ htmlInput: { min: 0, max: 9999 } }}
                sx={{ width: 160 }}
              />
              <TextField
                label="Min targets"
                type="number"
                size="small"
                disabled={!canEdit || !qualifiers.minVolumeEnabled}
                value={qualifiers.minTargets}
                onChange={(event) =>
                  updateQualifiers({
                    minTargets: Number.parseInt(event.target.value, 10) || 0,
                  })
                }
                slotProps={{ htmlInput: { min: 0, max: 9999 } }}
                sx={{ width: 160 }}
              />
            </Stack>
          </Stack>
        </Box>

        <Typography variant="h6">Stat credit</Typography>
        <FormControl fullWidth disabled={!canEdit}>
          <InputLabel id="sk-stat-preset-label">Preset</InputLabel>
          <Select
            labelId="sk-stat-preset-label"
            label="Preset"
            value={preset}
            onChange={(event) => onPreset(presetFromSelect(String(event.target.value)))}
          >
            {STAT_CREDIT_PRESET_OPTIONS.map((option) => (
              <MenuItem key={option.id} value={option.id}>
                {option.label}
              </MenuItem>
            ))}
            <MenuItem value="custom">Custom</MenuItem>
          </Select>
        </FormControl>
        <Typography variant="body2" color="text.secondary">
          {preset === 'custom'
            ? 'Custom combination of the options below.'
            : STAT_CREDIT_PRESET_OPTIONS.find((option) => option.id === preset)?.description}
        </Typography>

        <FormControl fullWidth disabled={!canEdit}>
          <InputLabel id="sk-team-throw-mode-label">Team-throw kill credit</InputLabel>
          <Select
            labelId="sk-team-throw-mode-label"
            label="Team-throw kill credit"
            value={draft.teamThrowKillCreditMode}
            onChange={(event) =>
              update({
                teamThrowKillCreditMode: event.target.value as TeamThrowKillCreditMode,
              })
            }
          >
            {TEAM_THROW_KILL_CREDIT_MODES.map((mode) => (
              <MenuItem key={mode} value={mode}>
                {MODE_LABELS[mode]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {draft.teamThrowKillCreditMode === 'firstWeighted' ? (
          <Box>
            <Typography gutterBottom>
              First hitter share: {draft.teamThrowFirstHitPercent}%
            </Typography>
            <Slider
              min={0}
              max={100}
              step={5}
              value={draft.teamThrowFirstHitPercent}
              disabled={!canEdit}
              onChange={(_, value) =>
                update({ teamThrowFirstHitPercent: Array.isArray(value) ? value[0] : value })
              }
            />
            <Typography variant="caption" color="text.secondary">
              Uses throw order in the team throw (lowest ordinal = first ball to connect). A solo
              hitter always receives full credit.
            </Typography>
          </Box>
        ) : null}

        <FormControl fullWidth disabled={!canEdit}>
          <InputLabel id="sk-assist-mode-label">Team-throw assists</InputLabel>
          <Select
            labelId="sk-assist-mode-label"
            label="Team-throw assists"
            value={draft.teamThrowAssistMode}
            onChange={(event) =>
              update({ teamThrowAssistMode: event.target.value as TeamThrowAssistMode })
            }
          >
            {TEAM_THROW_ASSIST_MODES.map((mode) => (
              <MenuItem key={mode} value={mode}>
                {ASSIST_LABELS[mode]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControlLabel
          disabled={!canEdit}
          control={
            <Switch
              checked={draft.dedupeSameTargetEliminations}
              onChange={(event) =>
                update({ dedupeSameTargetEliminations: event.target.checked })
              }
            />
          }
          label="One death per unique target in a team throw"
        />

        <Box>
          <Typography gutterBottom>
            Deflection kill weight: {draft.deflectionKillWeight.toFixed(2)}
          </Typography>
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={draft.deflectionKillWeight}
            disabled={!canEdit}
            onChange={(_, value) =>
              update({ deflectionKillWeight: Array.isArray(value) ? value[0] : value })
            }
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Direct hits stay at full weight. Today’s engine uses 1.00 (deflection kills were never
            partial unless you change this).
          </Typography>
        </Box>

        <Box>
          <Typography gutterBottom>
            Deflection-catch death weight: {draft.deflectionCatchDeathWeight.toFixed(2)}
          </Typography>
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={draft.deflectionCatchDeathWeight}
            disabled={!canEdit}
            onChange={(_, value) =>
              update({
                deflectionCatchDeathWeight: Array.isArray(value) ? value[0] : value,
              })
            }
          />
          <Typography variant="caption" color="text.secondary">
            Thrower detriment when only a deflection is caught. A direct catch is always a full
            death.
          </Typography>
        </Box>

        <FormControlLabel
          disabled={!canEdit}
          control={
            <Switch
              checked={draft.countDeflectionCatchesSeparately}
              onChange={(event) =>
                update({ countDeflectionCatchesSeparately: event.target.checked })
              }
            />
          }
          label="Show deflection catches as a separate stat"
        />
        <FormControlLabel
          disabled={!canEdit}
          control={
            <Switch
              checked={draft.trackMultiKills}
              onChange={(event) => update({ trackMultiKills: event.target.checked })}
            />
          }
          label="Track double / triple / quad kills"
        />
        <FormControlLabel
          disabled={!canEdit}
          control={
            <Switch
              checked={draft.trackMultiCatches}
              onChange={(event) => update({ trackMultiCatches: event.target.checked })}
            />
          }
          label="Track multi-catches"
        />

        {canEdit ? (
          <Button
            type="button"
            variant="contained"
            className="bw-button bw-button--text"
            disabled={!dirty}
            onClick={save}
          >
            Save league stat settings
          </Button>
        ) : null}
      </Stack>
    </>
  );
}
