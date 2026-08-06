export type BannerColumnKind = 'home' | 'away' | 'throwing' | 'defending' | 'none';

export function getThrowPhaseOneBannerColumns(showTarget: boolean): BannerColumnKind[] {
  if (!showTarget) {
    return ['home', 'away', 'none'];
  }
  return ['throwing', 'defending', 'none'];
}
