/**
 * DebrisNet - SGP4 Orbital Propagator Engine
 * Wraps satellite.js to calculate high-precision ECI coordinates,
 * velocities, orbital periods, and multi-day trajectory paths.
 */

import * as satellite from 'satellite.js';

export const EARTH_RADIUS_KM = 6371.0;
export const THREE_SCALE = 1.0 / 1000.0; // 1 unit in Three.js = 1000 km (Earth radius ~ 6.371 units)

/**
 * Initialize a satellite record from TLE strings
 */
export function initSatrec(tle1, tle2) {
  try {
    return satellite.twoline2satrec(tle1, tle2);
  } catch (err) {
    console.error("Failed to parse TLE:", err);
    return null;
  }
}

/**
 * Propagate satrec to a specific JavaScript Date
 * Returns { position: {x,y,z}, velocity: {x,y,z}, altitudeKm, speedKmS }
 */
export function propagateAtDate(satrec, date) {
  if (!satrec) return null;
  const positionAndVelocity = satellite.propagate(satrec, date);
  const positionEci = positionAndVelocity.position;
  const velocityEci = positionAndVelocity.velocity;

  if (!positionEci || typeof positionEci.x !== 'number') {
    return null;
  }

  // Altitude above Earth surface
  const distanceKm = Math.sqrt(
    positionEci.x * positionEci.x +
    positionEci.y * positionEci.y +
    positionEci.z * positionEci.z
  );
  const altitudeKm = distanceKm - EARTH_RADIUS_KM;

  // Orbital speed in km/s
  let speedKmS = 0;
  if (velocityEci && typeof velocityEci.x === 'number') {
    speedKmS = Math.sqrt(
      velocityEci.x * velocityEci.x +
      velocityEci.y * velocityEci.y +
      velocityEci.z * velocityEci.z
    );
  }

  return {
    position: positionEci,
    velocity: velocityEci,
    distanceKm,
    altitudeKm,
    speedKmS
  };
}

/**
 * Generate 3D orbit trajectory path for a full orbital period
 * Returns an array of Three.js Vector3 points
 */
export function generateOrbitPath(satrec, startDate = new Date(), numPoints = 120) {
  if (!satrec) return [];
  const points = [];
  
  // Approximate orbital period from mean motion (revs per day)
  // mean motion 'no_kozai' is in radians/min
  const meanMotionRadMin = satrec.no_kozai || 0.06;
  const periodMinutes = (2 * Math.PI) / meanMotionRadMin;
  const stepMs = (periodMinutes * 60 * 1000) / numPoints;

  for (let i = 0; i <= numPoints; i++) {
    const t = new Date(startDate.getTime() + i * stepMs);
    const pv = propagateAtDate(satrec, t);
    if (pv && pv.position) {
      // Convert to Three.js coordinates
      // Note: Three.js coordinates: Y is up, X is right, Z is forward
      // ECI: X is vernal equinox, Y is 90 deg East, Z is North pole
      points.push({
        x: pv.position.x * THREE_SCALE,
        y: pv.position.z * THREE_SCALE, // Map ECI Z (North) to Three.js Y
        z: -pv.position.y * THREE_SCALE // Map ECI Y to Three.js -Z
      });
    }
  }

  return points;
}

/**
 * Convert ECI position to Three.js world coordinates
 */
export function eciToThreeCoords(eciPos) {
  if (!eciPos) return { x: 0, y: 0, z: 0 };
  return {
    x: eciPos.x * THREE_SCALE,
    y: eciPos.z * THREE_SCALE,
    z: -eciPos.y * THREE_SCALE
  };
}
