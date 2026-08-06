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

export function OverviewPage() {
  const { exportBytes, replaceDatabase } = useDatabase();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const onFile = async (file: File) => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessOpen(false);
    try {
      // Yield so the spinner paints before heavy JSON parse/normalize.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const text = await file.text();
      replaceDatabase(JSON.parse(text));
      setSuccessMessage(`Loaded “${file.name}” successfully.`);
      setSuccessOpen(true);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(`Could not load database: ${detail}`);
    } finally {
      setLoading(false);
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
          disabled={loading}
          onClick={downloadDatabase}
        >
          Download Database
        </Button>
        <Button
          type="button"
          className="bw-button bw-button--text"
          variant="outlined"
          disabled={loading}
          onClick={() => fileInputRef.current?.click()}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {loading ? 'Loading…' : 'Load Database'}
        </Button>
      </Stack>

      {loading ? (
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mt: 2 }}>
          <CircularProgress size={28} />
          <Alert severity="info" sx={{ flex: 1 }}>
            Importing database…
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
        disabled={loading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onFile(file);
          event.target.value = '';
        }}
      />
    </>
  );
}
