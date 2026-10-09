/**
 * DebrisNet - 3D Scene Manager (Three.js)
 * Manages the Earth, atmospheric glow, starry skybox, lighting, and camera.
 */

import * as THREE from 'three';
import { EARTH_RADIUS_KM, THREE_SCALE } from '../core/sgp4Propagator.js';

export class SceneManager {
  constructor(canvasContainer) {
    this.container = canvasContainer;
    this.width = canvasContainer.clientWidth || window.innerWidth;
    this.height = canvasContainer.clientHeight || window.innerHeight;

    // Three.js core components
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    // Initial Camera Position
    this.camera.position.set(0, 8, 16);
    this.camera.lookAt(0, 0, 0);

    // Orbital radius in Three.js units
    this.earthRadiusUnits = EARTH_RADIUS_KM * THREE_SCALE; // ~6.371 units

    this.initLights();
    this.initEarth();
    this.initAtmosphere();
    this.initStars();
    this.initControls();

    window.addEventListener('resize', this.onResize.bind(this));
  }

  initLights() {
    // Ambient starlight
    const ambientLight = new THREE.AmbientLight(0x223344, 1.2);
    this.scene.add(ambientLight);

    // Sun directional light
    this.sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
    this.sunLight.position.set(20, 10, 20);
    this.scene.add(this.sunLight);

    // Subtle blue rim light from deep space
    const rimLight = new THREE.DirectionalLight(0x0088ff, 0.8);
    rimLight.position.set(-20, -10, -20);
    this.scene.add(rimLight);
  }

  initEarth() {
    // High-resolution procedural canvas for Earth texture (continents & oceans)
    const earthCanvas = document.createElement('canvas');
    earthCanvas.width = 2048;
    earthCanvas.height = 1024;
    const ctx = earthCanvas.getContext('2d');

    // Deep ocean base
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, 1024);
    oceanGrad.addColorStop(0, '#0a1d37');
    oceanGrad.addColorStop(0.5, '#051329');
    oceanGrad.addColorStop(1, '#0a1d37');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, 2048, 1024);

    // Draw stylized continental grid lines & landmass outlines
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
    ctx.lineWidth = 1;
    // Latitude lines
    for (let lat = 0; lat <= 1024; lat += 64) {
      ctx.beginPath();
      ctx.moveTo(0, lat);
      ctx.lineTo(2048, lat);
      ctx.stroke();
    }
    // Longitude lines
    for (let lon = 0; lon <= 2048; lon += 64) {
      ctx.beginPath();
      ctx.moveTo(lon, 0);
      ctx.lineTo(lon, 1024);
      ctx.stroke();
    }

    // Stylized procedural continents
    ctx.fillStyle = 'rgba(16, 75, 115, 0.75)';
    // Simplified landmass blobs (Americas, Eurasia, Africa, Australia)
    const continents = [
      { x: 380, y: 320, rx: 180, ry: 140 }, // North America
      { x: 500, y: 640, rx: 110, ry: 190 }, // South America
      { x: 1050, y: 300, rx: 240, ry: 120 }, // Europe/Russia
      { x: 1040, y: 550, rx: 160, ry: 170 }, // Africa
      { x: 1450, y: 380, rx: 250, ry: 150 }, // Asia
      { x: 1650, y: 720, rx: 110, ry: 90 }   // Australia
    ];

    continents.forEach(c => {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.rx, c.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // Coastal glowing outline
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
    ctx.lineWidth = 2;
    continents.forEach(c => {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.rx, c.ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    });

    const earthTexture = new THREE.CanvasTexture(earthCanvas);
    earthTexture.wrapS = THREE.RepeatWrapping;
    earthTexture.wrapT = THREE.ClampToEdgeWrapping;

    const geometry = new THREE.SphereGeometry(this.earthRadiusUnits, 64, 64);
    const material = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.65,
      metalness: 0.25,
      bumpScale: 0.05
    });

    this.earthMesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.earthMesh);

    // Subtle equatorial reference grid
    const eqGeo = new THREE.RingGeometry(this.earthRadiusUnits * 1.002, this.earthRadiusUnits * 1.006, 64);
    const eqMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide, opacity: 0.4, transparent: true });
    this.eqRing = new THREE.Mesh(eqGeo, eqMat);
    this.eqRing.rotation.x = Math.PI / 2;
    this.scene.add(this.eqRing);
  }

  initAtmosphere() {
    // Glowing atmospheric outer shell
    const atmoGeo = new THREE.SphereGeometry(this.earthRadiusUnits * 1.025, 64, 64);
    const atmoMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
          gl_FragColor = vec4(0.0, 0.75, 1.0, 1.0) * intensity * 0.9;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true
    });

    this.atmosphereMesh = new THREE.Mesh(atmoGeo, atmoMat);
    this.scene.add(this.atmosphereMesh);
  }

  initStars() {
    // 2500 deep-space stars
    const starCount = 2500;
    const starGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      const radius = 100 + Math.random() * 200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i + 2] = radius * Math.cos(phi);

      colors[i] = 0.8 + Math.random() * 0.2;
      colors[i + 1] = 0.85 + Math.random() * 0.15;
      colors[i + 2] = 1.0;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 0.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.85
    });

    this.starPoints = new THREE.Points(starGeo, starMat);
    this.scene.add(this.starPoints);
  }

  initControls() {
    // Orbit mouse controls implementation
    this.isDragging = false;
    this.prevMouse = { x: 0, y: 0 };
    this.spherical = { radius: 18, theta: 0.6, phi: 1.1 };

    const updateCameraFromSpherical = () => {
      this.spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.spherical.phi));
      this.spherical.radius = Math.max(7.5, Math.min(50, this.spherical.radius));

      this.camera.position.x = this.spherical.radius * Math.sin(this.spherical.phi) * Math.sin(this.spherical.theta);
      this.camera.position.y = this.spherical.radius * Math.cos(this.spherical.phi);
      this.camera.position.z = this.spherical.radius * Math.sin(this.spherical.phi) * Math.cos(this.spherical.theta);
      this.camera.lookAt(0, 0, 0);
    };

    updateCameraFromSpherical();

    const dom = this.renderer.domElement;
    dom.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.prevMouse = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.prevMouse.x;
      const dy = e.clientY - this.prevMouse.y;
      this.prevMouse = { x: e.clientX, y: e.clientY };

      this.spherical.theta -= dx * 0.005;
      this.spherical.phi -= dy * 0.005;
      updateCameraFromSpherical();
    });

    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.spherical.radius += e.deltaY * 0.015;
      updateCameraFromSpherical();
    }, { passive: false });
  }

  onResize() {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  render() {
    // Slow planetary diurnal rotation
    if (this.earthMesh) {
      this.earthMesh.rotation.y += 0.0003;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
