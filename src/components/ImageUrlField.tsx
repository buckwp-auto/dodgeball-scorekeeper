import { Stack, TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import { imageRefFromExternalUrl, type ImageRef } from '../domain/imageRef';
import { MAX_IMAGE_URL } from '../domain/limits';
import { EntityAvatar } from './EntityAvatar';

export function ImageUrlField({
  label,
  name,
  image,
  onSave,
  disabled = false,
  size = 40,
  showAvatar = true,
}: {
  label: string;
  name: string;
  image?: ImageRef | null;
  onSave: (url: string | null) => void;
  disabled?: boolean;
  size?: number;
  showAvatar?: boolean;
}) {
  const current = image?.url ?? '';
  const [draft, setDraft] = useState(current);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(image?.url ?? '');
    setError(null);
  }, [image?.url]);

  const save = () => {
    const trimmed = draft.trim();
    if (trimmed === (image?.url ?? '')) return;
    if (!trimmed) {
      onSave(null);
      setError(null);
      return;
    }
    try {
      imageRefFromExternalUrl(trimmed);
      onSave(trimmed);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid image URL');
    }
  };

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: 'flex-start', flexWrap: 'wrap', width: '100%' }}
    >
      {showAvatar ? <EntityAvatar name={name} image={image} size={size} /> : null}
      <TextField
        size="small"
        label={label}
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            save();
            (event.target as HTMLInputElement).blur();
          }
        }}
        error={Boolean(error)}
        helperText={error ?? 'https URL only. Leave blank to clear.'}
        slotProps={{ htmlInput: { maxLength: MAX_IMAGE_URL } }}
        sx={{ minWidth: 240, flex: 1 }}
      />
    </Stack>
  );
}
