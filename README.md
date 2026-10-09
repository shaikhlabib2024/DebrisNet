# 🛰️ DebrisNet: Space Domain Awareness & Satellite Collision Processor

> **Official Entry for NASA Space Apps Challenge**  
> *Track: Space Domain Awareness, Orbital Safety & Planetary Protection*

---

## 🌌 Overview & The Challenge

Low Earth Orbit (LEO) is critically congested with over 35,000 cataloged objects and hundreds of thousands of lethal untracked debris particles orbiting at velocities exceeding $28,000 \text{ km/h}$ ($\sim 7.8 \text{ km/s}$). 

At hypervelocity speeds, even a 1-centimeter fragment carries the destructive kinetic energy of an exploding hand grenade. Without rapid, predictive intervention, unchecked collisions threaten to trigger the **Kessler Syndrome**—a cascading chain reaction of catastrophic breakups rendering vital orbital bands inaccessible for generations.

**DebrisNet** is an autonomous, high-precision **Orbital Safety & Conjunction Assessment Platform**. It tracks space debris density, predicts close encounters across a 7-day operational horizon, computes exact collision probabilities ($P_c$) following NASA CARA standards, and outputs a **fuel-optimal Collision Avoidance Maneuver (CAM)** that preserves satellite operational lifetime.

---

## ✨ Key Features & Capabilities

### 1. 🌍 GPU-Accelerated 3D Space Situational Awareness
* **Interactive Orbital Globe:** Three.js WebGL visualization featuring Earth reference planes, atmospheric scattering, and deep-space starfields.
* **Debris Density Point Cloud:** Real-time GPU particle simulation of hundreds of cataloged debris fragments categorized by danger level and altitude shells (400 km to 1200 km).
* **High-Value Asset Tracking:** Monitors crucial assets including the **International Space Station (ISS)**, **Tiangong (CSS)**, **Hubble Space Telescope**, **Landsat 9**, and simulated regional payloads like **Bangabandhu-1**.

### 2. 🎯 7-Day Conjunction Assessment Engine
* **SGP4 Orbit Propagation:** Propagates orbital mechanics using `satellite.js` in Earth Centered Inertial (ECI/TEME) coordinates.
* **Time to Closest Approach (TCA):** Pinpoints the exact encounter timestamp down to the second.
* **Encounter Plane (B-Plane) Collision Probability ($P_c$):** Implements NASA Foster-Hall 2D Gaussian probability density formulation over covariance error ellipsoids:
  $$P_c \approx \left(\frac{R^2}{2 \sigma_{\text{eff}}^2}\right) \exp\left(-\frac{d_{\text{miss}}^2}{2 \sigma_{\text{eff}}^2}\right)$$
* **Automated CCSDS Conjunction Data Message (CDM) Generator:** Produces exportable standard spaceflight alert files for ground control teams.

### 3. 🚀 Fuel-Optimal Collision Avoidance Maneuver (CAM) Planner
* **Keplerian Impulse Optimization:** Calculates along-track / cross-track thruster impulses ($\Delta v$) executed $0.5 - 1.5$ orbits prior to TCA, multiplying orbital deflection while minimizing fuel consumption.
* **Tsiolkovsky Rocket Equation Engine:**
  $$\Delta m = m_0 \cdot \left(1 - \exp\left(-\frac{\Delta v}{I_{\text{sp}} \cdot g_0}\right)\right)$$
* **Economic & Mission Impact:** Quantifies propellant expenditure in kg, financial launch-mass cost in USD, and lost operational lifespan in days.
* **Dynamic Re-routing:** Renders the post-burn modified safe trajectory (bright green) in the 3D globe to verify clearance of the 5 km keep-out zone.

### 4. 💥 NASA Standard Breakup Kessler Cascade Simulator
* **Interactive Hypervelocity Breakup:** Simulates a catastrophic collision using the power-law fragment distribution and velocity dispersion from **NASA-TM-2001-210744**.
* **Shockwave & Particle Dispersion:** Visualizes immediate fragment cloud expansion across neighboring altitude shells.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Orbital Mechanics & SGP4** | `satellite.js`, Keplerian numerical solvers, NASA Foster & Hall B-plane models |
| **3D Graphics & Visuals** | `Three.js` (r170), WebGL shaders, GPU particle buffers |
| **Frontend Framework & Bundler** | `Vite 6`, HTML5 Canvas, modern Glassmorphic CSS |
| **Data Sources** | CelesTrak GP API, NASA Orbital Debris Program Office (ODPO), Space-Track.org |

---

## 🚀 Getting Started & Running Locally

### Prerequisites
* **Node.js** (v18.0.0 or higher)
* **npm**

### Installation & Run

1. Clone repository:
   ```bash
   git clone https://github.com/shaikhlabib2024/DebrisNet.git
   cd DebrisNet
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch development server:
   ```bash
   npm run dev
   ```

4. Open your browser at `http://localhost:5173` to access the Mission Control HUD.

---

## 🏆 Presentation & Judging Highlights

1. **Not just a visualizer:** DebrisNet doesn't just show dots in space; it runs **mathematical risk screening** and provides **executable $\Delta v$ maneuvers**.
2. **Economic Viability:** Satellite operators cannot afford guesswork. Calculating the exact fuel cost (\$13,000+ USD) and mission lifespan trade-off demonstrates deep industry awareness.
3. **Emergency Readiness:** The 1-click CDM download and Kessler cascade simulator provide memorable, high-impact moments during live pitches.