/**
 * DebrisNet - Debris Density Cloud & GPU Particle System
 * Efficiently animates hundreds of debris fragments in real-time
 */

import * as THREE from 'three';
import { propagateAtDate, eciToThreeCoords } from '../core/sgp4Propagator.js';

export class DebrisCloud {
  constructor(scene, debrisList) {
    this.scene = scene;
    this.debrisList = debrisList;
    this.count = debrisList.length;

    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.count * 3);
    this.colors = new Float32Array(this.count * 3);

    // Initialize initial positions and colors
    for (let i = 0; i < this.count; i++) {
      const deb = debrisList[i];
      // Default color: Red/Orange for debris, yellow for moderate
      const color = new THREE.Color(deb.color || "#ff3333");
      this.colors[i * 3] = color.r;
      this.colors[i * 3 + 1] = color.g;
      this.colors[i * 3 + 2] = color.b;

      // Temporary placeholder position
      this.positions[i * 3] = 0;
      this.positions[i * 3 + 1] = 0;
      this.positions[i * 3 + 2] = 0;
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    // Custom circular particle texture
    const particleTexture = this.createParticleTexture();

    this.material = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      map: particleTexture,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.pointsMesh = new THREE.Points(this.geometry, this.material);
    this.scene.add(this.pointsMesh);
  }

  createParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(255, 100, 50, 0.8)');
    grad.addColorStop(0.8, 'rgba(255, 0, 50, 0.2)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    return new THREE.CanvasTexture(canvas);
  }

  /**
   * Update all debris coordinates for current simulation time
   */
  update(simDate) {
    const posAttr = this.geometry.attributes.position;
    const posArray = posAttr.array;

    for (let i = 0; i < this.count; i++) {
      const deb = this.debrisList[i];
      if (deb.satrec) {
        const pv = propagateAtDate(deb.satrec, simDate);
        if (pv && pv.position) {
          const threePos = eciToThreeCoords(pv.position);
          posArray[i * 3] = threePos.x;
          posArray[i * 3 + 1] = threePos.y;
          posArray[i * 3 + 2] = threePos.z;
        }
      }
    }

    posAttr.needsUpdate = true;
  }

  /**
   * Highlight a specific debris threatening an asset
   */
  highlightThreat(threatNoradId) {
    const colAttr = this.geometry.attributes.color;
    const colArray = colAttr.array;

    for (let i = 0; i < this.count; i++) {
      const deb = this.debrisList[i];
      if (deb.noradId === threatNoradId) {
        // Bright blinking yellow/white
        colArray[i * 3] = 1.0;
        colArray[i * 3 + 1] = 1.0;
        colArray[i * 3 + 2] = 0.0;
      }
    }
    colAttr.needsUpdate = true;
  }
}
