import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { SoundSynth } from './audio.js';
import { MaterialLibrary, PALETTE } from './materials.js';
import { WorldBuilder, GATE_1_Z, GATE_2_Z } from './worlds.js';
import { RobotEnemy, WeaponRig, ENEMY_KIND } from './entities.js';
import { HUDController } from './hud.js';

class VoidGame {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.modalOverlay = document.getElementById('modal-overlay');
    this.engageBtn = document.getElementById('engage-btn');
    this.resetBtn = document.getElementById('reset-btn');

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.98;
    this.renderer.autoClear = false;
    this.container.appendChild(this.renderer.domElement);

    // Live See-Through Portal RenderTarget (512x768)
    this.portalRT = new THREE.WebGLRenderTarget(512, 768, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.HalfFloatType
    });
    this.portalCamera = new THREE.PerspectiveCamera(75, 512 / 768, 0.1, 480);
    this.portalCamera.rotation.order = 'YXZ';

    // Main FPS Camera
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 520);
    this.camera.rotation.order = 'YXZ';

    this.audio = new SoundSynth();
    this.mats  = new MaterialLibrary(this.renderer);
    this.worlds = new WorldBuilder(this.mats, this.portalRT.texture);
    this.weaponRig = new WeaponRig(this.mats);
    this.hud = new HUDController();

    // Post-Processing Composer (World -> 3D Weapon Viewmodel -> Selective HDR Bloom -> ACES Output)
    this.composer = new EffectComposer(this.renderer);
    this.worldPass = new RenderPass(this.worlds.skyScene, this.camera);
    this.weaponPass = new RenderPass(this.weaponRig.scene, this.weaponRig.camera);
    this.weaponPass.clear = false;
    this.weaponPass.clearDepth = true;
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.30, // subtle realistic HDR bloom strength
      0.42, // radius
      1.08  // threshold above diffuse white so only emissive optics/portals/lasers bloom!
    );
    this.outputPass = new OutputPass();

    this.composer.addPass(this.worldPass);
    this.composer.addPass(this.weaponPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.outputPass);

    // Shared projectile & spark geometries
    this.boltGeom = new THREE.BoxGeometry(0.08, 0.08, 0.72);
    this.sparkGeom = new THREE.BoxGeometry(0.09, 0.09, 0.09);

    // Input state
    this.keys = new Set();
    this.mouseDownLeft = false;
    this.isLocked = false;

    // Gameplay containers
    this.enemies = [];
    this.projectiles = [];
    this.sparks = [];

    this._bindEvents();
    this.resetCampaign();

    this.clock = new THREE.Clock();
    this._animate = this._animate.bind(this);
    requestAnimationFrame(this._animate);
  }

  resetCampaign() {
    for (const e of this.enemies) {
      this.worlds.skyScene.remove(e.group);
    }
    this.enemies = [];
    this._clearTransientFX();

    this.inSkyTower = true;
    this.worldPass.scene = this.worlds.skyScene;
    this.sectorUnlocked = [true, false, false];
    this.sectorSpawned = [true, false, false];
    this.victory = false;
    this.worlds.updateUnlocks(this.sectorUnlocked);

    this.playerPos = new THREE.Vector3(0, 0, 12.5);
    this.playerVel = new THREE.Vector3(0, 0, 0);
    this.playerYaw = 0;
    this.playerPitch = 0;
    this.onGround = true;

    this.health = 100;
    this.maxHealth = 100;
    this.shield = 50;
    this.maxShield = 50;
    this.timeSinceDamaged = 10;

    this.isPulse = true;
    this.weaponRig.setWeapon(true);
    this.pulseMag = 32;
    this.pulseMagMax = 32;
    this.railMag = 8;
    this.railMagMax = 8;
    this.railReserve = 40;
    this.railReserveMax = 56;

    this.fireCooldown = 0;
    this.reloadTimer = 0;
    this.recoil = 0;
    this.muzzleFlashTimer = 0;
    this.bobTime = 0;
    this.bobWeight = 0;

    this.katanaCooldown = 0;
    this.katanaCooldownMax = 2.4;
    this.katanaDashTimer = 0;
    this.katanaSlashAnim = 0;
    this.katanaDashDir = new THREE.Vector3(0, 0, -1);

    this.portalCooldown = 1.0;
    this.portalFlash = 0.65;
    this.hurtFlash = 0;
    this.healPulse = 0;
    this.hitMarkerTimer = 0;
    this.hitMarkerCrit = false;
    this.portalHint = '';

    this.totalKills = 0;
    this.elapsedTime = 0;

    this._spawnSector1Wave();
    this.showBanner('CONSTRUCT ONLINE // CLEAR SKY.TOWER SEC.01 ANDROID PATROL', 5.0);
  }

  showBanner(text, duration = 4.2) {
    this.bannerText = text;
    this.bannerTimer = duration;
  }

  _bindEvents() {
    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.weaponRig.setAspect(w / h);
      this.renderer.setSize(w, h);
      this.composer.setSize(w, h);
    });

    const requestLock = () => {
      this.audio.ensureContext();
      this.renderer.domElement.requestPointerLock?.();
    };

    this.engageBtn.addEventListener('click', requestLock);
    this.resetBtn.addEventListener('click', () => {
      this.resetCampaign();
      requestLock();
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.renderer.domElement;
      this.modalOverlay.style.display = this.isLocked ? 'none' : 'flex';
      if (!this.isLocked) {
        this.keys.clear();
        this.mouseDownLeft = false;
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isLocked) return;
      const sens = 0.0023;
      this.playerYaw -= e.movementX * sens;
      this.playerPitch = Math.max(-1.44, Math.min(1.44, this.playerPitch - e.movementY * sens));
    });

    document.addEventListener('mousedown', (e) => {
      if (!this.isLocked) return;
      if (e.button === 0) {
        this.mouseDownLeft = true;
      } else if (e.button === 2) {
        this._triggerKatanaDash();
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDownLeft = false;
    });

    document.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('wheel', (e) => {
      if (!this.isLocked) return;
      if (Math.abs(e.deltaY) > 4) {
        this._switchWeapon(!this.isPulse);
      }
    }, { passive: true });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyN' && !e.repeat) {
        this.resetCampaign();
        return;
      }
      if (!this.isLocked) return;
      this.keys.add(e.code);

      if (e.code === 'Digit1') this._switchWeapon(true);
      if (e.code === 'Digit2') this._switchWeapon(false);
      if (e.code === 'KeyR' && !e.repeat) this._startReload();
      if (e.code === 'KeyF' && !e.repeat) this._triggerKatanaDash();
      if (e.code === 'Space' && !e.repeat && this.onGround) {
        this.playerVel.y = 7.8;
        this.onGround = false;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
  }

  _switchWeapon(toPulse) {
    if (this.isPulse === toPulse) return;
    this.isPulse = toPulse;
    this.reloadTimer = 0;
    this.weaponRig.setWeapon(toPulse);
  }

  _startReload() {
    if (this.reloadTimer > 0) return;
    if (this.isPulse && this.pulseMag < this.pulseMagMax) {
      this.reloadTimer = 1.0;
    } else if (!this.isPulse && this.railMag < this.railMagMax && this.railReserve > 0) {
      this.reloadTimer = 1.15;
    }
  }

  _finishReload() {
    if (this.isPulse) {
      this.pulseMag = this.pulseMagMax;
    } else {
      const take = Math.min(this.railMagMax - this.railMag, this.railReserve);
      this.railMag += take;
      this.railReserve -= take;
    }
  }

  // --- Wave Spawning ---
  _spawnEnemy(kind, sector, x, y, z) {
    const bot = new RobotEnemy(kind, sector, new THREE.Vector3(x, y, z), this.mats);
    this.worlds.skyScene.add(bot.group);
    this.enemies.push(bot);
  }

  _spawnSector1Wave() {
    this._spawnEnemy(ENEMY_KIND.OPTIC_ANDROID, 1, -5.5, 0, -2.0);
    this._spawnEnemy(ENEMY_KIND.OPTIC_ANDROID, 1,  5.5, 0, -4.5);
    this._spawnEnemy(ENEMY_KIND.HOLO_STRIDER,  1, -2.5, 0, -11.0);
    this._spawnEnemy(ENEMY_KIND.HOLO_STRIDER,  1,  3.5, 0, -14.5);
    this._spawnEnemy(ENEMY_KIND.OPTIC_ANDROID, 1, -6.5, 0, -18.5);
    this._spawnEnemy(ENEMY_KIND.OPTIC_ANDROID, 1,  6.5, 0, -19.5);
  }

  _spawnSector2Wave() {
    if (this.sectorSpawned[1]) return;
    this.sectorSpawned[1] = true;
    this._spawnEnemy(ENEMY_KIND.OPTIC_ANDROID,    2, -4.5, 0, -35.0);
    this._spawnEnemy(ENEMY_KIND.OPTIC_ANDROID,    2,  4.5, 0, -39.0);
    this._spawnEnemy(ENEMY_KIND.HOLO_STRIDER,     2, -2.0, 0, -45.0);
    this._spawnEnemy(ENEMY_KIND.HOLO_STRIDER,     2,  2.5, 0, -51.0);
    this._spawnEnemy(ENEMY_KIND.OPTIC_ANDROID,    2,  0.0, 0, -61.0);
    this._spawnEnemy(ENEMY_KIND.HOLO_STRIDER,     2, -6.0, 0, -66.0);
    this._spawnEnemy(ENEMY_KIND.OBSIDIAN_STALKER, 2, -13.2, 2.8, -48.0);
    this._spawnEnemy(ENEMY_KIND.OBSIDIAN_STALKER, 2,  13.2, 2.8, -52.0);
    this._spawnEnemy(ENEMY_KIND.OBSIDIAN_STALKER, 2, -13.2, 2.8, -61.0);
    this.showBanner('SEC.02 // CRIMSON CONCOURSE — STALKER SNIPERS ON MEZZANINES!', 4.5);
  }

  _spawnSector3BossWave() {
    if (this.sectorSpawned[2]) return;
    this.sectorSpawned[2] = true;
    this._spawnEnemy(ENEMY_KIND.KATANA_BOSS,   3,  0.0, 0, -106.0);
    this._spawnEnemy(ENEMY_KIND.OPTIC_ANDROID, 3, -12.0, 0, -96.0);
    this._spawnEnemy(ENEMY_KIND.OPTIC_ANDROID, 3,  12.0, 0, -96.0);
    this._spawnEnemy(ENEMY_KIND.HOLO_STRIDER,  3, -6.5, 0, -112.0);
    this._spawnEnemy(ENEMY_KIND.HOLO_STRIDER,  3,  6.5, 0, -112.0);
    this.showBanner('WARNING // HIR-00 WHITE KATANA MECH ENGAGED IN APEX LOUNGE!', 5.5);
  }

  getSectorNumber() {
    if (!this.inSkyTower) return 0;
    if (this.playerPos.z < GATE_2_Z) return 3;
    if (this.playerPos.z < GATE_1_Z) return 2;
    return 1;
  }

  // --- Physics & Collision ---
  _collidesHorizontal(x, y, z, radius, height) {
    const stepH = 0.50;
    const minX = x - radius, maxX = x + radius;
    const minY = y + stepH,  maxY = y + height;
    const minZ = z - radius, maxZ = z + radius;

    const list = this.inSkyTower ? this.worlds.skyColliders : this.worlds.voidColliders;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (minX <= b.max.x && maxX >= b.min.x &&
          minY <= b.max.y && maxY >= b.min.y &&
          minZ <= b.max.z && maxZ >= b.min.z) {
        return true;
      }
    }

    if (this.inSkyTower) {
      if (!this.sectorUnlocked[1] && Math.abs(z - GATE_1_Z) < radius + 0.35 && Math.abs(x) < 4.2) return true;
      if (!this.sectorUnlocked[2] && Math.abs(z - GATE_2_Z) < radius + 0.35 && Math.abs(x) < 4.2) return true;
    }
    return false;
  }

  _supportHeight(x, curY, z) {
    let best = 0;
    if (!this.inSkyTower) return best;

    for (const r of this.worlds.skyRamps) {
      if (x >= r.xMin && x <= r.xMax && z <= r.zLow && z >= r.zHigh) {
        const t = Math.max(0, Math.min(1, (z - r.zLow) / (r.zHigh - r.zLow)));
        const ry = r.yLow + (r.yHigh - r.yLow) * t;
        if (ry <= curY + 0.65) best = Math.max(best, ry);
      }
    }
    for (const s of this.worlds.skyFloorSlabs) {
      if (x >= s.xMin && x <= s.xMax && z >= s.zMin && z <= s.zMax) {
        if (s.yTop <= curY + 0.55) best = Math.max(best, s.yTop);
      }
    }
    return best;
  }

  _stepPlayer(dt) {
    const fwdX = -Math.sin(this.playerYaw);
    const fwdZ = -Math.cos(this.playerYaw);
    const rgtX =  Math.cos(this.playerYaw);
    const rgtZ = -Math.sin(this.playerYaw);

    let wx = 0, wz = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp'))    { wx += fwdX; wz += fwdZ; }
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown'))  { wx -= fwdX; wz -= fwdZ; }
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) { wx += rgtX; wz += rgtZ; }
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft'))  { wx -= rgtX; wz -= rgtZ; }
    const wLen = Math.hypot(wx, wz);
    if (wLen > 0.001) { wx /= wLen; wz /= wLen; }

    const sprinting = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');

    if (this.katanaDashTimer > 0) {
      this.katanaDashTimer -= dt;
      this.playerVel.x = this.katanaDashDir.x * 23.5;
      this.playerVel.z = this.katanaDashDir.z * 23.5;
      this.playerVel.y = Math.max(0, this.playerVel.y);
      this._performKatanaCleave();
    } else {
      const speed = sprinting ? 10.4 : 7.2;
      const accel = Math.min(1, (this.onGround ? 15.0 : 5.5) * dt);
      this.playerVel.x += (wx * speed - this.playerVel.x) * accel;
      this.playerVel.z += (wz * speed - this.playerVel.z) * accel;
    }

    this.playerVel.y -= 19.6 * dt;

    const minX = this.inSkyTower ? -21.5 : -23.5;
    const maxX = this.inSkyTower ?  21.5 :  23.5;
    const minZ = this.inSkyTower ? -125.4 : -41.5;
    const maxZ = this.inSkyTower ?   17.6 :  21.5;

    const nx = Math.max(minX, Math.min(maxX, this.playerPos.x + this.playerVel.x * dt));
    if (!this._collidesHorizontal(nx, this.playerPos.y, this.playerPos.z, 0.42, 1.78)) {
      this.playerPos.x = nx;
    } else {
      this.playerVel.x = 0;
    }

    const nz = Math.max(minZ, Math.min(maxZ, this.playerPos.z + this.playerVel.z * dt));
    if (!this._collidesHorizontal(this.playerPos.x, this.playerPos.y, nz, 0.42, 1.78)) {
      this.playerPos.z = nz;
    } else {
      this.playerVel.z = 0;
    }

    const floorY = this._supportHeight(this.playerPos.x, this.playerPos.y, this.playerPos.z);
    this.playerPos.y += this.playerVel.y * dt;
    if (this.playerPos.y <= floorY + (this.onGround && this.playerVel.y <= 0 ? 0.28 : 0.02) && this.playerVel.y <= 0) {
      this.playerPos.y = floorY;
      this.playerVel.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    const hSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    if (this.onGround && hSpeed > 0.5 && this.katanaDashTimer <= 0) {
      this.bobTime += dt * (sprinting ? 7.4 : 5.5);
      this.bobWeight += (Math.min(1, hSpeed / 8.5) - this.bobWeight) * Math.min(1, dt * 10);
    } else {
      this.bobWeight += (0 - this.bobWeight) * Math.min(1, dt * 10);
    }

    const bobY = Math.sin(this.bobTime * 2.0) * 0.042 * this.bobWeight;
    this.camera.position.set(this.playerPos.x, this.playerPos.y + 1.68 + bobY, this.playerPos.z);
    this.camera.rotation.y = this.playerYaw;
    this.camera.rotation.x = this.playerPitch;

    const targetFov = this.katanaDashTimer > 0 ? 85 : 75;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 12);
      this.camera.updateProjectionMatrix();
    }
  }

  // --- Weapons & Cyber-Katana ---
  _fireCurrentWeapon() {
    const origin = this.camera.position.clone();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    const rgt = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion).normalize();
    const up  = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion).normalize();
    const muzzle = origin.clone().addScaledVector(fwd, 0.55).addScaledVector(rgt, 0.22).addScaledVector(up, -0.14);

    if (this.isPulse) {
      if (this.pulseMag <= 0) { this._startReload(); return; }
      this.pulseMag--;
      this.fireCooldown = 0.105;
      this.recoil = Math.min(1, this.recoil + 0.35);
      this.muzzleFlashTimer = 0.045;
      this.weaponRig.muzzleLight.color.setHex(PALETTE.holoCyan);
      this.audio.play('pulse');

      const dir = fwd.clone()
        .addScaledVector(rgt, (Math.random() - 0.5) * 0.016)
        .addScaledVector(up,  (Math.random() - 0.5) * 0.016)
        .normalize();
      this._raycastAndTracer(origin, muzzle, dir, 135, 27, PALETTE.holoCyan);
      if (this.pulseMag === 0) this._startReload();
    } else {
      if (this.railMag <= 0) {
        if (this.railReserve > 0) this._startReload();
        else {
          this._switchWeapon(true);
          this.showBanner('RAIL SHELLS DEPLETED // SWITCHED TO HIR-01 PULSE', 2.5);
        }
        return;
      }
      this.railMag--;
      this.fireCooldown = 0.56;
      this.recoil = 1.0;
      this.playerPitch = Math.min(1.44, this.playerPitch + 0.022);
      this.muzzleFlashTimer = 0.065;
      this.weaponRig.muzzleLight.color.setHex(PALETTE.safetyOrange);
      this.audio.play('rail');

      for (let p = 0; p < 8; p++) {
        const dir = fwd.clone()
          .addScaledVector(rgt, (Math.random() - 0.5) * 0.104)
          .addScaledVector(up,  (Math.random() - 0.5) * 0.084)
          .normalize();
        this._raycastAndTracer(origin, muzzle, dir, 75, 18, PALETTE.safetyOrange);
      }
      if (this.railMag === 0 && this.railReserve > 0) this._startReload();
    }
  }

  _raycastAndTracer(origin, muzzle, dir, maxDist, damage, hexCol) {
    const ray = new THREE.Ray(origin, dir);
    let bestDist = maxDist;
    let hitPt = origin.clone().addScaledVector(dir, maxDist);
    let hitEnemy = null;

    const colliders = this.inSkyTower ? this.worlds.skyColliders : this.worlds.voidColliders;
    const tmp = new THREE.Vector3();
    for (const box of colliders) {
      if (ray.intersectBox(box, tmp)) {
        const d = origin.distanceTo(tmp);
        if (d < bestDist) {
          bestDist = d;
          hitPt.copy(tmp);
        }
      }
    }

    if (this.inSkyTower) {
      for (const e of this.enemies) {
        const eb = e.getBoundingBox().expandByScalar(0.08);
        if (ray.intersectBox(eb, tmp)) {
          const d = origin.distanceTo(tmp);
          if (d < bestDist) {
            bestDist = d;
            hitPt.copy(tmp);
            hitEnemy = e;
          }
        }
      }
    }

    if (hitEnemy) {
      const isHead = hitPt.y >= hitEnemy.position.y + hitEnemy.height * 0.72;
      this._damageEnemy(hitEnemy, damage * (isHead ? 1.5 : 1.0), hitPt, isHead);
      this._spawnSparks(hitPt, hexCol, 6);
    } else if (bestDist < maxDist) {
      this._spawnSparks(hitPt, hexCol, 4);
    }

    const visDir = hitPt.clone().sub(muzzle).normalize();
    this._spawnBolt(muzzle, visDir.multiplyScalar(155), hexCol, 0, true, Math.min(0.4, bestDist / 155));
  }

  _triggerKatanaDash() {
    if (this.katanaCooldown > 0) return;
    this.katanaCooldown = this.katanaCooldownMax;
    this.katanaDashTimer = 0.20;
    this.katanaSlashAnim = 1.0;
    this.katanaDashDir.set(-Math.sin(this.playerYaw), 0, -Math.cos(this.playerYaw)).normalize();
    this.audio.play('katana');
    this._performKatanaCleave();
  }

  _performKatanaCleave() {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      if (!pr.fromPlayer && pr.mesh.position.distanceTo(this.camera.position) < 3.6) {
        this._spawnSparks(pr.mesh.position, PALETTE.holoCyan, 5);
        pr.scene.remove(pr.mesh);
        this.projectiles.splice(i, 1);
      }
    }
    if (!this.inSkyTower) return;

    const fwdX = -Math.sin(this.playerYaw);
    const fwdZ = -Math.cos(this.playerYaw);
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e || e.hitFlashTimer > 0.04) continue;
      const dx = e.position.x - this.playerPos.x;
      const dz = e.position.z - this.playerPos.z;
      const d = Math.hypot(dx, dz);
      if (d < 3.9 + e.radius) {
        const dot = d > 0.2 ? (dx / d) * fwdX + (dz / d) * fwdZ : 1.0;
        if (dot > -0.25) {
          this._damageEnemy(e, 95, e.position.clone().add(new THREE.Vector3(0, 1.1, 0)), true);
        }
      }
    }
  }

  // --- Portals & Void Planet Sanctuary ---
  _checkPortals() {
    this.portalHint = '';
    for (const p of this.worlds.portals) {
      const pPos = this.inSkyTower ? p.skyPos : p.voidPos;
      const dist = Math.hypot(this.playerPos.x - pPos.x, this.playerPos.z - pPos.z);
      const dy = Math.abs(this.playerPos.y - pPos.y);
      const open = this.sectorUnlocked[p.index];

      if (dist < 4.6 && dy < 2.5) {
        this.portalHint = open
          ? `STEP INTO THRESHOLD \u2192 ${this.inSkyTower ? 'VOID.PLANET SANCTUARY' : `SKY.TOWER ${p.label}`}`
          : `LOCKED // CLEAR PREVIOUS SECTOR TO SYNC ${p.label}`;
      }
      if (open && this.portalCooldown <= 0 && dist < 1.48 && dy < 2.3) {
        this._warpThroughPortal(p);
        return;
      }
    }
  }

  _warpThroughPortal(p) {
    this.portalCooldown = 1.35;
    this.portalFlash = 1.0;
    this.playerVel.set(0, 0, 0);
    this._clearTransientFX();
    this.audio.play('portal');

    if (this.inSkyTower) {
      this.inSkyTower = false;
      this.worldPass.scene = this.worlds.voidScene;
      this.playerPos.copy(p.voidSpawn);
      const toWell = this.worlds.bioWellPos.clone().sub(this.playerPos);
      this.playerYaw = Math.atan2(-toWell.x, -toWell.z);
      this.playerPitch = -0.04;
      this.showBanner('REALITY // VOID.PLANET — STEP IN EMERALD BIO-WELL TO HEAL', 5.0);
    } else {
      this.inSkyTower = true;
      this.worldPass.scene = this.worlds.skyScene;
      this.playerPos.copy(p.skySpawn);
      this.playerYaw = 0;
      this.playerPitch = 0;
      if (p.index === 1) this._spawnSector2Wave();
      if (p.index === 2) this._spawnSector3BossWave();
      this.showBanner(`CONSTRUCT // RE-ENTERED SKY.TOWER ${p.label}`, 3.8);
    }
  }

  _stepVoidSanctuary(dt) {
    if (this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + 9.0 * dt);
    }
    const dWell = Math.hypot(this.playerPos.x - this.worlds.bioWellPos.x, this.playerPos.z - this.worlds.bioWellPos.z);
    if (dWell <= 5.2) {
      const needVitals = this.health < this.maxHealth - 0.2 || this.shield < this.maxShield - 0.2;
      const needAmmo = this.pulseMag < this.pulseMagMax || this.railMag < this.railMagMax || this.railReserve < this.railReserveMax;
      if (needVitals || needAmmo) {
        this.health = Math.min(this.maxHealth, this.health + 45 * dt);
        this.shield = Math.min(this.maxShield, this.shield + 40 * dt);
        this.pulseMag = this.pulseMagMax;
        this.railMag = this.railMagMax;
        this.railReserve = this.railReserveMax;
        this.reloadTimer = 0;
        this.healPulse = Math.min(1, this.healPulse + dt * 4.5);
        this.audio.play('heal');
      }
    }
    for (const sp of this.worlds.ammoShrines) {
      if (Math.hypot(this.playerPos.x - sp.x, this.playerPos.z - sp.z) < 2.5) {
        this.pulseMag = this.pulseMagMax;
        this.railMag = this.railMagMax;
        this.railReserve = this.railReserveMax;
      }
    }
  }

  // --- Sector Progression & Enemy AI ---
  _checkSectorProgression() {
    if (!this.sectorUnlocked[1] && !this.enemies.some((e) => e.sector === 1)) {
      this.sectorUnlocked[1] = true;
      this.worlds.updateUnlocks(this.sectorUnlocked);
      this.audio.play('clear');
      this.showBanner('SEC.01 CLEARED // CONCOURSE BULKHEAD & PORTAL P-02 SYNCED!', 5.0);
    }
    if (this.sectorUnlocked[1] && !this.sectorSpawned[1] && this.playerPos.z < GATE_1_Z + 2.5) {
      this._spawnSector2Wave();
    }
    if (this.sectorSpawned[1] && !this.sectorUnlocked[2] && !this.enemies.some((e) => e.sector === 2)) {
      this.sectorUnlocked[2] = true;
      this.worlds.updateUnlocks(this.sectorUnlocked);
      this.audio.play('clear');
      this.showBanner('SEC.02 CLEARED // APEX LOUNGE & PORTAL P-03 SYNCED — BOSS AHEAD!', 5.5);
    }
    if (this.sectorUnlocked[2] && !this.sectorSpawned[2] && this.playerPos.z < GATE_2_Z + 2.0) {
      this._spawnSector3BossWave();
    }
    if (this.sectorSpawned[2] && !this.victory && this.enemies.length === 0) {
      this.victory = true;
      this.audio.play('clear');
      this.showBanner('CONSTRUCT LIBERATED // HIR-00 DEFEATED! [PRESS N FOR NEW RUN]', 12.0);
    }
  }

  _hasLineOfSight(from, to) {
    const sub = to.clone().sub(from);
    const dist = sub.length();
    if (dist < 0.2) return true;
    const ray = new THREE.Ray(from, sub.divideScalar(dist));
    const hit = new THREE.Vector3();
    for (const b of this.worlds.skyColliders) {
      if (ray.intersectBox(b, hit) && from.distanceTo(hit) < dist - 0.15) {
        return false;
      }
    }
    return true;
  }

  _stepEnemies(dt) {
    const pSec = this.getSectorNumber();

    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      e.fireCooldown -= dt;
      e.dashCooldown -= dt;
      e.strafeTimer -= dt;
      if (e.strafeTimer <= 0) {
        e.strafeSign *= -1;
        e.strafeTimer = 1.4 + Math.random() * 1.6;
      }

      const dx = this.playerPos.x - e.position.x;
      const dz = this.playerPos.z - e.position.z;
      const dist = Math.hypot(dx, dz);
      const dirX = dist > 0.01 ? dx / dist : 0;
      const dirZ = dist > 0.01 ? dz / dist : 1;
      e.yaw = Math.atan2(-dirX, -dirZ);

      if (dist > 46 || e.sector > pSec) {
        e.updateVisuals(dt, 0);
        continue;
      }

      if (e.kind === ENEMY_KIND.KATANA_BOSS && !e.summonedEscorts && e.health < e.maxHealth * 0.5) {
        e.summonedEscorts = true;
        this._spawnEnemy(ENEMY_KIND.HOLO_STRIDER, 3, -14, 0, -99);
        this._spawnEnemy(ENEMY_KIND.HOLO_STRIDER, 3,  14, 0, -99);
        this.showBanner('HIR-00 OVERCLOCK // HOLO-STRIDER ESCORTS DEPLOYED!', 4.0);
      }

      const eyeFrom = e.position.clone().add(new THREE.Vector3(0, e.height * 0.78, 0));
      const los = this._hasLineOfSight(eyeFrom, this.camera.position);
      const stX = -dirZ * e.strafeSign;
      const stZ =  dirX * e.strafeSign;
      let vx = 0, vz = 0;

      if (e.kind === ENEMY_KIND.OPTIC_ANDROID) {
        if (dist > 15) { vx = (dirX * 0.8 + stX * 0.5) * 4.3; vz = (dirZ * 0.8 + stZ * 0.5) * 4.3; }
        else if (dist < 9.5) { vx = (-dirX * 0.6 + stX * 0.8) * 4.0; vz = (-dirZ * 0.6 + stZ * 0.8) * 4.0; }
        else { vx = stX * 3.8; vz = stZ * 3.8; }
      } else if (e.kind === ENEMY_KIND.HOLO_STRIDER) {
        vx = (dirX + stX * 0.4) * 6.4;
        vz = (dirZ + stZ * 0.4) * 6.4;
        if (dist < 2.25 && e.fireCooldown <= 0) {
          e.fireCooldown = 0.95;
          this._damagePlayer(14);
        }
      } else if (e.kind === ENEMY_KIND.OBSIDIAN_STALKER) {
        vz = e.strafeSign * 2.6;
      } else if (e.kind === ENEMY_KIND.KATANA_BOSS) {
        if (e.dashTimer > 0) {
          e.dashTimer -= dt;
          vx = e.dashDir.x * 19.5;
          vz = e.dashDir.z * 19.5;
          if (dist < 3.2) {
            e.dashTimer = 0;
            this._damagePlayer(30);
            this._spawnSparks(this.playerPos.clone().add(new THREE.Vector3(0, 1.2, 0)), PALETTE.signalCrimson, 14);
          }
        } else if (e.dashCooldown <= 0 && dist > 6.5 && dist < 26 && los) {
          e.dashCooldown = 5.2;
          e.dashTimer = 0.42;
          e.dashDir.set(dirX, 0, dirZ);
          this.audio.play('katana');
        } else {
          vx = (dirX * 0.78 + stX * 0.62) * 5.2;
          vz = (dirZ * 0.78 + stZ * 0.62) * 5.2;
        }
      }

      if (e.kind !== ENEMY_KIND.OBSIDIAN_STALKER) {
        const enx = Math.max(-21, Math.min(21, e.position.x + vx * dt));
        if (!this._collidesHorizontal(enx, e.position.y, e.position.z, e.radius, e.height)) e.position.x = enx;
      }
      const zMinS = e.sector === 1 ? GATE_1_Z + 1 : (e.sector === 2 ? GATE_2_Z + 1 : -124);
      const zMaxS = e.sector === 1 ? 16.5 : (e.sector === 2 ? GATE_1_Z - 1 : GATE_2_Z - 1);
      const enz = Math.max(zMinS, Math.min(zMaxS, e.position.z + vz * dt));
      if (!this._collidesHorizontal(e.position.x, e.position.y, enz, e.radius, e.height)) e.position.z = enz;

      if (e.kind !== ENEMY_KIND.OBSIDIAN_STALKER) {
        e.position.y = this._supportHeight(e.position.x, e.position.y, e.position.z);
      }
      e.updateVisuals(dt, Math.hypot(vx, vz));

      if (e.fireCooldown <= 0 && los) {
        const muz = e.position.clone().add(new THREE.Vector3(dirX * 0.6, e.height * 0.72, dirZ * 0.6));
        const aim = this.camera.position.clone().add(new THREE.Vector3(0, -0.22, 0)).sub(muz).normalize();

        if (e.kind === ENEMY_KIND.OPTIC_ANDROID) {
          e.fireCooldown = 1.25 + Math.random() * 0.6;
          this._spawnBolt(muz, aim.multiplyScalar(35), PALETTE.safetyOrange, 11, false, 2.8);
        } else if (e.kind === ENEMY_KIND.HOLO_STRIDER) {
          e.fireCooldown = 1.5 + Math.random() * 0.7;
          if (dist > 4.0) this._spawnBolt(muz, aim.multiplyScalar(39), PALETTE.holoCoral, 9, false, 2.2);
        } else if (e.kind === ENEMY_KIND.OBSIDIAN_STALKER) {
          e.fireCooldown = 2.1 + Math.random() * 0.7;
          this._spawnBolt(muz, aim.multiplyScalar(55), PALETTE.signalCrimson, 18, false, 2.8);
        } else {
          e.fireCooldown = 1.35 + Math.random() * 0.55;
          const rVec = new THREE.Vector3(-dirZ, 0, dirX);
          for (const sp of [-0.14, 0, 0.14]) {
            const bDir = aim.clone().addScaledVector(rVec, sp).normalize();
            this._spawnBolt(muz, bDir.multiplyScalar(43), PALETTE.signalCrimson, 15, false, 3.0);
          }
        }
      }
    }
  }

  _damageEnemy(bot, amount, hitPt, isCrit) {
    const idx = this.enemies.indexOf(bot);
    if (idx === -1) return;
    bot.health -= amount;
    bot.triggerHitFlash();
    this.hitMarkerTimer = 0.16;
    this.hitMarkerCrit = isCrit;
    this.audio.play('hit');

    if (bot.health <= 0) {
      this.enemies.splice(idx, 1);
      this.worlds.skyScene.remove(bot.group);
      this.totalKills++;
      this.railReserve = Math.min(this.railReserveMax, this.railReserve + (bot.kind === ENEMY_KIND.KATANA_BOSS ? 16 : 3));
      this._spawnSparks(hitPt, bot.kind === ENEMY_KIND.HOLO_STRIDER ? PALETTE.holoCoral : PALETTE.safetyOrange, bot.kind === ENEMY_KIND.KATANA_BOSS ? 28 : 14);
      this.audio.play('down');
    }
  }

  _damagePlayer(amount) {
    if (this.katanaDashTimer > 0) return;
    this.timeSinceDamaged = 0;
    this.hurtFlash = Math.min(1, this.hurtFlash + 0.65);
    this.audio.play('hurt');

    let rem = amount;
    if (this.shield > 0) {
      const ab = Math.min(this.shield, rem);
      this.shield -= ab;
      rem -= ab;
    }
    if (rem > 0) this.health -= rem;

    if (this.health > 0 && this.health <= 38 && this.bannerTimer <= 0.4) {
      this.showBanner('CRITICAL DAMAGE // ENTER PORTAL TO VOID.PLANET TO HEAL!', 4.5);
    }

    if (this.health <= 0) {
      this.health = 28;
      this.shield = 0;
      const boss = this.enemies.find((e) => e.kind === ENEMY_KIND.KATANA_BOSS);
      if (boss) boss.health = Math.min(boss.maxHealth, boss.health + 180);
      const pIdx = this.sectorUnlocked[2] ? 2 : (this.sectorUnlocked[1] ? 1 : 0);
      this._warpThroughPortal(this.worlds.portals[pIdx]);
      this.showBanner('EMERGENCY CONSTRUCT EJECTION // HEAL AT EMERALD BIO-WELL!', 6.0);
    }
  }

  // --- Projectiles & Sparks ---
  _spawnBolt(pos, vel, hexCol, dmg, fromPlayer, life) {
    const scene = this.inSkyTower ? this.worlds.skyScene : this.worlds.voidScene;
    const mesh = new THREE.Mesh(this.boltGeom, this.mats.getEmissive(`bolt_${hexCol}`, hexCol, 3.6));
    mesh.position.copy(pos);
    mesh.lookAt(pos.clone().add(vel));
    scene.add(mesh);
    this.projectiles.push({ mesh, scene, vel: vel.clone(), dmg, fromPlayer, life, hexCol });
  }

  _stepProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      if (pr.life <= 0) {
        pr.scene.remove(pr.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }
      const next = pr.mesh.position.clone().addScaledVector(pr.vel, dt);

      if (!pr.fromPlayer && this.inSkyTower) {
        const pCenter = this.playerPos.clone().add(new THREE.Vector3(0, 0.95, 0));
        if (next.distanceTo(pCenter) < 0.68) {
          this._damagePlayer(pr.dmg);
          this._spawnSparks(next, PALETTE.signalCrimson, 5);
          pr.scene.remove(pr.mesh);
          this.projectiles.splice(i, 1);
          continue;
        }
        if (this._collidesHorizontal(next.x, next.y - 0.5, next.z, 0.08, 0.2)) {
          this._spawnSparks(pr.mesh.position, pr.hexCol, 4);
          pr.scene.remove(pr.mesh);
          this.projectiles.splice(i, 1);
          continue;
        }
      }
      pr.mesh.position.copy(next);
    }
  }

  _spawnSparks(pos, hexCol, count) {
    if (this.sparks.length > 160) return;
    const scene = this.inSkyTower ? this.worlds.skyScene : this.worlds.voidScene;
    const mat = this.mats.getEmissive(`spark_${hexCol}`, hexCol, 3.4);
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.sparkGeom, mat);
      mesh.position.copy(pos);
      scene.add(mesh);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.4, (Math.random() - 0.5) * 2)
        .normalize()
        .multiplyScalar(3.5 + Math.random() * 6.0);
      this.sparks.push({ mesh, scene, vel, life: 0.16 + Math.random() * 0.22 });
    }
  }

  _stepSparks(dt) {
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      sp.life -= dt;
      if (sp.life <= 0) {
        sp.scene.remove(sp.mesh);
        this.sparks.splice(i, 1);
        continue;
      }
      sp.vel.y -= 14.0 * dt;
      sp.mesh.position.addScaledVector(sp.vel, dt);
      sp.mesh.scale.setScalar(Math.max(0.1, sp.life * 3.2));
    }
  }

  _clearTransientFX() {
    for (const pr of this.projectiles) pr.scene.remove(pr.mesh);
    for (const sp of this.sparks) sp.scene.remove(sp.mesh);
    this.projectiles = [];
    this.sparks = [];
  }

  // --- Live See-Through Portal Render Pass ---
  _renderPortalPreview() {
    let bestP = this.worlds.portals[0];
    let bestD = Infinity;
    for (const p of this.worlds.portals) {
      if (!this.sectorUnlocked[p.index]) continue;
      const src = this.inSkyTower ? p.skyPos : p.voidPos;
      const d = this.playerPos.distanceTo(src);
      if (d < bestD) { bestD = d; bestP = p; }
    }

    const srcPos = this.inSkyTower ? bestP.skyPos : bestP.voidPos;
    const dstPos = this.inSkyTower ? bestP.voidPos : bestP.skyPos;
    const srcYaw = this.inSkyTower ? bestP.skyYaw : bestP.voidYaw;
    const dstYaw = this.inSkyTower ? bestP.voidYaw : bestP.skyYaw;

    const yawDiff = dstYaw - srcYaw + Math.PI;
    const rel = this.camera.position.clone().sub(srcPos.clone().add(new THREE.Vector3(0, 1.7, 0)));
    rel.applyAxisAngle(new THREE.Vector3(0, 1, 0), yawDiff);
    if (rel.length() > 8) rel.setLength(8);

    this.portalCamera.position.copy(dstPos).add(new THREE.Vector3(0, 1.7, 0)).add(rel);
    this.portalCamera.rotation.set(this.playerPitch, this.playerYaw + yawDiff, 0);

    const destScene = this.inSkyTower ? this.worlds.voidScene : this.worlds.skyScene;
    this.renderer.setRenderTarget(this.portalRT);
    this.renderer.clear();
    this.renderer.render(destScene, this.portalCamera);
    this.renderer.setRenderTarget(null);
  }

  _animateLandmarks(t) {
    this.mats.timeUniform.value = t;
    if (this.worlds.floatingOctahedron) {
      this.worlds.floatingOctahedron.position.y = 28 + Math.sin(t * 0.7) * 2.2;
      this.worlds.floatingOctahedron.rotation.y = t * 0.22;
    }
    if (this.worlds.bioCrystal) {
      this.worlds.bioCrystal.position.y = 2.8 + Math.sin(t * 2.2) * 0.35;
      this.worlds.bioCrystal.rotation.y = t * 1.4;
    }
    this.worlds.vtols.forEach((v, idx) => {
      const ph = t * 0.24 + idx * Math.PI;
      const rad = 56 + idx * 16;
      v.position.set(Math.sin(ph) * rad, 6 + idx * 8 + Math.sin(ph * 2) * 2, -62 + Math.cos(ph) * 68);
      v.rotation.set(0, Math.atan2(-Math.cos(ph) * rad, Math.sin(ph) * 68), 0.16);
    });
  }

  _animate() {
    requestAnimationFrame(this._animate);
    const dt = Math.min(0.05, Math.max(0.001, this.clock.getDelta()));
    this.elapsedTime += dt;
    this._animateLandmarks(this.elapsedTime);

    if (this.isLocked) {
      this.timeSinceDamaged += dt;
      this.fireCooldown = Math.max(0, this.fireCooldown - dt);
      this.katanaCooldown = Math.max(0, this.katanaCooldown - dt);
      this.katanaSlashAnim = Math.max(0, this.katanaSlashAnim - dt * 3.4);
      this.recoil = Math.max(0, this.recoil - dt * 6.5);
      this.muzzleFlashTimer = Math.max(0, this.muzzleFlashTimer - dt);
      this.portalCooldown = Math.max(0, this.portalCooldown - dt);
      this.portalFlash = Math.max(0, this.portalFlash - dt * 1.6);
      this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.2);
      this.healPulse = Math.max(0, this.healPulse - dt * 1.8);
      this.hitMarkerTimer = Math.max(0, this.hitMarkerTimer - dt);
      if (this.bannerTimer > 0) this.bannerTimer = Math.max(0, this.bannerTimer - dt);

      if (this.reloadTimer > 0) {
        this.reloadTimer -= dt;
        if (this.reloadTimer <= 0) this._finishReload();
      }

      this._stepPlayer(dt);
      this._checkPortals();

      if (!this.inSkyTower) {
        this._stepVoidSanctuary(dt);
      } else {
        if (this.timeSinceDamaged > 5.5 && this.shield < this.maxShield) {
          this.shield = Math.min(this.maxShield, this.shield + 8.5 * dt);
        }
        this._checkSectorProgression();
        this._stepEnemies(dt);
      }

      if (this.mouseDownLeft && this.reloadTimer <= 0 && this.fireCooldown <= 0) {
        this._fireCurrentWeapon();
      }

      this._stepProjectiles(dt);
      this._stepSparks(dt);
    } else {
      // Keep idle camera updated while on VOID landing/pause modal
      this.camera.position.set(this.playerPos.x, this.playerPos.y + 1.68, this.playerPos.z);
      this.camera.rotation.set(this.playerPitch, this.playerYaw, 0);
    }

    this.weaponRig.update(
      this.bobTime, this.bobWeight, this.recoil,
      this.reloadTimer, this.katanaSlashAnim, this.muzzleFlashTimer
    );

    this._renderPortalPreview();
    this.composer.render();

    this.hud.update({
      inSkyTower: this.inSkyTower,
      sectorNum: this.getSectorNumber(),
      elapsedTime: this.elapsedTime,
      health: this.health,
      maxHealth: this.maxHealth,
      shield: this.shield,
      maxShield: this.maxShield,
      katanaCooldown: this.katanaCooldown,
      katanaCooldownMax: this.katanaCooldownMax,
      isPulse: this.isPulse,
      pulseMag: this.pulseMag,
      railMag: this.railMag,
      railReserve: this.railReserve,
      reloadTimer: this.reloadTimer,
      recoil: this.recoil,
      enemies: this.enemies,
      totalKills: this.totalKills,
      victory: this.victory,
      activeBoss: this.enemies.find((e) => e.kind === ENEMY_KIND.KATANA_BOSS) || null,
      bannerText: this.bannerText,
      bannerTimer: this.bannerTimer,
      portalHint: this.portalHint,
      hurtFlash: this.hurtFlash,
      healPulse: this.healPulse,
      portalFlash: this.portalFlash,
      hitMarkerTimer: this.hitMarkerTimer,
      hitMarkerCrit: this.hitMarkerCrit,
      playerPos: this.playerPos,
      playerYaw: this.playerYaw,
      portals: this.worlds.portals,
      sectorUnlocked: this.sectorUnlocked,
      bioWellPos: this.worlds.bioWellPos
    });
  }
}

window.__voidGame = new VoidGame();
