# VOID

**HIR.SYS // 001** — A first-person cyberpunk tactical shooter built with **Three.js** and **Vite**.

Fight future humanoid androids inside the computer-generated **Sky Tower** construct. When critically wounded, cross a live see-through **Threshold Portal** back to the real-world **Void Planet** Megastructure Sanctuary to restore bio-integrity and ordnance—then dive back into battle.

---

## Core Architecture & Features

### Dual-Realm Live Portal System
- **Construct // Sky Tower (`001`)**: A multi-sector vertical brutalist/Swiss-industrial architectural construct suspended above a sprawling white megacity beneath a crimson sun.
  - **SEC.01 // Cobalt Atrium**: Opening patrol sector with multi-level cover and Portal `P-01 // ATRIUM` (Safety Orange).
  - **SEC.02 // Crimson Concourse**: Mid-construct concourse featuring elevated sniper mezzanines and Portal `P-02 // CONCOURSE` (Signal Crimson).
  - **SEC.03 // Apex Sky Lounge**: Final executive arena housing Portal `P-03 // APEX LOUNGE` (Holo Cyan) and the boss encounter.
- **Reality // Void Planet (`000`)**: An obsidian desert megastructure sanctuary featuring floating monoliths, an Emerald **Bio-Well** (restores HP, shield, and full ammunition), and flanking **Ammo Shrines**.
- **Real-Time Portal Rendering**: Portals render live cross-dimensional views using a dedicated `WebGLRenderTarget` (`512×768` HalfFloat) and synchronized virtual portal camera before you step across the threshold.

### Ordnance & Combat Mechanics
- **HIR-01 Pulse Rifle (`[1]`)**: High-velocity automatic energy rifle firing cyan bolts (`32` round magazine, infinite reserve, `27` base damage, `1.5×` headshot multiplier).
- **HIR-02 Twin-Rail Scattergun (`[2]`)**: Heavy close-quarters scattergun firing 8 superheated orange rail pellets per shot (`8` shell magazine, `56` max reserve, `18` damage per pellet).
- **Cyber-Katana Dash & Cleave (`[RMB]` / `[F]`)**: High-speed forward lunge (`2.4s` cooldown) that cleaves hostiles in a wide arc for `95` damage and slices incoming enemy projectiles out of mid-air.
- **Vitals & Shielding**: `100 HP` Bio-Integrity paired with a `50` capacity regenerating energy shield.

### Hostile Classifications
| Unit | Designation | Profile |
| :--- | :--- | :--- |
| **Optic Android** | `OPTIC_ANDROID` | Ceramic-and-carbon patrol unit (`115 HP`) with glowing orange side-optics and mid-range pulse fire. |
| **Holo-Strider** | `HOLO_STRIDER` | Agile coral holographic runner (`85 HP`) that closes distance rapidly for melee strikes. |
| **Obsidian Stalker** | `OBSIDIAN_STALKER` | Winged dark-titanium sniper (`130 HP`) positioned on elevated mezzanines with high-velocity crimson rail shots. |
| **HIR-00 White Katana Mech** | `KATANA_BOSS` | Towering `3.35m` samurai mech boss (`980 HP`) in the Apex Sky Lounge; performs high-speed katana dashes and deploys Holo-Strider escorts at 50% health. |

### Visuals, HUD & Audio
- **Rendering Pipeline**: Three.js `WebGLRenderer` with `PCFSoftShadowMap` (player-following sun frustum), `ACESFilmicToneMapping`, world-space UV box mapping with seamless 1K PBR textures (JPEG `albedo`, OpenGL-convention `normal`, `roughness`, `metallic`), scanline/glitch hologram shaders, custom GLSL sky domes (procedural skyline & crimson-sun spire; banded gas giant, stars & eclipse), reflective void ocean, proximity-culled live portal preview, and selective HDR `UnrealBloomPass`.
- **Swiss-Industrial HUD**: High-contrast telemetry overlay featuring live 45m tactical radar, dynamic reticle with hitmarkers, segmented bio-integrity readout, boss health bar, and screen-space trauma/heal/portal vignettes.
- **Procedural Web Audio Synth**: Zero-dependency synthesized sound effects (`SoundSynth`) for pulse fire, rail blasts, katana sweeps, hitmarkers, portal warps, and sanctuary bio-healing.

---

## Controls

| Input | Action |
| :--- | :--- |
| `W` `A` `S` `D` / `Arrow Keys` | Move / Strafe |
| `Shift` | Sprint |
| `Space` | Jump |
| `Mouse` | Aim (Pointer Lock) |
| `Left Click` | Fire Active Ordnance |
| `Right Click` or `F` | Cyber-Katana Dash & Cleave |
| `1` / `2` or `Mouse Wheel` | Switch Weapon (HIR-01 Pulse Rifle / HIR-02 Rail Scatter) |
| `R` | Reload Magazine |
| `Walk into Portal` | Live Warp between Sky Tower & Void Planet Sanctuary |
| `N` | Reset / Start New Campaign Run |
| `ESC` | Pause / Unlock Cursor |

---

## Project Structure

```text
void/
├── index.html          # Main entry HTML & Swiss-Industrial HUD markup
├── package.json        # Vite & Three.js configuration
├── public/
│   └── textures/       # 1K PBR texture sets (albedo .jpg; normal, roughness, metallic .png) incl. rusted_corten
├── inspiration/        # Concept art & visual reference boards (characters, HUD, worlds)
├── tools/
│   └── gen_textures.py # Procedural seamless PBR texture generator (numpy + Pillow)
└── src/
    ├── main.js         # Core game loop, physics, raycasting, AI, and portal warping
    ├── worlds.js       # Sky Tower sectors, Void Planet sanctuary, and portal geometry
    ├── entities.js     # Enemy procedural rigs (RobotEnemy) & 3D FPS viewmodel (WeaponRig)
    ├── materials.js    # PBR material cache, world-space UV mapper, and GLSL shaders
    ├── hud.js          # HUD telemetry controller and 2D tactical radar canvas
    ├── audio.js        # Web Audio API procedural sound synthesizer
    └── style.css       # HUD layout, typography, and screen-space FX styling
```

---

## Getting Started

### Prerequisites
- **Node.js** (v18+ recommended)
- **npm**

### Installation & Development

```bash
# Install dependencies
npm install

# Start local development server (http://127.0.0.1:5173)
npm run dev

# Build for production
npm run build

# Preview production build (http://127.0.0.1:4173)
npm run preview
```

### Regenerating Textures

Textures are generated procedurally and are deterministic (fixed seeds). Requires Python 3 and runs from the repo root:

```bash
pip install -r tools/requirements.txt

# Regenerate all sets into public/textures
python tools/gen_textures.py

# Regenerate specific sets only
python tools/gen_textures.py public/textures mech_armor void_sand
```
