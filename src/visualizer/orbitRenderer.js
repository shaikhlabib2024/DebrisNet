/**
 * DebrisNet - Orbit & Spacecraft Renderer
 * Renders active satellite orbits, keep-out spheres, and post-maneuver trajectory deflections.
 */

import * as THREE from 'three';
import { generateOrbitPath, propagateAtDate, eciToThreeCoords, THREE_SCALE } from '../core/sgp4Propagator.js';

export class OrbitRenderer {
  constructor(scene) {
    this.scene = scene;
    this.orbitLines = new Map(); // id -> Line
    this.satMeshes = new Map(); // id -> Mesh
    this.keepOutSpheres = new Map(); // id -> Mesh
    this.conjunctionVectorLine = null;
    this.maneuverOrbitLine = null;
  }

  /**
   * Register a satellite asset with its nominal orbit
   */
  addSatellite(asset, simDate = new Date()) {
    if (!asset.satrec) return;

    // 1. Generate nominal orbit trajectory line
    const orbitPoints = generateOrbitPath(asset.satrec, simDate, 140);
    const geometry = new THREE.BufferGeometry().setFromPoints(
      orbitPoints.map(p => new THREE.Vector3(p.x, p.y, p.z))
    );
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(asset.color || "#00f0ff"),
      transparent: true,
      opacity: 0.75,
      linewidth: 2
    });
    const orbitLine = new THREE.LineLoop(geometry, material);
    this.scene.add(orbitLine);
    this.orbitLines.set(asset.noradId, orbitLine);

    // 2. Spacecraft marker mesh
    const satGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const satMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(asset.color || "#00f0ff") });
    const satMesh = new THREE.Mesh(satGeo, satMat);
    this.scene.add(satMesh);
    this.satMeshes.set(asset.noradId, satMesh);

    // 3. Keep-out Safety Sphere (5 km radius scaled up visually for visibility)
    // 5 km in actual scale is 0.005 units; we scale to 0.25 units for mission control HUD visibility
    const sphereGeo = new THREE.SphereGeometry(0.25, 24, 24);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(asset.color || "#00f0ff"),
      wireframe: true,
      transparent: true,
      opacity: 0.35
    });
    const keepOut = new THREE.Mesh(sphereGeo, sphereMat);
    this.scene.add(keepOut);
    this.keepOutSpheres.set(asset.noradId, keepOut);
  }

  /**
   * Update satellite positions for current simulation date
   */
  update(assetList, simDate) {
    for (const asset of assetList) {
      if (!asset.satrec) continue;
      const pv = propagateAtDate(asset.satrec, simDate);
      if (pv && pv.position) {
        const coords = eciToThreeCoords(pv.position);

        const mesh = this.satMeshes.get(asset.noradId);
        if (mesh) {
          mesh.position.set(coords.x, coords.y, coords.z);
        }

        const sphere = this.keepOutSpheres.get(asset.noradId);
        if (sphere) {
          sphere.position.set(coords.x, coords.y, coords.z);
        }
      }
    }
  }

  /**
   * Render close approach line between satellite and threatening debris
   */
  showConjunctionVector(satPos, debrisPos) {
    if (this.conjunctionVectorLine) {
      this.scene.remove(this.conjunctionVectorLine);
    }

    const p1 = new THREE.Vector3(satPos.x * THREE_SCALE, satPos.z * THREE_SCALE, -satPos.y * THREE_SCALE);
    const p2 = new THREE.Vector3(debrisPos.x * THREE_SCALE, debrisPos.z * THREE_SCALE, -debrisPos.y * THREE_SCALE);

    const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    const mat = new THREE.LineDashedMaterial({
      color: 0xff0055,
      dashSize: 0.1,
      gapSize: 0.05,
      linewidth: 3
    });

    this.conjunctionVectorLine = new THREE.Line(geo, mat);
    this.conjunctionVectorLine.computeLineDistances();
    this.scene.add(this.conjunctionVectorLine);
  }

  /**
   * Render post-maneuver modified orbit trajectory (neon green)
   */
  showManeuverTrajectory(asset, burnDeltaV) {
    if (this.maneuverOrbitLine) {
      this.scene.remove(this.maneuverOrbitLine);
    }

    if (!asset.satrec) return;
    const nominalPoints = generateOrbitPath(asset.satrec, new Date(), 140);
    // Displace trajectory slightly along tangential vector to visually show safe clearance
    const displacedPoints = nominalPoints.map((p, idx) => {
      const factor = 1.0 + (burnDeltaV.total / 100.0) * Math.sin((idx / 140) * Math.PI);
      return new THREE.Vector3(p.x * factor, p.y * factor, p.z * factor);
    });

    const geo = new THREE.BufferGeometry().setFromPoints(displacedPoints);
    const mat = new THREE.LineBasicMaterial({
      color: 0x39ff14, // Neon bright green
      linewidth: 3,
      transparent: true,
      opacity: 0.95
    });

    this.maneuverOrbitLine = new THREE.Line(geo, mat);
    this.scene.add(this.maneuverOrbitLine);
  }

  clearManeuverTrajectory() {
    if (this.maneuverOrbitLine) {
      this.scene.remove(this.maneuverOrbitLine);
      this.maneuverOrbitLine = null;
    }
  }
}
