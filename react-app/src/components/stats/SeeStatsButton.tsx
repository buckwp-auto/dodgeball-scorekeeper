import { Button } from '@mui/material';
import { useNavigate } from 'react-router';

export function SeeStatsButton({
  to,
  size = 'small',
  label = 'See stats',
}: {
  to: string;
  size?: 'small' | 'medium';
  label?: string;
}) {
  const navigate = useNavigate();
  return (
    <Button
      type="button"
      size={size}
      variant="outlined"
      className="bw-button bw-button--text"
      onClick={() => navigate(to)}
    >
      {label}
    </Button>
  );
}
