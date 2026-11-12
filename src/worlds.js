import * as THREE from 'three';
import { PALETTE } from './materials.js';

export const GATE_1_Z = -24.0;
export const GATE_2_Z = -72.0;

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
    this.gate1Mesh = null;
    this.gate2Mesh = null;

    this.bioWellPos = new THREE.Vector3(0, 0, -8);
    this.ammoShrines = [
      new THREE.Vector3(-9.5, 0, -8.0),
      new THREE.Vector3( 9.5, 0, -8.0)
    ];

    this.portals = [
      {
        index: 0,
        label: 'P-01 // ATRIUM',
        skyPos: new THREE.Vector3(-10.5, 0, 14.0),
        skyYaw: 0.45,
        skySpawn: new THREE.Vector3(-8.2, 0, 11.4),
        voidPos: new THREE.Vector3(-13.0, 0, -30.0),
        voidYaw: 0.32,
        voidSpawn: new THREE.Vector3(-11.4, 0, -26.4),
        color: PALETTE.safetyOrange,
        cssColor: '#ff6616',
        skyApertureMat: null,
        voidApertureMat: null,
        skyLight: null,
        voidLight: null
      },
      {
        index: 1,
        label: 'P-02 // CONCOURSE',
        skyPos: new THREE.Vector3(12.5, 0, -29.5),
        skyYaw: -0.55,
        skySpawn: new THREE.Vector3(9.8, 0, -31.8),
        voidPos: new THREE.Vector3(0.0, 0, -33.5),
        voidYaw: 0.0,
        voidSpawn: new THREE.Vector3(0.0, 0, -29.8),
        color: PALETTE.signalCrimson,
        cssColor: '#ec1822',
        skyApertureMat: null,
        voidApertureMat: null,
        skyLight: null,
        voidLight: null
      },
      {
        index: 2,
        label: 'P-03 // APEX LOUNGE',
        skyPos: new THREE.Vector3(-16.5, 0, -78.0),
        skyYaw: 0.55,
        skySpawn: new THREE.Vector3(-13.5, 0, -80.5),
        voidPos: new THREE.Vector3(13.0, 0, -30.0),
        voidYaw: -0.32,
        voidSpawn: new THREE.Vector3(11.4, 0, -26.4),
        color: PALETTE.holoCyan,
        cssColor: '#24e0ff',
        skyApertureMat: null,
        voidApertureMat: null,
        skyLight: null,
        voidLight: null
      }
    ];

    this._buildSkyTower();
    this._buildVoidPlanet();
    this.updateUnlocks([true, false, false]);
  }

  updateUnlocks(unlocked) {
    for (const p of this.portals) {
      const open = unlocked[p.index];
      const val = open ? 1.0 : 0.0;
      if (p.skyApertureMat) p.skyApertureMat.uniforms.uUnlocked.value = val;
      if (p.voidApertureMat) p.voidApertureMat.uniforms.uUnlocked.value = val;
      if (p.skyLight) p.skyLight.intensity = open ? 18.0 : 1.5;
      if (p.voidLight) p.voidLight.intensity = open ? 26.0 : 2.0;
    }
    if (this.gate1Mesh) this.gate1Mesh.visible = !unlocked[1];
    if (this.gate2Mesh) this.gate2Mesh.visible = !unlocked[2];
  }

  _addBox(scene, colliders, pos, size, mat, opts = {}) {
    const geom = this.mats.makeWorldBoxGeometry(size[0], size[1], size[2], opts.tileMeters ?? 4.0);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    if (opts.rot) mesh.rotation.set(opts.rot[0], opts.rot[1], opts.rot[2]);
    mesh.castShadow = opts.castShadow ?? true;
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
      m.castShadow = !glow;
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

    const light = new THREE.PointLight(neonHex, 20.0, 18.0, 1.6);
    light.position.set(0, 2.3, 0);
    group.add(light);

    // Side pillar colliders so player walks cleanly through center opening
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    for (const side of [-1.68, 1.68]) {
      const wx = pos.x + side * cosY;
      const wz = pos.z - side * sinY;
      colliders.push(new THREE.Box3(
        new THREE.Vector3(wx - 0.45, 0, wz - 0.45),
        new THREE.Vector3(wx + 0.45, 4.5, wz + 0.45)
      ));
    }

    return { apertureMat: apMat, light };
  }

  // =========================================================================
  // WORLD 1: SKY TOWER VIRTUAL CONSTRUCT + MEGA CITY SKYLINE
  // =========================================================================
  _buildSkyTower() {
    const s = this.skyScene;
    const dome = this.mats.createSkyTowerDome();
    s.add(dome);
    s.environment = this.mats.bakeEnvironmentFromDome(dome);
    s.fog = new THREE.FogExp2(0xeaf2ff, 0.0026);

    const hemi = new THREE.HemisphereLight(0xd8ecff, 0x748299, 0.85);
    s.add(hemi);

    const sun = new THREE.DirectionalLight(0xfffaf2, 2.3);
    sun.position.set(42, 78, 35);
    sun.target.position.set(0, 0, -55);
    s.add(sun.target);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 220;
    sun.shadow.camera.left = -40;
    sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 95;
    sun.shadow.camera.bottom = -95;
    sun.shadow.bias = -0.0005;
    s.add(sun);

    const mWhiteTile   = this.mats.getPBR('st_white_tile', 'marble_tile', { color: PALETTE.pureWhite, roughness: 0.82, envMapIntensity: 1.45 });
    const mCobaltTile  = this.mats.getPBR('st_cobalt_tile', 'marble_tile', { color: 0x3472eb, roughness: 0.78, envMapIntensity: 1.5 });
    const mWhitePanel  = this.mats.getPBR('st_white_panel', 'arch_panel', { color: PALETTE.pureWhite, hasMetallic: true, roughness: 0.90 });
    const mCrimsonPan  = this.mats.getPBR('st_crimson_panel', 'arch_panel', { color: PALETTE.signalCrimson, hasMetallic: true, roughness: 0.85 });
    const mOrangePan   = this.mats.getPBR('st_orange_panel', 'arch_panel', { color: PALETTE.safetyOrange, hasMetallic: true, roughness: 0.85 });
    const mAmberPan    = this.mats.getPBR('st_amber_panel', 'arch_panel', { color: PALETTE.solarAmber, hasMetallic: true, roughness: 0.88 });
    const mRunner      = this.mats.getPBR('st_runner', 'runner_tread', { color: 0xffffff, roughness: 0.95 });
    const mDarkTi      = this.mats.getPBR('st_dark_ti', 'dark_titanium', { color: 0xd8e0ee, hasMetallic: true, roughness: 0.85 });
    const mGlass       = this.mats.getGlass('st_glass', 0x9cd6ff, 0.22);
    const mCyanStrip   = this.mats.getEmissive('st_cyan_strip', 0xbff4ff, 2.6);

    // --- SECTOR 01: Cobalt Atrium & Skybridge (z: +18 .. -24, x: -15 .. +15) ---
    this._addBox(s, this.skyColliders, [0, -0.25, -3], [30, 0.5, 42], mCobaltTile, { collide: false, castShadow: false });
    this._addBox(s, null, [0, 0.015, -3], [5.2, 0.03, 39.5], mRunner, { collide: false, castShadow: false, tileMeters: 2.6 });
    this._addBox(s, null, [0, 6.8, -3], [30.6, 0.6, 42.2], mWhitePanel, { collide: false });
    this._addBox(s, null, [-6.8, 6.46, -3], [0.45, 0.10, 36], mCyanStrip, { collide: false, castShadow: false });
    this._addBox(s, null, [ 6.8, 6.46, -3], [0.45, 0.10, 36], mCyanStrip, { collide: false, castShadow: false });
    this._addBox(s, null, [ 0.0, 6.47, -3], [0.95, 0.09, 38], mOrangePan, { collide: false });

    // South Back Wall + Sculpted Orange Relief Fin (material-cobalt-atrium-office-04.jpg)
    this._addBox(s, this.skyColliders, [0, 3.25, 18.25], [30.6, 6.5, 0.5], mWhitePanel);
    this._addBox(s, null, [4.5, 2.3, 17.85], [6.8, 3.5, 0.24], mOrangePan, { collide: false, rot: [0, 0, 0.19] });

    // Panoramic Glass Curtain Walls + Structural White Columns
    this._addBox(s, this.skyColliders, [-15.0, 3.25, -3], [0.16, 6.3, 41.5], mGlass, { castShadow: false });
    this._addBox(s, this.skyColliders, [ 15.0, 3.25, -3], [0.16, 6.3, 41.5], mGlass, { castShadow: false });
    for (let zc = -18; zc <= 14.1; zc += 8) {
      this._addBox(s, this.skyColliders, [-14.65, 3.25, zc], [0.65, 6.5, 0.65], mWhitePanel);
      this._addBox(s, this.skyColliders, [ 14.65, 3.25, zc], [0.65, 6.5, 0.65], mWhitePanel);
    }

    // Atrium Cover Desks
    const sec1Covers = [
      [[-5.8, 0.65,  3.5], [3.2, 1.3, 1.5]],
      [[ 5.8, 0.65,  1.5], [3.2, 1.3, 1.5]],
      [[-6.2, 0.75, -10.5], [3.4, 1.5, 1.8]],
      [[ 6.2, 0.75, -12.5], [3.4, 1.5, 1.8]],
      [[ 0.0, 0.65, -7.0], [2.8, 1.3, 2.8]]
    ];
    for (const [p, sz] of sec1Covers) {
      this._addBox(s, this.skyColliders, p, sz, mWhitePanel);
      this._addBox(s, null, [p[0], p[1] + sz[1] * 0.5 + 0.04, p[2]], [sz[0] + 0.06, 0.08, sz[2] + 0.06], mOrangePan, { collide: false });
    }

    // Bulkhead 01 -> 02 (z = -24)
    this._addBox(s, this.skyColliders, [-10.5, 3.25, GATE_1_Z], [13.0, 6.5, 0.85], mDarkTi);
    this._addBox(s, this.skyColliders, [ 10.5, 3.25, GATE_1_Z], [13.0, 6.5, 0.85], mDarkTi);
    this._addBox(s, this.skyColliders, [  0.0, 5.45, GATE_1_Z], [ 8.2, 2.1, 0.90], mOrangePan);
    const holoGateMat = this.mats.getHoloConstruct('holo_gate', PALETTE.signalCrimson);
    this.gate1Mesh = this._addBox(s, null, [0, 2.2, GATE_1_Z], [8.0, 4.4, 0.16], holoGateMat, { collide: false, castShadow: false });

    // --- SECTOR 02: Crimson Split-Level Concourse (z: -24 .. -72, x: -17 .. +17) ---
    this._addBox(s, null, [0, -0.25, -48], [34, 0.5, 48], mWhiteTile, { collide: false, castShadow: false });
    this._addBox(s, null, [0, 0.015, -48], [3.8, 0.03, 46], mCrimsonPan, { collide: false, castShadow: false });

    // Two-Tone Crimson Lower + Pure-White Upper Walls (colorblock-crimson-corridor-02.jpg)
    this._addBox(s, this.skyColliders, [-17.2, 1.4, -48], [0.5, 2.8, 48], mCrimsonPan);
    this._addBox(s, this.skyColliders, [-17.2, 5.2, -48], [0.5, 4.8, 48], mWhitePanel);
    this._addBox(s, this.skyColliders, [ 17.2, 1.4, -48], [0.5, 2.8, 48], mCrimsonPan);
    this._addBox(s, this.skyColliders, [ 17.2, 5.2, -48], [0.5, 4.8, 48], mWhitePanel);

    // Skylight Truss Ceiling
    this._addBox(s, null, [-11.5, 7.7, -48], [11.5, 0.5, 48], mWhitePanel, { collide: false });
    this._addBox(s, null, [ 11.5, 7.7, -48], [11.5, 0.5, 48], mWhitePanel, { collide: false });
    this._addBox(s, null, [  0.0, 7.75, -48], [11.0, 0.12, 46], mGlass, { collide: false, castShadow: false });
    for (let zb = -68; zb <= -27.9; zb += 6) {
      this._addBox(s, null, [0, 7.52, zb], [11.4, 0.30, 0.36], mWhitePanel, { collide: false });
    }

    // Elevated Mezzanine Catwalks (y = 2.8m) + Crimson Guardrails + Walkable Ramps
    this._addBox(s, this.skyColliders, [-13.3, 2.65, -53.5], [7.0, 0.30, 23.0], mWhiteTile);
    this._addBox(s, this.skyColliders, [ 13.3, 2.65, -53.5], [7.0, 0.30, 23.0], mWhiteTile);
    this.skyFloorSlabs.push(
      { xMin: -16.8, xMax: -9.8, zMin: -65.0, zMax: -42.0, yTop: 2.8 },
      { xMin:   9.8, xMax: 16.8, zMin: -65.0, zMax: -42.0, yTop: 2.8 }
    );
    this._addBox(s, null, [-9.9, 3.65, -53.5], [0.10, 0.10, 22.8], mCrimsonPan, { collide: false });
    this._addBox(s, null, [ 9.9, 3.65, -53.5], [0.10, 0.10, 22.8], mCrimsonPan, { collide: false });

    const rampLen = Math.hypot(9.5, 2.8);
    const rampPitch = Math.atan2(2.8, 9.5);
    this._addBox(s, null, [-13.2, 1.35, -37.25], [4.4, 0.28, rampLen], mWhiteTile, { collide: false, rot: [rampPitch, 0, 0] });
    this._addBox(s, null, [ 13.2, 1.35, -37.25], [4.4, 0.28, rampLen], mWhiteTile, { collide: false, rot: [rampPitch, 0, 0] });
    this.skyRamps.push(
      { xMin: -15.4, xMax: -11.0, zLow: -32.5, zHigh: -42.0, yLow: 0.0, yHigh: 2.8 },
      { xMin:  11.0, xMax:  15.4, zLow: -32.5, zHigh: -42.0, yLow: 0.0, yHigh: 2.8 }
    );

    // Concourse Cover Blocks
    this._addBox(s, this.skyColliders, [-4.8, 0.85, -40], [2.8, 1.7, 2.2], mWhitePanel);
    this._addBox(s, this.skyColliders, [ 4.8, 0.85, -46], [2.8, 1.7, 2.2], mWhitePanel);
    this._addBox(s, this.skyColliders, [ 0.0, 0.90, -56], [4.6, 1.8, 1.8], mCrimsonPan);
    this._addBox(s, this.skyColliders, [-5.2, 0.85, -63], [2.6, 1.7, 2.2], mWhitePanel);
    this._addBox(s, this.skyColliders, [ 5.2, 0.85, -63], [2.6, 1.7, 2.2], mWhitePanel);

    // Bulkhead 02 -> 03 (z = -72)
    this._addBox(s, this.skyColliders, [-13.0, 3.8, GATE_2_Z], [18.0, 7.6, 0.9], mDarkTi);
    this._addBox(s, this.skyColliders, [ 13.0, 3.8, GATE_2_Z], [18.0, 7.6, 0.9], mDarkTi);
    this._addBox(s, this.skyColliders, [  0.0, 6.1, GATE_2_Z], [ 8.2, 3.0, 0.95], mCrimsonPan);
    this.gate2Mesh = this._addBox(s, null, [0, 2.2, GATE_2_Z], [8.0, 4.4, 0.16], holoGateMat, { collide: false, castShadow: false });

    // --- SECTOR 03: Panoramic Apex Sky Lounge - Boss Arena (z: -72 .. -126, x: -22 .. +22) ---
    this._addBox(s, null, [0, -0.25, -99], [44, 0.5, 54], mWhiteTile, { collide: false, castShadow: false });
    this._addBox(s, null, [0, 8.3, -99], [44.6, 0.7, 54.6], mAmberPan, { collide: false });

    const rugMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(7.8, 7.8, 0.03, 40),
      this.mats.getPBR('st_rug', 'void_sand', { color: 0x162038, roughness: 1.0 })
    );
    rugMesh.position.set(0, 0.015, -99);
    rugMesh.receiveShadow = true;
    s.add(rugMesh);

    // 3-Sided Panoramic Glass Curtain Walls
    this._addBox(s, this.skyColliders, [-22.0, 4.0, -99], [0.18, 8.0, 53.5], mGlass, { castShadow: false });
    this._addBox(s, this.skyColliders, [ 22.0, 4.0, -99], [0.18, 8.0, 53.5], mGlass, { castShadow: false });
    this._addBox(s, this.skyColliders, [  0.0, 4.0, -126], [44.0, 8.0, 0.18], mGlass, { castShadow: false });

    for (const [px, pz] of [[-10.5, -88], [10.5, -88], [-10.5, -109], [10.5, -109]]) {
      this._addBox(s, this.skyColliders, [px, 4.0, pz], [1.8, 8.0, 1.8], mWhitePanel);
      this._addBox(s, null, [px, 1.25, pz], [1.92, 0.35, 1.92], mOrangePan, { collide: false });
    }
    this._addBox(s, this.skyColliders, [-8.5, 0.75, -99], [2.2, 1.5, 5.0], mDarkTi);
    this._addBox(s, this.skyColliders, [ 8.5, 0.75, -99], [2.2, 1.5, 5.0], mDarkTi);

    // Portals in Sky Tower
    for (const p of this.portals) {
      const res = this._addPortalArch(s, this.skyColliders, p.skyPos, p.skyYaw, p.color);
      p.skyApertureMat = res.apertureMat;
      p.skyLight = res.light;
    }

    // Surrounding Mega City Skyline + Twin-Ring Spire + Patrol VTOLs
    this._addBox(s, null, [54, 24, -235], [18, 350, 18], mWhitePanel, { collide: false, castShadow: false, rot: [0, 0.26, 0], tileMeters: 16 });
    this._addBox(s, null, [72, 12, -242], [13, 320, 15], mWhitePanel, { collide: false, castShadow: false, rot: [0, 0.26, 0], tileMeters: 16 });
    const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(22, 1.8, 12, 36), mWhitePanel);
    ringMesh.position.set(63, 122, -238);
    s.add(ringMesh);

    const towers = [
      [-68, -18, 24, 185, 24, false], [-98, -55, 30, 225, 26, true],
      [-75, -108, 25, 198, 26, false], [-118, -148, 36, 255, 32, false],
      [-54, -180, 28, 215, 26, true], [-14, -205, 32, 190, 28, false],
      [ 96, -172, 30, 235, 28, false], [ 82, -112, 26, 208, 24, true],
      [ 72, -48, 24, 192, 24, false], [112, -82, 34, 248, 30, false],
      [ 66,   8, 26, 178, 24, false], [-70,  28, 26, 172, 24, false],
      [-128, -24, 36, 242, 32, false], [128, -16, 36, 238, 30, true]
    ];
    const beaconMat = this.mats.getEmissive('city_beacon', PALETTE.signalCrimson, 2.8);
    for (const [cx, cz, sx, sy, sz, accent] of towers) {
      const by = -115 + sy * 0.5;
      this._addBox(s, null, [cx, by, cz], [sx, sy, sz], mWhitePanel, { collide: false, castShadow: false, tileMeters: 14 });
      if (accent) {
        this._addBox(s, null, [cx, by + sy * 0.32, cz], [sx + 0.8, 5, sz + 0.8], mCobaltTile, { collide: false, castShadow: false });
        this._addBox(s, null, [cx, by + sy * 0.5 + 12, cz], [1.2, 24, 1.2], beaconMat, { collide: false, castShadow: false });
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

  // =========================================================================
  // WORLD 2: VOID PLANET MEGASTRUCTURE SANCTUARY
  // =========================================================================
  _buildVoidPlanet() {
    const v = this.voidScene;
    const dome = this.mats.createVoidPlanetDome();
    v.add(dome);
    v.environment = this.mats.bakeEnvironmentFromDome(dome);
    v.fog = new THREE.FogExp2(0x3b4960, 0.0040);

    const hemi = new THREE.HemisphereLight(0x7c92b8, 0x181e2b, 0.75);
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
    this._addBox(v, null, [0, -0.35, -10], [48, 0.70, 64], mCauseway, { collide: false, castShadow: false, tileMeters: 4.0 });
    this._addBox(v, null, [0, -0.54, -10], [66, 0.36, 82], mSand, { collide: false, castShadow: false, tileMeters: 5.0 });

    // Brutalist Concrete Perimeter Parapets
    this._addBox(v, this.voidColliders, [-24.2, 0.55, -10], [0.65, 1.1, 64.4], mConcrete);
    this._addBox(v, this.voidColliders, [ 24.2, 0.55, -10], [0.65, 1.1, 64.4], mConcrete);
    this._addBox(v, this.voidColliders, [  0.0, 0.55,  22.2], [49.0, 1.1, 0.65], mConcrete);
    this._addBox(v, this.voidColliders, [  0.0, 0.55, -42.2], [49.0, 1.1, 0.65], mConcrete);

    // Glowing Neon Causeway Guide Strips
    this._addBox(v, null, [ 0.0, 0.015, -20.5], [0.22, 0.03, 18.0], this.mats.getEmissive('vp_g1', PALETTE.signalCrimson, 3.0), { collide: false, castShadow: false });
    this._addBox(v, null, [-6.5, 0.015, -19.0], [0.18, 0.03, 18.5], this.mats.getEmissive('vp_g2', PALETTE.safetyOrange, 2.8), { collide: false, castShadow: false, rot: [0, 0.48, 0] });
    this._addBox(v, null, [ 6.5, 0.015, -19.0], [0.18, 0.03, 18.5], this.mats.getEmissive('vp_g3', PALETTE.holoCyan, 2.8), { collide: false, castShadow: false, rot: [0, -0.48, 0] });

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
      this._addBox(v, null, [sp.x, 1.35, sp.z], [0.95, 0.12, 0.95], orangeGlow, { collide: false, castShadow: false });
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
      this._addBox(v, null, [-22.0, 2.4, zs], [0.18, 4.6, 2.2], mAmberGl, { collide: false, castShadow: false, rot: [0, 0.26, 0] });
      this._addBox(v, null, [ 22.0, 2.4, zs], [0.18, 4.6, 2.2], mAmberGl, { collide: false, castShadow: false, rot: [0, -0.26, 0] });
    }

    // Portals on Void Planet
    for (const p of this.portals) {
      const res = this._addPortalArch(v, this.voidColliders, p.voidPos, p.voidYaw, p.color);
      p.voidApertureMat = res.apertureMat;
      p.voidLight = res.light;
    }

    // --- COLOSSAL HORIZON MEGASTRUCTURES (voidplanet/) ---
    // 1. 88m Faceted Crimson Wedge Colossus (colossus-crimson-wedge-shore-02.jpg)
    const wedgeMesh = new THREE.Mesh(this._buildCrimsonWedgeGeometry(), this.mats.createCrimsonWedgeMaterial());
    wedgeMesh.position.set(76, -1.2, -104);
    wedgeMesh.rotation.y = -0.45;
    v.add(wedgeMesh);

    // 2. Levitating Brushed-Titanium Sea Octahedron (monolith-floating-sea-octahedron-01.jpg)
    const octGeom = new THREE.OctahedronGeometry(22, 0);
    octGeom.scale(0.86, 1.32, 0.86);
    this.floatingOctahedron = new THREE.Mesh(octGeom, mDarkTi);
    this.floatingOctahedron.position.set(-70, 28, -100);
    v.add(this.floatingOctahedron);

    // 3. Twin Metallic Pyramids (architecture-twin-metallic-pyramids-03.jpg)
    const pyr1 = new THREE.Mesh(new THREE.ConeGeometry(46, 64, 4), mDarkTi);
    pyr1.position.set(-22, 31, -162);
    pyr1.rotation.y = 0.98;
    v.add(pyr1);

    const pyr2 = new THREE.Mesh(new THREE.ConeGeometry(58, 82, 4), mDarkTi);
    pyr2.position.set(34, 40, -186);
    pyr2.rotation.y = 1.12;
    v.add(pyr2);

    // 4. Southern Split Red-Anomaly Monolith (isolation-split-desert-monolith-08 & anomaly-glowing-red-monolith-14)
    this._addBox(v, null, [-5.4, 38, 128], [8.8, 78, 14], mDarkTi, { collide: false, castShadow: false, tileMeters: 10 });
    this._addBox(v, null, [ 5.4, 38, 128], [8.8, 78, 14], mDarkTi, { collide: false, castShadow: false, tileMeters: 10 });
    this._addBox(v, null, [ 0.0, 40, 128], [1.2, 70, 8], this.mats.getEmissive('vp_slit', PALETTE.signalCrimson, 3.6), { collide: false, castShadow: false });
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
