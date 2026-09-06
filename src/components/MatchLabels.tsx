import { Autocomplete, Chip, Stack, TextField } from '@mui/material';
import { useState } from 'react';
import { getMatchLabels, normalizeMatchLabels } from '../domain/matchLabels';
import type { MatchRow } from '../domain/types';

export function MatchLabelChips({
  match,
  labels,
  className = 'sk-match-labels',
}: {
  match?: MatchRow;
  labels?: string[];
  className?: string;
}) {
  const values = labels ?? (match ? getMatchLabels(match) : []);
  if (values.length === 0) return null;
  return (
    <Stack
      direction="row"
      spacing={0.5}
      className={className}
      sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.5 }}
    >
      {values.map((label) => (
        <Chip key={label.toLowerCase()} size="small" label={label} className="sk-match-label" />
      ))}
    </Stack>
  );
}

export function MatchLabelsEditor({
  value,
  suggestions,
  onChange,
}: {
  value: string[];
  suggestions: string[];
  onChange: (labels: string[]) => void;
}) {
  const [inputValue, setInputValue] = useState('');
  const suggestionOptions = suggestions.filter(
    (label) => !value.some((current) => current.toLowerCase() === label.toLowerCase()),
  );

  const commitInput = (raw: string) => {
    const parts = raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    onChange(normalizeMatchLabels([...value, ...parts]));
    setInputValue('');
  };

  return (
    <Autocomplete
      multiple
      freeSolo
      options={suggestionOptions}
      value={value}
      inputValue={inputValue}
      onInputChange={(_, next, reason) => {
        if (reason === 'reset') return;
        if (next.includes(',')) {
          commitInput(next);
          return;
        }
        setInputValue(next);
      }}
      onChange={(_, next) => {
        onChange(
          normalizeMatchLabels(
            next.map((entry) => (typeof entry === 'string' ? entry : String(entry))),
          ),
        );
      }}
      onBlur={() => {
        if (inputValue.trim()) commitInput(inputValue);
      }}
      renderValue={(selected, getItemProps) =>
        selected.map((option, index) => {
          const { key, ...itemProps } = getItemProps({ index });
          return (
            <Chip
              key={key}
              size="small"
              label={option}
              {...itemProps}
              className={`sk-match-label ${itemProps.className ?? ''}`.trim()}
            />
          );
        })
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label="Labels"
          placeholder="Week 3, Playoffs, GOTW…"
          helperText="Pick a suggestion (Week, Playoffs, …) or type your own. Enter or comma to add."
          size="small"
          fullWidth
          className="sk-match-labels-field"
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            if (!inputValue.trim()) return;
            event.preventDefault();
            commitInput(inputValue);
          }}
        />
      )}
      sx={{ maxWidth: 720 }}
    />
  );
}
