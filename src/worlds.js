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
  constructor(mats, portalRenderTexture) {
    this.mats = mats;
    this.portalTex = portalRenderTexture;

    this.skyScene = new THREE.Scene();
    this.voidScene = new THREE.Scene();

    this.skyColliders = [];
    this.skyFloorSlabs = [];
    this.skyRamps = [];
    this.voidColliders = [];

    this.vtols = [];
    this.floatingOctahedron = null;
    this.bioCrystal = null;

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
        skyYaw: side < 0 ? 0.52 : -0.52,
        skySpawn: new THREE.Vector3(side * 9.5, y0, 10.2),
        voidPos: new THREE.Vector3(voidArcX[pIdx], 0, voidArcZ[pIdx]),
        voidYaw: voidYaws[pIdx],
        voidSpawn: new THREE.Vector3(voidArcX[pIdx] * 0.85, 0, voidArcZ[pIdx] + 3.6),
        color: f.accent,
        cssColor: f.cssColor,
        skyApertureMat: null,
        voidApertureMat: null,
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
      if (p.skyLight) p.skyLight.intensity = open ? 18.0 : 1.5;
      if (p.voidLight) p.voidLight.intensity = open ? 24.0 : 2.0;
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

  _addBox(scene, colliders, pos, size, mat, opts = {}) {
    const geom = this.mats.makeWorldBoxGeometry(size[0], size[1], size[2], opts.tileMeters ?? 4.0);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    if (opts.rot) mesh.rotation.set(opts.rot[0], opts.rot[1], opts.rot[2]);
    mesh.castShadow = opts.castShadow ?? false;
    mesh.receiveShadow = opts.receiveShadow ?? true;
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

  _addPortalArch(scene, colliders, pos, yaw, neonHex) {
    const group = new THREE.Group();
    group.position.copy(pos);
    group.rotation.y = yaw;
    scene.add(group);

    const tiMat = this.mats.getPBR('portal_ti', 'dark_titanium', {
      color: 0xd8e0ec, hasMetallic: true, roughness: 0.85, normalScale: 1.2
    });
    const neonMat = this.mats.getEmissive(`portal_neon_${neonHex}`, neonHex, 3.2);

    const addPart = (lp, sz, mat, glow = false) => {
      const m = new THREE.Mesh(this.mats.makeWorldBoxGeometry(sz[0], sz[1], sz[2], 2.0), mat);
      m.position.set(lp[0], lp[1], lp[2]);
      m.castShadow = false;
      m.receiveShadow = !glow;
      group.add(m);
    };

    // Raised obsidian dais & monolithic pillars (threshold-neon-void-portal-13.jpg)
    addPart([0, 0.10, 0], [4.8, 0.20, 2.4], tiMat);
    addPart([-1.68, 2.35, 0], [0.56, 4.5, 0.76], tiMat);
    addPart([ 1.68, 2.35, 0], [0.56, 4.5, 0.76], tiMat);
    addPart([ 0.00, 4.48, 0], [3.92, 0.58, 0.82], tiMat);

    // Inner blazing neon rim
    addPart([-1.32, 2.25, 0], [0.14, 3.96, 0.44], neonMat, true);
    addPart([ 1.32, 2.25, 0], [0.14, 3.96, 0.44], neonMat, true);
    addPart([ 0.00, 4.14, 0], [2.78, 0.14, 0.44], neonMat, true);
    addPart([ 0.00, 0.24, 0], [2.78, 0.10, 0.48], neonMat, true);

    // Live See-Through Dimensional Aperture Plane
    const apMat = this.mats.createPortalApertureMaterial(this.portalTex, neonHex);
    const apMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.50, 3.80), apMat);
    apMesh.position.set(0, 2.18, 0);
    group.add(apMesh);

    const light = new THREE.PointLight(neonHex, 18.0, 16.0, 1.6);
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

    return { apertureMat: apMat, light };
  }

  // =========================================================================
  // WORLD 1: 16-FLOOR SKY TOWER + UNDERGROUND STATION + ELEVATOR & STAIRS
  // =========================================================================
  _buildSkyTower() {
    const s = this.skyScene;
    const dome = this.mats.createSkyTowerDome();
    s.add(dome);
    s.environment = this.mats.bakeEnvironmentFromDome(dome);
    s.fog = new THREE.FogExp2(0xeaf2ff, 0.0018);

    const hemi = new THREE.HemisphereLight(0xd8ecff, 0x748299, 0.92);
    s.add(hemi);

    // Sun shadow frustum is kept tight and re-centred on the player's floor each frame (updateSunShadow)
    const sun = new THREE.DirectionalLight(0xfffaf2, 2.35);
    this.sunOffset = new THREE.Vector3(55, 145, 52);
    sun.position.set(55, 225, 48);
    sun.target.position.set(0, 80, -4);
    s.add(sun.target);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 20;
    sun.shadow.camera.far = 300;
    sun.shadow.camera.left = -32;
    sun.shadow.camera.right = 32;
    sun.shadow.camera.top = 32;
    sun.shadow.camera.bottom = -32;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    s.add(sun);
    this.skySun = sun;

    // Shared architectural materials
    const mWhiteTile   = this.mats.getPBR('st_white_tile', 'marble_tile', { color: PALETTE.pureWhite, roughness: 0.82, envMapIntensity: 1.45 });
    const mCobaltTile  = this.mats.getPBR('st_cobalt_tile', 'marble_tile', { color: 0x3472eb, roughness: 0.78, envMapIntensity: 1.5 });
    const mMagentaTile = this.mats.getPBR('st_magenta_tile', 'marble_tile', { color: 0xff2e6c, roughness: 0.25, envMapIntensity: 1.85 });
    const mWhitePanel  = this.mats.getPBR('st_white_panel', 'arch_panel', { color: PALETTE.pureWhite, hasMetallic: true, roughness: 0.90 });
    const mConcrete    = this.mats.getPBR('st_concrete', 'brutalist_concrete', { color: 0x7b8494, roughness: 0.95, normalScale: 1.3 });
    const mDarkConcrete = this.mats.getPBR('st_dark_concrete', 'brutalist_concrete', { color: 0x3b424f, roughness: 0.96, normalScale: 1.35 });
    const mSandStone   = this.mats.getPBR('st_sandstone', 'brutalist_concrete', { color: 0xd8cdb8, roughness: 0.92, normalScale: 1.25 });
    const mCrimsonPan  = this.mats.getPBR('st_crimson_panel', 'arch_panel', { color: PALETTE.signalCrimson, hasMetallic: true, roughness: 0.85 });
    const mOrangePan   = this.mats.getPBR('st_orange_panel', 'arch_panel', { color: PALETTE.safetyOrange, hasMetallic: true, roughness: 0.85 });
    const mAmberPan    = this.mats.getPBR('st_amber_panel', 'arch_panel', { color: PALETTE.solarAmber, hasMetallic: true, roughness: 0.88 });
    const mEmeraldPan  = this.mats.getPBR('st_emerald_panel', 'arch_panel', { color: 0x628b78, hasMetallic: true, roughness: 0.88 });
    const mRunner      = this.mats.getPBR('st_runner', 'runner_tread', { color: 0xffffff, roughness: 0.95 });
    const mDarkTi      = this.mats.getPBR('st_dark_ti', 'dark_titanium', { color: 0xd8e0ee, hasMetallic: true, roughness: 0.85 });
    const mObsidianTi  = this.mats.getPBR('st_obs_ti', 'dark_titanium', { color: 0x262d3d, hasMetallic: true, roughness: 0.72 });
    const mGlass       = this.mats.getGlass('st_glass', 0x9cd6ff, 0.22);
    const mAmberGlass  = this.mats.getGlass('st_amber_glass', 0xffb838, 0.32);

    const mCyanStrip    = this.mats.getEmissive('st_cyan_strip', 0xbff4ff, 2.7);
    const mWhiteStrip   = this.mats.getEmissive('st_white_strip', 0xffffff, 2.8);
    const mOrangeStrip  = this.mats.getEmissive('st_orange_strip', PALETTE.safetyOrange, 2.8);
    const mCrimsonStrip = this.mats.getEmissive('st_crimson_strip', PALETTE.signalCrimson, 3.0);
    const mAmberStrip   = this.mats.getEmissive('st_amber_strip', PALETTE.solarAmber, 2.8);
    const mMagentaStrip = this.mats.getEmissive('st_magenta_strip', PALETTE.holoCoral, 3.0);
    const mEmeraldStrip = this.mats.getEmissive('st_emerald_strip', PALETTE.bioEmerald, 2.8);
    const holoGateMat   = this.mats.getHoloConstruct('holo_gate', PALETTE.signalCrimson);

    const palette = {
      mWhiteTile, mCobaltTile, mMagentaTile, mWhitePanel,
      mConcrete, mDarkConcrete, mSandStone,
      mCrimsonPan, mOrangePan, mAmberPan, mEmeraldPan,
      mRunner, mDarkTi, mObsidianTi, mGlass, mAmberGlass,
      mCyanStrip, mWhiteStrip, mOrangeStrip, mCrimsonStrip, mAmberStrip, mMagentaStrip, mEmeraldStrip,
      holoGateMat
    };

    // Build all 16 floors + connecting stairwells + elevator shaft
    for (let fIdx = 0; fIdx < TOTAL_FLOORS; fIdx++) {
      this._buildSingleFloor(s, fIdx, SKYTOWER_FLOORS[fIdx], palette);
      if (fIdx < TOTAL_FLOORS - 1) {
        this._buildFloorStairwell(s, fIdx, palette);
      }
    }

    // Build the Continuous Vertical Central Elevator Shaft & Interactive Glass Cab
    this._buildElevatorSystem(s, palette);

    // Portals in Sky Tower (placed on key floors 1, 4, 8, 12, 16)
    for (const p of this.portals) {
      const res = this._addPortalArch(s, this.skyColliders, p.skyPos, p.skyYaw, p.color);
      p.skyApertureMat = res.apertureMat;
      p.skyLight = res.light;
    }

    // Surrounding Mega City Skyline + Twin-Ring Spire + Patrol VTOLs
    this._addBox(s, null, [64, 95, -235], [18, 420, 18], mWhitePanel, { collide: false, rot: [0, 0.26, 0], tileMeters: 16 });
    this._addBox(s, null, [82, 82, -242], [13, 390, 15], mWhitePanel, { collide: false, rot: [0, 0.26, 0], tileMeters: 16 });
    const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(22, 1.8, 12, 36), mWhitePanel);
    ringMesh.position.set(73, 195, -238);
    s.add(ringMesh);

    const towers = [
      [-68, -18, 24, 285, 24, false], [-98, -55, 30, 325, 26, true],
      [-75, -108, 25, 298, 26, false], [-118, -148, 36, 355, 32, false],
      [-54, -180, 28, 315, 26, true], [-14, -205, 32, 290, 28, false],
      [ 96, -172, 30, 335, 28, false], [ 82, -112, 26, 308, 24, true],
      [ 72, -48, 24, 292, 24, false], [112, -82, 34, 348, 30, false],
      [ 66,   8, 26, 278, 24, false], [-70,  28, 26, 272, 24, false],
      [-128, -24, 36, 342, 32, false], [128, -16, 36, 338, 30, true]
    ];
    const beaconMat = this.mats.getEmissive('city_beacon', PALETTE.signalCrimson, 2.8);
    for (const [cx, cz, sx, sy, sz, accent] of towers) {
      const by = -95 + sy * 0.5;
      this._addBox(s, null, [cx, by, cz], [sx, sy, sz], mWhitePanel, { collide: false, tileMeters: 14 });
      if (accent) {
        this._addBox(s, null, [cx, by + sy * 0.32, cz], [sx + 0.8, 5, sz + 0.8], mCobaltTile, { collide: false });
        this._addBox(s, null, [cx, by + sy * 0.5 + 12, cz], [1.2, 24, 1.2], beaconMat, { collide: false });
      }
    }

    for (let i = 0; i < 2; i++) {
      const v = new THREE.Group();
      const part = (lp, sz, mat, rx = 0) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(sz[0], sz[1], sz[2]), mat);
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
      floorMat = P.mDarkConcrete; wallMat = P.mDarkConcrete; ceilMat = P.mDarkConcrete; stripMat = P.mWhiteStrip;
    } else if (info.theme === 'rail_depot' || info.theme === 'vault_train_hub') {
      floorMat = P.mSandStone; wallMat = P.mSandStone; ceilMat = P.mSandStone; stripMat = P.mAmberStrip;
    } else if (info.theme === 'cobalt_metro' || info.theme === 'cobalt_atrium') {
      floorMat = P.mCobaltTile; stripMat = P.mCyanStrip;
    } else if (info.theme === 'magenta_gallery') {
      floorMat = P.mMagentaTile; stripMat = P.mMagentaStrip;
    } else if (info.theme === 'crimson_corridor') {
      stripMat = P.mCrimsonStrip;
    } else if (info.theme === 'split_hallway') {
      wallMat = P.mEmeraldPan; stripMat = P.mEmeraldStrip;
    } else if (info.theme === 'amber_canopy' || info.theme === 'mezzanine_terminal') {
      stripMat = P.mAmberStrip;
    } else if (info.theme === 'shuttle_cabin' || info.theme === 'curved_concourse' || info.theme === 'skybridge_corridor') {
      stripMat = P.mOrangeStrip;
    }

    // Main Floor Slab (x: -18..+18, z: -18..+16)
    this._addBox(s, null, [0, y0 - 0.25, -1.0], [36.0, 0.5, 34.0], floorMat, { collide: false });
    this._addSlab(-18.0, 18.0, -18.0, 16.0, y0);

    // Central Tactical Runner Tread
    this._addBox(s, null, [0, y0 + 0.015, -1.0], [4.2, 0.03, 30.0], P.mRunner, { collide: false, tileMeters: 2.5 });

    // Ceiling Slab on top floor (or underside of next floor)
    if (fIdx === TOTAL_FLOORS - 1) {
      this._addBox(s, null, [0, y0 + FLOOR_HEIGHT - 0.25, -1.0], [38.0, 0.5, 35.0], P.mAmberPan, { collide: false });
    }

    // Ceiling Linear Luminaire Strips
    this._addBox(s, null, [-7.2, y0 + FLOOR_HEIGHT - 0.56, -1.0], [0.38, 0.10, 28.0], stripMat, { collide: false });
    this._addBox(s, null, [ 7.2, y0 + FLOOR_HEIGHT - 0.56, -1.0], [0.38, 0.10, 28.0], stripMat, { collide: false });

    // South Wall (z = +16.0)
    if (isUnderground || info.theme === 'modular_corridor' || info.theme === 'crimson_corridor') {
      this._addBox(s, this.skyColliders, [0, y0 + 5.75, 16.0], [36.4, 11.5, 0.5], wallMat);
    } else {
      this._addBox(s, this.skyColliders, [0, y0 + 5.75, 16.0], [36.4, 11.5, 0.18], P.mGlass);
      this._addBox(s, this.skyColliders, [-12.0, y0 + 5.75, 15.8], [0.8, 11.5, 0.8], P.mWhitePanel);
      this._addBox(s, this.skyColliders, [ 12.0, y0 + 5.75, 15.8], [0.8, 11.5, 0.8], P.mWhitePanel);
    }

    // North Wall (z = -18.0) with central opening (x: -2.4..+2.4) for Elevator Cab & Lobby
    this._addBox(s, this.skyColliders, [-10.2, y0 + 5.75, -18.0], [15.6, 11.5, 0.6], P.mDarkTi);
    this._addBox(s, this.skyColliders, [ 10.2, y0 + 5.75, -18.0], [15.6, 11.5, 0.6], P.mDarkTi);
    this._addBox(s, this.skyColliders, [  0.0, y0 + 8.15, -18.0], [ 4.8,  6.7, 0.65], P.mOrangePan);
    // Level number header bar above elevator door
    this._addBox(s, null, [0.0, y0 + 4.45, -17.64], [3.6, 0.35, 0.12], stripMat, { collide: false });

    // Holographic Laser Gate across Elevator doorway when next floor is locked
    if (fIdx < TOTAL_FLOORS - 1) {
      this.elevGateMeshes[fIdx] = this._addBox(
        s, null, [0, y0 + 2.15, -17.75], [3.8, 4.2, 0.10], P.holoGateMat, { collide: false }
      );
    }

    // West Wall (x = -18.0) — solid in underground, glass curtain wall in upper tower
    if (isUnderground) {
      this._addBox(s, this.skyColliders, [-18.0, y0 + 5.75, -1.0], [0.6, 11.5, 34.0], wallMat);
    } else {
      this._addBox(s, this.skyColliders, [-18.0, y0 + 5.75, -1.0], [0.18, 11.5, 34.0], P.mGlass);
      for (const zc of [-12, 0, 12]) {
        this._addBox(s, this.skyColliders, [-17.65, y0 + 5.75, zc], [0.65, 11.5, 0.65], P.mWhitePanel);
      }
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
        // West rail trench barrier & sleek aerodynamic bullet train nose/car
        this._addBox(s, this.skyColliders, [-14.2, y0 + 0.35, -1.0], [0.4, 0.7, 30.0], P.mConcrete);
        this._addBox(s, this.skyColliders, [-16.2, y0 + 1.65, -2.0], [2.8, 2.8, 24.0], P.mWhitePanel);
        this._addBox(s, null, [-16.2, y0 + 2.15,  9.5], [2.4, 1.3, 3.2], P.mObsidianTi, { collide: false, rot: [0.38, 0, 0] });
        this._addBox(s, null, [-15.0, y0 + 0.85, 11.0], [0.35, 0.22, 0.4], P.mCyanStrip, { collide: false });
        this._addBox(s, null, [-17.4, y0 + 0.85, 11.0], [0.35, 0.22, 0.4], P.mCyanStrip, { collide: false });

        // Sweeping brutalist ceiling ribs with embedded white LED strips
        for (let zr = -13; zr <= 11; zr += 6) {
          this._addBox(s, null, [-2.0, y0 + 8.6, zr], [28.0, 1.4, 1.2], P.mDarkConcrete, { collide: false, rot: [0, 0, 0.08] });
          this._addBox(s, null, [-2.0, y0 + 7.82, zr], [26.0, 0.12, 0.18], P.mWhiteStrip, { collide: false, rot: [0, 0, 0.08] });
        }
        // Platform cover kiosks
        this._addBox(s, this.skyColliders, [-5.5, y0 + 0.85,  2.0], [3.2, 1.7, 1.6], P.mConcrete);
        this._addBox(s, this.skyColliders, [ 5.5, y0 + 0.85, -5.0], [3.2, 1.7, 1.6], P.mConcrete);
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
        this._addBox(s, this.skyColliders, [-6.0, y0 + 0.9,  3.5], [2.4, 1.8, 5.2], P.mSandStone);
        this._addBox(s, this.skyColliders, [ 6.0, y0 + 0.9, -6.5], [2.4, 1.8, 5.2], P.mSandStone);
        break;
      }

      case 'cobalt_metro': {
        // 04: lighting-cobalt-metro-platform-05.jpg — Deep cobalt columns, glowing cyan lightboxes, sleek bench islands
        for (const [px, pz] of [[-7.5, -8], [7.5, -8], [-7.5, 6], [7.5, 6]]) {
          this._addBox(s, this.skyColliders, [px, y0 + 5.5, pz], [1.6, 11.0, 1.6], P.mCobaltTile);
          this._addBox(s, null, [px, y0 + 2.4, pz + (px < 0 ? 0.85 : -0.85)], [1.1, 1.8, 0.12], P.mCyanStrip, { collide: false });
        }
        this._addBox(s, this.skyColliders, [0, y0 + 0.65,  2.5], [4.6, 1.3, 1.8], P.mCobaltTile);
        this._addBox(s, this.skyColliders, [0, y0 + 0.65, -7.5], [4.6, 1.3, 1.8], P.mCobaltTile);
        break;
      }

      case 'shuttle_cabin': {
        // 05: seating-shuttle-cabin-10.jpg — Modular orange transit seating rows & titanium grab stanchions
        for (const [bx, bz] of [[-6.5, 6], [6.5, 6], [-6.5, -1], [6.5, -1], [-6.5, -8], [6.5, -8]]) {
          this._addBox(s, this.skyColliders, [bx, y0 + 0.65, bz], [3.6, 1.3, 1.5], P.mOrangePan);
          this._addBox(s, null, [bx, y0 + 1.45, bz - 0.55], [3.4, 0.65, 0.35], P.mWhitePanel, { collide: false });
          this._addBox(s, null, [bx + (bx < 0 ? 1.6 : -1.6), y0 + 5.5, bz], [0.14, 11.0, 0.14], P.mDarkTi, { collide: false });
        }
        break;
      }

      case 'mezzanine_terminal': {
        // 06: scale-mezzanine-terminal-09.jpg — Grand terminal hall with walkable raised west mezzanine & ramp
        this._addBox(s, this.skyColliders, [-12.5, y0 + 2.65, -2.0], [7.0, 0.35, 18.0], P.mWhiteTile);
        this._addSlab(-16.0, -9.0, -11.0, 7.0, y0 + 2.8);
        this._addBox(s, null, [-9.1, y0 + 3.45, -2.0], [0.12, 0.9, 17.8], P.mAmberPan, { collide: false });

        const rLen = Math.hypot(6.0, 2.8);
        const rPitch = Math.atan2(2.8, 6.0);
        this._addBox(s, null, [-12.5, y0 + 1.4, 10.0], [3.8, 0.28, rLen], P.mWhiteTile, { collide: false, rot: [rPitch, 0, 0] });
        this._addRamp(-14.4, -10.6, 13.0, 7.0, y0, y0 + 2.8);

        this._addBox(s, this.skyColliders, [4.5, y0 + 0.85,  4.0], [3.4, 1.7, 2.0], P.mWhitePanel);
        this._addBox(s, this.skyColliders, [4.5, y0 + 0.85, -6.5], [3.4, 1.7, 2.0], P.mWhitePanel);
        break;
      }

      case 'modular_corridor': {
        // 07: symmetry-modular-corridor-12.jpg — Iconic octagonal white sci-fi ribs with chamfered base skirts
        for (let zr = -13; zr <= 11; zr += 6) {
          this._addBox(s, this.skyColliders, [-11.5, y0 + 5.5, zr], [1.4, 11.0, 1.2], P.mWhitePanel);
          this._addBox(s, this.skyColliders, [ 11.5, y0 + 5.5, zr], [1.4, 11.0, 1.2], P.mWhitePanel);
          this._addBox(s, null, [-9.8, y0 + 0.8, zr], [2.4, 1.6, 4.8], P.mWhitePanel, { collide: false, rot: [0, 0, -0.45] });
          this._addBox(s, null, [ 9.8, y0 + 0.8, zr], [2.4, 1.6, 4.8], P.mWhitePanel, { collide: false, rot: [0, 0,  0.45] });
          this._addBox(s, null, [ 0.0, y0 + 9.2, zr], [18.0, 0.55, 1.4], P.mDarkTi, { collide: false });
        }
        this._addBox(s, this.skyColliders, [-3.8, y0 + 0.8,  2.5], [2.4, 1.6, 2.0], P.mWhitePanel);
        this._addBox(s, this.skyColliders, [ 3.8, y0 + 0.8, -6.5], [2.4, 1.6, 2.0], P.mWhitePanel);
        break;
      }

      case 'split_hallway': {
        // 08: verticality-split-level-hallway-14.jpg — Brutalist sage-green split-level hallway with dramatic angled light shafts
        this._addBox(s, this.skyColliders, [ 5.5, y0 + 2.65, -2.0], [7.5, 0.35, 16.0], P.mEmeraldPan);
        this._addSlab(1.75, 9.25, -10.0, 6.0, y0 + 2.8);
        const rLen = Math.hypot(6.0, 2.8);
        const rPitch = Math.atan2(2.8, 6.0);
        this._addBox(s, null, [5.5, y0 + 1.4, 9.0], [3.6, 0.28, rLen], P.mEmeraldPan, { collide: false, rot: [rPitch, 0, 0] });
        this._addRamp(3.7, 7.3, 12.0, 6.0, y0, y0 + 2.8);

        for (let zb = -10; zb <= 6; zb += 8) {
          this._addBox(s, null, [-6.5, y0 + 6.5, zb], [1.2, 9.5, 1.8], P.mEmeraldPan, { collide: false, rot: [0, 0, 0.36] });
        }
        this._addBox(s, this.skyColliders, [-6.5, y0 + 0.85, -3.0], [3.0, 1.7, 2.8], P.mEmeraldPan);
        break;
      }

      case 'crimson_corridor': {
        // 09: colorblock-crimson-corridor-02.jpg — Bold two-tone Signal Crimson lower walls + pure white upper walls
        this._addBox(s, null, [-17.5, y0 + 1.6, -1.0], [0.4, 3.2, 32.0], P.mCrimsonPan, { collide: false });
        this._addBox(s, null, [ 17.5, y0 + 1.6, -1.0], [0.4, 3.2, 32.0], P.mCrimsonPan, { collide: false });
        this._addBox(s, null, [0, y0 + 0.02, -1.0], [3.6, 0.03, 30.0], P.mCrimsonPan, { collide: false });
        this._addBox(s, this.skyColliders, [-5.2, y0 + 0.9,  3.5], [2.8, 1.8, 2.2], P.mCrimsonPan);
        this._addBox(s, this.skyColliders, [ 5.2, y0 + 0.9, -2.5], [2.8, 1.8, 2.2], P.mCrimsonPan);
        this._addBox(s, this.skyColliders, [ 0.0, y0 + 0.9, -9.0], [4.4, 1.8, 1.8], P.mWhitePanel);
        break;
      }

      case 'curved_concourse': {
        // 10: kinetic-curved-concourse-03.jpg — Sweeping orange kinetic ribbon fins & streamlined concourse islands
        for (let i = 0; i < 5; i++) {
          const zf = 10 - i * 5.5;
          const xOff = Math.sin(i * 0.9) * 2.5;
          this._addBox(s, null, [xOff, y0 + 7.8, zf], [22.0, 0.45, 0.9], P.mOrangePan, { collide: false, rot: [0, 0.14 * Math.cos(i), 0] });
        }
        this._addBox(s, this.skyColliders, [-6.0, y0 + 0.85,  2.0], [2.6, 1.7, 3.6], P.mOrangePan);
        this._addBox(s, this.skyColliders, [ 6.0, y0 + 0.85, -6.0], [2.6, 1.7, 3.6], P.mOrangePan);
        break;
      }

      case 'cobalt_atrium': {
        // 11: material-cobalt-atrium-office-04.jpg — Polished cobalt floor, sculpted diagonal orange wall fin, executive desks
        this._addBox(s, null, [5.5, y0 + 3.2, 15.4], [8.5, 4.5, 0.28], P.mOrangePan, { collide: false, rot: [0, 0, 0.22] });
        for (const [dx, dz] of [[-6.0, 4.0], [6.0, 2.0], [-6.0, -7.0], [6.0, -9.0]]) {
          this._addBox(s, this.skyColliders, [dx, y0 + 0.7, dz], [3.4, 1.4, 1.6], P.mWhitePanel);
          this._addBox(s, null, [dx, y0 + 1.44, dz], [3.5, 0.08, 1.7], P.mOrangePan, { collide: false });
        }
        break;
      }

      case 'skybridge_corridor': {
        // 12: palette-skybridge-corridor-01.jpg — High-altitude glass skybridge with bright orange portal frames
        for (let zf = -10; zf <= 8; zf += 9) {
          this._addBox(s, this.skyColliders, [-10.5, y0 + 4.5, zf], [0.9, 9.0, 0.9], P.mOrangePan);
          this._addBox(s, this.skyColliders, [ 10.5, y0 + 4.5, zf], [0.9, 9.0, 0.9], P.mOrangePan);
          this._addBox(s, null, [0, y0 + 8.8, zf], [21.9, 0.7, 0.9], P.mOrangePan, { collide: false });
        }
        this._addBox(s, this.skyColliders, [0, y0 + 0.8, -1.5], [3.4, 1.6, 3.4], P.mWhitePanel);
        break;
      }

      case 'observation_tunnel': {
        // 13: geometry-observation-tunnel-11.jpg — Geometric triangular/hexagonal observation ribs framing the skyline
        for (let zt = -11; zt <= 9; zt += 5) {
          this._addBox(s, null, [-11.0, y0 + 6.5, zt], [0.6, 10.0, 0.8], P.mWhitePanel, { collide: false, rot: [0, 0, -0.35] });
          this._addBox(s, null, [ 11.0, y0 + 6.5, zt], [0.6, 10.0, 0.8], P.mWhitePanel, { collide: false, rot: [0, 0,  0.35] });
        }
        this._addBox(s, this.skyColliders, [-5.8, y0 + 0.85,  3.0], [2.8, 1.7, 2.0], P.mDarkTi);
        this._addBox(s, this.skyColliders, [ 5.8, y0 + 0.85, -7.0], [2.8, 1.7, 2.0], P.mDarkTi);
        break;
      }

      case 'magenta_gallery': {
        // 14: reflection-magenta-gallery-hall-08.jpg — Glossy magenta reflection floor, white gallery wall & glowing art monoliths
        this._addBox(s, this.skyColliders, [-11.5, y0 + 3.2, -1.0], [0.6, 6.4, 22.0], P.mWhitePanel);
        for (const zg of [-8, -1, 6]) {
          this._addBox(s, null, [-11.1, y0 + 3.4, zg], [0.14, 3.6, 2.6], P.mMagentaStrip, { collide: false });
        }
        this._addBox(s, this.skyColliders, [-4.5, y0 + 0.9,  3.5], [1.6, 1.8, 1.6], P.mWhitePanel);
        this._addBox(s, this.skyColliders, [ 5.5, y0 + 0.9, -4.5], [1.6, 1.8, 1.6], P.mWhitePanel);
        break;
      }

      case 'amber_canopy': {
        // 15: sunlight-amber-canopy-lounge-06.jpg — Warm golden-amber glass canopy louvers & sunlit lounge pavilions
        for (let zl = -12; zl <= 10; zl += 4.5) {
          this._addBox(s, null, [0, y0 + 9.4, zl], [28.0, 0.25, 2.2], P.mAmberGlass, { collide: false, rot: [0.22, 0, 0] });
        }
        this._addBox(s, this.skyColliders, [-6.5, y0 + 0.8,  2.5], [3.6, 1.6, 2.2], P.mAmberPan);
        this._addBox(s, this.skyColliders, [ 6.5, y0 + 0.8, -6.5], [3.6, 1.6, 2.2], P.mAmberPan);
        break;
      }

      case 'panoramic_sky_lounge': {
        // 16: vista-panoramic-sky-lounge-07.jpg — Apex Boss Arena with sunken circular rug, structural white columns & 360° skyline vista
        const rugMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(7.2, 7.2, 0.04, 36),
          this.mats.getPBR('st_rug_top', 'void_sand', { color: 0x162038, roughness: 1.0 })
        );
        rugMesh.position.set(0, y0 + 0.02, -1.0);
        s.add(rugMesh);

        for (const [px, pz] of [[-9.5, -9], [9.5, -9], [-9.5, 7], [9.5, 7]]) {
          this._addBox(s, this.skyColliders, [px, y0 + 5.75, pz], [1.6, 11.5, 1.6], P.mWhitePanel);
          this._addBox(s, null, [px, y0 + 1.25, pz], [1.76, 0.35, 1.76], P.mOrangePan, { collide: false });
        }
        this._addBox(s, this.skyColliders, [-7.5, y0 + 0.75, -1.0], [2.0, 1.5, 4.4], P.mDarkTi);
        this._addBox(s, this.skyColliders, [ 7.5, y0 + 0.75, -1.0], [2.0, 1.5, 4.4], P.mDarkTi);
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

    this.elevatorLight = new THREE.PointLight(PALETTE.holoCyan, 14.0, 10.0, 1.5);
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
    v.environment = this.mats.bakeEnvironmentFromDome(dome);
    v.fog = new THREE.FogExp2(0x8297a1, 0.0040);

    const hemi = new THREE.HemisphereLight(0x86a3b0, 0x161d24, 0.8);
    v.add(hemi);

    const moon = new THREE.DirectionalLight(0xaac2ee, 1.25);
    moon.position.set(-38, 54, -45);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.left = -35;
    moon.shadow.camera.right = 35;
    moon.shadow.camera.top = 45;
    moon.shadow.camera.bottom = -45;
    v.add(moon);

    const mCauseway = this.mats.getPBR('vp_causeway', 'void_causeway', { hasMetallic: true, roughness: 1.0, normalScale: 1.35, envMapIntensity: 1.7 });
    const mSand     = this.mats.getPBR('vp_sand', 'void_sand', { roughness: 1.0, normalScale: 1.4 });
    const mConcrete = this.mats.getPBR('vp_concrete', 'brutalist_concrete', { roughness: 1.0, normalScale: 1.3 });
    const mDarkTi   = this.mats.getPBR('vp_dark_ti', 'dark_titanium', { hasMetallic: true, roughness: 0.9, normalScale: 1.3, envMapIntensity: 1.4 });
    const mAmberGl  = this.mats.getGlass('vp_amber_glass', 0xff9a1e, 0.44);

    // Animated Reflective Void Ocean
    const oceanGeom = new THREE.PlaneGeometry(920, 920, 96, 96);
    oceanGeom.rotateX(-Math.PI * 0.5);
    const oceanMesh = new THREE.Mesh(oceanGeom, this.mats.createVoidOceanMaterial());
    oceanMesh.position.set(0, -0.68, -30);
    v.add(oceanMesh);

    // Wet Obsidian Flagstone Causeway & Dark Volcanic Shore
    this._addBox(v, null, [0, -0.35, -10], [48, 0.70, 64], mCauseway, { collide: false, tileMeters: 4.0 });
    this._addBox(v, null, [0, -0.54, -10], [66, 0.36, 82], mSand, { collide: false, tileMeters: 5.0 });

    // Brutalist Concrete Perimeter Parapets
    this._addBox(v, this.voidColliders, [-24.2, 0.55, -10], [0.65, 1.1, 64.4], mConcrete);
    this._addBox(v, this.voidColliders, [ 24.2, 0.55, -10], [0.65, 1.1, 64.4], mConcrete);
    this._addBox(v, this.voidColliders, [  0.0, 0.55,  22.2], [49.0, 1.1, 0.65], mConcrete);
    this._addBox(v, this.voidColliders, [  0.0, 0.55, -42.2], [49.0, 1.1, 0.65], mConcrete);

    // Glowing Neon Causeway Guide Strips
    this._addBox(v, null, [ 0.0, 0.015, -20.5], [0.22, 0.03, 18.0], this.mats.getEmissive('vp_g1', PALETTE.signalCrimson, 3.0), { collide: false });
    this._addBox(v, null, [-6.5, 0.015, -19.0], [0.18, 0.03, 18.5], this.mats.getEmissive('vp_g2', PALETTE.safetyOrange, 2.8), { collide: false, rot: [0, 0.48, 0] });
    this._addBox(v, null, [ 6.5, 0.015, -19.0], [0.18, 0.03, 18.5], this.mats.getEmissive('vp_g3', PALETTE.holoCyan, 2.8), { collide: false, rot: [0, -0.48, 0] });

    // Central Emerald Bio-Regeneration Sanctuary Well
    const emeraldMat = this.mats.getEmissive('vp_emerald', PALETTE.bioEmerald, 3.2);
    const wellBase = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 0.18, 40), mDarkTi);
    wellBase.position.set(0, 0.09, -8);
    v.add(wellBase);
    const wellPad = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 0.04, 40), emeraldMat);
    wellPad.position.set(0, 0.19, -8);
    v.add(wellPad);

    this.bioCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.35, 0), emeraldMat);
    this.bioCrystal.scale.set(0.65, 1.35, 0.65);
    this.bioCrystal.position.set(0, 2.8, -8);
    v.add(this.bioCrystal);

    const wellLight = new THREE.PointLight(PALETTE.bioEmerald, 24.0, 20.0, 1.5);
    wellLight.position.set(0, 2.6, -8);
    v.add(wellLight);

    // Munition Reliquary Shrines
    const orangeGlow = this.mats.getEmissive('vp_shrine_o', PALETTE.safetyOrange, 2.8);
    for (const sp of this.ammoShrines) {
      this._addBox(v, this.voidColliders, [sp.x, 0.65, sp.z], [1.4, 1.3, 1.4], mDarkTi);
      this._addBox(v, null, [sp.x, 1.35, sp.z], [0.95, 0.12, 0.95], orangeGlow, { collide: false });
    }

    // Vaulted Brutalist Concrete Arches & Refractive Amber Glass Slabs
    for (let za = 12; za >= -20.1; za -= 8) {
      this._addBox(v, this.voidColliders, [-19.5, 4.5, za], [1.6, 9.0, 1.8], mConcrete);
      this._addBox(v, this.voidColliders, [ 19.5, 4.5, za], [1.6, 9.0, 1.8], mConcrete);
      this._addBox(v, null, [-17.0, 8.8, za], [6.5, 1.2, 1.6], mConcrete, { collide: false, rot: [0, 0, -0.22] });
      this._addBox(v, null, [ 17.0, 8.8, za], [6.5, 1.2, 1.6], mConcrete, { collide: false, rot: [0, 0,  0.22] });
    }
    for (let i = 0; i < 5; i++) {
      const zs = 8.0 - i * 4.5;
      this._addBox(v, null, [-22.0, 2.4, zs], [0.18, 4.6, 2.2], mAmberGl, { collide: false, rot: [0, 0.26, 0] });
      this._addBox(v, null, [ 22.0, 2.4, zs], [0.18, 4.6, 2.2], mAmberGl, { collide: false, rot: [0, -0.26, 0] });
    }

    // Portals on Void Planet
    for (const p of this.portals) {
      const res = this._addPortalArch(v, this.voidColliders, p.voidPos, p.voidYaw, p.color);
      p.voidApertureMat = res.apertureMat;
      p.voidLight = res.light;
    }

    // --- COLOSSAL HORIZON MEGASTRUCTURES (voidplanet/) ---
    const wedgeMesh = new THREE.Mesh(this._buildCrimsonWedgeGeometry(), this.mats.createCrimsonWedgeMaterial());
    wedgeMesh.position.set(76, -1.2, -104);
    wedgeMesh.rotation.y = -0.45;
    v.add(wedgeMesh);

    const octGeom = new THREE.OctahedronGeometry(22, 0);
    octGeom.scale(0.86, 1.32, 0.86);
    this.floatingOctahedron = new THREE.Mesh(octGeom, mDarkTi);
    this.floatingOctahedron.position.set(-70, 28, -100);
    v.add(this.floatingOctahedron);

    const pyr1 = new THREE.Mesh(new THREE.ConeGeometry(46, 64, 4), mDarkTi);
    pyr1.position.set(-22, 31, -162);
    pyr1.rotation.y = 0.98;
    v.add(pyr1);

    const pyr2 = new THREE.Mesh(new THREE.ConeGeometry(58, 82, 4), mDarkTi);
    pyr2.position.set(34, 40, -186);
    pyr2.rotation.y = 1.12;
    v.add(pyr2);

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

  _buildCrimsonWedgeGeometry() {
    const center = new THREE.Vector3(0, 34, 0);
    const b0 = [-6, 0, 16],  b1 = [6, 0, 16],  b2 = [6, 0, -16],  b3 = [-6, 0, -16];
    const m0 = [-11, 15, 24], m1 = [11, 15, 24], m2 = [10, 19, -22], m3 = [-10, 19, -22];
    const t0 = [-5, 54, 20],  t1 = [5, 54, 20],  t2 = [4, 88, -26],  t3 = [-4, 88, -26];

    const pos = [];
    const uvs = [];
    const pushTriOutward = (a, b, c, uvA, uvB, uvC) => {
      const va = new THREE.Vector3(...a);
      const vb = new THREE.Vector3(...b);
      const vc = new THREE.Vector3(...c);
      const mid = new THREE.Vector3().addVectors(va, vb).add(vc).multiplyScalar(1 / 3);
      const outward = mid.sub(center);
      const e1 = new THREE.Vector3().subVectors(vb, va);
      const e2 = new THREE.Vector3().subVectors(vc, va);
      const n = new THREE.Vector3().crossVectors(e1, e2);
      if (n.dot(outward) < 0) {
        pos.push(...a, ...c, ...b);
        uvs.push(...uvA, ...uvC, ...uvB);
      } else {
        pos.push(...a, ...b, ...c);
        uvs.push(...uvA, ...uvB, ...uvC);
      }
    };
    const pushQuad = (p0, p1, p2, p3) => {
      pushTriOutward(p0, p1, p2, [0, 0], [3, 0], [3, 4]);
      pushTriOutward(p0, p2, p3, [0, 0], [3, 4], [0, 4]);
    };

    pushQuad(b0, b1, m1, m0); pushQuad(b1, b2, m2, m1); pushQuad(b2, b3, m3, m2); pushQuad(b3, b0, m0, m3);
    pushQuad(m0, m1, t1, t0); pushQuad(m1, m2, t2, t1); pushQuad(m2, m3, t3, t2); pushQuad(m3, m0, t0, t3);
    pushQuad(t3, t0, t1, t2);

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.computeVertexNormals();
    return geom;
  }
}

