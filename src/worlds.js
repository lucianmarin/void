import * as THREE from 'three';
import { PALETTE } from './materials.js';

export const FLOOR_HEIGHT = 12.0;
export const TOTAL_FLOORS = 16;

// All 16 Sky Tower inspiration files mapped to 16 vertical floors (Level 01 Underground Station -> Level 16 Apex Sky Lounge)
export const SKYTOWER_FLOORS = [
  {
    level: 1,
    code: 'B1 // LVL.01',
    name: 'UNDERGROUND STATION',
    ref: 'contrast-underground-station-13.jpg',
    theme: 'underground_station',
    accent: PALETTE.holoCyan,
    cssColor: '#24e0ff',
    portalSide: -1
  },
  {
    level: 2,
    code: 'B1 // LVL.02',
    name: 'BRUTALIST RAIL DEPOT',
    ref: 'structure-brutalist-rail-depot-16.jpg',
    theme: 'rail_depot',
    accent: PALETTE.safetyOrange,
    cssColor: '#ff6616'
  },
  {
    level: 3,
    code: 'G0 // LVL.03',
    name: 'VAULT ARCHED TRAIN HUB',
    ref: 'vault-arched-train-hub-15.jpg',
    theme: 'vault_train_hub',
    accent: PALETTE.bioEmerald,
    cssColor: '#24f5a8'
  },
  {
    level: 4,
    code: 'F04 // LVL.04',
    name: 'COBALT METRO PLATFORM',
    ref: 'lighting-cobalt-metro-platform-05.jpg',
    theme: 'cobalt_metro',
    accent: PALETTE.cobaltBlue,
    cssColor: '#215ce8',
    portalSide: 1
  },
  {
    level: 5,
    code: 'F05 // LVL.05',
    name: 'SHUTTLE CABIN TERMINAL',
    ref: 'seating-shuttle-cabin-10.jpg',
    theme: 'shuttle_cabin',
    accent: PALETTE.safetyOrange,
    cssColor: '#ff6616'
  },
  {
    level: 6,
    code: 'F06 // LVL.06',
    name: 'MEZZANINE TERMINAL',
    ref: 'scale-mezzanine-terminal-09.jpg',
    theme: 'mezzanine_terminal',
    accent: PALETTE.solarAmber,
    cssColor: '#ffb60f'
  },
  {
    level: 7,
    code: 'F07 // LVL.07',
    name: 'MODULAR SYMMETRY CORRIDOR',
    ref: 'symmetry-modular-corridor-12.jpg',
    theme: 'modular_corridor',
    accent: PALETTE.holoCyan,
    cssColor: '#24e0ff'
  },
  {
    level: 8,
    code: 'F08 // LVL.08',
    name: 'SPLIT-LEVEL HALLWAY',
    ref: 'verticality-split-level-hallway-14.jpg',
    theme: 'split_hallway',
    accent: PALETTE.bioEmerald,
    cssColor: '#24f5a8',
    portalSide: -1
  },
  {
    level: 9,
    code: 'F09 // LVL.09',
    name: 'CRIMSON COLORBLOCK CORRIDOR',
    ref: 'colorblock-crimson-corridor-02.jpg',
    theme: 'crimson_corridor',
    accent: PALETTE.signalCrimson,
    cssColor: '#ec1822'
  },
  {
    level: 10,
    code: 'F10 // LVL.10',
    name: 'KINETIC CURVED CONCOURSE',
    ref: 'kinetic-curved-concourse-03.jpg',
    theme: 'curved_concourse',
    accent: PALETTE.safetyOrange,
    cssColor: '#ff6616'
  },
  {
    level: 11,
    code: 'F11 // LVL.11',
    name: 'COBALT ATRIUM OFFICE',
    ref: 'material-cobalt-atrium-office-04.jpg',
    theme: 'cobalt_atrium',
    accent: PALETTE.cobaltBlue,
    cssColor: '#215ce8'
  },
  {
    level: 12,
    code: 'F12 // LVL.12',
    name: 'SKYBRIDGE CORRIDOR',
    ref: 'palette-skybridge-corridor-01.jpg',
    theme: 'skybridge_corridor',
    accent: PALETTE.safetyOrange,
    cssColor: '#ff6616',
    portalSide: 1
  },
  {
    level: 13,
    code: 'F13 // LVL.13',
    name: 'OBSERVATION TUNNEL',
    ref: 'geometry-observation-tunnel-11.jpg',
    theme: 'observation_tunnel',
    accent: PALETTE.holoCyan,
    cssColor: '#24e0ff'
  },
  {
    level: 14,
    code: 'F14 // LVL.14',
    name: 'MAGENTA GALLERY HALL',
    ref: 'reflection-magenta-gallery-hall-08.jpg',
    theme: 'magenta_gallery',
    accent: PALETTE.holoCoral,
    cssColor: '#ff4472'
  },
  {
    level: 15,
    code: 'F15 // LVL.15',
    name: 'AMBER CANOPY LOUNGE',
    ref: 'sunlight-amber-canopy-lounge-06.jpg',
    theme: 'amber_canopy',
    accent: PALETTE.solarAmber,
    cssColor: '#ffb60f'
  },
  {
    level: 16,
    code: 'F16 // LVL.16',
    name: 'PANORAMIC SKY LOUNGE',
    ref: 'vista-panoramic-sky-lounge-07.jpg',
    theme: 'panoramic_sky_lounge',
    accent: PALETTE.signalCrimson,
    cssColor: '#ec1822',
    portalSide: -1
  }
];

export class WorldBuilder {
  constructor(mats, portalRenderTexture, voidPortalTextures = null) {
    this.mats = mats;
    this.portalTex = portalRenderTexture;
    this.voidPortalTexs = voidPortalTextures;

    this.skyScene = new THREE.Scene();
    this.voidScene = new THREE.Scene();

    this.skyColliders = [];
    this.skyFloorSlabs = [];
    this.skyRamps = [];
    this.voidColliders = [];

    this.vtols = [];
    this.floatingOctahedron = null;
    this.bioCrystal = null;
    this.skySun = null;
    this.voidMoon = null;
    this.floorReflectors = new Map();
    this.floorGroups = Array.from({ length: TOTAL_FLOORS }, () => new THREE.Group());
    for (const fg of this.floorGroups) this.skyScene.add(fg);
    this.skyDustPoints = null;
    this.voidDustPoints = null;

    // Interactive Elevator Cab & Floor Bulkheads
    this.elevatorCab = null;
    this.elevatorY = 0;
    this.elevatorTargetY = 0;
    this.elevatorDoorOffset = 1.0;
    this.elevatorLeftDoor = null;
    this.elevatorRightDoor = null;
    this.elevatorLight = null;
    this.elevatorCenter = new THREE.Vector3(0, 0, -20.0);

    // Per-floor stairwell barrier & elevator shaft barrier meshes (indexed 0..15 for floor index)
    this.stairGateMeshes = new Array(TOTAL_FLOORS).fill(null);
    this.elevGateMeshes = new Array(TOTAL_FLOORS).fill(null);

    this.bioWellPos = new THREE.Vector3(0, 0, -8);
    this.ammoShrines = [
      new THREE.Vector3(-9.5, 0, -8.0),
      new THREE.Vector3( 9.5, 0, -8.0)
    ];

    // 5 Dimensional Threshold Portals linking key Sky Tower levels with the Void Planet Sanctuary
    const portalFloors = [0, 3, 7, 11, 15]; // Floors 1, 4, 8, 12, 16
    const voidArcX = [-16.0, -8.2, 0.0, 8.2, 16.0];
    const voidArcZ = [-28.0, -31.5, -33.5, -31.5, -28.0];
    const voidYaws = [0.42, 0.22, 0.0, -0.22, -0.42];

    this.portals = portalFloors.map((fIdx, pIdx) => {
      const f = SKYTOWER_FLOORS[fIdx];
      const y0 = fIdx * FLOOR_HEIGHT;
      const side = f.portalSide || -1;
      return {
        index: pIdx,
        floorIndex: fIdx,
        label: `P-0${pIdx + 1} // LVL.${String(f.level).padStart(2, '0')} ${f.name}`,
        skyPos: new THREE.Vector3(side * 12.6, y0, 12.2),
        skyYaw: side < 0 ? -0.95 : 0.95,
        skySpawn: new THREE.Vector3(side * 9.5, y0, 10.2),
        voidPos: new THREE.Vector3(voidArcX[pIdx], 0, voidArcZ[pIdx]),
        voidYaw: voidYaws[pIdx],
        voidSpawn: new THREE.Vector3(voidArcX[pIdx] * 0.85, 0, voidArcZ[pIdx] + 3.6),
        color: f.accent,
        cssColor: f.cssColor,
        skyApertureMat: null,
        voidApertureMat: null,
        skyGroup: null,
        voidGroup: null,
        skyLight: null,
        voidLight: null
      };
    });

    this._buildSkyTower();
    this._buildVoidPlanet();
    const initUnlocked = new Array(TOTAL_FLOORS).fill(false);
    initUnlocked[0] = true;
    this.updateUnlocks(initUnlocked);
  }

  updateUnlocks(floorUnlocked) {
    for (const p of this.portals) {
      const open = Boolean(floorUnlocked[p.floorIndex]);
      const val = open ? 1.0 : 0.0;
      if (p.skyApertureMat) p.skyApertureMat.uniforms.uUnlocked.value = val;
      if (p.voidApertureMat) p.voidApertureMat.uniforms.uUnlocked.value = val;
      if (p.skyLight) p.skyLight.intensity = open ? 3.8 : 0.8;
      if (p.voidLight) p.voidLight.intensity = open ? 5.5 : 1.0;
    }
    // Stairway gates on floor i unlock when floor i+1 is unlocked;
    // Elevator doorway gates open when either the floor itself or the next floor is unlocked so players can exit the cab onto the new level
    for (let i = 0; i < TOTAL_FLOORS - 1; i++) {
      const nextOpen = Boolean(floorUnlocked[i + 1]);
      const elevOpen = Boolean(floorUnlocked[i] || floorUnlocked[i + 1]);
      if (this.stairGateMeshes[i]) this.stairGateMeshes[i].visible = !nextOpen;
      if (this.elevGateMeshes[i]) this.elevGateMeshes[i].visible = !elevOpen;
    }
  }

  updateElevatorVisuals(y, doorOpenRatio) {
    this.elevatorY = y;
    this.elevatorDoorOffset = doorOpenRatio;
    if (this.elevatorCab) {
      this.elevatorCab.position.y = y;
    }
    if (this.elevatorLeftDoor && this.elevatorRightDoor) {
      const slide = 0.72 + doorOpenRatio * 0.95;
      this.elevatorLeftDoor.position.x = -slide;
      this.elevatorRightDoor.position.x = slide;
    }
  }

  setVisibleFloors(centerFloorIdx) {
    for (let i = 0; i < TOTAL_FLOORS; i++) {
      this.floorGroups[i].visible = (centerFloorIdx < 0) || (Math.abs(i - centerFloorIdx) <= 1);
    }
  }

  updateActiveFloorVisuals(curFloorIdx, time, playerY) {
    this.setVisibleFloors(curFloorIdx);
    for (const [fIdx, refl] of this.floorReflectors.entries()) {
      refl.visible = (fIdx === curFloorIdx);
    }
    if (this.skyDustPoints) {
      this.skyDustPoints.position.y = curFloorIdx * FLOOR_HEIGHT;
      this.skyDustPoints.material.uniforms.uTime.value = time;
    }
    if (this.voidDustPoints) {
      this.voidDustPoints.material.uniforms.uTime.value = time;
    }
  }

  _addBox(scene, colliders, pos, size, mat, opts = {}) {
    const chamfer = opts.chamfer ?? 0;
    const geom = chamfer > 0
      ? this.mats.makeChamferBoxGeometry(size[0], size[1], size[2], chamfer, opts.chamferSegs ?? 2, opts.tileMeters ?? 4.0)
      : this.mats.makeWorldBoxGeometry(size[0], size[1], size[2], opts.tileMeters ?? 4.0);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    if (opts.rot) mesh.rotation.set(opts.rot[0], opts.rot[1], opts.rot[2]);
    mesh.castShadow = opts.castShadow ?? false;
    mesh.receiveShadow = opts.receiveShadow ?? true;
    if (opts.noDepthPrepass || (mat && mat.transparent)) {
      mesh.userData.noDepthPrepass = true;
    }
    scene.add(mesh);

    if ((opts.collide ?? true) && colliders && !opts.rot) {
      colliders.push(new THREE.Box3(
        new THREE.Vector3(pos[0] - size[0] * 0.5, pos[1] - size[1] * 0.5, pos[2] - size[2] * 0.5),
        new THREE.Vector3(pos[0] + size[0] * 0.5, pos[1] + size[1] * 0.5, pos[2] + size[2] * 0.5)
      ));
    }
    return mesh;
  }

  _addSlab(xMin, xMax, zMin, zMax, yTop) {
    this.skyFloorSlabs.push({ xMin, xMax, zMin, zMax, yTop });
  }

  _addRamp(xMin, xMax, zLow, zHigh, yLow, yHigh) {
    this.skyRamps.push({ xMin, xMax, zLow, zHigh, yLow, yHigh });
  }

  _addPortalArch(scene, colliders, pos, yaw, neonHex, portalTexOverride = null) {
    const group = new THREE.Group();
    group.position.copy(pos);
    group.rotation.y = yaw;
    scene.add(group);

    const tiMat = this.mats.getPBR('portal_ti', 'dark_titanium', {
      color: 0xe6edf8, hasMetallic: true, roughness: 0.68, clearcoat: 0.30, envMapIntensity: 2.35, normalScale: 1.2
    });
    const neonMat = this.mats.getEmissive(`portal_neon_${neonHex}`, neonHex, 1.12);

    const addPart = (lp, sz, mat, glow = false, chamfer = 0.04) => {
      const geom = chamfer > 0
        ? this.mats.makeChamferBoxGeometry(sz[0], sz[1], sz[2], chamfer, 2, 2.0)
        : this.mats.makeWorldBoxGeometry(sz[0], sz[1], sz[2], 2.0);
      const m = new THREE.Mesh(geom, mat);
      m.position.set(lp[0], lp[1], lp[2]);
      m.castShadow = !glow;
      m.receiveShadow = !glow;
      group.add(m);
    };

    // Raised obsidian dais & grounded wide concrete base plinth + chamfered monolithic pillars
    addPart([0, 0.04, 0], [5.45, 0.08, 3.05], tiMat, false, 0.02);
    addPart([0, 0.14, 0], [4.8, 0.20, 2.4], tiMat, false, 0.04);
    addPart([-1.68, 2.35, 0], [0.56, 4.5, 0.76], tiMat, false, 0.06);
    addPart([ 1.68, 2.35, 0], [0.56, 4.5, 0.76], tiMat, false, 0.06);
    addPart([ 0.00, 4.48, 0], [3.92, 0.58, 0.82], tiMat, false, 0.06);

    // Inner blazing neon rim
    addPart([-1.32, 2.25, 0], [0.14, 3.96, 0.44], neonMat, true, 0.02);
    addPart([ 1.32, 2.25, 0], [0.14, 3.96, 0.44], neonMat, true, 0.02);
    addPart([ 0.00, 4.14, 0], [2.78, 0.14, 0.44], neonMat, true, 0.02);
    addPart([ 0.00, 0.24, 0], [2.78, 0.10, 0.48], neonMat, true, 0.02);

    // Live See-Through Dimensional Aperture Plane
    const apMat = this.mats.createPortalApertureMaterial(portalTexOverride || this.portalTex, neonHex);
    const apMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.50, 3.80), apMat);
    apMesh.position.set(0, 2.18, 0);
    apMesh.userData.noDepthPrepass = true;
    group.add(apMesh);

    const light = new THREE.PointLight(neonHex, 3.8, 8.5, 1.5);
    light.position.set(0, 2.3, 0);
    group.add(light);

    // Side pillar colliders so player walks cleanly through center opening
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    for (const side of [-1.68, 1.68]) {
      const wx = pos.x + side * cosY;
      const wz = pos.z - side * sinY;
      colliders.push(new THREE.Box3(
        new THREE.Vector3(wx - 0.45, pos.y, wz - 0.45),
        new THREE.Vector3(wx + 0.45, pos.y + 4.5, wz + 0.45)
      ));
    }

    return { apertureMat: apMat, light, group };
  }

  // =========================================================================
  // WORLD 1: 16-FLOOR SKY TOWER + UNDERGROUND STATION + ELEVATOR & STAIRS
  // =========================================================================
  _buildSkyTower() {
    const s = this.skyScene;
    const dome = this.mats.createSkyTowerDome();
    s.add(dome);
    s.environment = this.mats.bakeEnvironmentFromDome(dome, 0x9ab0ca);
    s.fog = new THREE.FogExp2(0xdce8f8, 0.0017);

    const hemi = new THREE.HemisphereLight(0xd4e5fb, 0x727882, 0.98);
    s.add(hemi);

    // Sun shadow frustum shines diagonally through West & South panoramic glass walls for real architectural sunbeams
    const sun = new THREE.DirectionalLight(0xfff1dc, 1.58);
    this.sunOffset = new THREE.Vector3(-62, 34, 28);
    sun.position.set(-62, 114, 28);
    sun.target.position.set(0, 80, -2);
    s.add(sun.target);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.radius = 3.2;
    sun.shadow.camera.near = 12;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -36;
    sun.shadow.camera.right = 36;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    sun.shadow.bias = -0.00025;
    sun.shadow.normalBias = 0.015;
    s.add(sun);
    this.skySun = sun;

    // Shared architectural materials (Physical clearcoat on polished stone & wet flagstones, lifted IBL response on titanium)
    const mWhiteTile   = this.mats.getPBR('st_white_tile', 'marble_tile', { color: 0xcdd7e4, roughness: 0.44, normalScale: 1.15, clearcoat: 0.42, clearcoatRoughness: 0.16, envMapIntensity: 1.35, microScale: 0.09 });
    const mCobaltTile  = this.mats.getPBR('st_cobalt_tile', 'marble_tile', { color: 0x3b78f2, roughness: 0.42, clearcoat: 0.45, clearcoatRoughness: 0.16, envMapIntensity: 1.45, microScale: 0.08 });
    const mMagentaTile = this.mats.getPBR('st_magenta_tile', 'marble_tile', { color: 0x9c6e84, albedoBoost: 1.25, roughness: 0.34, metalness: 0.06, clearcoat: 0.72, clearcoatRoughness: 0.12, normalScale: 0.38, envMapIntensity: 1.55, microScale: 0.08 });
    const mWhitePanel  = this.mats.getPBR('st_white_panel', 'arch_panel', { color: 0xdfe6ef, hasMetallic: true, roughness: 0.50, clearcoat: 0.34, clearcoatRoughness: 0.22, envMapIntensity: 1.45, microScale: 0.10 });
    const mConcrete    = this.mats.getPBR('st_concrete', 'brutalist_concrete', { color: 0xa4b0c0, roughness: 0.86, normalScale: 1.35, microScale: 0.11 });
    const mDarkConcrete = this.mats.getPBR('st_dark_concrete', 'brutalist_concrete', { color: 0x7b8799, roughness: 0.86, normalScale: 1.40, envMapIntensity: 1.45, microScale: 0.11 });
    const mSandStone   = this.mats.getPBR('st_sandstone', 'brutalist_concrete', { color: 0xdfd3be, roughness: 0.88, normalScale: 1.25, microScale: 0.10 });
    const mCrimsonPan  = this.mats.getPBR('st_crimson_panel', 'arch_panel', { color: PALETTE.signalCrimson, hasMetallic: true, roughness: 0.62, clearcoat: 0.32 });
    const mOrangePan   = this.mats.getPBR('st_orange_panel', 'arch_panel', { color: PALETTE.safetyOrange, hasMetallic: true, roughness: 0.62, clearcoat: 0.32 });
    const mAmberPan    = this.mats.getPBR('st_amber_panel', 'arch_panel', { color: 0xffc62e, hasMetallic: true, roughness: 0.60, clearcoat: 0.28, envMapIntensity: 1.65 });
    const mEmeraldPan  = this.mats.getPBR('st_emerald_panel', 'arch_panel', { color: 0x4b6b5c, hasMetallic: true, roughness: 0.68, clearcoat: 0.22, microScale: 0.10 });
    const mRunner      = this.mats.getPBR('st_runner', 'arch_panel', { color: 0xc2ccd8, hasMetallic: true, roughness: 0.54, clearcoat: 0.32, clearcoatRoughness: 0.22, normalScale: 0.75, envMapIntensity: 1.35, microScale: 0.09 });
    const mDarkTi      = this.mats.getPBR('st_dark_ti', 'dark_titanium', { color: 0xf4f8ff, hasMetallic: true, roughness: 0.72, clearcoat: 0.22, envMapIntensity: 2.4 });
    const mObsidianTi  = this.mats.getPBR('st_obs_ti', 'dark_titanium', { color: 0x64728c, hasMetallic: true, roughness: 0.65, clearcoat: 0.28, envMapIntensity: 2.2 });
    const mGlass       = this.mats.getGlass('st_glass', 0xa6dcff, 0.20);
    const mAmberGlass  = this.mats.getGlass('st_amber_glass', 0xffbc42, 0.34);

    // Textured paneled warm limestone-champagne coffered ceiling for Floor 16
    const mSunAmberCeil = this.mats.getPBR('st_sun_amber_ceil', 'arch_panel', {
      color: 0xc4b08c,
      hasMetallic: false,
      roughness: 0.78,
      normalScale: 1.25,
      envMapIntensity: 1.1
    });

    const mCyanStrip    = this.mats.getEmissive('st_cyan_strip', 0xbff4ff, 1.15);
    const mWhiteStrip   = this.mats.getEmissive('st_white_strip', 0xffffff, 0.85);
    const mOrangeStrip  = this.mats.getEmissive('st_orange_strip', PALETTE.safetyOrange, 1.65);
    const mCrimsonStrip = this.mats.getEmissive('st_crimson_strip', PALETTE.signalCrimson, 1.85);
    const mAmberStrip   = this.mats.getEmissive('st_amber_strip', PALETTE.solarAmber, 1.65);
    const mMagentaStrip = this.mats.getEmissive('st_magenta_strip', PALETTE.holoCoral, 1.75);
    const mEmeraldStrip = this.mats.getEmissive('st_emerald_strip', PALETTE.bioEmerald, 1.65);
    const holoGateMat   = this.mats.getHoloConstruct('holo_gate', PALETTE.signalCrimson);

    const palette = {
      mWhiteTile, mCobaltTile, mMagentaTile, mWhitePanel,
      mConcrete, mDarkConcrete, mSandStone,
      mCrimsonPan, mOrangePan, mAmberPan, mSunAmberCeil, mEmeraldPan,
      mRunner, mDarkTi, mObsidianTi, mGlass, mAmberGlass,
      mCyanStrip, mWhiteStrip, mOrangeStrip, mCrimsonStrip, mAmberStrip, mMagentaStrip, mEmeraldStrip,
      holoGateMat
    };

    // Build all 16 floors + connecting stairwells inside per-floor Groups for fast visibility culling
    for (let fIdx = 0; fIdx < TOTAL_FLOORS; fIdx++) {
      const fg = this.floorGroups[fIdx];
      this._buildSingleFloor(fg, fIdx, SKYTOWER_FLOORS[fIdx], palette);
      if (fIdx < TOTAL_FLOORS - 1) {
        this._buildFloorStairwell(fg, fIdx, palette);
      }
    }

    // Real-time planar floor reflector on Floor 16 (Panoramic Sky Lounge); Floor 14 uses clean physical clearcoat marble
    const loungeRefl = this.mats.createFloorReflector(35.6, 33.6, 0xdce4f0, 0.085, 512);
    loungeRefl.position.set(0, 15 * FLOOR_HEIGHT + 0.004, -1.0);
    loungeRefl.visible = false;
    this.floorGroups[15].add(loungeRefl);
    this.floorReflectors.set(15, loungeRefl);

    // Subtle atmospheric dust motes catching Sky Tower sunbeams
    this.skyDustPoints = this._createDustParticles(600, [34, 10.5, 32], [0, 5.8, -1], 0xfff2dc, 0.045);
    s.add(this.skyDustPoints);

    // Build the Continuous Vertical Central Elevator Shaft & Interactive Glass Cab
    this._buildElevatorSystem(s, palette);

    // Portals in Sky Tower (placed on key floors 1, 4, 8, 12, 16)
    for (const p of this.portals) {
      const res = this._addPortalArch(this.floorGroups[p.floorIndex], this.skyColliders, p.skyPos, p.skyYaw, p.color);
      p.skyApertureMat = res.apertureMat;
      p.skyLight = res.light;
      p.skyGroup = res.group;
    }

    // Surrounding Mega City Skyline + Twin-Ring Spire + Patrol VTOLs (clean architectural cladding, no giant vent textures)
    this._addBox(s, null, [64, 95, -235], [18, 420, 18], mWhiteTile, { collide: false, rot: [0, 0.26, 0], tileMeters: 16 });
    this._addBox(s, null, [82, 82, -242], [13, 390, 15], mWhiteTile, { collide: false, rot: [0, 0.26, 0], tileMeters: 16 });
    const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(22, 1.8, 12, 48), mWhiteTile);
    ringMesh.position.set(73, 195, -238);
    s.add(ringMesh);

    const towers = [
      [-68, -18, 24, 345, 24, false, true], [-98, -55, 30, 385, 26, true, false],
      [-75, -108, 25, 355, 26, false, true], [-118, -148, 36, 410, 32, false, false],
      [-54, -180, 28, 375, 26, true, true], [-14, -205, 32, 350, 28, false, false],
      [ 96, -172, 30, 395, 28, false, true], [ 82, -112, 26, 365, 24, true, false],
      [ 72, -48, 24, 352, 24, false, true], [112, -82, 34, 405, 30, false, false],
      [ 66,   8, 26, 340, 24, false, true], [-70,  28, 26, 338, 24, false, false],
      [-128, -24, 36, 398, 32, false, true], [128, -16, 36, 392, 30, true, false],
      [-74,  76, 28, 365, 26, true, true],  [-118,  66, 34, 388, 30, false, false],
      [-28, 108, 30, 354, 28, false, true], [ 34, 102, 28, 372, 26, true, false],
      [ 84,  72, 32, 358, 28, false, true], [-58, 136, 36, 396, 32, false, false],
      [ -4, 168, 28, 376, 26, false, true],
      [ 48, -130, 26, 368, 26, false, true], [-48, -128, 24, 348, 24, true, false]
    ];
    const beaconMat = this.mats.getEmissive('city_beacon', PALETTE.signalCrimson, 2.8);
    for (const [cx, cz, sx, sy, sz, accent, glassBand] of towers) {
      const by = -95 + sy * 0.5;
      this._addBox(s, null, [cx, by, cz], [sx, sy, sz], mWhiteTile, { collide: false, tileMeters: 14 });
      // Stepped architectural crown
      this._addBox(s, null, [cx, by + sy * 0.5 + 9, cz], [sx * 0.65, 18, sz * 0.65], mWhiteTile, { collide: false, tileMeters: 12 });
      if (glassBand) {
        this._addBox(s, null, [cx, by + sy * 0.18, cz], [sx + 0.5, 22, sz + 0.5], mCobaltTile, { collide: false, tileMeters: 8 });
      }
      if (accent) {
        this._addBox(s, null, [cx, by + sy * 0.32, cz], [sx + 0.8, 5, sz + 0.8], mAmberPan, { collide: false });
        this._addBox(s, null, [cx, by + sy * 0.5 + 24, cz], [1.2, 24, 1.2], beaconMat, { collide: false });
      }
    }

    for (let i = 0; i < 2; i++) {
      const v = new THREE.Group();
      const part = (lp, sz, mat, rx = 0) => {
        const m = new THREE.Mesh(this.mats.makeChamferBoxGeometry(sz[0], sz[1], sz[2], 0.14, 2, 3.0), mat);
        m.position.set(lp[0], lp[1], lp[2]);
        m.rotation.x = rx;
        v.add(m);
      };
      part([0, 0, 0], [2.8, 1.8, 9.8], mWhitePanel);
      part([0, -0.4, -1.2], [2.9, 0.8, 7.0], mDarkTi);
      part([0, 0.3, -4.6], [2.2, 0.9, 2.4], mGlass, 0.35);
      part([0, 0.6, 0.5], [11.6, 0.32, 1.9], mDarkTi);
      part([-5.9, 0.65, 0.5], [0.9, 1.7, 2.5], mDarkTi, 0.25);
      part([ 5.9, 0.65, 0.5], [0.9, 1.7, 2.5], mDarkTi, 0.25);
      part([0, 1.2, 4.5], [0.35, 2.1, 1.6], mCrimsonPan);
      s.add(v);
      this.vtols.push(v);
    }
  }

  // Build one of the 16 Sky Tower floors (x: -18..+18, z: +16..-18, height: 12m)
  _buildSingleFloor(s, fIdx, info, P) {
    const y0 = fIdx * FLOOR_HEIGHT;
    const isUnderground = fIdx < 3; // Levels 1-3 are Underground Station / Rail Depot / Vault Hub

    let floorMat = P.mWhiteTile;
    let wallMat  = isUnderground ? P.mDarkConcrete : P.mWhitePanel;
    let ceilMat  = isUnderground ? P.mDarkConcrete : P.mWhitePanel;
    let stripMat = P.mCyanStrip;

    if (info.theme === 'underground_station') {
      floorMat = P.mConcrete; wallMat = P.mDarkConcrete; ceilMat = P.mDarkConcrete; stripMat = P.mWhiteStrip;
    } else if (info.theme === 'rail_depot' || info.theme === 'vault_train_hub') {
      floorMat = P.mSandStone; wallMat = P.mSandStone; ceilMat = P.mSandStone; stripMat = P.mAmberStrip;
    } else if (info.theme === 'cobalt_metro' || info.theme === 'cobalt_atrium') {
      floorMat = P.mCobaltTile; stripMat = P.mCyanStrip;
    } else if (info.theme === 'magenta_gallery') {
      floorMat = P.mMagentaTile; stripMat = P.mMagentaStrip;
    } else if (info.theme === 'crimson_corridor') {
      stripMat = P.mCrimsonStrip;
    } else if (info.theme === 'split_hallway') {
      floorMat = P.mConcrete; wallMat = P.mEmeraldPan; stripMat = P.mEmeraldStrip;
    } else if (info.theme === 'amber_canopy' || info.theme === 'mezzanine_terminal') {
      stripMat = P.mAmberStrip;
    } else if (info.theme === 'shuttle_cabin' || info.theme === 'curved_concourse' || info.theme === 'skybridge_corridor') {
      stripMat = P.mOrangeStrip;
    }

    // Main Floor Slab (x: -18.4..+18.4, z: -18.4..+16.4) — slight overhang seals wall-ceiling seams against hairline sun-cracks
    this._addBox(s, null, [0, y0 - 0.30, -1.0], [36.8, 0.60, 34.8], floorMat, { collide: false, castShadow: true, tileMeters: 6.0 });
    this._addSlab(-18.0, 18.0, -18.0, 16.0, y0);

    // Central Tactical Walkway with clean anti-aliased safety-orange border rails
    this._addBox(s, null, [0, y0 + 0.018, -1.0], [3.6, 0.024, 30.0], P.mRunner, { collide: false, tileMeters: 4.0 });
    this._addBox(s, null, [-1.87, y0 + 0.020, -1.0], [0.14, 0.026, 30.0], P.mOrangePan, { collide: false });
    this._addBox(s, null, [ 1.87, y0 + 0.020, -1.0], [0.14, 0.026, 30.0], P.mOrangePan, { collide: false });

    // Ceiling Slab on top floor (warm sunlit yellow on Floor 16 per vista-panoramic-sky-lounge-07.jpg)
    if (fIdx === TOTAL_FLOORS - 1) {
      this._addBox(s, null, [0, y0 + FLOOR_HEIGHT - 0.25, -1.0], [38.0, 0.5, 35.0], P.mSunAmberCeil, { collide: false, castShadow: true });
    }

    // Recessed Ceiling Linear Luminaire Coves
    this._addBox(s, null, [-7.2, y0 + FLOOR_HEIGHT - 0.56, -1.0], [0.38, 0.10, 28.0], stripMat, { collide: false });
    this._addBox(s, null, [ 7.2, y0 + FLOOR_HEIGHT - 0.56, -1.0], [0.38, 0.10, 28.0], stripMat, { collide: false });

    // Architectural interior fill light for enclosed underground floors (1-3) and enclosed corridors
    if (isUnderground || info.theme === 'modular_corridor' || info.theme === 'crimson_corridor') {
      const fillHex = info.theme === 'crimson_corridor' ? 0xff7078 : (info.theme === 'rail_depot' || info.theme === 'vault_train_hub' ? 0xffdca8 : 0xd2ecff);
      const l1 = new THREE.PointLight(fillHex, 13.5, 34.0, 1.05);
      l1.position.set(0, y0 + 8.5, 4.5);
      if (fIdx === 0) {
        // Real shadow-casting station lighting on Floor 1 grounds androids, cover kiosks & bullet train
        l1.castShadow = true;
        l1.shadow.mapSize.set(1024, 1024);
        l1.shadow.bias = -0.0006;
        l1.shadow.radius = 2.5;
      }
      const l2 = new THREE.PointLight(fillHex, 11.5, 32.0, 1.05);
      l2.position.set(0, y0 + 7.5, -5.5);
      s.add(l1, l2);
    }

    // South Wall (z = +16.0)
    if (isUnderground || info.theme === 'modular_corridor' || info.theme === 'crimson_corridor') {
      this._addBox(s, this.skyColliders, [0, y0 + 5.75, 16.0], [36.4, 11.5, 0.5], wallMat, { castShadow: true, tileMeters: 6.5 });
    } else {
      this._addBox(s, this.skyColliders, [0, y0 + 5.75, 16.0], [36.4, 11.5, 0.18], P.mGlass);
      this._addBox(s, this.skyColliders, [-12.0, y0 + 5.75, 15.8], [0.8, 11.5, 0.8], P.mWhitePanel, { castShadow: false, chamfer: 0.04, tileMeters: 6.0 });
      this._addBox(s, this.skyColliders, [ 12.0, y0 + 5.75, 15.8], [0.8, 11.5, 0.8], P.mWhitePanel, { castShadow: false, chamfer: 0.04, tileMeters: 6.0 });
      // Sleek architectural dark curtain-wall mullions (thin bars don't cast aliased diagonal shadow lines)
      for (const xm of [-6.0, 0.0, 6.0]) {
        this._addBox(s, null, [xm, y0 + 5.75, 15.9], [0.16, 11.5, 0.22], P.mObsidianTi, { collide: false, castShadow: false });
      }
      this._addBox(s, null, [0, y0 + 6.4, 15.9], [36.0, 0.12, 0.22], P.mObsidianTi, { collide: false, castShadow: false });
    }

    // North Wall (z = -18.0) with central opening (x: -2.4..+2.4) for Elevator Cab & Lobby
    // On Floor 16 (Apex Sky Lounge), flank elevator core with panoramic glass curtain walls framing the Twin-Ring Spire & skyline!
    if (fIdx === TOTAL_FLOORS - 1) {
      this._addBox(s, this.skyColliders, [-10.8, y0 + 5.75, -18.0], [14.4, 11.5, 0.18], P.mGlass);
      this._addBox(s, this.skyColliders, [ 10.8, y0 + 5.75, -18.0], [14.4, 11.5, 0.18], P.mGlass);
      for (const xm of [-11.5, 11.5]) {
        this._addBox(s, null, [xm, y0 + 5.75, -17.9], [0.20, 11.5, 0.26], P.mObsidianTi, { collide: false, castShadow: false });
      }
      this._addBox(s, null, [-10.8, y0 + 6.4, -17.9], [14.4, 0.12, 0.22], P.mObsidianTi, { collide: false, castShadow: false });
      this._addBox(s, null, [ 10.8, y0 + 6.4, -17.9], [14.4, 0.12, 0.22], P.mObsidianTi, { collide: false, castShadow: false });
    } else {
      this._addBox(s, this.skyColliders, [-10.8, y0 + 5.75, -18.0], [14.4, 11.5, 0.6], wallMat, { castShadow: true, tileMeters: 6.5 });
      this._addBox(s, this.skyColliders, [ 10.8, y0 + 5.75, -18.0], [14.4, 11.5, 0.6], wallMat, { castShadow: true, tileMeters: 6.5 });
      for (const xp of [-10.0, -4.5, 4.5, 10.0]) {
        this._addBox(s, null, [xp, y0 + 5.75, -17.62], [0.85, 11.5, 0.24], isUnderground ? P.mConcrete : P.mWhitePanel, { collide: false, chamfer: 0.03 });
      }
      this._addBox(s, null, [-10.2, y0 + 4.45, -17.64], [14.2, 0.14, 0.12], stripMat, { collide: false });
      this._addBox(s, null, [ 10.2, y0 + 4.45, -17.64], [14.2, 0.14, 0.12], stripMat, { collide: false });
    }
    this._addBox(s, this.skyColliders, [ -3.0, y0 + 5.75, -18.0], [ 1.2, 11.5, 0.68], P.mDarkTi, { castShadow: true });
    this._addBox(s, this.skyColliders, [  3.0, y0 + 5.75, -18.0], [ 1.2, 11.5, 0.68], P.mDarkTi, { castShadow: true });
    this._addBox(s, this.skyColliders, [  0.0, y0 + 8.15, -18.0], [ 4.8,  6.7, 0.65], P.mDarkTi, { castShadow: true, chamfer: 0.04 });
    this._addBox(s, null, [0.0, y0 + 5.05, -17.64], [4.6, 0.28, 0.14], P.mOrangePan, { collide: false });
    this._addBox(s, null, [0, y0 + 0.14, -17.65], [35.6, 0.28, 0.18], P.mWhitePanel, { collide: false });
    // Level number header bar above elevator door
    this._addBox(s, null, [0.0, y0 + 4.45, -17.64], [3.6, 0.35, 0.12], stripMat, { collide: false });

    // Holographic Laser Gate across Elevator doorway when next floor is locked
    if (fIdx < TOTAL_FLOORS - 1) {
      this.elevGateMeshes[fIdx] = this._addBox(
        s, null, [0, y0 + 2.15, -17.75], [3.8, 4.2, 0.10], P.holoGateMat, { collide: false }
      );
    }

    // West Wall (x = -18.0) — solid in underground, glass curtain wall with mullions in upper tower
    if (isUnderground) {
      this._addBox(s, this.skyColliders, [-18.0, y0 + 5.75, -1.0], [0.6, 11.5, 34.0], wallMat, { castShadow: true, tileMeters: 6.5 });
    } else {
      this._addBox(s, this.skyColliders, [-18.0, y0 + 5.75, -1.0], [0.18, 11.5, 34.0], P.mGlass);
      for (const zc of [-12, 0, 12]) {
        this._addBox(s, this.skyColliders, [-17.65, y0 + 5.75, zc], [0.65, 11.5, 0.65], P.mWhitePanel, { castShadow: true, chamfer: 0.04, tileMeters: 6.0 });
      }
      for (const zm of [-6, 6]) {
        this._addBox(s, null, [-17.9, y0 + 5.75, zm], [0.22, 11.5, 0.16], P.mObsidianTi, { collide: false, castShadow: false });
      }
      this._addBox(s, null, [-17.9, y0 + 6.4, -1.0], [0.22, 0.12, 33.8], P.mObsidianTi, { collide: false, castShadow: false });
    }

    // East Wall (x = +18.0) — leaves opening for East Stairwell Annex (z: -14..+14)
    this._addBox(s, this.skyColliders, [18.0, y0 + 5.75, -16.0], [0.6, 11.5, 4.0], wallMat);
    this._addBox(s, this.skyColliders, [18.0, y0 + 5.75,  15.0], [0.6, 11.5, 2.0], wallMat);

    // Build bespoke architectural details inspired by each of the 16 files in inspiration/skytower
    this._buildFloorThemeDetails(s, fIdx, y0, info, P);
  }

  _buildFloorThemeDetails(s, fIdx, y0, info, P) {
    switch (info.theme) {
      case 'underground_station': {
        // 01: contrast-underground-station-13.jpg — Dark brutalist concrete ribs, sleek white bullet train on west track, grand staircase
        this._addBox(s, this.skyColliders, [-14.2, y0 + 0.35, -1.0], [0.4, 0.7, 30.0], P.mConcrete, { chamfer: 0.04, castShadow: true });
        this._addBox(s, this.skyColliders, [-16.2, y0 + 1.65, -2.0], [2.8, 2.8, 24.0], P.mWhitePanel, { chamfer: 0.22, castShadow: true });
        this._addBox(s, null, [-16.2, y0 + 2.15,  9.5], [2.4, 1.3, 3.2], P.mObsidianTi, { collide: false, rot: [0.38, 0, 0], chamfer: 0.14 });
        this._addBox(s, null, [-14.78, y0 + 1.9, -2.0], [0.06, 0.75, 20.0], P.mGlass, { collide: false });
        this._addBox(s, null, [-15.0, y0 + 0.85, 11.0], [0.35, 0.22, 0.4], P.mCyanStrip, { collide: false });
        this._addBox(s, null, [-17.4, y0 + 0.85, 11.0], [0.35, 0.22, 0.4], P.mCyanStrip, { collide: false });

        // Sweeping brutalist ceiling ribs with embedded white LED strips
        for (let zr = -13; zr <= 11; zr += 6) {
          this._addBox(s, null, [-2.0, y0 + 8.6, zr], [28.0, 1.4, 1.2], P.mDarkConcrete, { collide: false, rot: [0, 0, 0.08], chamfer: 0.08 });
          this._addBox(s, null, [-2.0, y0 + 7.82, zr], [26.0, 0.12, 0.18], P.mWhiteStrip, { collide: false, rot: [0, 0, 0.08] });
        }
        // Platform cover kiosks with chamfered matte charcoal concrete plinth bases & steel caps
        this._addBox(s, null, [-5.5, y0 + 0.08, 2.0], [3.45, 0.16, 1.85], P.mDarkConcrete, { collide: false, castShadow: true, chamfer: 0.03 });
        this._addBox(s, this.skyColliders, [-5.5, y0 + 0.85,  2.0], [3.2, 1.7, 1.6], P.mConcrete, { chamfer: 0.06, castShadow: true });
        this._addBox(s, null, [-5.5, y0 + 1.72,  2.0], [3.26, 0.08, 1.66], P.mWhitePanel, { collide: false, chamfer: 0.02 });
        this._addBox(s, null, [ 5.5, y0 + 0.08, -5.0], [3.45, 0.16, 1.85], P.mDarkConcrete, { collide: false, castShadow: true, chamfer: 0.03 });
        this._addBox(s, this.skyColliders, [ 5.5, y0 + 0.85, -5.0], [3.2, 1.7, 1.6], P.mConcrete, { chamfer: 0.06, castShadow: true });
        this._addBox(s, null, [ 5.5, y0 + 1.72, -5.0], [3.26, 0.08, 1.66], P.mWhitePanel, { collide: false, chamfer: 0.02 });
        break;
      }

      case 'rail_depot': {
        // 02: structure-brutalist-rail-depot-16.jpg — Colossal slanted limestone ribs, dual commuter trains, elevated sky-bridge
        for (let zr = -12; zr <= 12; zr += 8) {
          this._addBox(s, this.skyColliders, [-15.5, y0 + 5.5, zr], [2.2, 11.0, 2.2], P.mSandStone, { rot: [0, 0, -0.18] });
          this._addBox(s, null, [ 15.5, y0 + 5.5, zr], [2.2, 11.0, 2.2], P.mSandStone, { collide: false, rot: [0, 0,  0.18] });
        }
        // Dual dark-titanium rail cars parked along west & center-west tracks with glowing amber floor strips
        this._addBox(s, this.skyColliders, [-11.5, y0 + 1.5, -1.5], [2.8, 2.8, 18.0], P.mObsidianTi);
        this._addBox(s, null, [-9.8, y0 + 0.03, -1.5], [0.16, 0.05, 24.0], P.mAmberStrip, { collide: false });
        // Elevated bridge crossbeam
        this._addBox(s, null, [0, y0 + 6.2, -4.0], [32.0, 1.1, 3.6], P.mSandStone, { collide: false });
        this._addBox(s, this.skyColliders, [ 4.5, y0 + 0.85,  4.0], [3.4, 1.7, 1.8], P.mSandStone);
        this._addBox(s, this.skyColliders, [ 4.5, y0 + 0.85, -8.0], [3.4, 1.7, 1.8], P.mSandStone);
        break;
      }

      case 'vault_train_hub': {
        // 03: vault-arched-train-hub-15.jpg — Soaring vaulted arches, circular ceiling skylights, suspended emerald sphere
        for (let zr = -10; zr <= 10; zr += 10) {
          this._addBox(s, this.skyColliders, [-15.8, y0 + 5.5, zr], [1.8, 11.0, 2.0], P.mSandStone);
          this._addBox(s, null, [-12.0, y0 + 9.5, zr], [9.0, 1.2, 1.8], P.mSandStone, { collide: false, rot: [0, 0, -0.32] });
          this._addBox(s, null, [ 12.0, y0 + 9.5, zr], [9.0, 1.2, 1.8], P.mSandStone, { collide: false, rot: [0, 0,  0.32] });
          const oculus = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 0.18, 24), P.mWhiteStrip);
          oculus.position.set(0, y0 + 11.3, zr);
          s.add(oculus);
        }
        const orb = new THREE.Mesh(new THREE.SphereGeometry(1.65, 24, 18), P.mEmeraldPan);
        orb.position.set(0, y0 + 6.5, -2.0);
        s.add(orb);
        this._addBox(s, this.skyColliders, [-6.0, y0 + 0.9,  3.5], [2.4, 1.8, 5.2], P.mSandStone, { chamfer: 0.08, castShadow: true });
        this._addBox(s, this.skyColliders, [ 6.0, y0 + 0.9, -6.5], [2.4, 1.8, 5.2], P.mSandStone, { chamfer: 0.08, castShadow: true });
        break;
      }

      case 'cobalt_metro': {
        // 04: lighting-cobalt-metro-platform-05.jpg — Deep cobalt columns, glowing cyan lightboxes, sleek bench islands
        const cobFill = new THREE.PointLight(0xa6dcff, 4.2, 28.0, 1.1);
        cobFill.position.set(0, y0 + 7.5, 0);
        s.add(cobFill);
        for (const [px, pz] of [[-7.5, -8], [7.5, -8], [-7.5, 6], [7.5, 6]]) {
          this._addBox(s, this.skyColliders, [px, y0 + 5.5, pz], [1.6, 11.0, 1.6], P.mCobaltTile, { chamfer: 0.05, castShadow: true });
          this._addBox(s, null, [px, y0 + 2.4, pz + (px < 0 ? 0.85 : -0.85)], [1.1, 1.8, 0.12], P.mCyanStrip, { collide: false });
        }
        this._addBox(s, this.skyColliders, [0, y0 + 0.65,  2.5], [4.6, 1.3, 1.8], P.mCobaltTile, { chamfer: 0.07, castShadow: true });
        this._addBox(s, this.skyColliders, [0, y0 + 0.65, -7.5], [4.6, 1.3, 1.8], P.mCobaltTile, { chamfer: 0.07, castShadow: true });
        break;
      }

      case 'shuttle_cabin': {
        // 05: seating-shuttle-cabin-10.jpg — Modular orange transit seating rows & titanium grab stanchions
        for (const [bx, bz] of [[-6.5, 6], [6.5, 6], [-6.5, -1], [6.5, -1], [-6.5, -8], [6.5, -8]]) {
          this._addBox(s, this.skyColliders, [bx, y0 + 0.65, bz], [3.6, 1.3, 1.5], P.mOrangePan, { chamfer: 0.08, castShadow: true });
          this._addBox(s, null, [bx, y0 + 1.45, bz - 0.55], [3.4, 0.65, 0.35], P.mWhitePanel, { collide: false, chamfer: 0.05 });
          this._addBox(s, null, [bx + (bx < 0 ? 1.6 : -1.6), y0 + 5.5, bz], [0.14, 11.0, 0.14], P.mDarkTi, { collide: false, castShadow: true });
        }
        break;
      }

      case 'mezzanine_terminal': {
        // 06: scale-mezzanine-terminal-09.jpg — Grand terminal hall with walkable raised west mezzanine & ramp
        this._addBox(s, this.skyColliders, [-12.5, y0 + 2.65, -2.0], [7.0, 0.35, 18.0], P.mWhiteTile, { castShadow: true });
        this._addSlab(-16.0, -9.0, -11.0, 7.0, y0 + 2.8);
        this._addBox(s, null, [-9.1, y0 + 3.45, -2.0], [0.12, 0.9, 17.8], P.mAmberPan, { collide: false, castShadow: true });

        const rLen = Math.hypot(6.0, 2.8);
        const rPitch = Math.atan2(2.8, 6.0);
        this._addBox(s, null, [-12.5, y0 + 1.4, 10.0], [3.8, 0.28, rLen], P.mWhiteTile, { collide: false, rot: [rPitch, 0, 0], castShadow: true });
        this._addRamp(-14.4, -10.6, 13.0, 7.0, y0, y0 + 2.8);

        this._addBox(s, this.skyColliders, [4.5, y0 + 0.85,  4.0], [3.4, 1.7, 2.0], P.mWhitePanel, { chamfer: 0.07, castShadow: true });
        this._addBox(s, this.skyColliders, [4.5, y0 + 0.85, -6.5], [3.4, 1.7, 2.0], P.mWhitePanel, { chamfer: 0.07, castShadow: true });
        break;
      }

      case 'modular_corridor': {
        // 07: symmetry-modular-corridor-12.jpg — Iconic octagonal white sci-fi ribs with chamfered base skirts
        for (let zr = -13; zr <= 11; zr += 6) {
          this._addBox(s, this.skyColliders, [-11.5, y0 + 5.5, zr], [1.4, 11.0, 1.2], P.mWhitePanel, { chamfer: 0.06, castShadow: true });
          this._addBox(s, this.skyColliders, [ 11.5, y0 + 5.5, zr], [1.4, 11.0, 1.2], P.mWhitePanel, { chamfer: 0.06, castShadow: true });
          this._addBox(s, null, [-9.8, y0 + 0.8, zr], [2.4, 1.6, 4.8], P.mWhitePanel, { collide: false, rot: [0, 0, -0.45], chamfer: 0.06 });
          this._addBox(s, null, [ 9.8, y0 + 0.8, zr], [2.4, 1.6, 4.8], P.mWhitePanel, { collide: false, rot: [0, 0,  0.45], chamfer: 0.06 });
          this._addBox(s, null, [ 0.0, y0 + 9.2, zr], [18.0, 0.55, 1.4], P.mDarkTi, { collide: false, castShadow: true });
        }
        this._addBox(s, this.skyColliders, [-3.8, y0 + 0.8,  2.5], [2.4, 1.6, 2.0], P.mWhitePanel, { chamfer: 0.07, castShadow: true });
        this._addBox(s, this.skyColliders, [ 3.8, y0 + 0.8, -6.5], [2.4, 1.6, 2.0], P.mWhitePanel, { chamfer: 0.07, castShadow: true });
        break;
      }

      case 'split_hallway': {
        // 08: verticality-split-level-hallway-14.jpg — Brutalist sage-green split-level hallway with engineered mezzanine, coffered ceiling & light shafts
        const shFill = new THREE.PointLight(0xdff5ea, 5.5, 24.0, 1.1);
        shFill.position.set(1.5, y0 + 2.2, -2.0);
        const eastWallFill = new THREE.PointLight(0xcbe8e0, 2.8, 22.0, 1.2);
        eastWallFill.position.set(18.5, y0 + 6.5, -2.0);
        s.add(shFill, eastWallFill);
        // Coffered ceiling ribs so overhead surface has crisp depth and tonal relief
        for (let zc = -12; zc <= 12; zc += 6) {
          this._addBox(s, null, [0, y0 + 11.40, zc], [35.6, 0.55, 0.85], P.mEmeraldPan, { collide: false, castShadow: true, chamfer: 0.04 });
        }
        this._addBox(s, this.skyColliders, [ 5.5, y0 + 2.65, -2.0], [7.5, 0.35, 16.0], P.mEmeraldPan, { castShadow: true, chamfer: 0.04 });
        this._addSlab(1.75, 9.25, -10.0, 6.0, y0 + 2.8);
        // Heavy brutalist structural piers, fascia trim & stepped foundation plinths grounding the mezzanine
        this._addBox(s, null, [5.5, y0 + 2.52, -2.0], [7.62, 0.14, 16.12], P.mDarkTi, { collide: false, chamfer: 0.03 });
        this._addBox(s, null, [5.5, y0 + 2.38, -2.0], [7.4, 0.28, 15.9], P.mWhitePanel, { collide: false, castShadow: true });
        for (const mz of [-9.0, -2.0, 5.0]) {
          this._addBox(s, null, [2.25, y0 + 1.18, mz], [0.95, 2.36, 1.35], P.mWhitePanel, { collide: false, castShadow: true, chamfer: 0.05 });
          this._addBox(s, null, [2.25, y0 + 0.10, mz], [1.25, 0.20, 1.65], P.mDarkTi, { collide: false, castShadow: true, chamfer: 0.03 });
        }
        // Solid East structural spine wall anchoring the right side of the mezzanine
        this._addBox(s, null, [8.85, y0 + 1.18, -2.0], [0.85, 2.36, 15.6], P.mWhitePanel, { collide: false, castShadow: true, chamfer: 0.04 });
        this._addBox(s, null, [8.85, y0 + 0.10, -2.0], [1.10, 0.20, 15.8], P.mDarkTi, { collide: false, chamfer: 0.03 });
        // Continuous low-profile clear glass balustrade along West edge (x=1.85) so upper-level enemies remain cleanly visible
        this._addBox(s, null, [1.85, y0 + 2.98, -2.0], [0.05, 0.32, 15.8], P.mGlass, { collide: false });
        this._addBox(s, null, [1.85, y0 + 3.16, -2.0], [0.06, 0.03, 16.0], P.mWhitePanel, { collide: false, chamfer: 0.01 });
        for (const [rx, rw] of [[2.72, 1.85], [8.28, 1.85]]) {
          this._addBox(s, null, [rx, y0 + 2.98, 5.92], [rw, 0.32, 0.05], P.mGlass, { collide: false });
          this._addBox(s, null, [rx, y0 + 3.16, 5.92], [rw + 0.06, 0.03, 0.06], P.mWhitePanel, { collide: false, chamfer: 0.01 });
        }

        const rLen = Math.hypot(6.0, 2.8);
        const rPitch = Math.atan2(2.8, 6.0);
        // Sleek cantilevered architectural ramp with dark-titanium stringer beams, twin slim columns & glass handrails
        this._addBox(s, null, [5.5, y0 + 1.32, 9.0], [3.6, 0.22, rLen], P.mConcrete, { collide: false, rot: [rPitch, 0, 0], castShadow: true, chamfer: 0.03 });
        this._addBox(s, null, [5.5, y0 + 1.16, 9.0], [3.4, 0.14, rLen - 0.15], P.mDarkTi, { collide: false, rot: [rPitch, 0, 0], castShadow: true });
        this._addBox(s, null, [5.5, y0 + 1.44, 9.0], [1.4, 0.035, rLen], P.mDarkTi, { collide: false, rot: [rPitch, 0, 0] });
        this._addBox(s, null, [4.76, y0 + 1.445, 9.0], [0.06, 0.03, rLen], P.mCyanStrip, { collide: false, rot: [rPitch, 0, 0] });
        this._addBox(s, null, [6.24, y0 + 1.445, 9.0], [0.06, 0.03, rLen], P.mCyanStrip, { collide: false, rot: [rPitch, 0, 0] });
        for (const sx of [3.74, 7.26]) {
          this._addBox(s, null, [sx, y0 + 1.70, 9.0], [0.06, 0.40, rLen], P.mGlass, { collide: false, rot: [rPitch, 0, 0] });
          this._addBox(s, null, [sx, y0 + 1.94, 9.0], [0.10, 0.06, rLen], P.mWhitePanel, { collide: false, rot: [rPitch, 0, 0] });
        }
        // Twin slim architectural piers tucked cleanly under the outer ramp stringers (no bulky stacked block)
        for (const px of [4.10, 6.90]) {
          this._addBox(s, null, [px, y0 + 1.24, 6.45], [0.56, 2.48, 0.68], P.mConcrete, { collide: false, castShadow: true, chamfer: 0.04 });
          this._addBox(s, null, [px, y0 + 0.08, 6.45], [0.78, 0.16, 0.88], P.mDarkTi, { collide: false, castShadow: true, chamfer: 0.03 });
        }
        this._addBox(s, null, [5.5, y0 + 0.06, 11.9], [3.70, 0.12, 0.42], P.mDarkTi, { collide: false, chamfer: 0.03 });
        this._addRamp(3.7, 7.3, 12.0, 6.0, y0, y0 + 2.8);

        // Floor-to-ceiling angled structural buttresses with anchored titanium base plinths & ceiling capitals
        for (let zb = -10; zb <= 6; zb += 8) {
          this._addBox(s, null, [-15.2, y0 + 0.20, zb], [1.6, 0.40, 2.2], P.mDarkTi, { collide: false, castShadow: false, chamfer: 0.04 });
          this._addBox(s, null, [-12.6, y0 + 11.45, zb], [1.6, 0.40, 2.2], P.mDarkTi, { collide: false, castShadow: false, chamfer: 0.04 });
          this._addBox(s, null, [-13.9, y0 + 5.82, zb], [0.85, 11.8, 1.4], P.mEmeraldPan, { collide: false, rot: [0, 0, -0.22], castShadow: false, chamfer: 0.06 });
        }
        this._addBox(s, this.skyColliders, [-6.5, y0 + 0.85, -3.0], [3.0, 1.7, 2.8], P.mEmeraldPan, { chamfer: 0.07, castShadow: true });
        break;
      }

      case 'crimson_corridor': {
        // 09: colorblock-crimson-corridor-02.jpg — Bold two-tone Signal Crimson lower walls + pure white upper walls
        this._addBox(s, null, [-17.5, y0 + 1.6, -1.0], [0.4, 3.2, 32.0], P.mCrimsonPan, { collide: false });
        this._addBox(s, null, [ 17.5, y0 + 1.6, -1.0], [0.4, 3.2, 32.0], P.mCrimsonPan, { collide: false });
        this._addBox(s, null, [0, y0 + 0.02, -1.0], [3.6, 0.03, 30.0], P.mCrimsonPan, { collide: false });
        this._addBox(s, this.skyColliders, [-5.2, y0 + 0.9,  3.5], [2.8, 1.8, 2.2], P.mCrimsonPan, { chamfer: 0.07, castShadow: true });
        this._addBox(s, this.skyColliders, [ 5.2, y0 + 0.9, -2.5], [2.8, 1.8, 2.2], P.mCrimsonPan, { chamfer: 0.07, castShadow: true });
        this._addBox(s, this.skyColliders, [ 0.0, y0 + 0.9, -9.0], [4.4, 1.8, 1.8], P.mWhitePanel, { chamfer: 0.07, castShadow: true });
        break;
      }

      case 'curved_concourse': {
        // 10: kinetic-curved-concourse-03.jpg — Sweeping orange kinetic ribbon fins & streamlined concourse islands
        for (let i = 0; i < 5; i++) {
          const zf = 10 - i * 5.5;
          const xOff = Math.sin(i * 0.9) * 2.5;
          this._addBox(s, null, [xOff, y0 + 7.8, zf], [22.0, 0.45, 0.9], P.mOrangePan, { collide: false, rot: [0, 0.14 * Math.cos(i), 0], castShadow: true, chamfer: 0.06 });
        }
        this._addBox(s, this.skyColliders, [-6.0, y0 + 0.85,  2.0], [2.6, 1.7, 3.6], P.mOrangePan, { chamfer: 0.08, castShadow: true });
        this._addBox(s, this.skyColliders, [ 6.0, y0 + 0.85, -6.0], [2.6, 1.7, 3.6], P.mOrangePan, { chamfer: 0.08, castShadow: true });
        break;
      }

      case 'cobalt_atrium': {
        // 11: material-cobalt-atrium-office-04.jpg — Polished cobalt floor, sculpted diagonal orange wall fin, executive desks
        this._addBox(s, null, [5.5, y0 + 3.2, 15.4], [8.5, 4.5, 0.28], P.mOrangePan, { collide: false, rot: [0, 0, 0.22], castShadow: true, chamfer: 0.05 });
        for (const [dx, dz] of [[-6.0, 4.0], [6.0, 2.0], [-6.0, -7.0], [6.0, -9.0]]) {
          this._addBox(s, this.skyColliders, [dx, y0 + 0.7, dz], [3.4, 1.4, 1.6], P.mWhitePanel, { chamfer: 0.06, castShadow: true });
          this._addBox(s, null, [dx, y0 + 1.44, dz], [3.5, 0.08, 1.7], P.mOrangePan, { collide: false, chamfer: 0.02 });
        }
        break;
      }

      case 'skybridge_corridor': {
        // 12: palette-skybridge-corridor-01.jpg — High-altitude glass skybridge with bright orange portal frames
        for (let zf = -10; zf <= 8; zf += 9) {
          this._addBox(s, this.skyColliders, [-10.5, y0 + 4.5, zf], [0.9, 9.0, 0.9], P.mOrangePan, { chamfer: 0.05, castShadow: true });
          this._addBox(s, this.skyColliders, [ 10.5, y0 + 4.5, zf], [0.9, 9.0, 0.9], P.mOrangePan, { chamfer: 0.05, castShadow: true });
          this._addBox(s, null, [0, y0 + 8.8, zf], [21.9, 0.7, 0.9], P.mOrangePan, { collide: false, chamfer: 0.05, castShadow: true });
        }
        this._addBox(s, this.skyColliders, [0, y0 + 0.8, -1.5], [3.4, 1.6, 3.4], P.mWhitePanel, { chamfer: 0.08, castShadow: true });
        break;
      }

      case 'observation_tunnel': {
        // 13: geometry-observation-tunnel-11.jpg — Geometric triangular/hexagonal observation ribs framing the skyline
        for (let zt = -11; zt <= 9; zt += 5) {
          this._addBox(s, null, [-11.0, y0 + 6.5, zt], [0.6, 10.0, 0.8], P.mWhitePanel, { collide: false, rot: [0, 0, -0.35], castShadow: true, chamfer: 0.05 });
          this._addBox(s, null, [ 11.0, y0 + 6.5, zt], [0.6, 10.0, 0.8], P.mWhitePanel, { collide: false, rot: [0, 0,  0.35], castShadow: true, chamfer: 0.05 });
        }
        this._addBox(s, this.skyColliders, [-5.8, y0 + 0.85,  3.0], [2.8, 1.7, 2.0], P.mDarkTi, { chamfer: 0.07, castShadow: true });
        this._addBox(s, this.skyColliders, [ 5.8, y0 + 0.85, -7.0], [2.8, 1.7, 2.0], P.mDarkTi, { chamfer: 0.07, castShadow: true });
        break;
      }

      case 'magenta_gallery': {
        // 14: reflection-magenta-gallery-hall-08.jpg — High-contrast architectural gallery with rose-slate polished marble, crisp sun shafts & balanced bounce fill
        const galBounce = new THREE.PointLight(0xffdce8, 2.6, 34.0, 1.15);
        galBounce.position.set(2.0, y0 + 8.5, -2.0);
        s.add(galBounce);
        for (let zc = -12; zc <= 12; zc += 8) {
          this._addBox(s, null, [0, y0 + 11.40, zc], [35.6, 0.50, 0.85], P.mWhitePanel, { collide: false, castShadow: true, chamfer: 0.04 });
        }
        for (const [cx, cz] of [[-6.5, -9.5], [7.5, -8.5]]) {
          this._addBox(s, this.skyColliders, [cx, y0 + 5.75, cz], [1.2, 11.5, 1.2], P.mWhitePanel, { chamfer: 0.05, castShadow: true });
          this._addBox(s, null, [cx, y0 + 0.12, cz], [1.45, 0.24, 1.45], P.mDarkTi, { collide: false, chamfer: 0.03 });
        }
        for (const zg of [-8.5, -2.0, 3.6]) {
          this._addBox(s, this.skyColliders, [-11.5, y0 + 3.2, zg], [0.65, 6.4, 4.6], P.mWhitePanel, { chamfer: 0.05, castShadow: true });
          this._addBox(s, null, [-11.5, y0 + 0.12, zg], [0.95, 0.24, 4.9], P.mDarkTi, { collide: false, chamfer: 0.03 });
          this._addBox(s, null, [-11.10, y0 + 3.4, zg], [0.18, 3.8, 2.8], P.mObsidianTi, { collide: false, chamfer: 0.03 });
          this._addBox(s, null, [-11.00, y0 + 3.4, zg], [0.06, 3.2, 2.2], P.mMagentaTile, { collide: false });
          this._addBox(s, null, [-10.95, y0 + 3.4, zg], [0.08, 2.2, 0.28], P.mWhitePanel, { collide: false, rot: [0.55, 0, 0], chamfer: 0.02 });
          this._addBox(s, null, [-10.98, y0 + 5.15, zg], [0.12, 0.08, 2.4], P.mMagentaStrip, { collide: false });
          const artWash = new THREE.PointLight(0xff4da6, 2.4, 9.0, 1.8);
          artWash.position.set(-10.1, y0 + 5.3, zg);
          s.add(artWash);
        }
        this._addBox(s, this.skyColliders, [-4.5, y0 + 0.9,  3.5], [1.6, 1.8, 1.6], P.mWhitePanel, { chamfer: 0.07, castShadow: true });
        this._addBox(s, null, [-4.5, y0 + 0.08, 3.5], [1.84, 0.16, 1.84], P.mDarkTi, { collide: false, chamfer: 0.03 });
        this._addBox(s, this.skyColliders, [ 5.5, y0 + 0.9, -4.5], [1.6, 1.8, 1.6], P.mWhitePanel, { chamfer: 0.07, castShadow: true });
        this._addBox(s, null, [ 5.5, y0 + 0.08, -4.5], [1.84, 0.16, 1.84], P.mDarkTi, { collide: false, chamfer: 0.03 });
        break;
      }

      case 'amber_canopy': {
        // 15: sunlight-amber-canopy-lounge-06.jpg — Warm golden-amber glass canopy louvers & sunlit lounge pavilions
        for (let zl = -12; zl <= 10; zl += 4.5) {
          this._addBox(s, null, [0, y0 + 9.4, zl], [28.0, 0.25, 2.2], P.mAmberGlass, { collide: false, rot: [0.22, 0, 0], castShadow: true });
          this._addBox(s, null, [0, y0 + 9.2, zl], [28.0, 0.14, 0.24], P.mObsidianTi, { collide: false, rot: [0.22, 0, 0], castShadow: true });
        }
        this._addBox(s, this.skyColliders, [-6.5, y0 + 0.8,  2.5], [3.6, 1.6, 2.2], P.mAmberPan, { chamfer: 0.08, castShadow: true });
        this._addBox(s, this.skyColliders, [ 6.5, y0 + 0.8, -6.5], [3.6, 1.6, 2.2], P.mAmberPan, { chamfer: 0.08, castShadow: true });
        break;
      }

      case 'panoramic_sky_lounge': {
        // 16: vista-panoramic-sky-lounge-07.jpg — Apex Boss Arena with sunken circular rug, coffered ceiling beams, white columns & 360° skyline vista
        for (const zBeam of [-10, -2, 6]) {
          this._addBox(s, null, [0, y0 + 11.30, zBeam], [36.0, 0.55, 0.90], P.mWhitePanel, { collide: false, castShadow: true, chamfer: 0.05 });
        }
        for (const xBeam of [-9.5, 9.5]) {
          this._addBox(s, null, [xBeam, y0 + 11.30, -1.0], [0.90, 0.55, 34.0], P.mWhitePanel, { collide: false, castShadow: true, chamfer: 0.05 });
        }
        const loungeGlow = new THREE.PointLight(0xffe8c2, 0.9, 28.0, 1.3);
        loungeGlow.position.set(0, y0 + 9.2, 2.0);
        s.add(loungeGlow);

        const rugMat = this.mats.getPBR('st_lounge_medallion', 'marble_tile', {
          color: 0x9aaec6,
          roughness: 0.56,
          normalScale: 0.55,
          envMapIntensity: 1.25
        });
        const rugGeom = new THREE.CylinderGeometry(7.15, 7.15, 0.02, 64);
        const rugUv = rugGeom.attributes.uv;
        for (let i = 0; i < rugUv.count; i++) {
          rugUv.setXY(i, rugUv.getX(i) * 3.5, rugUv.getY(i) * 3.5);
        }
        rugUv.needsUpdate = true;
        const rugMesh = new THREE.Mesh(rugGeom, rugMat);
        rugMesh.position.set(0, y0 + 0.022, -1.0);
        rugMesh.receiveShadow = true;
        s.add(rugMesh);

        const rugTrim = new THREE.Mesh(new THREE.TorusGeometry(7.20, 0.045, 12, 64), P.mDarkTi);
        rugTrim.rotation.x = Math.PI * 0.5;
        rugTrim.position.set(0, y0 + 0.030, -1.0);
        s.add(rugTrim);

        for (const [px, pz] of [[-9.5, -9], [9.5, -9], [-9.5, 7], [9.5, 7]]) {
          this._addBox(s, this.skyColliders, [px, y0 + 5.75, pz], [1.6, 11.5, 1.6], P.mWhitePanel, { chamfer: 0.06, castShadow: true });
          this._addBox(s, null, [px, y0 + 0.13, pz], [1.92, 0.26, 1.92], P.mDarkTi, { collide: false, castShadow: true, chamfer: 0.04 });
          this._addBox(s, null, [px, y0 + 1.25, pz], [1.76, 0.35, 1.76], P.mOrangePan, { collide: false, chamfer: 0.04 });
        }
        // Sculpted brushed concrete & white ceramic lounge cover blocks with orange accent band
        this._addBox(s, this.skyColliders, [-7.5, y0 + 0.75, -1.0], [2.0, 1.5, 4.4], P.mConcrete, { chamfer: 0.08, castShadow: true });
        this._addBox(s, null, [-7.5, y0 + 0.10, -1.0], [2.20, 0.20, 4.60], P.mDarkTi, { collide: false, chamfer: 0.03 });
        this._addBox(s, null, [-7.5, y0 + 1.52, -1.0], [1.85, 0.08, 4.25], P.mWhitePanel, { collide: false, chamfer: 0.02 });
        this._addBox(s, this.skyColliders, [ 7.5, y0 + 0.75, -1.0], [2.0, 1.5, 4.4], P.mConcrete, { chamfer: 0.08, castShadow: true });
        this._addBox(s, null, [ 7.5, y0 + 0.10, -1.0], [2.20, 0.20, 4.60], P.mDarkTi, { collide: false, chamfer: 0.03 });
        this._addBox(s, null, [ 7.5, y0 + 1.52, -1.0], [1.85, 0.08, 4.25], P.mWhitePanel, { collide: false, chamfer: 0.02 });
        break;
      }
    }
  }

  // Build East Stairwell Annex connecting floor fIdx to fIdx + 1 (x: +18..+26, z: -14..+14)
  _buildFloorStairwell(s, fIdx, P) {
    const y0 = fIdx * FLOOR_HEIGHT;
    const yMid = y0 + FLOOR_HEIGHT * 0.5;
    const yTop = y0 + FLOOR_HEIGHT;

    // Outer East Glass Wall & North/South Stairwell Bulkheads
    this._addBox(s, this.skyColliders, [26.2, y0 + 6.0,  0.0], [0.22, 12.0, 28.4], P.mGlass);
    this._addBox(s, this.skyColliders, [22.0, y0 + 6.0, -14.2], [8.4, 12.0, 0.5], P.mWhitePanel);
    this._addBox(s, this.skyColliders, [22.0, y0 + 6.0,  14.2], [8.4, 12.0, 0.5], P.mWhitePanel);

    // Center Divider Wall between Flight 1 (inner x: 18..22) and Flight 2 (outer x: 22..26)
    this._addBox(s, this.skyColliders, [22.0, y0 + 6.0, 0.0], [0.35, 12.0, 16.4], P.mDarkTi);

    // South Entry Platform at (x: 18..22, z: +8..+14, y: y0)
    this._addBox(s, null, [20.0, y0 - 0.2, 11.0], [4.0, 0.4, 6.0], P.mWhiteTile, { collide: false });
    this._addSlab(18.0, 22.0, 8.0, 14.0, y0);

    // Holographic Stairway Gate at entry to Flight 1 (unlocked when floor fIdx stands cleared)
    this.stairGateMeshes[fIdx] = this._addBox(
      s, null, [20.0, y0 + 2.1, 8.0], [3.7, 4.2, 0.12], P.holoGateMat, { collide: false }
    );

    // Flight 1: Inner Lane (x: 18.2..21.8), ascending North from z = +8.0 (y0) to z = -8.0 (yMid)
    const fLen = Math.hypot(16.0, 6.0);
    const fPitch = Math.atan2(6.0, 16.0);
    this._addBox(s, null, [20.0, y0 + 2.85, 0.0], [3.6, 0.30, fLen], P.mWhiteTile, { collide: false, rot: [fPitch, 0, 0] });
    this._addBox(s, null, [20.0, y0 + 3.02, 0.0], [1.8, 0.05, fLen], P.mOrangePan, { collide: false, rot: [fPitch, 0, 0] });
    this._addRamp(18.0, 22.0, 8.0, -8.0, y0, yMid);

    // North Half-Landing (x: 18..26, z: -14..-8, y: yMid)
    this._addBox(s, null, [22.0, yMid - 0.2, -11.0], [8.0, 0.4, 6.0], P.mWhiteTile, { collide: false });
    this._addSlab(18.0, 26.0, -14.0, -8.0, yMid);
    this._addBox(s, null, [25.8, yMid + 1.2, -11.0], [0.15, 0.12, 5.6], P.mCyanStrip, { collide: false });

    // Flight 2: Outer Lane (x: 22.2..25.8), ascending South from z = -8.0 (yMid) to z = +8.0 (yTop)
    this._addBox(s, null, [24.0, yMid + 2.85, 0.0], [3.6, 0.30, fLen], P.mWhiteTile, { collide: false, rot: [-fPitch, 0, 0] });
    this._addBox(s, null, [24.0, yMid + 3.02, 0.0], [1.8, 0.05, fLen], P.mOrangePan, { collide: false, rot: [-fPitch, 0, 0] });
    // Note: For Flight 2, z goes from -8.0 (low) to +8.0 (high)
    this._addRamp(22.0, 26.0, -8.0, 8.0, yMid, yTop);

    // Top Arrival Platform at (x: 18..26, z: +8..+14, y: yTop)
    this._addBox(s, null, [22.0, yTop - 0.2, 11.0], [8.0, 0.4, 6.0], P.mWhiteTile, { collide: false });
    this._addSlab(18.0, 26.0, 8.0, 14.0, yTop);
  }

  // Build the Continuous 192m Vertical Glass Elevator Shaft & Animated Cab at (x: -2.4..+2.4, z: -18..-22)
  _buildElevatorSystem(s, P) {
    const totalH = TOTAL_FLOORS * FLOOR_HEIGHT;
    const midY = totalH * 0.5;

    // Structural Shaft Corner Pillars & Panoramic Glass Back/Sides
    this._addBox(s, this.skyColliders, [-2.45, midY, -20.0], [0.45, totalH, 4.4], P.mDarkTi);
    this._addBox(s, this.skyColliders, [ 2.45, midY, -20.0], [0.45, totalH, 4.4], P.mDarkTi);
    this._addBox(s, this.skyColliders, [ 0.00, midY, -22.2], [5.20, totalH, 0.3], P.mGlass);

    // Vertical Neon Guide Rails inside Shaft
    this._addBox(s, null, [-2.1, midY, -21.8], [0.12, totalH, 0.12], P.mCyanStrip, { collide: false });
    this._addBox(s, null, [ 2.1, midY, -21.8], [0.12, totalH, 0.12], P.mCyanStrip, { collide: false });

    // Interactive Movable Elevator Cab Group
    this.elevatorCab = new THREE.Group();
    this.elevatorCab.position.set(0, 0, -20.0);
    s.add(this.elevatorCab);

    const addCabPart = (lp, sz, mat) => {
      const m = new THREE.Mesh(this.mats.makeWorldBoxGeometry(sz[0], sz[1], sz[2], 2.0), mat);
      m.position.set(lp[0], lp[1], lp[2]);
      this.elevatorCab.add(m);
      return m;
    };

    // Cab Floor, Ceiling, Glowing Control Console & Sliding Doors
    addCabPart([0, -0.15, 0], [4.3, 0.30, 3.9], P.mDarkTi);
    addCabPart([0,  0.02, 0], [3.6, 0.04, 3.2], P.mCobaltTile);
    addCabPart([0,  4.15, 0], [4.3, 0.25, 3.9], P.mDarkTi);
    addCabPart([0,  3.98, 0], [2.8, 0.06, 2.4], P.mCyanStrip);
    // Control panel on east inside wall of cab
    addCabPart([1.95, 1.35, 0], [0.18, 0.95, 0.55], P.mOrangePan);
    addCabPart([1.84, 1.45, 0], [0.04, 0.45, 0.35], P.mCyanStrip);

    // Animated Front Sliding Glass Doors
    this.elevatorLeftDoor  = addCabPart([-1.4, 2.0, 1.92], [1.9, 4.0, 0.10], P.mGlass);
    this.elevatorRightDoor = addCabPart([ 1.4, 2.0, 1.92], [1.9, 4.0, 0.10], P.mGlass);
    // Sleek brushed-titanium rear interior wall inside cab (balanced mid-slate so both white & dark enemies read cleanly)
    addCabPart([0, 2.0, -1.85], [4.0, 4.0, 0.14], P.mDarkTi);

    this.elevatorLight = new THREE.PointLight(PALETTE.holoCyan, 2.8, 8.5, 1.5);
    this.elevatorLight.position.set(0, 3.4, 0);
    this.elevatorCab.add(this.elevatorLight);
  }

  // =========================================================================
  // WORLD 2: VOID PLANET MEGASTRUCTURE SANCTUARY
  // =========================================================================
  _buildVoidPlanet() {
    const v = this.voidScene;
    const dome = this.mats.createVoidPlanetDome();
    v.add(dome);
    v.environment = this.mats.bakeEnvironmentFromDome(dome, 0x526b78);
    v.fog = new THREE.FogExp2(0x425864, 0.0024);

    const hemi = new THREE.HemisphereLight(0xc8e2ee, 0x688292, 1.78);
    v.add(hemi);
    v.add(new THREE.AmbientLight(0x88a4b4, 0.55));

    // Soft front-right cool sky bounce light so foreground monoliths & causeway keep crisp sculptural detail
    const skyFill = new THREE.DirectionalLight(0xa4cce0, 1.15);
    skyFill.position.set(36, 42, 48);
    v.add(skyFill);

    // Directional eclipse light aligned with the Twin-Planet Eclipse corona (-0.30, 0.46, -0.83)
    const moon = new THREE.DirectionalLight(0xffcca4, 1.12);
    moon.position.set(-30, 46, -83);
    moon.target.position.set(0, 0, -10);
    v.add(moon.target);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.radius = 3.5;
    moon.shadow.camera.near = 15;
    moon.shadow.camera.far = 175;
    moon.shadow.camera.left = -38;
    moon.shadow.camera.right = 38;
    moon.shadow.camera.top = 38;
    moon.shadow.camera.bottom = -38;
    moon.shadow.bias = -0.0005;
    moon.shadow.normalBias = 0.025;
    v.add(moon);
    this.voidMoon = moon;

    const mCauseway = this.mats.getPBR('vp_causeway', 'void_causeway', { hasMetallic: false, metalness: 0.05, color: 0xb6c6d6, albedoBoost: 1.70, roughness: 0.72, minRoughness: 0.52, clearcoat: 0.14, clearcoatRoughness: 0.38, normalScale: 0.55, envMapIntensity: 0.85, microScale: 0.11 });
    const mSand     = this.mats.getPBR('vp_sand', 'void_sand', { roughness: 0.94, normalScale: 1.45 });
    const mConcrete = this.mats.getPBR('vp_concrete', 'brutalist_concrete', { color: 0xb6c0cc, roughness: 0.90, normalScale: 1.35 });
    const mDarkTi   = this.mats.getPBR('vp_dark_ti', 'dark_titanium', { color: 0xe6edf8, hasMetallic: true, roughness: 0.74, clearcoat: 0.25, normalScale: 1.3, envMapIntensity: 2.3 });
    const mAmberGl  = this.mats.getGlass('vp_amber_glass', 0xff9a1e, 0.44);

    // Real-time Planar-Reflective Animated Void Ocean
    const oceanMesh = this.mats.createVoidOceanReflector(920, 920);
    v.add(oceanMesh);

    // Smooth large-format obsidian basalt causeway slabs & dark volcanic shore (zero z-fighting)
    this._addBox(v, null, [0, -0.35, -10], [48, 0.70, 64], mCauseway, { collide: false, tileMeters: 6.0 });
    this._addBox(v, null, [0, -0.54, -10], [66, 0.36, 82], mSand, { collide: false, tileMeters: 8.5 });

    // Brutalist Concrete Perimeter Parapets (chamfered)
    this._addBox(v, this.voidColliders, [-24.2, 0.55, -10], [0.65, 1.1, 64.4], mConcrete, { chamfer: 0.06, castShadow: true });
    this._addBox(v, this.voidColliders, [ 24.2, 0.55, -10], [0.65, 1.1, 64.4], mConcrete, { chamfer: 0.06, castShadow: true });
    this._addBox(v, this.voidColliders, [  0.0, 0.55,  22.2], [49.0, 1.1, 0.65], mConcrete, { chamfer: 0.06, castShadow: true });
    this._addBox(v, this.voidColliders, [  0.0, 0.55, -42.2], [49.0, 1.1, 0.65], mConcrete, { chamfer: 0.06, castShadow: true });

    // Glowing Neon Causeway Guide Strips (subtle grounded trim lines)
    this._addBox(v, null, [ 0.0, 0.015, -20.5], [0.22, 0.03, 18.0], this.mats.getEmissive('vp_g1', PALETTE.signalCrimson, 0.85), { collide: false });
    this._addBox(v, null, [-6.5, 0.015, -19.0], [0.18, 0.03, 18.5], this.mats.getEmissive('vp_g2', PALETTE.safetyOrange, 0.85), { collide: false, rot: [0, 0.48, 0] });
    this._addBox(v, null, [ 6.5, 0.015, -19.0], [0.18, 0.03, 18.5], this.mats.getEmissive('vp_g3', PALETTE.holoCyan, 0.85), { collide: false, rot: [0, -0.48, 0] });

    // Central Emerald Bio-Regeneration Sanctuary Well with silky-smooth machined pedestal & reliquary core
    const emeraldRingMat = this.mats.getEmissive('vp_emerald', PALETTE.bioEmerald, 0.68);
    const emeraldCrystalMat = new THREE.MeshPhysicalMaterial({
      color: 0x1aa47a,
      emissive: 0x0c6b50,
      emissiveIntensity: 0.42,
      roughness: 0.12,
      metalness: 0.18,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06
    });
    const wellFoundation = new THREE.Mesh(new THREE.CylinderGeometry(5.8, 6.2, 0.14, 72), mConcrete);
    wellFoundation.position.set(0, 0.06, -8);
    wellFoundation.castShadow = true;
    wellFoundation.receiveShadow = true;
    v.add(wellFoundation);
    const wellBase = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.35, 0.18, 72), mDarkTi);
    wellBase.position.set(0, 0.12, -8);
    wellBase.castShadow = true;
    wellBase.receiveShadow = true;
    v.add(wellBase);
    const wellInner = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 4.1, 0.04, 72), mCauseway);
    wellInner.position.set(0, 0.21, -8);
    wellInner.receiveShadow = true;
    v.add(wellInner);
    const wellRing = new THREE.Mesh(new THREE.TorusGeometry(4.1, 0.10, 24, 96), emeraldRingMat);
    wellRing.rotation.x = Math.PI * 0.5;
    wellRing.position.set(0, 0.23, -8);
    v.add(wellRing);

    // Grounded Machined Titanium Emitter Pedestal + vertical energy column anchoring the Reliquary Core
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.55, 1.15, 64), mDarkTi);
    pedestal.position.set(0, 0.76, -8);
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    v.add(pedestal);
    const collarRing = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.08, 24, 96), emeraldRingMat);
    collarRing.rotation.x = Math.PI * 0.5;
    collarRing.position.set(0, 1.32, -8);
    v.add(collarRing);
    const coreBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.42, 1.65, 32),
      this.mats.getEmissive('vp_well_beam', PALETTE.bioEmerald, 0.72)
    );
    coreBeam.position.set(0, 2.05, -8);
    v.add(coreBeam);

    // High-resolution smooth-shaded Sanctuary Reliquary Core + precision gyroscopic rings
    const crystalGroup = new THREE.Group();
    crystalGroup.position.set(0, 2.85, -8);
    const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(0.86, 48, 36), emeraldCrystalMat);
    coreMesh.scale.set(0.76, 1.48, 0.76);
    coreMesh.castShadow = true;
    crystalGroup.add(coreMesh);
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.055, 24, 96), mDarkTi);
    ringA.rotation.set(0.65, 0.4, 0);
    crystalGroup.add(ringA);
    const ringB = new THREE.Mesh(new THREE.TorusGeometry(1.68, 0.038, 20, 96), emeraldRingMat);
    ringB.rotation.set(-0.55, 0.2, 0.45);
    crystalGroup.add(ringB);
    this.bioCrystal = crystalGroup;
    v.add(this.bioCrystal);

    const wellLight = new THREE.PointLight(PALETTE.bioEmerald, 5.0, 24.0, 1.0);
    wellLight.position.set(0, 2.6, -8);
    v.add(wellLight);

    // Munition Reliquary Shrines with stepped base plinths
    const orangeGlow = this.mats.getEmissive('vp_shrine_o', PALETTE.safetyOrange, 2.2);
    for (const sp of this.ammoShrines) {
      this._addBox(v, null, [sp.x, 0.08, sp.z], [1.9, 0.16, 1.9], mConcrete, { collide: false, castShadow: true, chamfer: 0.04 });
      this._addBox(v, this.voidColliders, [sp.x, 0.72, sp.z], [1.4, 1.28, 1.4], mDarkTi, { chamfer: 0.08, castShadow: true });
      this._addBox(v, null, [sp.x, 1.40, sp.z], [0.95, 0.12, 0.95], orangeGlow, { collide: false, chamfer: 0.03 });
    }

    // Vaulted Brutalist Concrete Arches with recessed amber light channels & tapered haunches
    const archTrim = this.mats.getEmissive('vp_arch_trim', PALETTE.solarAmber, 1.15);
    for (let za = 12; za >= -20.1; za -= 8) {
      this._addBox(v, null, [-19.5, 0.22, za], [2.3, 0.44, 2.3], mDarkTi, { collide: false, castShadow: true, chamfer: 0.06 });
      this._addBox(v, null, [ 19.5, 0.22, za], [2.3, 0.44, 2.3], mDarkTi, { collide: false, castShadow: true, chamfer: 0.06 });
      this._addBox(v, this.voidColliders, [-19.5, 4.6, za], [1.5, 8.8, 1.7], mConcrete, { chamfer: 0.08, castShadow: true });
      this._addBox(v, this.voidColliders, [ 19.5, 4.6, za], [1.5, 8.8, 1.7], mConcrete, { chamfer: 0.08, castShadow: true });
      // Recessed vertical light channel & inner titanium spine on each arch column
      this._addBox(v, null, [-18.72, 4.6, za], [0.08, 6.8, 0.35], mDarkTi, { collide: false });
      this._addBox(v, null, [-18.67, 4.6, za], [0.04, 6.2, 0.10], archTrim, { collide: false });
      this._addBox(v, null, [ 18.72, 4.6, za], [0.08, 6.8, 0.35], mDarkTi, { collide: false });
      this._addBox(v, null, [ 18.67, 4.6, za], [0.04, 6.2, 0.10], archTrim, { collide: false });
      this._addBox(v, null, [-16.8, 9.05, za], [6.4, 0.95, 1.5], mConcrete, { collide: false, rot: [0, 0, -0.22], chamfer: 0.08, castShadow: true });
      this._addBox(v, null, [ 16.8, 9.05, za], [6.4, 0.95, 1.5], mConcrete, { collide: false, rot: [0, 0,  0.22], chamfer: 0.08, castShadow: true });
    }
    for (let i = 0; i < 5; i++) {
      const zs = 8.0 - i * 4.5;
      this._addBox(v, null, [-22.0, 2.4, zs], [0.18, 4.6, 2.2], mAmberGl, { collide: false, rot: [0, 0.26, 0] });
      this._addBox(v, null, [ 22.0, 2.4, zs], [0.18, 4.6, 2.2], mAmberGl, { collide: false, rot: [0, -0.26, 0] });
    }

    // Atmospheric drifting mist spores / volcanic embers on Void Planet
    this.voidDustPoints = this._createDustParticles(520, [54, 16, 68], [0, 7.5, -10], 0x8ef2d8, 0.048);
    v.add(this.voidDustPoints);

    // Portals on Void Planet (each portal receives its own Sky Tower floor render target)
    for (const p of this.portals) {
      const pTex = this.voidPortalTexs?.[p.index] || this.portalTex;
      const res = this._addPortalArch(v, this.voidColliders, p.voidPos, p.voidYaw, p.color, pTex);
      p.voidApertureMat = res.apertureMat;
      p.voidLight = res.light;
      p.voidGroup = res.group;
    }

    // --- COLOSSAL HORIZON MEGASTRUCTURES (voidplanet/) ---
    const wedgeGrp = new THREE.Group();
    wedgeGrp.position.set(92, -1.8, -142);
    wedgeGrp.rotation.y = -0.45;
    wedgeGrp.scale.setScalar(0.86);
    const mWedge = this.mats.createCrimsonWedgeMaterial();
    const mWedgeTrim = this.mats.getPBR('vp_wedge_trim', 'dark_titanium', {
      hasMetallic: false, metalness: 0.35, roughness: 0.42, color: 0x9aaec4, albedoBoost: 2.0, envMapIntensity: 1.8
    });
    const mWedgeGlow = this.mats.getEmissive('vp_wedge_glow', PALETTE.solarAmber, 1.35);

    // Sweeping curved brutalist Crimson Wedge architectural monument (smooth Bezier prow + stepped plinth)
    const wShape = new THREE.Shape();
    wShape.moveTo(-11, 0);
    wShape.lineTo(13, 0);
    wShape.quadraticCurveTo(11, 46, 4.5, 86);
    wShape.quadraticCurveTo(0.0, 93, -6.5, 82);
    wShape.quadraticCurveTo(-10.5, 42, -11, 0);
    const wGeo = new THREE.ExtrudeGeometry(wShape, {
      depth: 18,
      bevelEnabled: true,
      bevelThickness: 1.5,
      bevelSize: 1.5,
      bevelSegments: 5,
      curveSegments: 24
    });
    wGeo.translate(0, 0, -9);
    const wUv = wGeo.attributes.uv;
    for (let i = 0; i < wUv.count; i++) {
      wUv.setXY(i, wUv.getX(i) * 0.14, wUv.getY(i) * 0.14);
    }
    wUv.needsUpdate = true;
    const wMain = new THREE.Mesh(wGeo, mWedge);
    wedgeGrp.add(wMain);

    // Monumental stepped plinth & recessed titanium structural ribs + amber beacon channel
    const wBase1 = new THREE.Mesh(this.mats.makeChamferBoxGeometry(30, 5, 25, 0.35, 2, 6.0), mWedgeTrim);
    wBase1.position.set(1, 2.5, 0);
    wedgeGrp.add(wBase1);
    const wBase2 = new THREE.Mesh(this.mats.makeChamferBoxGeometry(27, 4, 22.5, 0.30, 2, 6.0), mConcrete);
    wBase2.position.set(1, 6.8, 0);
    wedgeGrp.add(wBase2);
    for (const rz of [-6.0, 0, 6.0]) {
      const rib = new THREE.Mesh(this.mats.makeChamferBoxGeometry(19.0, 56, 1.3, 0.2, 2, 6.0), mWedgeTrim);
      rib.position.set(0.0, 32, rz);
      rib.rotation.z = -0.09;
      wedgeGrp.add(rib);
    }
    const wCollar = new THREE.Mesh(this.mats.makeChamferBoxGeometry(24.0, 2.4, 21.8, 0.25, 2, 6.0), mWedgeTrim);
    wCollar.position.set(0.8, 42, 0);
    wedgeGrp.add(wCollar);
    const wCrownCollar = new THREE.Mesh(this.mats.makeChamferBoxGeometry(18.5, 2.0, 21.2, 0.25, 2, 6.0), mWedgeTrim);
    wCrownCollar.position.set(0.2, 74, 0);
    wedgeGrp.add(wCrownCollar);
    const wSlit = new THREE.Mesh(new THREE.BoxGeometry(1.1, 46, 0.9), mWedgeGlow);
    wSlit.position.set(-10.2, 41, 0);
    wSlit.rotation.z = -0.05;
    wedgeGrp.add(wSlit);
    v.add(wedgeGrp);

    // Lit metallic-basalt material for horizon megastructures (spires + floating monolith)
    const mPyrMat = this.mats.getPBR('vp_pyr_mat', 'dark_titanium', {
      hasMetallic: false,
      metalness: 0.28,
      roughness: 0.64,
      color: 0xa2b6cc,
      albedoBoost: 2.25,
      normalScale: 1.45,
      envMapIntensity: 1.65
    });

    // Sleek Machined Floating Obelisk Monolith (smooth 64-segment cones + precision collar rings)
    const octGroup = new THREE.Group();
    octGroup.position.set(-70, 28, -100);
    const topCone = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 12.5, 28, 64), mPyrMat);
    topCone.position.y = 14.5;
    octGroup.add(topCone);
    const botCone = new THREE.Mesh(new THREE.CylinderGeometry(12.5, 1.8, 22, 64), mPyrMat);
    botCone.position.y = -11.5;
    octGroup.add(botCone);
    for (const [ry, rr] of [[8.0, 9.6], [18.0, 5.6]]) {
      const collar = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.45, 18, 64), mConcrete);
      collar.rotation.x = Math.PI * 0.5;
      collar.position.y = ry;
      octGroup.add(collar);
    }
    const octRing = new THREE.Mesh(new THREE.TorusGeometry(14.5, 0.68, 24, 96), mConcrete);
    octRing.rotation.set(Math.PI * 0.5, 0, 0);
    octGroup.add(octRing);
    const octCore = new THREE.Mesh(new THREE.CylinderGeometry(13.0, 13.0, 1.1, 64), this.mats.getEmissive('vp_oct_core', PALETTE.holoCyan, 1.15));
    octGroup.add(octCore);
    v.add(octGroup);
    this.floatingOctahedron = octGroup;

    // Sleek High-Detail Tapered Megastructure Obelisk Spires with smooth 64-segment cones & collar bands
    const buildMonolithSpire = (px, pz, baseR, height, rotY) => {
      const grp = new THREE.Group();
      grp.position.set(px, -0.6, pz);
      grp.rotation.y = rotY;
      const baseSkirt = new THREE.Mesh(new THREE.CylinderGeometry(baseR * 0.72, baseR, height * 0.22, 64), mConcrete);
      baseSkirt.position.y = height * 0.11;
      grp.add(baseSkirt);
      const coreSpire = new THREE.Mesh(new THREE.CylinderGeometry(baseR * 0.14, baseR * 0.70, height * 0.84, 64), mPyrMat);
      coreSpire.position.y = height * 0.54;
      grp.add(coreSpire);
      for (const hFrac of [0.36, 0.58]) {
        const ringBand = new THREE.Mesh(new THREE.TorusGeometry(baseR * (0.72 - hFrac * 0.52), 0.7, 16, 64), mConcrete);
        ringBand.rotation.x = Math.PI * 0.5;
        ringBand.position.y = height * hFrac;
        grp.add(ringBand);
      }
      const crownRing = new THREE.Mesh(new THREE.TorusGeometry(baseR * 0.28, 0.65, 16, 64), this.mats.getEmissive('vp_pyr_seam', PALETTE.solarAmber, 1.0));
      crownRing.rotation.x = Math.PI * 0.5;
      crownRing.position.y = height * 0.74;
      grp.add(crownRing);
      v.add(grp);
    };
    buildMonolithSpire(-22, -162, 32, 50, 0.35);
    buildMonolithSpire( 34, -186, 38, 58, 0.55);

    this._addBox(v, null, [-5.4, 38, 128], [8.8, 78, 14], mDarkTi, { collide: false, tileMeters: 10 });
    this._addBox(v, null, [ 5.4, 38, 128], [8.8, 78, 14], mDarkTi, { collide: false, tileMeters: 10 });
    this._addBox(v, null, [ 0.0, 40, 128], [1.2, 70, 8], this.mats.getEmissive('vp_slit', PALETTE.signalCrimson, 3.6), { collide: false });

    this._buildCortenDuneIsland(v, mSand);
    this._buildGlassSlabArray(v);
  }

  // Wind-rippled dune island with leaning rusted corten monoliths (anomaly-glowing-red-monolith-14 / horizon-planetary-desert-highway)
  _buildCortenDuneIsland(v, mSand) {
    const cx = -50, cz = -62;
    const geom = new THREE.PlaneGeometry(56, 44, 36, 28);
    geom.rotateX(-Math.PI * 0.5);
    const pos = geom.attributes.position;
    const uv = geom.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const r = Math.hypot(x / 26, z / 20);
      const mound = Math.max(0, 1 - r * r) ** 1.6 * 5.2;
      const dune = Math.sin(x * 0.21 + Math.sin(z * 0.13) * 1.8) * 0.55 + Math.sin(z * 0.35 + x * 0.08) * 0.22;
      pos.setY(i, mound + dune * Math.min(1, mound) - 1.4);
      uv.setXY(i, (x + cx) / 5, -(z + cz) / 5);
    }
    geom.computeVertexNormals();
    const island = new THREE.Mesh(geom, mSand);
    island.position.set(cx, 0, cz);
    island.receiveShadow = true;
    v.add(island);

    const mCorten = this.mats.getPBR('vp_corten', 'rusted_corten', { hasMetallic: true, roughness: 1.0, normalScale: 1.2 });
    const pillars = [
      [-4, 0, 16, 2.4, 1.1, 0.04], [0.5, -3, 22, 3.0, 1.4, -0.03], [5, 1.5, 12, 2.0, 1.0, 0.09],
      [-9, 4, 8, 1.6, 0.9, -0.12], [9, -5, 6.5, 1.4, 1.4, 0.18], [-2, 7, 4.5, 3.6, 1.0, 0.0]
    ];
    for (const [px, pz, h, w, d, lean] of pillars) {
      this._addBox(v, null, [cx + px, h * 0.5 + 1.6, cz + pz], [w, h, d], mCorten,
        { collide: false, rot: [lean * 0.5, px * 0.07, lean], tileMeters: 3.0, castShadow: true });
    }
    // Thin glowing seam on the tallest monolith
    this._addBox(v, null, [cx + 0.5, 13.2, cz - 3 + 0.71], [0.12, 19, 0.04],
      this.mats.getEmissive('vp_corten_seam', PALETTE.signalCrimson, 3.4), { collide: false, rot: [-0.015, 0.035, -0.03] });
  }

  // Receding array of tall refractive amber & crimson glass slabs standing in the ocean (refraction-amber-glass-slab-array)
  _buildGlassSlabArray(v) {
    const mAmber = this.mats.getGlass('vp_slab_amber', 0xffa030, 0.38);
    const mCrimson = this.mats.getGlass('vp_slab_crimson', 0xff2a3c, 0.34);
    const mEdge = this.mats.getEmissive('vp_slab_edge', PALETTE.solarAmber, 2.6);
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const x = 38 + i * 6.5;
      const z = -18 - i * 9.5;
      const h = 9 + t * 22;
      const mat = i % 3 === 2 ? mCrimson : mAmber;
      this._addBox(v, null, [x, h * 0.5 - 0.8, z], [0.35, h, 7.5 + t * 4], mat, { collide: false, rot: [0, 0.42, 0] });
      this._addBox(v, null, [x, h - 0.75, z], [0.4, 0.1, 7.6 + t * 4], mEdge, { collide: false, rot: [0, 0.42, 0] });
    }
  }

  // GPU-animated atmospheric dust motes / spores (zero per-frame JS allocations)
  _createDustParticles(count, boxSize, center, colorHex, size) {
    const pos = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 2);
    const hash = (n) => {
      const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = center[0] + (hash(i * 3 + 1) - 0.5) * boxSize[0];
      pos[i * 3 + 1] = center[1] + (hash(i * 3 + 2) - 0.5) * boxSize[1];
      pos[i * 3 + 2] = center[2] + (hash(i * 3 + 3) - 0.5) * boxSize[2];
      seeds[i * 2 + 0] = hash(i * 7 + 5);
      seeds[i * 2 + 1] = 0.5 + hash(i * 11 + 9) * 1.2;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 2));

    const col = new THREE.Color(colorHex);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Vector3(col.r, col.g, col.b) },
        uSize: { value: size }
      },
      vertexShader: /* glsl */`
        attribute vec2 aSeed;
        uniform float uTime;
        uniform float uSize;
        varying float vAlpha;
        void main() {
          float ph = aSeed.x * 62.8318;
          vec3 p = position;
          p.x += sin(uTime * 0.32 + ph) * 0.65;
          p.y += cos(uTime * 0.24 + ph * 1.3) * 0.45 + mod(uTime * 0.14 * aSeed.y + aSeed.x * 4.0, 2.0) - 1.0;
          p.z += cos(uTime * 0.29 + ph * 0.7) * 0.65;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float d = max(1.0, -mv.z);
          float tw = 0.45 + 0.55 * sin(uTime * (0.8 + aSeed.y) + ph);
          vAlpha = tw * smoothstep(42.0, 8.0, d) * smoothstep(0.6, 2.2, d);
          gl_PointSize = clamp(uSize * 520.0 * aSeed.y / d, 1.5, 9.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          vec2 q = gl_PointCoord * 2.0 - 1.0;
          float r2 = dot(q, q);
          if (r2 > 1.0) discard;
          float fall = exp(-r2 * 5.2) * (1.0 - r2);
          gl_FragColor = vec4(uColor * fall * vAlpha * 0.24, 1.0);
        }
      `
    });
    const pts = new THREE.Points(geom, mat);
    pts.userData.noDepthPrepass = true;
    pts.frustumCulled = false;
    return pts;
  }

  // Keep the Sky Tower sun's tight shadow frustum centred on the player's current floor
  updateSunShadow(floorY, playerPos) {
    if (!this.skySun) return;
    const snap = 0.5;
    const tx = Math.round(playerPos.x / snap) * snap;
    const tz = Math.round(playerPos.z / snap) * snap;
    this.skySun.target.position.set(tx, floorY + 4, tz);
    this.skySun.position.set(tx + this.sunOffset.x, floorY + 4 + this.sunOffset.y, tz + this.sunOffset.z);
    this.skySun.target.updateMatrixWorld();
  }
}

