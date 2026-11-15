import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PALETTE } from './materials.js';

export const ENEMY_KIND = {
  OPTIC_ANDROID:    'OPTIC_ANDROID',
  HOLO_STRIDER:     'HOLO_STRIDER',
  OBSIDIAN_STALKER: 'OBSIDIAN_STALKER',
  KATANA_BOSS:      'KATANA_BOSS'
};

function makeContactShadowMat() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv * 2.0 - 1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        float r = length(vUv);
        float core = exp(-r * r * 5.2);
        float soft = smoothstep(1.0, 0.15, r);
        float a = clamp(core * 0.86 + soft * soft * 0.34, 0.0, 0.96);
        gl_FragColor = vec4(0.005, 0.008, 0.016, a);
      }
    `
  });
}

let _contactShadowMat = null;

export class RobotEnemy {
  constructor(kind, sector, pos, mats) {
    this.kind = kind;
    this.sector = sector;
    this.position = pos.clone();
    this.yaw = 0;

    if (kind === ENEMY_KIND.KATANA_BOSS) {
      this.maxHealth = 980; this.height = 3.35; this.radius = 0.92; this.hipY = 1.66;
    } else if (kind === ENEMY_KIND.OBSIDIAN_STALKER) {
      this.maxHealth = 130; this.height = 1.95; this.radius = 0.44; this.hipY = 0.97;
    } else if (kind === ENEMY_KIND.HOLO_STRIDER) {
      this.maxHealth = 85;  this.height = 1.84; this.radius = 0.40; this.hipY = 0.97;
    } else {
      this.maxHealth = 115; this.height = 1.90; this.radius = 0.44; this.hipY = 0.97;
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
    const uvAttr = geom.attributes?.uv;
    if (uvAttr && !geom.userData._uvScaled) {
      for (let i = 0; i < uvAttr.count; i++) {
        uvAttr.setXY(i, uvAttr.getX(i) * 2.4, uvAttr.getY(i) * 2.4);
      }
      uvAttr.needsUpdate = true;
      geom.userData._uvScaled = true;
    }
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
    const ceramic = { hasMetallic: true, roughness: 0.46, clearcoat: 0.24, clearcoatRoughness: 0.22, normalScale: 1.75, envMapIntensity: 1.75, microScale: 0.08 };
    const mWhite  = mats.getPBR('bot_white', 'mech_armor', { ...ceramic, color: PALETTE.pureWhite });
    const mDark   = mats.getPBR('bot_dark', 'dark_titanium', { color: 0xd8e2f0, hasMetallic: true, roughness: 0.64, clearcoat: 0.22, normalScale: 1.65, envMapIntensity: 2.1, microScale: 0.09 });
    const mGunmetal = mats.getPBR('bot_gunmetal', 'dark_titanium', { color: 0xdce6f4, hasMetallic: false, metalness: 0.48, roughness: 0.40, albedoBoost: 2.35, normalScale: 1.65, envMapIntensity: 1.85, microScale: 0.08 });
    const mCrim   = mats.getPBR('bot_crimson', 'mech_armor', { ...ceramic, color: 0xb8101e, roughness: 0.40, clearcoat: 0.34 });
    const mOrange = mats.getPBR('bot_orange', 'mech_armor', { ...ceramic, color: PALETTE.safetyOrange });
    const mVisorO = mats.getEmissive('visor_o', PALETTE.safetyOrange, 1.45);
    const mVisorR = mats.getEmissive('visor_r', PALETTE.signalCrimson, 1.45);
    const mVisorC = mats.getEmissive('visor_c', PALETTE.holoCyan, 1.45);
    const mHolo   = mats.getHoloConstruct('strider_holo', 0xf41e58, 0.06);

    // Soft grounded contact shadow disc + per-foot contact patches under every unit (renders above floor reflectors)
    if (!_contactShadowMat) _contactShadowMat = makeContactShadowMat();
    const shR = this.kind === ENEMY_KIND.KATANA_BOSS ? 2.05 : 1.05;
    const contactDisc = new THREE.Mesh(new THREE.PlaneGeometry(shR * 2, shR * 2), _contactShadowMat);
    contactDisc.rotation.x = -Math.PI * 0.5;
    contactDisc.position.y = 0.031;
    contactDisc.renderOrder = 3;
    contactDisc.userData.noDepthPrepass = true;
    this.group.add(contactDisc);
    const footR = this.kind === ENEMY_KIND.KATANA_BOSS ? 0.52 : 0.27;
    const footSep = this.kind === ENEMY_KIND.KATANA_BOSS ? 0.34 : 0.17;
    this.footSep = footSep;
    this.footDiscs = [];
    for (const fx of [-footSep, footSep]) {
      const fDisc = new THREE.Mesh(new THREE.PlaneGeometry(footR * 2, footR * 2.2), _contactShadowMat);
      fDisc.rotation.x = -Math.PI * 0.5;
      fDisc.position.set(fx, 0.034, 0);
      fDisc.renderOrder = 3;
      fDisc.userData.noDepthPrepass = true;
      this.group.add(fDisc);
      this.footDiscs.push(fDisc);
    }

    const box = (x, y, z, r = 0.022) => {
      const safeR = Math.min(r, x * 0.3, y * 0.3, z * 0.3);
      return safeR > 0.004 ? new RoundedBoxGeometry(x, y, z, 3, safeR) : new THREE.BoxGeometry(x, y, z);
    };
    const cyl = (rt, rb, h, seg = 24) => new THREE.CylinderGeometry(rt, rb, h, seg);
    const cap = (r, len) => new THREE.CapsuleGeometry(r, Math.max(0.02, len - r * 2), 10, 24);
    const sph = (r) => new THREE.SphereGeometry(r, 24, 20);
    const lathe = (pts, seg = 28) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

    if (this.kind === ENEMY_KIND.OPTIC_ANDROID) {
      // Sculpted Ceramic & Carbon Tactical Android with Contoured Torso, Bent-Knee Stance & Side-Optics
      this.leftLeg.position.set(-0.14, 0, 0);
      this.rightLeg.position.set( 0.14, 0, 0);
      this.rightArm.position.set( 0.31, 0.54, 0);

      this._addPart(this.rigRoot, lathe([[0.09, -0.05], [0.16, 0.03], [0.17, 0.12], [0.12, 0.18]], 24), mDark, [0, 0.02, 0]);
      this._addPart(this.rigRoot, cyl(0.13, 0.11, 0.24, 20), mDark, [0, 0.26, 0]);
      const chest = lathe([[0.12, -0.20], [0.18, -0.08], [0.27, 0.10], [0.25, 0.22], [0.15, 0.26]], 28);
      chest.scale(1.04, 1.0, 0.68);
      this._addPart(this.rigRoot, chest, mWhite, [0, 0.52, 0]);
      this._addPart(this.rigRoot, box(0.24, 0.19, 0.14, 0.032), mDark, [0, 0.52, -0.10]);
      this._addPart(this.rigRoot, cyl(0.18, 0.23, 0.09, 24), mOrange, [0, 0.72, 0]);
      this._addPart(this.rigRoot, box(0.22, 0.30, 0.16, 0.030), mGunmetal, [0, 0.54, 0.18]);
      this._addPart(this.rigRoot, cyl(0.008, 0.014, 0.38, 12), mOrange, [-0.10, 0.84, 0.22], [-0.15, 0, 0]);
      // Contoured dome shoulder pauldrons & elbow actuators
      const pauldron = lathe([[0.01, 0.10], [0.09, 0.08], [0.12, 0.0], [0.10, -0.10]], 20);
      this._addPart(this.rigRoot, pauldron, mWhite, [-0.30, 0.60, 0], [0, 0, 0.26]);
      this._addPart(this.rigRoot, pauldron, mWhite, [ 0.30, 0.60, 0], [0, 0, -0.26]);
      this._addPart(this.rigRoot, sph(0.082), mOrange, [-0.30, 0.54, 0]);
      this._addPart(this.rigRoot, sph(0.082), mOrange, [ 0.30, 0.54, 0]);
      // Left arm bent forward in tactical rifle-support pose
      this._addPart(this.rigRoot, cap(0.052, 0.32), mGunmetal, [-0.30, 0.38, -0.14], [0.92, 0, -0.35]);
      this._addPart(this.rigRoot, box(0.075, 0.09, 0.16, 0.022), mWhite, [-0.14, 0.33, -0.34], [0, -0.5, 0]);

      // Articulated neck joint & sleek angular tactical helmet cowl (replaces sphere head) + glowing side-optic rings
      this._addPart(this.rigRoot, cyl(0.065, 0.085, 0.16, 20), mDark, [0, 0.78, -0.01]);
      this._addPart(this.rigRoot, box(0.22, 0.22, 0.26, 0.045), mWhite, [0, 0.91, -0.02], [0.08, 0, 0]);
      this._addPart(this.rigRoot, box(0.18, 0.12, 0.18, 0.032), mDark, [0, 0.87, -0.08]);
      this._addPart(this.rigRoot, box(0.042, 0.06, 0.22, 0.014), mOrange, [0, 1.03, 0.0]);
      const ringGeom = new THREE.TorusGeometry(0.056, 0.014, 12, 28);
      ringGeom.rotateY(Math.PI * 0.5);
      this._addPart(this.rigRoot, ringGeom, mVisorO, [-0.118, 0.91, -0.02]);
      this._addPart(this.rigRoot, ringGeom, mVisorO, [ 0.118, 0.91, -0.02]);
      this._addPart(this.rigRoot, box(0.15, 0.034, 0.04, 0.010), mVisorO, [0, 0.91, -0.155]);
      this._addPart(this.rigRoot, box(0.20, 0.040, 0.04, 0.012), mVisorO, [0, 0.54, -0.18]);

      for (const leg of [this.leftLeg, this.rightLeg]) {
        this._addPart(leg, cap(0.082, 0.44), mWhite, [0, -0.22, -0.035], [0.16, 0, 0]);
        this._addPart(leg, box(0.11, 0.22, 0.08, 0.020), mDark, [0, -0.22, -0.09], [0.16, 0, 0]);
        this._addPart(leg, sph(0.068), mGunmetal, [0, -0.45, -0.072]);
        this._addPart(leg, box(0.115, 0.11, 0.06, 0.018), mOrange, [0, -0.44, -0.125]);
        this._addPart(leg, cap(0.058, 0.44), mGunmetal, [0, -0.68, -0.02], [-0.24, 0, 0]);
        this._addPart(leg, box(0.085, 0.26, 0.06, 0.018), mWhite, [0, -0.68, -0.065], [-0.24, 0, 0]);
        this._addPart(leg, box(0.14, 0.09, 0.24, 0.025), mWhite, [0, -0.90, -0.01]);
      }

      this._addPart(this.rightArm, cap(0.052, 0.34), mGunmetal, [0, -0.14, -0.14], [1.15, 0, 0]);
      this._addPart(this.rightArm, box(0.075, 0.11, 0.52, 0.020), mWhite, [0, -0.20, -0.44]);
      this._addPart(this.rightArm, box(0.082, 0.032, 0.32, 0.010), mVisorO, [0, -0.16, -0.52]);

    } else if (this.kind === ENEMY_KIND.HOLO_STRIDER) {
      // Sleek Sculpted Cyber-Runner with Articulated Ceramic/Gunmetal Limbs, Coral Holo-Mantle & Twin Cyan Blades
      this.leftLeg.position.set(-0.14, 0, 0);
      this.rightLeg.position.set( 0.14, 0, 0);
      this.rightArm.position.set( 0.27, 0.48, 0);

      this._addPart(this.rigRoot, lathe([[0.09, -0.05], [0.15, 0.04], [0.15, 0.12], [0.11, 0.17]], 24), mGunmetal, [0, 0.04, 0]);
      this._addPart(this.rigRoot, cyl(0.11, 0.10, 0.22, 20), mDark, [0, 0.24, 0]);
      const torso = lathe([[0.11, -0.18], [0.16, -0.04], [0.23, 0.12], [0.21, 0.22], [0.13, 0.26]], 28);
      torso.scale(1.0, 1.0, 0.65);
      this._addPart(this.rigRoot, torso, mHolo, [0, 0.46, -0.02], [0.10, 0, 0]);
      this._addPart(this.rigRoot, box(0.22, 0.16, 0.20, 0.032), mWhite, [0, 0.54, -0.03]);
      this._addPart(this.rigRoot, box(0.14, 0.05, 0.04, 0.012), mVisorC, [0, 0.54, -0.14]);
      this._addPart(this.rigRoot, sph(0.095), mWhite, [-0.26, 0.56, 0]);
      this._addPart(this.rigRoot, sph(0.095), mWhite, [ 0.26, 0.56, 0]);
      // Articulated neck + sleek swept tactical recon helmet + glowing visor
      this._addPart(this.rigRoot, cyl(0.06, 0.08, 0.14, 20), mDark, [0, 0.74, -0.02]);
      this._addPart(this.rigRoot, box(0.19, 0.20, 0.25, 0.042), mWhite, [0, 0.85, -0.03], [0.12, 0, 0]);
      this._addPart(this.rigRoot, box(0.16, 0.040, 0.05, 0.012), mVisorC, [0, 0.85, -0.15]);
      this._addPart(this.rigRoot, cyl(0.012, 0.045, 0.26, 16), mHolo, [-0.11, 0.95, 0.08], [-0.55, 0, 0.16]);
      this._addPart(this.rigRoot, cyl(0.012, 0.045, 0.26, 16), mHolo, [ 0.11, 0.95, 0.08], [-0.55, 0, -0.16]);
      // Left arm + twin cyan forearm blade
      this._addPart(this.rigRoot, cap(0.048, 0.32), mGunmetal, [-0.27, 0.34, -0.14], [1.0, 0, 0]);
      this._addPart(this.rigRoot, box(0.024, 0.050, 0.58, 0.008), mVisorC, [-0.27, 0.26, -0.46]);

      for (const leg of [this.leftLeg, this.rightLeg]) {
        this._addPart(leg, cap(0.072, 0.44), mGunmetal, [0, -0.22, -0.035], [0.16, 0, 0]);
        this._addPart(leg, sph(0.058), mHolo, [0, -0.45, -0.072]);
        this._addPart(leg, cap(0.050, 0.44), mWhite, [0, -0.68, -0.02], [-0.24, 0, 0]);
        this._addPart(leg, box(0.125, 0.085, 0.23, 0.024), mGunmetal, [0, -0.90, -0.01]);
      }

      this._addPart(this.rightArm, cap(0.048, 0.32), mGunmetal, [0, -0.16, -0.16], [1.0, 0, 0]);
      this._addPart(this.rightArm, box(0.024, 0.055, 0.64, 0.008), mVisorC, [0, -0.22, -0.52]);

    } else if (this.kind === ENEMY_KIND.OBSIDIAN_STALKER) {
      // High-Contrast Obsidian-Charcoal & Crimson Recon Sniper with Contoured Armor & Bent-Knee Stance
      this.leftLeg.position.set(-0.14, 0, 0);
      this.rightLeg.position.set( 0.14, 0, 0);
      this.rightArm.position.set( 0.28, 0.52, 0);

      this._addPart(this.rigRoot, lathe([[0.09, -0.05], [0.16, 0.04], [0.16, 0.12], [0.11, 0.17]], 24), mDark, [0, 0.04, 0]);
      const stTorso = lathe([[0.12, -0.20], [0.17, -0.06], [0.25, 0.12], [0.23, 0.22], [0.14, 0.26]], 28);
      stTorso.scale(1.0, 1.0, 0.68);
      this._addPart(this.rigRoot, stTorso, mDark, [0, 0.50, 0]);
      this._addPart(this.rigRoot, lathe([[0.16, -0.06], [0.25, 0.0], [0.22, 0.08], [0.15, 0.10]], 24), mCrim, [0, 0.68, 0]);
      this._addPart(this.rigRoot, box(0.20, 0.045, 0.04, 0.012), mVisorR, [0, 0.54, -0.15]);
      // Sleek chamfered rear thruster pods & dark-obsidian shoulder armor
      this._addPart(this.rigRoot, box(0.11, 0.36, 0.14, 0.028), mDark, [-0.14, 0.56, 0.18], [-0.12, 0, 0.08]);
      this._addPart(this.rigRoot, box(0.11, 0.36, 0.14, 0.028), mDark, [ 0.14, 0.56, 0.18], [-0.12, 0, -0.08]);
      this._addPart(this.rigRoot, box(0.03, 0.22, 0.04, 0.008), mVisorR, [-0.14, 0.56, 0.25], [-0.12, 0, 0.08]);
      this._addPart(this.rigRoot, box(0.03, 0.22, 0.04, 0.008), mVisorR, [ 0.14, 0.56, 0.25], [-0.12, 0, -0.08]);
      this._addPart(this.rigRoot, sph(0.115), mDark, [-0.28, 0.58, 0]);
      this._addPart(this.rigRoot, sph(0.115), mDark, [ 0.28, 0.58, 0]);
      this._addPart(this.rigRoot, cap(0.042, 0.34), mDark, [-0.28, 0.36, -0.10], [0.65, 0, 0]);

      // Articulated armored neck collar & sleek angular obsidian/crimson recon visor cowl
      this._addPart(this.rigRoot, cyl(0.072, 0.095, 0.16, 20), mDark, [0, 0.76, -0.01]);
      this._addPart(this.rigRoot, box(0.21, 0.20, 0.27, 0.042), mDark, [0, 0.88, -0.02], [0.10, 0, 0]);
      this._addPart(this.rigRoot, box(0.18, 0.038, 0.05, 0.010), mVisorR, [0, 0.88, -0.15]);
      this._addPart(this.rigRoot, box(0.04, 0.05, 0.22, 0.014), mCrim, [0, 0.99, 0.0]);

      for (const leg of [this.leftLeg, this.rightLeg]) {
        this._addPart(leg, cap(0.076, 0.44), mDark, [0, -0.22, -0.035], [0.16, 0, 0]);
        this._addPart(leg, box(0.095, 0.22, 0.06, 0.018), mGunmetal, [0, -0.22, 0.02], [0.16, 0, 0]);
        this._addPart(leg, sph(0.066), mCrim, [0, -0.45, -0.072]);
        this._addPart(leg, cap(0.056, 0.44), mDark, [0, -0.68, -0.02], [-0.24, 0, 0]);
        this._addPart(leg, box(0.088, 0.30, 0.055, 0.018), mWhite, [0, -0.68, -0.068], [-0.24, 0, 0]);
        this._addPart(leg, box(0.030, 0.20, 0.025, 0.008), mVisorR, [0, -0.68, -0.095], [-0.24, 0, 0]);
        this._addPart(leg, box(0.135, 0.09, 0.24, 0.025), mDark, [0, -0.90, -0.01]);
      }

      this._addPart(this.rightArm, box(0.07, 0.10, 0.92, 0.022), mDark, [0, -0.15, -0.46]);
      this._addPart(this.rightArm, box(0.08, 0.028, 0.52, 0.008), mVisorR, [0, -0.12, -0.66]);

    } else {
      // BOSS: Towering 3.4m Sculpted HIR-00 White Katana Samurai Mech (fully curved hard-surface Lathe/Extrude shells, zero boxy slabs)
      this.leftLeg.position.set(-0.28, 0, 0);
      this.rightLeg.position.set( 0.28, 0, 0);
      this.rightArm.position.set( 0.68, 0.80, 0);

      // Sculpted contoured pelvis, segmented abdominal rings & flared elliptical samurai kusazuri skirt armor
      this._addPart(this.rigRoot, lathe([[0.18, -0.10], [0.34, 0.04], [0.32, 0.18], [0.22, 0.26]], 32), mDark, [0, 0.12, 0]);
      for (const ry of [0.24, 0.33, 0.42]) {
        const ring = new THREE.TorusGeometry(0.23, 0.048, 14, 32);
        ring.rotateX(Math.PI * 0.5);
        ring.scale(1.05, 1.0, 0.78);
        this._addPart(this.rigRoot, ring, mGunmetal, [0, ry, 0]);
      }
      const skirt = lathe([[0.28, 0.16], [0.36, 0.06], [0.44, -0.14], [0.40, -0.18]], 32);
      skirt.scale(1.12, 1.0, 0.78);
      this._addPart(this.rigRoot, skirt, mCrim, [0, 0.06, 0]);
      const skirtTrim = lathe([[0.27, 0.14], [0.33, 0.04], [0.38, -0.16]], 24);
      skirtTrim.scale(0.55, 1.0, 0.86);
      this._addPart(this.rigRoot, skirtTrim, mWhite, [0, 0.04, -0.05]);

      // Sculpted Samurai Chest Carapace (smooth 32-segment LatheGeometry breastplate + contoured crimson cuirass + collar cowl)
      const bossChest = lathe([[0.22, -0.32], [0.34, -0.16], [0.54, 0.10], [0.50, 0.28], [0.30, 0.36]], 32);
      bossChest.scale(1.06, 1.0, 0.64);
      this._addPart(this.rigRoot, bossChest, mWhite, [0, 0.72, 0]);
      const bossPlate = lathe([[0.16, -0.20], [0.30, -0.02], [0.34, 0.14], [0.20, 0.22]], 32);
      bossPlate.scale(1.12, 1.0, 0.44);
      this._addPart(this.rigRoot, bossPlate, mCrim, [0, 0.74, -0.26]);
      const coreRing = new THREE.TorusGeometry(0.11, 0.022, 14, 32);
      this._addPart(this.rigRoot, coreRing, mVisorR, [0, 0.78, -0.38]);
      this._addPart(this.rigRoot, sph(0.065), mDark, [0, 0.78, -0.38]);
      this._addPart(this.rigRoot, lathe([[0.28, -0.06], [0.34, 0.0], [0.26, 0.09], [0.18, 0.12]], 32), mDark, [0, 1.08, 0.02]);

      // Sculpted double-tiered curved Samurai Shoulder Pauldrons (sode) + articulated left arm
      const pauldronOuter = lathe([[0.02, 0.20], [0.22, 0.14], [0.32, -0.04], [0.35, -0.24], [0.28, -0.27]], 32);
      pauldronOuter.scale(1.06, 1.0, 0.86);
      const pauldronUpper = lathe([[0.02, 0.12], [0.18, 0.09], [0.27, 0.0], [0.24, -0.05]], 28);
      pauldronUpper.scale(1.08, 1.0, 0.88);
      this._addPart(this.rigRoot, pauldronOuter, mCrim, [-0.66, 0.92, 0], [0, 0, 0.28]);
      this._addPart(this.rigRoot, pauldronOuter, mCrim, [ 0.66, 0.92, 0], [0, 0, -0.28]);
      this._addPart(this.rigRoot, pauldronUpper, mWhite, [-0.66, 1.02, 0], [0, 0, 0.28]);
      this._addPart(this.rigRoot, pauldronUpper, mWhite, [ 0.66, 1.02, 0], [0, 0, -0.28]);
      this._addPart(this.rigRoot, cap(0.115, 0.44), mWhite, [-0.68, 0.54, -0.06], [0.38, 0, -0.12]);
      this._addPart(this.rigRoot, cap(0.098, 0.42), mDark,  [-0.58, 0.36, -0.28], [1.12, 0, 0.22]);
      this._addPart(this.rigRoot, sph(0.115), mDark, [-0.66, 0.72, -0.02]);
      this._addPart(this.rigRoot, sph(0.105), mGunmetal, [-0.50, 0.24, -0.44]);

      // Sculpted Samurai Kabuto Helmet with angular armored faceplate, flared shikoro cowl, recessed visor & sweeping kuwagata crest
      this._addPart(this.rigRoot, box(0.30, 0.28, 0.34, 0.058), mWhite, [0, 1.37, -0.03], [0.06, 0, 0]);
      this._addPart(this.rigRoot, box(0.24, 0.14, 0.24, 0.035), mDark, [0, 1.30, -0.09]);
      const kabutoFlap = lathe([[0.15, 0.14], [0.23, 0.04], [0.30, -0.11], [0.25, -0.14]], 32);
      kabutoFlap.scale(1.1, 1.0, 0.95);
      this._addPart(this.rigRoot, kabutoFlap, mDark, [0, 1.33, 0.03]);
      this._addPart(this.rigRoot, box(0.22, 0.042, 0.06, 0.012), mVisorR, [0, 1.35, -0.20]);
      const hornShape = new THREE.Shape();
      hornShape.moveTo(0.0, 0.0);
      hornShape.quadraticCurveTo(0.14, 0.12, 0.26, 0.34);
      hornShape.quadraticCurveTo(0.10, 0.18, -0.03, 0.06);
      hornShape.closePath();
      const hornGeo = new THREE.ExtrudeGeometry(hornShape, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 2, curveSegments: 16 });
      hornGeo.translate(0, 0, -0.009);
      this._addPart(this.rigRoot, hornGeo, mWhite, [0.03, 1.44, -0.18], [-0.22, 0, -0.08]);
      const hornGeoL = hornGeo.clone();
      hornGeoL.rotateY(Math.PI);
      this._addPart(this.rigRoot, hornGeoL, mWhite, [-0.03, 1.44, -0.18], [-0.22, 0, 0.08]);
      // Glowing crimson halo ring mounted cleanly behind shoulders
      this._addPart(this.rigRoot, new THREE.TorusGeometry(0.32, 0.016, 16, 48), mVisorR, [0, 1.44, 0.36]);

      // Twin Crossed Scabbards cleanly mounted on back
      this._addPart(this.rigRoot, cyl(0.035, 0.045, 1.08, 16), mDark, [ 0.24, 1.30, 0.38], [0, 0, -0.32]);
      this._addPart(this.rigRoot, cyl(0.038, 0.038, 0.38, 16), mWhite, [ 0.41, 1.72, 0.38], [0, 0, -0.32]);
      this._addPart(this.rigRoot, cyl(0.035, 0.045, 1.08, 16), mDark, [-0.18, 1.30, 0.40], [0, 0, 0.28]);
      this._addPart(this.rigRoot, cyl(0.038, 0.038, 0.38, 16), mCrim, [-0.33, 1.72, 0.40], [0, 0, 0.28]);

      // Sculpted LatheGeometry articulated legs (contoured thigh armor, domed knee guard, tapered calf greaves & curved saber-toe boots)
      const thighShell = lathe([[0.12, -0.36], [0.16, -0.16], [0.20, 0.10], [0.15, 0.34]], 24);
      const shinShell = lathe([[0.10, -0.36], [0.14, -0.10], [0.16, 0.14], [0.12, 0.34]], 24);
      const bootShell = lathe([[0.14, -0.08], [0.18, -0.02], [0.13, 0.06], [0.08, 0.10]], 24);
      bootShell.scale(0.95, 1.0, 1.65);
      for (const leg of [this.leftLeg, this.rightLeg]) {
        this._addPart(leg, thighShell, mWhite, [0, -0.39, -0.055], [0.14, 0, 0]);
        this._addPart(leg, cap(0.11, 0.62), mGunmetal, [0, -0.38, -0.085], [0.14, 0, 0]);
        this._addPart(leg, sph(0.14), mDark, [0, -0.79, -0.11]);
        this._addPart(leg, sph(0.115), mCrim, [0, -0.78, -0.18]);
        this._addPart(leg, shinShell, mWhite, [0, -1.18, -0.025], [-0.22, 0, 0]);
        this._addPart(leg, cap(0.095, 0.60), mGunmetal, [0, -1.16, -0.065], [-0.22, 0, 0]);
        this._addPart(leg, bootShell, mWhite, [0, -1.58, -0.04]);
      }

      // Sculpted 2-segment weapon arm + contoured armored gauntlet + tsuba guard + smooth curved ExtrudeGeometry Katana
      this._addPart(this.rightArm, cap(0.12, 0.34), mWhite, [0, -0.14, -0.04], [0.25, 0, 0]);
      this._addPart(this.rightArm, sph(0.105), mDark, [0, -0.28, -0.09]);
      this._addPart(this.rightArm, cap(0.105, 0.36), mWhite, [0, -0.35, -0.26], [1.22, 0, 0]);
      this._addPart(this.rightArm, cyl(0.105, 0.105, 0.08, 24), mCrim, [0, -0.39, -0.39], [1.22, 0, 0]);
      // Sculpted rounded armored fist gripping the katana hilt
      this._addPart(this.rightArm, sph(0.105), mWhite, [0, -0.41, -0.45]);
      this._addPart(this.rightArm, cap(0.075, 0.18), mGunmetal, [0, -0.42, -0.46], [Math.PI * 0.5, 0, 0]);
      // Tsuka (hilt) extending cleanly through the closed gauntlet + prominent metallic Tsuba guard flush against knuckles
      this._addPart(this.rightArm, cyl(0.052, 0.052, 0.44, 20), mGunmetal, [0, -0.41, -0.40], [Math.PI * 0.5, 0, 0]);
      this._addPart(this.rightArm, cyl(0.058, 0.058, 0.055, 20), mOrange, [0, -0.41, -0.19], [Math.PI * 0.5, 0, 0]);
      this._addPart(this.rightArm, cyl(0.145, 0.145, 0.048, 24), mOrange, [0, -0.41, -0.57], [Math.PI * 0.5, 0, 0]);
      this._addPart(this.rightArm, cyl(0.105, 0.105, 0.062, 24), mCrim, [0, -0.41, -0.57], [Math.PI * 0.5, 0, 0]);

      // Single continuous gracefully curved Katana blade (1.18m balanced proportion, gleaming silver-steel spine + crimson plasma edge)
      const bladeShape = new THREE.Shape();
      bladeShape.moveTo(0.0, -0.042);
      bladeShape.quadraticCurveTo(0.60, -0.028, 1.18, 0.072);
      bladeShape.lineTo(1.09, 0.114);
      bladeShape.quadraticCurveTo(0.56, 0.046, 0.0, 0.042);
      bladeShape.closePath();
      const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
        depth: 0.024,
        bevelEnabled: true,
        bevelThickness: 0.008,
        bevelSize: 0.008,
        bevelSegments: 2,
        curveSegments: 24
      });
      bladeGeo.translate(0, 0, -0.012);
      bladeGeo.rotateY(Math.PI * 0.5);
      this._addPart(this.rightArm, bladeGeo, mWhite, [0, -0.41, -0.57]);

      const edgeShape = new THREE.Shape();
      edgeShape.moveTo(0.0, -0.045);
      edgeShape.quadraticCurveTo(0.60, -0.032, 1.18, 0.072);
      edgeShape.lineTo(1.13, 0.088);
      edgeShape.quadraticCurveTo(0.58, -0.010, 0.0, -0.018);
      edgeShape.closePath();
      const edgeGeo = new THREE.ExtrudeGeometry(edgeShape, {
        depth: 0.026,
        bevelEnabled: true,
        bevelThickness: 0.004,
        bevelSize: 0.004,
        bevelSegments: 2,
        curveSegments: 24
      });
      edgeGeo.translate(0, 0, -0.013);
      edgeGeo.rotateY(Math.PI * 0.5);
      const mBladeGlow = mats.getEmissive('boss_blade_edge', PALETTE.signalCrimson, 0.92);
      this._addPart(this.rightArm, edgeGeo, mBladeGlow, [0, -0.41, -0.57]);
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

    this.animPhase += dt * Math.max(0.0, moveSpeed * 1.45);
    const moveFactor = Math.min(1.0, moveSpeed / 2.2);
    const maxSwing = this.kind === ENEMY_KIND.OBSIDIAN_STALKER ? 0.18 : 0.42;
    const swing = Math.sin(this.animPhase) * maxSwing * moveFactor;
    const bob = Math.abs(Math.cos(this.animPhase)) * 0.035 * moveFactor;

    // Natural athletic combat idle stance with grounded feet & subtle per-unit asymmetry
    const idleStride = this.kind === ENEMY_KIND.KATANA_BOSS ? 0.10 : 0.09;
    const stanceSpread = this.kind === ENEMY_KIND.KATANA_BOSS ? 0.10 : 0.05;
    const idleLean = this.kind === ENEMY_KIND.HOLO_STRIDER ? 0.14 : (this.kind === ENEMY_KIND.KATANA_BOSS ? 0.05 : 0.04);
    const twistDir = Math.sin(this.animPhase) >= 0 ? 1 : -1;

    this.group.position.copy(this.position);
    this.group.rotation.y = this.yaw;
    this.rigRoot.position.y = this.hipY + bob - (1.0 - moveFactor) * (this.kind === ENEMY_KIND.KATANA_BOSS ? 0.07 : 0.035);
    this.rigRoot.rotation.x = idleLean;
    const legPitchL = -idleStride * (1.0 - moveFactor) * twistDir + swing;
    const legPitchR = idleStride * (1.0 - moveFactor) * twistDir - swing;
    this.leftLeg.rotation.set(legPitchL, 0, -stanceSpread);
    this.rightLeg.rotation.set(legPitchR, 0, stanceSpread);
    const rootYaw = this.kind === ENEMY_KIND.KATANA_BOSS
      ? (1.0 - moveFactor) * 0.18
      : (1.0 - moveFactor) * 0.14 * twistDir;
    this.rigRoot.rotation.y = rootYaw;
    if (this.footDiscs && this.footDiscs.length === 2) {
      const legLen = this.hipY;
      const cosY = Math.cos(rootYaw), sinY = Math.sin(rootYaw);
      const lx0 = -this.footSep - Math.sin(stanceSpread) * legLen * 0.5;
      const lz0 = Math.sin(legPitchL) * legLen * 0.85;
      const rx0 = this.footSep + Math.sin(stanceSpread) * legLen * 0.5;
      const rz0 = Math.sin(legPitchR) * legLen * 0.85;
      this.footDiscs[0].position.x = lx0 * cosY + lz0 * sinY;
      this.footDiscs[0].position.z = -lx0 * sinY + lz0 * cosY;
      this.footDiscs[1].position.x = rx0 * cosY + rz0 * sinY;
      this.footDiscs[1].position.z = -rx0 * sinY + rz0 * cosY;
    }
    if (this.kind === ENEMY_KIND.KATANA_BOSS) {
      // Natural samurai ready guard: well-proportioned sword angled forward-outward (clear of head & clearly gripped)
      this.rigRoot.rotation.y = (1.0 - moveFactor) * 0.18;
      this.rightArm.rotation.set(
        this.dashTimer > 0 ? Math.sin(this.dashTimer * 18.0) * 0.90 : 0.28,
        this.dashTimer > 0 ? 0.0 : -0.16,
        this.dashTimer > 0 ? 0.0 : -0.16
      );
    } else {
      this.rightArm.rotation.x = 0.0;
    }
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

    const amb = new THREE.HemisphereLight(0xf0f6ff, 0x3b485e, 1.35);
    const dir = new THREE.DirectionalLight(0xffffff, 2.0);
    dir.position.set(1.5, 3.0, 2.0);
    const rim = new THREE.DirectionalLight(0x88ccff, 1.1);
    rim.position.set(-2.0, 1.2, -1.8);
    this.muzzleLight = new THREE.PointLight(PALETTE.holoCyan, 0.0, 3.5);
    this.muzzleLight.position.set(0.24, -0.15, -0.82);
    this.scene.add(amb, dir, rim, this.muzzleLight);

    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);

    const ceramic = { hasMetallic: true, roughness: 0.48, clearcoat: 0.45, clearcoatRoughness: 0.14, envMapIntensity: 1.85 };
    const mWhite  = mats.getPBR('wpn_white', 'mech_armor', { ...ceramic, color: PALETTE.pureWhite });
    const mDark   = mats.getPBR('wpn_dark', 'dark_titanium', { color: 0xdce4f2, hasMetallic: true, roughness: 0.68, clearcoat: 0.30, envMapIntensity: 2.35 });
    const mOrange = mats.getPBR('wpn_orange', 'mech_armor', { ...ceramic, color: PALETTE.safetyOrange });
    const mCobalt = mats.getPBR('wpn_cobalt', 'mech_armor', { ...ceramic, color: PALETTE.cobaltBlue });
    const mCyanE  = mats.getEmissive('wpn_cyan_e', PALETTE.holoCyan, 1.12);
    const mOrgE   = mats.getEmissive('wpn_org_e', PALETTE.safetyOrange, 1.12);

    const addPart = (grp, pos, sz, mat, radius = 0.010, rot = null) => {
      const safeR = Math.min(radius, sz[0] * 0.3, sz[1] * 0.3, sz[2] * 0.3);
      const geom = safeR > 0.002
        ? mats._applyWorldBoxUVs(new RoundedBoxGeometry(sz[0], sz[1], sz[2], 2, safeR), sz[0], sz[1], sz[2], 0.5)
        : mats.makeWorldBoxGeometry(sz[0], sz[1], sz[2], 0.5);
      const m = new THREE.Mesh(geom, mat);
      m.position.set(pos[0], pos[1], pos[2]);
      if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
      grp.add(m);
      return m;
    };

    // HIR-01 Pulse Rifle (sculpted chamfered chassis, recessed optic rail, cooling vents, cylindrical barrel)
    this.pulseGroup = new THREE.Group();
    this.pulseGroup.position.set(0.27, -0.24, -0.46);
    this.pulseGroup.scale.setScalar(0.84);
    addPart(this.pulseGroup, [0, 0, 0.02], [0.078, 0.106, 0.52], mWhite, 0.012);
    addPart(this.pulseGroup, [0, -0.044, 0.05], [0.068, 0.082, 0.36], mDark, 0.010);
    addPart(this.pulseGroup, [0, 0.030, -0.15], [0.084, 0.048, 0.27], mOrange, 0.010);
    // Angled handguard cheek & side cooling fins
    addPart(this.pulseGroup, [0, -0.012, -0.20], [0.082, 0.036, 0.20], mDark, 0.008);
    for (let v = 0; v < 4; v++) {
      addPart(this.pulseGroup, [-0.043, 0.012, -0.04 - v * 0.042], [0.008, 0.022, 0.024], mDark, 0.002);
    }
    // Sleek holographic sight bridge + slim cyan optic strip (no chunky brick)
    addPart(this.pulseGroup, [0, 0.066, 0.02], [0.042, 0.022, 0.20], mDark, 0.006);
    addPart(this.pulseGroup, [-0.018, 0.082, 0.01], [0.006, 0.018, 0.09], mDark, 0.002);
    addPart(this.pulseGroup, [ 0.018, 0.082, 0.01], [0.006, 0.018, 0.09], mDark, 0.002);
    addPart(this.pulseGroup, [0, 0.078, 0.01], [0.024, 0.006, 0.15], mCyanE, 0.002);
    addPart(this.pulseGroup, [-0.040, 0.032, -0.15], [0.006, 0.010, 0.22], mCyanE, 0.002);
    // Cylindrical barrel & muzzle brake
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.017, 0.24, 14), mDark);
    barrel.rotation.x = Math.PI * 0.5;
    barrel.position.set(0, 0.012, -0.36);
    this.pulseGroup.add(barrel);
    addPart(this.pulseGroup, [0, 0.012, -0.47], [0.036, 0.036, 0.042], mDark, 0.006);
    this.pivot.add(this.pulseGroup);

    // HIR-02 Twin-Rail Scattergun
    this.railGroup = new THREE.Group();
    this.railGroup.position.set(0.27, -0.24, -0.46);
    this.railGroup.scale.setScalar(0.84);
    this.railGroup.visible = false;
    addPart(this.railGroup, [0, -0.012, 0.03], [0.114, 0.122, 0.48], mDark, 0.014);
    addPart(this.railGroup, [-0.040, 0.026, -0.19], [0.028, 0.058, 0.52], mWhite, 0.008);
    addPart(this.railGroup, [ 0.040, 0.026, -0.19], [0.028, 0.058, 0.52], mWhite, 0.008);
    addPart(this.railGroup, [0, 0.026, -0.21], [0.032, 0.024, 0.44], mOrgE, 0.004);
    addPart(this.railGroup, [0, 0.062, 0.05], [0.076, 0.022, 0.19], mCobalt, 0.006);
    addPart(this.railGroup, [0, -0.062, -0.06], [0.052, 0.032, 0.18], mOrange, 0.008);
    this.pivot.add(this.railGroup);

    // Cyber-Katana Sweep Blade
    this.katanaGroup = new THREE.Group();
    this.katanaGroup.visible = false;
    addPart(this.katanaGroup, [0, 0, 0.16], [0.032, 0.032, 0.26], mDark, 0.008);
    addPart(this.katanaGroup, [0, 0, 0.02], [0.056, 0.070, 0.018], mOrange, 0.004); // tsuba guard
    addPart(this.katanaGroup, [0, 0, -0.42], [0.012, 0.046, 0.94], mWhite, 0.004);
    addPart(this.katanaGroup, [0, -0.024, -0.44], [0.014, 0.012, 0.96], mCyanE, 0.003);
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
