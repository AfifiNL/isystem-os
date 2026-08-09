export interface GscScoringThresholds {
  nearPageOne: { minPos: number; maxPos: number; minImpressions: number };
  contentExpansion: { minPos: number; maxPos: number; minImpressions: number };
  lowCtr: { minImpressions: number; maxCtr: number };
  skipAutonomous: { maxImpressions: number };
}

// Baseline thresholds for a mature site
export const GSC_THRESHOLDS: GscScoringThresholds = {
  nearPageOne: { minPos: 4, maxPos: 15, minImpressions: 20 },
  contentExpansion: { minPos: 11, maxPos: 30, minImpressions: 10 },
  lowCtr: { minImpressions: 30, maxCtr: 0.02 }, // 2% CTR is low
  skipAutonomous: { maxImpressions: 5 },
};

/**
 * Evaluates a GSC opportunity based on performance metrics.
 * Uses an adaptive factor (0.0 to 1.0) to scale down impression requirements for new/low-volume sites.
 */
export function scoreGscOpportunity(
  position: number,
  impressions: number,
  ctr: number,
  query: string,
  adaptiveVolumeFactor: number = 1.0
) {
  // Ensure factor is between 0.1 (very adaptive/new) and 1.0 (mature)
  const factor = Math.max(0.1, Math.min(1.0, adaptiveVolumeFactor));

  const thresholds = {
    nearPageOne: {
      minPos: GSC_THRESHOLDS.nearPageOne.minPos,
      maxPos: GSC_THRESHOLDS.nearPageOne.maxPos,
      minImpressions: Math.max(1, Math.floor(GSC_THRESHOLDS.nearPageOne.minImpressions * factor))
    },
    contentExpansion: {
      minPos: GSC_THRESHOLDS.contentExpansion.minPos,
      maxPos: GSC_THRESHOLDS.contentExpansion.maxPos,
      minImpressions: Math.max(1, Math.floor(GSC_THRESHOLDS.contentExpansion.minImpressions * factor))
    },
    lowCtr: {
      minImpressions: Math.max(1, Math.floor(GSC_THRESHOLDS.lowCtr.minImpressions * factor)),
      maxCtr: GSC_THRESHOLDS.lowCtr.maxCtr
    },
    skipAutonomous: {
      maxImpressions: Math.max(1, Math.floor(GSC_THRESHOLDS.skipAutonomous.maxImpressions * factor))
    }
  };

  const types: string[] = [];

  if (impressions < thresholds.skipAutonomous.maxImpressions) {
    return { types: ['skip'], skipAutonomous: true };
  }

  if (position >= thresholds.nearPageOne.minPos && position <= thresholds.nearPageOne.maxPos && impressions >= thresholds.nearPageOne.minImpressions) {
    types.push('near-page-one');
  }

  if (position >= thresholds.contentExpansion.minPos && position <= thresholds.contentExpansion.maxPos && impressions >= thresholds.contentExpansion.minImpressions) {
    types.push('content-expansion');
  }

  if (impressions >= thresholds.lowCtr.minImpressions && ctr <= thresholds.lowCtr.maxCtr) {
    types.push('low-ctr');
  }

  return { types, skipAutonomous: types.length === 0 };
}
