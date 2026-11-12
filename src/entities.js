import * as THREE from 'three';
import { PALETTE } from './materials.js';

export const ENEMY_KIND = {
  OPTIC_ANDROID:    'OPTIC_ANDROID',
  HOLO_STRIDER:     'HOLO_STRIDER',
  OBSIDIAN_STALKER: 'OBSIDIAN_STALKER',
  KATANA_BOSS:      'KATANA_BOSS'
};

export class RobotEnemy {
  constructor(kind, sector, pos, mats) {
    this.kind = kind;
    this.sector = sector;
    this.position = pos.clone();
    this.yaw = 0;

    if (kind === ENEMY_KIND.KATANA_BOSS) {
      this.maxHealth = 980; this.height = 3.35; this.radius = 0.92; this.hipY = 1.62;
    } else if (kind === ENEMY_KIND.OBSIDIAN_STALKER) {
      this.maxHealth = 130; this.height = 1.95; this.radius = 0.44; this.hipY = 0.94;
    } else if (kind === ENEMY_KIND.HOLO_STRIDER) {
      this.maxHealth = 85;  this.height = 1.84; this.radius = 0.40; this.hipY = 0.94;
    } else {
      this.maxHealth = 115; this.height = 1.90; this.radius = 0.44; this.hipY = 0.94;
    }
    this.health = this.maxHealth;

    this.fireCooldown = 0.5 + Math.random() * 0.9;
    this.dashCooldown = 4.5;
    this.dashTimer = 0.0;
    this.dashDir = new THREE.Vector3(0, 0, 1);
    this.strafeSign = Math.random() > 0.5 ? 1 : -1;
    this.strafeTimer = 1.8 + Math.random();
    this.animPhase = Math.random() * Math.PI * 2;
    this.hitFlashTimer = 0.0;
    this.summonedEscorts = false;

    this.group = new THREE.Group();
    this.group.position.copy(this.position);

    this.rigRoot = new THREE.Group();
    this.rigRoot.position.y = this.hipY;
    this.group.add(this.rigRoot);

    this.leftLeg = new THREE.Group();
    this.rightLeg = new THREE.Group();
    this.rightArm = new THREE.Group();
    this.rigRoot.add(this.leftLeg, this.rightLeg, this.rightArm);

    this.meshes = [];
    this.origMaterials = [];
    this.flashMat = mats.getEmissive('enemy_hit_flash', 0xffaa44, 3.2);

    this._buildRig(mats);
  }

  _addPart(parent, geom, mat, pos, rot = null) {
    const m = new THREE.Mesh(geom, mat);
    m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    this.meshes.push(m);
    this.origMaterials.push(mat);
    return m;
  }

  _buildRig(mats) {
    const mWhite  = mats.getPBR('bot_white', 'mech_armor', { color: PALETTE.pureWhite, hasMetallic: true, roughness: 0.85 });
    const mDark   = mats.getPBR('bot_dark', 'dark_titanium', { color: 0xc2ccdc, hasMetallic: true, roughness: 0.88 });
    const mCrim   = mats.getPBR('bot_crimson', 'mech_armor', { color: PALETTE.signalCrimson, hasMetallic: true, roughness: 0.85 });
    const mOrange = mats.getPBR('bot_orange', 'mech_armor', { color: PALETTE.safetyOrange, hasMetallic: true, roughness: 0.85 });
    const mVisorO = mats.getEmissive('visor_o', PALETTE.safetyOrange, 3.6);
    const mVisorR = mats.getEmissive('visor_r', PALETTE.signalCrimson, 4.0);
    const mVisorC = mats.getEmissive('visor_c', PALETTE.holoCyan, 3.8);
    const mHolo   = mats.getHoloConstruct('strider_holo', PALETTE.holoCoral);

    const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
    const cap = (r, len) => new THREE.CapsuleGeometry(r, Math.max(0.02, len - r * 2), 6, 12);
    const sph = (r) => new THREE.SphereGeometry(r, 16, 12);

    if (this.kind === ENEMY_KIND.OPTIC_ANDROID) {
      // White Ceramic & Carbon Android with Glowing Orange Circular Side-Optics (chassis-orange-optic-android-02.jpg)
      this.leftLeg.position.set(-0.14, 0, 0);
      this.rightLeg.position.set( 0.14, 0, 0);
      this.rightArm.position.set( 0.31, 0.54, 0);

      this._addPart(this.rigRoot, box(0.32, 0.18, 0.22), mDark, [0, 0.06, 0]);
      this._addPart(this.rigRoot, cap(0.11, 0.36), mDark, [0, 0.28, 0]);
      this._addPart(this.rigRoot, box(0.46, 0.38, 0.28), mWhite, [0, 0.50, 0]);
      this._addPart(this.rigRoot, box(0.30, 0.06, 0.25), mOrange, [0, 0.70, 0]);
      this._addPart(this.rigRoot, sph(0.12), mWhite, [-0.30, 0.56, 0]);
      this._addPart(this.rigRoot, sph(0.12), mWhite, [ 0.30, 0.56, 0]);
      this._addPart(this.rigRoot, cap(0.055, 0.38), mDark, [-0.31, 0.30, -0.08], [0.38, 0, 0]);

      this._addPart(this.rigRoot, sph(0.145), mDark, [0, 0.89, -0.02]);
      const ringGeom = new THREE.TorusGeometry(0.06, 0.016, 10, 20);
      ringGeom.rotateY(Math.PI * 0.5);
      this._addPart(this.rigRoot, ringGeom, mVisorO, [-0.135, 0.89, -0.01]);
      this._addPart(this.rigRoot, ringGeom, mVisorO, [ 0.135, 0.89, -0.01]);
      this._addPart(this.rigRoot, box(0.17, 0.045, 0.04), mVisorO, [0, 0.89, -0.145]);

      for (const leg of [this.leftLeg, this.rightLeg]) {
        this._addPart(leg, cap(0.075, 0.44), mWhite, [0, -0.22, 0]);
        this._addPart(leg, sph(0.065), mOrange, [0, -0.45, 0]);
        this._addPart(leg, cap(0.065, 0.42), mDark, [0, -0.68, 0.01]);
        this._addPart(leg, box(0.14, 0.08, 0.24), mWhite, [0, -0.90, -0.04]);
      }

      this._addPart(this.rightArm, cap(0.055, 0.34), mDark, [0, -0.14, -0.14], [1.15, 0, 0]);
      this._addPart(this.rightArm, box(0.08, 0.12, 0.50), mDark, [0, -0.20, -0.42]);
      this._addPart(this.rightArm, box(0.09, 0.035, 0.28), mVisorO, [0, -0.16, -0.50]);

    } else if (this.kind === ENEMY_KIND.HOLO_STRIDER) {
      // Agile Coral Holo-Runner with Aero-Ears & Cyan Blade (glitch-coral-holo-runner-19.jpg)
      this.leftLeg.position.set(-0.12, 0, 0);
      this.rightLeg.position.set( 0.12, 0, 0);
      this.rightArm.position.set( 0.26, 0.48, 0);

      this._addPart(this.rigRoot, box(0.28, 0.18, 0.18), mDark, [0, 0.08, 0]);
      this._addPart(this.rigRoot, box(0.40, 0.42, 0.22), mHolo, [0, 0.44, -0.02], [0.12, 0, 0]);
      this._addPart(this.rigRoot, sph(0.13), mWhite, [0, 0.82, -0.03]);
      this._addPart(this.rigRoot, box(0.18, 0.07, 0.04), mVisorC, [0, 0.82, -0.15]);
      this._addPart(this.rigRoot, box(0.03, 0.24, 0.13), mHolo, [-0.13, 0.90, 0.06], [-0.45, 0, 0]);
      this._addPart(this.rigRoot, box(0.03, 0.24, 0.13), mHolo, [ 0.13, 0.90, 0.06], [-0.45, 0, 0]);

      for (const leg of [this.leftLeg, this.rightLeg]) {
        this._addPart(leg, cap(0.062, 0.46), mHolo, [0, -0.24, 0]);
        this._addPart(leg, cap(0.050, 0.46), mWhite, [0, -0.68, 0.02]);
      }

      this._addPart(this.rightArm, cap(0.05, 0.32), mDark, [0, -0.16, -0.16], [1.0, 0, 0]);
      this._addPart(this.rightArm, box(0.03, 0.07, 0.66), mVisorC, [0, -0.22, -0.52]);

    } else if (this.kind === ENEMY_KIND.OBSIDIAN_STALKER) {
      // Winged Obsidian Sniper with Crimson Visor (stealth-black-winged-stalker-10.jpg)
      this.leftLeg.position.set(-0.13, 0, 0);
      this.rightLeg.position.set( 0.13, 0, 0);
      this.rightArm.position.set( 0.27, 0.52, 0);

      this._addPart(this.rigRoot, box(0.32, 0.18, 0.20), mDark, [0, 0.08, 0]);
      this._addPart(this.rigRoot, box(0.44, 0.46, 0.26), mDark, [0, 0.48, 0]);
      this._addPart(this.rigRoot, box(0.05, 0.52, 0.24), mDark, [-0.28, 0.64, 0.16], [0, 0, 0.38]);
      this._addPart(this.rigRoot, box(0.05, 0.52, 0.24), mDark, [ 0.28, 0.64, 0.16], [0, 0, -0.38]);
      this._addPart(this.rigRoot, box(0.25, 0.27, 0.27), mDark, [0, 0.86, 0]);
      this._addPart(this.rigRoot, box(0.21, 0.045, 0.03), mVisorR, [0, 0.85, -0.14]);

      for (const leg of [this.leftLeg, this.rightLeg]) {
        this._addPart(leg, cap(0.068, 0.88), mDark, [0, -0.45, 0]);
      }

      this._addPart(this.rightArm, box(0.08, 0.11, 0.96), mDark, [0, -0.15, -0.48]);
      this._addPart(this.rightArm, box(0.09, 0.03, 0.54), mVisorR, [0, -0.12, -0.68]);

    } else {
      // BOSS: Towering 3.4m HIR-00 White Katana Samurai Mech (boss-white-katana-mech-01.jpg)
      this.leftLeg.position.set(-0.28, 0, 0);
      this.rightLeg.position.set( 0.28, 0, 0);
      this.rightArm.position.set( 0.68, 0.80, 0);

      this._addPart(this.rigRoot, box(0.68, 0.34, 0.46), mDark, [0, 0.16, 0]);
      this._addPart(this.rigRoot, box(0.28, 0.38, 0.10), mWhite, [0, 0.04, -0.25]);
      this._addPart(this.rigRoot, box(0.09, 0.36, 0.09), mCrim, [-0.24, 0.12, -0.23]);
      this._addPart(this.rigRoot, box(0.09, 0.36, 0.09), mCrim, [ 0.24, 0.12, -0.23]);

      this._addPart(this.rigRoot, box(0.94, 0.70, 0.58), mWhite, [0, 0.68, 0]);
      this._addPart(this.rigRoot, box(0.56, 0.40, 0.14), mWhite, [0, 0.72, -0.31]);
      this._addPart(this.rigRoot, box(0.22, 0.06, 0.04), mVisorR, [0, 0.76, -0.39]);
      this._addPart(this.rigRoot, box(0.68, 0.24, 0.50), mCrim, [0, 1.09, 0.04]);

      this._addPart(this.rigRoot, box(0.40, 0.36, 0.54), mWhite, [-0.68, 0.88, 0], [0, 0, 0.18]);
      this._addPart(this.rigRoot, box(0.40, 0.36, 0.54), mWhite, [ 0.68, 0.88, 0], [0, 0, -0.18]);
      this._addPart(this.rigRoot, cap(0.13, 0.66), mWhite, [-0.70, 0.42, -0.14], [0.32, 0, 0]);

      this._addPart(this.rigRoot, sph(0.19), mWhite, [0, 1.32, -0.04]);
      this._addPart(this.rigRoot, box(0.26, 0.06, 0.04), mVisorR, [0, 1.30, -0.23]);
      this._addPart(this.rigRoot, box(0.04, 0.24, 0.08), mWhite, [-0.18, 1.46, -0.12], [0, 0, 0.45]);
      this._addPart(this.rigRoot, box(0.04, 0.24, 0.08), mWhite, [ 0.18, 1.46, -0.12], [0, 0, -0.45]);

      // Twin Crossed Katanas on Back
      this._addPart(this.rigRoot, box(0.06, 1.05, 0.08), mDark, [ 0.26, 1.30, 0.35], [0, 0, -0.32]);
      this._addPart(this.rigRoot, box(0.07, 0.40, 0.09), mWhite, [ 0.44, 1.72, 0.35], [0, 0, -0.32]);
      this._addPart(this.rigRoot, box(0.06, 1.05, 0.08), mDark, [-0.18, 1.30, 0.37], [0, 0, 0.28]);
      this._addPart(this.rigRoot, box(0.07, 0.40, 0.09), mCrim, [-0.34, 1.72, 0.37], [0, 0, 0.28]);

      for (const leg of [this.leftLeg, this.rightLeg]) {
        this._addPart(leg, cap(0.17, 0.78), mWhite, [0, -0.38, 0]);
        this._addPart(leg, sph(0.14), mDark, [0, -0.78, -0.03]);
        this._addPart(leg, cap(0.16, 0.78), mWhite, [0, -1.18, 0.02]);
        this._addPart(leg, box(0.36, 0.16, 0.54), mWhite, [0, -1.56, -0.08]);
      }

      this._addPart(this.rightArm, cap(0.13, 0.62), mWhite, [0, -0.26, -0.18], [0.95, 0, 0]);
      this._addPart(this.rightArm, box(0.08, 0.08, 0.38), mDark, [0, -0.44, -0.48]);
      this._addPart(this.rightArm, box(0.035, 0.11, 1.62), mWhite, [0, -0.44, -1.38]);
      this._addPart(this.rightArm, box(0.042, 0.038, 1.64), mVisorR, [0, -0.48, -1.40]);
    }
  }

  triggerHitFlash() {
    this.hitFlashTimer = 0.10;
    for (let i = 0; i < this.meshes.length; i++) {
      this.meshes[i].material = this.flashMat;
    }
  }

  updateVisuals(dt, moveSpeed) {
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
      if (this.hitFlashTimer <= 0) {
        for (let i = 0; i < this.meshes.length; i++) {
          this.meshes[i].material = this.origMaterials[i];
        }
      }
    }

    this.animPhase += dt * Math.max(1.8, moveSpeed * 1.45);
    const swing = Math.sin(this.animPhase) * (this.kind === ENEMY_KIND.OBSIDIAN_STALKER ? 0.22 : 0.56);
    const bob = Math.abs(Math.cos(this.animPhase)) * 0.045;

    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
    this.rigRoot.position.y = this.hipY + bob;
    this.leftLeg.rotation.x = swing;
    this.rightLeg.rotation.x = -swing;
    this.rightArm.rotation.x = (this.kind === ENEMY_KIND.KATANA_BOSS && this.dashTimer > 0)
      ? Math.sin(this.dashTimer * 18.0) * 0.90
      : 0.0;
  }

  getBoundingBox() {
    return new THREE.Box3(
      new THREE.Vector3(this.position.x - this.radius, this.position.y, this.position.z - this.radius),
      new THREE.Vector3(this.position.x + this.radius, this.position.y + this.height, this.position.z + this.radius)
    );
  }
}

// 3D PBR First-Person Weapon & Cyber-Katana Viewmodel Rig
export class WeaponRig {
  constructor(mats) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.02, 5.0);

    const amb = new THREE.HemisphereLight(0xeef6ff, 0x263042, 1.1);
    const dir = new THREE.DirectionalLight(0xffffff, 1.8);
    dir.position.set(1.5, 3.0, 2.0);
    this.muzzleLight = new THREE.PointLight(PALETTE.holoCyan, 0.0, 3.5);
    this.muzzleLight.position.set(0.24, -0.15, -0.82);
    this.scene.add(amb, dir, this.muzzleLight);

    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);

    const mWhite  = mats.getPBR('wpn_white', 'mech_armor', { color: PALETTE.pureWhite, hasMetallic: true, roughness: 0.80 });
    const mDark   = mats.getPBR('wpn_dark', 'dark_titanium', { color: 0xd0daea, hasMetallic: true, roughness: 0.84 });
    const mOrange = mats.getPBR('wpn_orange', 'mech_armor', { color: PALETTE.safetyOrange, hasMetallic: true, roughness: 0.82 });
    const mCobalt = mats.getPBR('wpn_cobalt', 'mech_armor', { color: PALETTE.cobaltBlue, hasMetallic: true, roughness: 0.82 });
    const mCyanE  = mats.getEmissive('wpn_cyan_e', PALETTE.holoCyan, 3.2);
    const mOrgE   = mats.getEmissive('wpn_org_e', PALETTE.safetyOrange, 3.2);

    const addPart = (grp, pos, sz, mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sz[0], sz[1], sz[2]), mat);
      m.position.set(pos[0], pos[1], pos[2]);
      grp.add(m);
    };

    // HIR-01 Pulse Rifle
    this.pulseGroup = new THREE.Group();
    this.pulseGroup.position.set(0.24, -0.22, -0.42);
    addPart(this.pulseGroup, [0, 0, 0], [0.082, 0.115, 0.54], mWhite);
    addPart(this.pulseGroup, [0, -0.045, 0.04], [0.072, 0.09, 0.36], mDark);
    addPart(this.pulseGroup, [0, 0.035, -0.16], [0.090, 0.055, 0.28], mOrange);
    addPart(this.pulseGroup, [0, 0.075, 0.02], [0.048, 0.028, 0.22], mDark);
    addPart(this.pulseGroup, [0, 0.088, 0.02], [0.022, 0.012, 0.14], mCyanE);
    addPart(this.pulseGroup, [0, 0.01, -0.36], [0.032, 0.032, 0.22], mDark);
    this.pivot.add(this.pulseGroup);

    // HIR-02 Twin-Rail Scattergun
    this.railGroup = new THREE.Group();
    this.railGroup.position.set(0.24, -0.22, -0.42);
    this.railGroup.visible = false;
    addPart(this.railGroup, [0, -0.01, 0.02], [0.118, 0.13, 0.50], mDark);
    addPart(this.railGroup, [-0.042, 0.025, -0.20], [0.030, 0.065, 0.52], mWhite);
    addPart(this.railGroup, [ 0.042, 0.025, -0.20], [0.030, 0.065, 0.52], mWhite);
    addPart(this.railGroup, [0, 0.025, -0.22], [0.040, 0.032, 0.44], mOrgE);
    addPart(this.railGroup, [0, 0.068, 0.04], [0.080, 0.024, 0.20], mCobalt);
    this.pivot.add(this.railGroup);

    // Cyber-Katana Sweep Blade
    this.katanaGroup = new THREE.Group();
    this.katanaGroup.visible = false;
    addPart(this.katanaGroup, [0, 0, 0.16], [0.034, 0.034, 0.26], mDark);
    addPart(this.katanaGroup, [0, 0, -0.42], [0.015, 0.052, 0.94], mWhite);
    addPart(this.katanaGroup, [0, -0.028, -0.44], [0.018, 0.018, 0.96], mCyanE);
    this.pivot.add(this.katanaGroup);
  }

  setAspect(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  setWeapon(isPulse) {
    this.pulseGroup.visible = isPulse;
    this.railGroup.visible = !isPulse;
  }

  update(bobTime, bobWeight, recoil, reloadTimer, katanaSlashAnim, muzzleFlashTimer) {
    this.muzzleLight.intensity = muzzleFlashTimer > 0 ? 5.0 : 0.0;
    const swayX = Math.sin(bobTime) * 0.012 * bobWeight;
    const swayY = Math.abs(Math.cos(bobTime)) * -0.010 * bobWeight;
    const dip = reloadTimer > 0 ? -0.14 : 0.0;
    this.pivot.position.set(swayX, swayY + dip, recoil * 0.055);
    this.pivot.rotation.x = recoil * 0.13;

    if (katanaSlashAnim > 0.01) {
      this.katanaGroup.visible = true;
      const t = 1.0 - katanaSlashAnim;
      this.katanaGroup.position.set(0.38 + (-0.44 - 0.38) * t, -0.12, -0.48);
      this.katanaGroup.rotation.set(0.25, -0.95 + 2.0 * t, -0.55);
    } else {
      this.katanaGroup.visible = false;
    }
  }
}
