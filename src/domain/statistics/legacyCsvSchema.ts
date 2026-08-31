import {
  DeflectionResult,
  ECompetitionOutcome,
  EDeathError,
  EDeathType,
  EKillType,
  EThrowError,
  ThrowResult,
  enumValues,
} from './constants';
import {
  LEGACY_DEATH_TYPE_COLUMNS,
  LEGACY_DEFLECTION_RESULT_COLUMNS,
  LEGACY_KILL_TYPE_COLUMNS,
  LEGACY_THROW_RESULT_COLUMNS,
  enumKey,
} from './legacyCsvExport';

export type LegacyCsvColumnKind =
  | 'team'
  | 'player'
  | 'sectionTotal'
  | 'enumValue';

export type LegacyCsvColumnSpec = {
  header: string;
  kind: LegacyCsvColumnKind;
  sectionTitle?: string;
  enumKey?: number;
  legacyRemap?: boolean;
};

function killEnumObject(): Record<string, number> {
  return { Hit: EKillType.Hit, BlockFailed: EKillType.BlockFailed, CatchFailed: EKillType.CatchFailed };
}

function deathEnumObject(): Record<string, number> {
  return {
    Hit: EDeathType.Hit,
    BlockFailed: EDeathType.BlockFailed,
    CatchFailed: EDeathType.CatchFailed,
    CatchThrown: EDeathType.CatchThrown,
  };
}

function throwEnumObject(): Record<string, number> {
  return {
    Hit: ThrowResult.Hit,
    Block: ThrowResult.Block,
    BlockFailed: ThrowResult.BlockFailed,
    Catch: ThrowResult.Catch,
    CatchFailed: ThrowResult.CatchFailed,
    Dodge: ThrowResult.Dodge,
    Miss: ThrowResult.Miss,
  };
}

function deflectionEnumObject(): Record<string, number> {
  return {
    Hit: DeflectionResult.Hit,
    Block: DeflectionResult.Block,
    BlockFailed: DeflectionResult.BlockFailed,
    Catch: DeflectionResult.Catch,
    CatchFailed: DeflectionResult.CatchFailed,
  };
}

/** Column layout shared by legacy CSV export and import. */
export function getLegacyStatisticsColumnSpecs(): LegacyCsvColumnSpec[] {
  const sections: {
    title: string;
    keys: readonly number[];
    enumObject: Record<string, number | string>;
    legacyRemap?: boolean;
  }[] = [
    {
      title: 'Matches',
      keys: enumValues(ECompetitionOutcome),
      enumObject: ECompetitionOutcome,
    },
    {
      title: 'Games',
      keys: enumValues(ECompetitionOutcome),
      enumObject: ECompetitionOutcome,
    },
    {
      title: 'Kills (Direct) (Individual)',
      keys: LEGACY_KILL_TYPE_COLUMNS,
      enumObject: killEnumObject(),
      legacyRemap: true,
    },
    {
      title: 'Kills (Direct) (Group)',
      keys: LEGACY_KILL_TYPE_COLUMNS,
      enumObject: killEnumObject(),
      legacyRemap: true,
    },
    {
      title: 'Kills Credit (Direct)',
      keys: LEGACY_KILL_TYPE_COLUMNS,
      enumObject: killEnumObject(),
      legacyRemap: true,
    },
    {
      title: 'Kills (Deflection) (Individual)',
      keys: LEGACY_KILL_TYPE_COLUMNS,
      enumObject: killEnumObject(),
      legacyRemap: true,
    },
    {
      title: 'Kills (Deflection) (Group)',
      keys: LEGACY_KILL_TYPE_COLUMNS,
      enumObject: killEnumObject(),
      legacyRemap: true,
    },
    {
      title: 'Kills Credit (Deflection)',
      keys: LEGACY_KILL_TYPE_COLUMNS,
      enumObject: killEnumObject(),
      legacyRemap: true,
    },
    {
      title: 'Deaths (Direct)',
      keys: LEGACY_DEATH_TYPE_COLUMNS,
      enumObject: deathEnumObject(),
      legacyRemap: true,
    },
    {
      title: 'Deaths (Deflection)',
      keys: LEGACY_DEATH_TYPE_COLUMNS,
      enumObject: deathEnumObject(),
      legacyRemap: true,
    },
    {
      title: 'Deaths (Error)',
      keys: enumValues(EDeathError),
      enumObject: EDeathError,
    },
    {
      title: 'Throws (Direct) (Individual)',
      keys: LEGACY_THROW_RESULT_COLUMNS,
      enumObject: throwEnumObject(),
      legacyRemap: true,
    },
    {
      title: 'Throws (Direct) (Group)',
      keys: LEGACY_THROW_RESULT_COLUMNS,
      enumObject: throwEnumObject(),
      legacyRemap: true,
    },
    {
      title: 'Throws (Deflection) (Individual)',
      keys: LEGACY_DEFLECTION_RESULT_COLUMNS,
      enumObject: deflectionEnumObject(),
      legacyRemap: true,
    },
    {
      title: 'Throws (Deflection) (Group)',
      keys: LEGACY_DEFLECTION_RESULT_COLUMNS,
      enumObject: deflectionEnumObject(),
      legacyRemap: true,
    },
    {
      title: 'Throws (Error)',
      keys: enumValues(EThrowError),
      enumObject: EThrowError,
    },
    {
      title: 'Targeted (Direct)',
      keys: LEGACY_THROW_RESULT_COLUMNS,
      enumObject: throwEnumObject(),
      legacyRemap: true,
    },
    {
      title: 'Targeted (Deflection)',
      keys: LEGACY_DEFLECTION_RESULT_COLUMNS,
      enumObject: deflectionEnumObject(),
      legacyRemap: true,
    },
  ];

  const columns: LegacyCsvColumnSpec[] = [
    { header: 'Team', kind: 'team' },
    { header: 'Player', kind: 'player' },
  ];

  for (const section of sections) {
    columns.push({
      header: `********** ${section.title}`,
      kind: 'sectionTotal',
      sectionTitle: section.title,
    });
    for (const key of section.keys) {
      columns.push({
        header: enumKey(section.enumObject, key),
        kind: 'enumValue',
        sectionTitle: section.title,
        enumKey: key,
        legacyRemap: section.legacyRemap,
      });
    }
  }

  return columns;
}

export function getLegacyStatisticsHeaderNames(): string[] {
  return getLegacyStatisticsColumnSpecs().map((column) => column.header);
}
