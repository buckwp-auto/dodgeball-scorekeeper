import {
  Box,
  Button,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useState, type FormEvent, type ReactNode } from 'react';

type FormOneLineProps = {
  label?: string;
  buttonText: string;
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  canSubmit: boolean;
  maxLength?: number;
};

export function FormOneLine({
  label,
  buttonText,
  value,
  onValueChange,
  onSubmit,
  canSubmit,
  maxLength,
}: FormOneLineProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (canSubmit) onSubmit();
  };

  return (
    <Box
      component="form"
      className="row form-one-line"
      onSubmit={submit}
      sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', mb: 2 }}
    >
      <Box className="col" sx={{ flex: 1 }}>
        {label ? (
          <Typography
            variant="caption"
            className="form-input-label"
            sx={{ display: 'block', mb: 0.5 }}
          >
            {label}
          </Typography>
        ) : null}
        <TextField
          className="bw-input-text"
          size="small"
          fullWidth
          value={value}
          slotProps={
            maxLength != null
              ? { htmlInput: { maxLength } }
              : undefined
          }
          onChange={(event) => onValueChange(event.target.value)}
        />
      </Box>
      <Box className="col-auto">
        <Button
          type="submit"
          className="bw-button bw-button--text"
          variant="contained"
          disabled={!canSubmit}
        >
          {buttonText}
        </Button>
      </Box>
    </Box>
  );
}

export function PageHeader({ children }: { children: ReactNode }) {
  return (
    <Typography component="h1" variant="h4" gutterBottom>
      {children}
    </Typography>
  );
}

export function TextButton({
  children,
  onClick = () => {},
  expand,
}: {
  children: string;
  onClick?: () => void;
  expand?: boolean;
}) {
  return (
    <Button
      type="button"
      className={`bw-button bw-button--text${expand ? ' bw-button--expand' : ''}`}
      variant="text"
      fullWidth={expand}
      onClick={onClick}
      sx={{ justifyContent: expand ? 'flex-start' : 'center', textTransform: 'none' }}
    >
      <span className="bw-text">{children}</span>
    </Button>
  );
}

export function TeamSearch({
  label,
  teams,
  selectedTeamId,
  onSelect,
  onClear,
}: {
  label: string;
  teams: { Id: string; Name: string }[];
  selectedTeamId: string | null;
  onSelect: (teamId: string) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const selected = teams.find((team) => team.Id === selectedTeamId);
  const results = teams.filter(
    (team) =>
      !query ||
      team.Name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  if (selected) {
    return (
      <div>
        <Typography variant="caption" className="form-input-label" sx={{ display: 'block', mb: 0.5 }}>
          {label}
        </Typography>
        <TextButton expand onClick={onClear}>
          {selected.Name}
        </TextButton>
      </div>
    );
  }

  return (
    <div>
      <Typography variant="caption" className="form-input-label" sx={{ display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      <div
        className={`bw-input-text-search${focused ? ' bw-input-text-search--focused' : ''}`}
      >
        <TextField
          className="bw-input-text"
          size="small"
          fullWidth
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
        />
        {focused && results.length > 0 ? (
          <Paper className="bw-results" elevation={3} sx={{ position: 'absolute', width: '100%', zIndex: 2 }}>
            <List dense disablePadding>
              {results.map((team) => (
                <ListItemButton
                  key={team.Id}
                  className="bw-result"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onSelect(team.Id);
                    setQuery('');
                    setFocused(false);
                  }}
                >
                  <ListItemText
                    primary={team.Name}
                    slotProps={{ primary: { className: 'bw-text' } }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Paper>
        ) : null}
      </div>
    </div>
  );
}
