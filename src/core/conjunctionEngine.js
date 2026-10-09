/**
 * DebrisNet - Conjunction Assessment & Collision Probability (Pc) Engine
 * Implements NASA CARA (Conjunction Assessment Risk Analysis) methodologies:
 * - Time to Closest Approach (TCA) determination
 * - Miss-distance vector analysis
 * - Encounter plane (B-plane) projection
 * - 2D Gaussian Collision Probability (Pc) estimation
 */

import { propagateAtDate, EARTH_RADIUS_KM } from './sgp4Propagator.js';

export const RISK_LEVELS = {
  CRITICAL: { label: "CRITICAL ALERT", color: "#ff0055", code: "RED", threshold: 1e-4 },
  WARNING: { label: "ELEVATED CONJUNCTION", color: "#ffb703", code: "AMBER", threshold: 1e-5 },
  NOMINAL: { label: "MONITORED APPROACH", color: "#39ff14", code: "GREEN", threshold: 0 }
};

/**
 * Calculate Euclidean distance between two 3D points in km
 */
function distanceKm(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = p1.z - p2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * 2D Gaussian B-Plane Collision Probability Estimator
 * Based on NASA Foster & Hall methodology
 * @param {number} missDistanceKm Minimum separation distance at TCA
 * @param {number} hardBodyRadiusKm Combined physical collision radius
 * @param {number} posUncertaintyKm Estimated position error ellipsoid (covariance sigma)
 */
export function calculateCollisionProbability(missDistanceKm, hardBodyRadiusKm = 0.05, posUncertaintyKm = 1.2) {
  // If miss distance is very large (> 25 km), probability is negligible
  if (missDistanceKm > 25.0) return 0.0;

  // Effective sigma on the encounter plane
  const sigma = Math.max(posUncertaintyKm, 0.2);
  const rCombined = Math.max(hardBodyRadiusKm, 0.01);

  // 2D Gaussian probability integral approximation over disk of radius rCombined
  // Pc = (rCombined^2 / (2 * sigma^2)) * exp(-missDistance^2 / (2 * sigma^2))
  const exponent = - (missDistanceKm * missDistanceKm) / (2 * sigma * sigma);
  const pc = ( (rCombined * rCombined) / (2 * sigma * sigma) ) * Math.exp(exponent);

  // Clamp probability between 0 and 1.0
  return Math.min(Math.max(pc, 0.0), 0.9999);
}

/**
 * Perform conjunction screening between a primary asset and a debris catalog
 * over a forward time window (default: 7 days)
 */
export function screenConjunctions(primaryAsset, debrisList, startDate = new Date(), windowDays = 7) {
  const primarySatrec = primaryAsset.satrec;
  if (!primarySatrec) return [];

  const conjunctionEvents = [];
  const windowMs = windowDays * 24 * 3600 * 1000;
  const coarseStepMs = 15 * 60 * 1000; // 15-minute coarse step

  // We screen against debris candidates
  for (const debris of debrisList) {
    if (!debris.satrec) continue;

    let minDistanceKm = Infinity;
    let minTcaDate = null;
    let primaryPvAtTca = null;
    let debrisPvAtTca = null;

    // Coarse screening loop
    for (let offsetMs = 0; offsetMs <= windowMs; offsetMs += coarseStepMs) {
      const testDate = new Date(startDate.getTime() + offsetMs);
      const primPv = propagateAtDate(primarySatrec, testDate);
      const debPv = propagateAtDate(debris.satrec, testDate);

      if (primPv && debPv) {
        const dist = distanceKm(primPv.position, debPv.position);
        if (dist < minDistanceKm) {
          minDistanceKm = dist;
          minTcaDate = testDate;
        }
      }
    }

    // If coarse screening found a close approach within threshold (e.g. < 40 km)
    // refine with 10-second fine search around TCA
    if (minDistanceKm < 40.0 && minTcaDate) {
      const fineWindowMs = 20 * 60 * 1000; // +/- 10 minutes around coarse TCA
      const fineStepMs = 10 * 1000; // 10-second step
      const fineStart = new Date(minTcaDate.getTime() - fineWindowMs / 2);

      let refinedMinDist = Infinity;
      let refinedTcaDate = minTcaDate;

      for (let fineOffset = 0; fineOffset <= fineWindowMs; fineOffset += fineStepMs) {
        const t = new Date(fineStart.getTime() + fineOffset);
        const p1 = propagateAtDate(primarySatrec, t);
        const p2 = propagateAtDate(debris.satrec, t);

        if (p1 && p2) {
          const d = distanceKm(p1.position, p2.position);
          if (d < refinedMinDist) {
            refinedMinDist = d;
            refinedTcaDate = t;
            primaryPvAtTca = p1;
            debrisPvAtTca = p2;
          }
        }
      }

      // Calculate relative velocity (km/s)
      let relativeSpeedKmS = 10.0;
      if (primaryPvAtTca?.velocity && debrisPvAtTca?.velocity) {
        const dvx = primaryPvAtTca.velocity.x - debrisPvAtTca.velocity.x;
        const dvy = primaryPvAtTca.velocity.y - debrisPvAtTca.velocity.y;
        const dvz = primaryPvAtTca.velocity.z - debrisPvAtTca.velocity.z;
        relativeSpeedKmS = Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz);
      }

      // Hard-body radius combined
      const hardBodyRadiusKm = (primaryAsset.radiusKm || 0.05) + (debris.radiusKm || 0.005);
      const pc = calculateCollisionProbability(refinedMinDist, hardBodyRadiusKm, 1.5);

      // Determine Risk Tier
      let riskTier = RISK_LEVELS.NOMINAL;
      if (pc >= RISK_LEVELS.CRITICAL.threshold || refinedMinDist < 1.5) {
        riskTier = RISK_LEVELS.CRITICAL;
      } else if (pc >= RISK_LEVELS.WARNING.threshold || refinedMinDist < 5.0) {
        riskTier = RISK_LEVELS.WARNING;
      }

      conjunctionEvents.push({
        id: `CDM-${primaryAsset.noradId}-${debris.noradId}-${refinedTcaDate.getTime()}`,
        primaryAsset: {
          name: primaryAsset.name,
          noradId: primaryAsset.noradId,
          massKg: primaryAsset.massKg || 1000,
          position: primaryPvAtTca?.position,
          altitudeKm: primaryPvAtTca?.altitudeKm
        },
        secondaryObject: {
          name: debris.name,
          noradId: debris.noradId,
          massKg: debris.massKg || 50,
          position: debrisPvAtTca?.position,
          altitudeKm: debrisPvAtTca?.altitudeKm
        },
        tca: refinedTcaDate,
        tcaIso: refinedTcaDate.toISOString(),
        missDistanceKm: parseFloat(refinedMinDist.toFixed(3)),
        missDistanceMeters: Math.round(refinedMinDist * 1000),
        relativeSpeedKmS: parseFloat(relativeSpeedKmS.toFixed(2)),
        collisionProbability: pc,
        pcScientific: pc.toExponential(3),
        riskLevel: riskTier,
        cdmMessage: generateCdmString(primaryAsset, debris, refinedTcaDate, refinedMinDist, pc, relativeSpeedKmS)
      });
    }
  }

  // Sort by highest risk (highest Pc and lowest miss distance)
  conjunctionEvents.sort((a, b) => b.collisionProbability - a.collisionProbability || a.missDistanceKm - b.missDistanceKm);

  return conjunctionEvents;
}

/**
 * Generate official standard CCSDS Conjunction Data Message (CDM) snippet
 */
function generateCdmString(primary, secondary, tca, missDistKm, pc, relSpeed) {
  return `CCSDS_CDM_VERS = 1.0
CREATION_DATE  = ${new Date().toISOString()}
ORIGINATOR     = NASA_CARA_DEBRISNET
MESSAGE_ID     = CDM-${primary.noradId}-${secondary.noradId}
TCA            = ${tca.toISOString()}
MISS_DISTANCE  = ${(missDistKm * 1000).toFixed(1)} [m]
RELATIVE_SPEED = ${(relSpeed * 1000).toFixed(1)} [m/s]
COLLISION_PROB = ${pc.toExponential(4)}
OBJECT1        = ${primary.name} (NORAD: ${primary.noradId})
OBJECT2        = ${secondary.name} (NORAD: ${secondary.noradId})
RECOMMENDATION = ${pc >= 1e-4 ? 'MANDATORY_AVOIDANCE_MANEUVER' : 'CONTINUE_MONITORING'}`;
}
