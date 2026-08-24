import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { getMatchName } from '../domain/database';
import { getAdjacentGameId, getMatchById } from '../domain/matchGame';
import { addGameWithAutoRoster } from '../domain/rosterAutoSelect';
import { useDatabase } from '../state/DatabaseContext';

export function useMatchGameNavigation(matchId: string, gameId: string) {
  const navigate = useNavigate();
  const { data, mutate } = useDatabase();
  const previousGameId = getAdjacentGameId(data, matchId, gameId, -1);
  const nextExistingGameId = getAdjacentGameId(data, matchId, gameId, 1);

  const goToGameRoster = useCallback(
    (targetGameId: string) => {
      navigate(`/matches/${matchId}/games/${targetGameId}`);
    },
    [matchId, navigate],
  );

  const goToMatch = useCallback(() => {
    navigate(`/matches/${matchId}/events`);
  }, [matchId, navigate]);

  const goToPreviousGame = useCallback(() => {
    if (previousGameId) goToGameRoster(previousGameId);
  }, [previousGameId, goToGameRoster]);

  const goToNextGame = useCallback(() => {
    if (nextExistingGameId) {
      goToGameRoster(nextExistingGameId);
      return;
    }
    const createdId = mutate(
      (draft) => {
        const id = addGameWithAutoRoster(draft, matchId);
        const match = getMatchById(draft, matchId);
        return {
          id,
          message: match
            ? `Added game to match (${getMatchName(draft, match)}).`
            : 'Added game to match.',
        };
      },
      ({ message }) => message,
    ).id;
    goToGameRoster(createdId);
  }, [nextExistingGameId, goToGameRoster, mutate, matchId]);

  return {
    previousGameId,
    goToPreviousGame,
    goToNextGame,
    goToMatch,
    goToGameRoster,
  };
}
