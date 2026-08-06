import {
  Alert,
  Button,
  CircularProgress,
  Snackbar,
  Stack,
} from '@mui/material';
import { useRef, useState } from 'react';
import { PageHeader } from '../components/Ui';
import { useDatabase } from '../state/DatabaseContext';

const SAMPLE_LEAGUE_URL = `${import.meta.env.BASE_URL}samples/league-six-teams.scrkpr`;

export function OverviewPage() {
  const { exportBytes, replaceDatabase } = useDatabase();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState<'file' | 'sample' | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const busy = loading !== null;

  const downloadDatabase = () => {
    const bytes = exportBytes();
    const blob = new Blob([bytes], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'Dodgeball Database.scrkpr';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importRawDatabase = async (raw: unknown, successLabel: string) => {
    setErrorMessage(null);
    setSuccessOpen(false);
    // Yield so the spinner paints before heavy JSON normalize.
    await new Promise((resolve) => setTimeout(resolve, 0));
    replaceDatabase(raw);
    setSuccessMessage(successLabel);
    setSuccessOpen(true);
  };

  const onFile = async (file: File) => {
    setLoading('file');
    try {
      const text = await file.text();
      await importRawDatabase(JSON.parse(text), `Loaded “${file.name}” successfully.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(`Could not load database: ${detail}`);
    } finally {
      setLoading(null);
    }
  };

  const onLoadSampleLeague = async () => {
    setLoading('sample');
    try {
      const response = await fetch(SAMPLE_LEAGUE_URL);
      if (!response.ok) {
        throw new Error(`Could not fetch sample (${response.status})`);
      }
      const raw: unknown = await response.json();
      await importRawDatabase(
        raw,
        'Loaded sample league (demo) — six teams with matches and games.',
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(`Could not load sample league: ${detail}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <PageHeader>Overview</PageHeader>
      <Stack direction="row" spacing={1} className="button-row" sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <Button
          type="button"
          className="bw-button bw-button--text"
          variant="contained"
          disabled={busy}
          onClick={downloadDatabase}
        >
          Download Database
        </Button>
        <Button
          type="button"
          className="bw-button bw-button--text"
          variant="outlined"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          startIcon={loading === 'file' ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {loading === 'file' ? 'Loading…' : 'Load from file'}
        </Button>
        <Button
          type="button"
          className="bw-button bw-button--text"
          variant="outlined"
          disabled={busy}
          onClick={() => void onLoadSampleLeague()}
          startIcon={loading === 'sample' ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {loading === 'sample' ? 'Loading…' : 'Load sample league (demo)'}
        </Button>
      </Stack>

      {busy ? (
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mt: 2 }}>
          <CircularProgress size={28} />
          <Alert severity="info" sx={{ flex: 1 }}>
            {loading === 'sample' ? 'Importing sample league…' : 'Importing database…'}
          </Alert>
        </Stack>
      ) : null}

      {errorMessage ? (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      ) : null}

      <Snackbar
        open={successOpen}
        autoHideDuration={4000}
        onClose={() => setSuccessOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setSuccessOpen(false)}>
          {successMessage}
        </Alert>
      </Snackbar>

      <input
        ref={fileInputRef}
        type="file"
        accept=".scrkpr"
        style={{ display: 'none' }}
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onFile(file);
          event.target.value = '';
        }}
      />
    </>
  );
}
