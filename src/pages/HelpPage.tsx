import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { PageHeader } from '../components/Ui';
import { useOnboarding } from '../state/OnboardingContext';

const HOW_TO_SECTIONS = [
  {
    title: 'Get started',
    body:
      'On Overview, use Load from file for a `.scrkpr` backup or Load sample league (demo) to explore with six teams and stamped VOD data. ' +
      'Download database saves your current league locally.',
  },
  {
    title: 'Set up teams and a match',
    body:
      'Open Teams to add teams and players. On Matches, pick home and away teams and create a match. ' +
      'The match roster screen lets you confirm who is playing, mark subs, and add one-off players for this match.',
  },
  {
    title: 'Score a game',
    body:
      'From the match, open a game to reach Track Game. Record throws (hit, dodge, block, catch, …), mistakes on the Other tab, and a Finish when a side wins. ' +
      'Undo/redo (`-` / `+`) fix the last committed event. After Game Complete, use Next game to continue the series.',
  },
  {
    title: 'YouTube VOD (optional)',
    body:
      'Paste a YouTube URL on the match page. Track Game stamps events from the player clock and slots the timeline by video time. ' +
      'Use `[` / `]` to dock or expand the player; the keyboard icon lists playback and scoring hotkeys.',
  },
  {
    title: 'Stats and export',
    body:
      'Stats shows league leaderboards, standings, and charts. Match and game screens include See stats and CSV download/copy. ' +
      'League Stat Settings controls players per side, highlight minimums, and stat-credit policy.',
  },
  {
    title: 'Cloud leagues (optional)',
    body:
      'When Firebase is configured, sign in on Overview to create or join a shared league. Admins approve members and can replace league data on import. ' +
      'Scorers can still undo their own game work without admin rights.',
  },
] as const;

const FAQ_ITEMS = [
  {
    q: 'Do I need an account?',
    a: 'No. Without cloud sign-in the app runs entirely in your browser with session storage and `.scrkpr` files.',
  },
  {
    q: 'Where is my data stored?',
    a: 'Local leagues live in session storage until you export or close the tab. Cloud leagues sync through Firebase when signed in.',
  },
  {
    q: 'Can I fix a mistake while scoring?',
    a: 'Yes. Undo/redo the last event, select a timeline row to edit or delete it, or use Edit roster to roll back from a player’s first involvement.',
  },
  {
    q: 'What is the sample league for?',
    a: 'It loads a ready-made league with teams, matches, games, and YouTube timestamps so you can try scoring, stats, and highlights without setup.',
  },
  {
    q: 'Who can delete teams, matches, or the whole league?',
    a: 'League admins (or local-only mode) handle destructive league actions. Match creators and scorers can delete games they manage and undo roster changes for that match.',
  },
  {
    q: 'How do keyboard shortcuts work?',
    a: 'Player and result keys are shown on roster and Track Game screens. Hotkeys ignore focused text fields. Track Game’s YouTube bar has a keyboard icon with the full list.',
  },
] as const;

export function HelpPage() {
  const { startTour } = useOnboarding();

  return (
    <Box className="sk-help-page">
      <PageHeader>Help</PageHeader>
      <Typography color="text.secondary" sx={{ mb: 2, maxWidth: 720 }}>
        How-to guides and answers for getting around Scorekeeper. New here? Take the guided tour of the
        menu and sync bar.
      </Typography>
      <Button
        variant="outlined"
        onClick={startTour}
        className="sk-help-start-tour"
        sx={{ mb: 3, textTransform: 'none' }}
      >
        Start guided tour
      </Button>

      <Typography component="h2" variant="h5" gutterBottom>
        How-to
      </Typography>
      <Stack spacing={0} sx={{ maxWidth: 720, mb: 4 }}>
        {HOW_TO_SECTIONS.map((section, index) => (
          <Box key={section.title}>
            {index > 0 ? <Divider sx={{ my: 2 }} /> : null}
            <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 600 }} gutterBottom>
              {section.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {section.body}
            </Typography>
          </Box>
        ))}
      </Stack>

      <Typography component="h2" variant="h5" gutterBottom>
        FAQ
      </Typography>
      <Box sx={{ maxWidth: 720 }}>
        {FAQ_ITEMS.map((item) => (
          <Accordion key={item.q} disableGutters elevation={0} sx={{ '&::before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} className="sk-help-faq-question">
              <Typography sx={{ fontWeight: 500 }}>{item.q}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary">
                {item.a}
              </Typography>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Box>
  );
}
