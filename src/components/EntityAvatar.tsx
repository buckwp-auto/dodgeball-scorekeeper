import { Avatar } from '@mui/material';
import { useEffect, useState } from 'react';
import {
  entityInitials,
  imageSrc,
  type ImageRef,
} from '../domain/imageRef';

export function EntityAvatar({
  name,
  image,
  size = 32,
}: {
  name: string;
  image?: ImageRef | null;
  size?: number;
}) {
  const src = imageSrc(image);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <Avatar
      src={failed ? undefined : src ?? undefined}
      alt=""
      sx={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.4),
        flexShrink: 0,
      }}
      slotProps={{
        img: {
          referrerPolicy: 'no-referrer',
          onError: () => setFailed(true),
        },
      }}
    >
      {entityInitials(name)}
    </Avatar>
  );
}
