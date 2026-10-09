/**
 * DebrisNet - Kessler Cascade 3D Visualizer
 * Animates hypervelocity orbital collisions and fragment cloud dispersion.
 */

import * as THREE from 'three';

export class KesslerVisualizer {
  constructor(scene) {
    this.scene = scene;
    this.activeExplosions = [];
  }

  /**
   * Spawn a new animated breakup event in the scene
   */
  spawnBreakup(breakupData) {
    const fragments = breakupData.fragments;
    const count = fragments.length;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const f = fragments[i];
      positions[i * 3] = f.currentPos.x;
      positions[i * 3 + 1] = f.currentPos.y;
      positions[i * 3 + 2] = f.currentPos.z;

      const c = new THREE.Color(f.color);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.28,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const pointsMesh = new THREE.Points(geometry, material);
    this.scene.add(pointsMesh);

    // Shockwave sphere flash
    const shockGeo = new THREE.SphereGeometry(0.1, 16, 16);
    const shockMat = new THREE.MeshBasicMaterial({
      color: 0xffeedd,
      transparent: true,
      opacity: 0.9,
      wireframe: true
    });
    const shockMesh = new THREE.Mesh(shockGeo, shockMat);
    shockMesh.position.set(fragments[0].origin.x, fragments[0].origin.y, fragments[0].origin.z);
    this.scene.add(shockMesh);

    this.activeExplosions.push({
      mesh: pointsMesh,
      shockMesh,
      geometry,
      fragments,
      age: 0,
      maxAge: 400 // frames
    });
  }

  update() {
    for (let eIdx = this.activeExplosions.length - 1; eIdx >= 0; eIdx--) {
      const exp = this.activeExplosions[eIdx];
      exp.age++;

      const posArray = exp.geometry.attributes.position.array;
      const count = exp.fragments.length;

      // Expand fragments outward
      for (let i = 0; i < count; i++) {
        const f = exp.fragments[i];
        f.currentPos.x += f.velocity.x * 0.08;
        f.currentPos.y += f.velocity.y * 0.08;
        f.currentPos.z += f.velocity.z * 0.08;

        posArray[i * 3] = f.currentPos.x;
        posArray[i * 3 + 1] = f.currentPos.y;
        posArray[i * 3 + 2] = f.currentPos.z;
      }

      exp.geometry.attributes.position.needsUpdate = true;

      // Expand shockwave
      if (exp.shockMesh) {
        exp.shockMesh.scale.multiplyScalar(1.08);
        exp.shockMesh.material.opacity = Math.max(0, 1.0 - (exp.age / 40));
      }

      // Fade out fragments over time
      if (exp.age > 200) {
        exp.mesh.material.opacity = Math.max(0, 1.0 - (exp.age - 200) / 200);
      }

      // Cleanup finished explosion
      if (exp.age >= exp.maxAge) {
        this.scene.remove(exp.mesh);
        if (exp.shockMesh) this.scene.remove(exp.shockMesh);
        exp.geometry.dispose();
        exp.mesh.material.dispose();
        this.activeExplosions.splice(eIdx, 1);
      }
    }
  }

  clear() {
    for (const exp of this.activeExplosions) {
      this.scene.remove(exp.mesh);
      if (exp.shockMesh) this.scene.remove(exp.shockMesh);
      exp.geometry.dispose();
      exp.mesh.material.dispose();
    }
    this.activeExplosions = [];
  }
}
