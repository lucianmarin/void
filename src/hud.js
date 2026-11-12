import { ENEMY_KIND } from './entities.js';

export class HUDController {
  constructor() {
    this.fxTrauma = document.getElementById('fx-trauma');
    this.fxHeal   = document.getElementById('fx-heal');
    this.fxPortal = document.getElementById('fx-portal');

    this.realmBadge  = document.getElementById('realm-badge');
    this.realmCode   = document.getElementById('realm-code');
    this.realmTitle  = document.getElementById('realm-title');
    this.sectorTitle = document.getElementById('sector-title');
    this.waveBarsEl  = document.getElementById('telemetry-bars');

    this.objBox      = document.getElementById('objective-box');
    this.objText     = document.getElementById('objective-text');
    this.bossBox     = document.getElementById('boss-box');
    this.bossPct     = document.getElementById('boss-pct');
    this.bossFill    = document.getElementById('boss-bar-fill');
    this.bannerBox   = document.getElementById('status-banner');
    this.bannerText  = document.getElementById('banner-text');

    this.reticle     = document.getElementById('reticle');
    this.hitmarker   = document.getElementById('hitmarker');
    this.portalPrompt = document.getElementById('portal-prompt');

    this.critWarn    = document.getElementById('critical-warning');
    this.katanaStat  = document.getElementById('katana-status');
    this.hpValue     = document.getElementById('hp-value');
    this.hpSegsRoot  = document.getElementById('hp-segments');
    this.shieldFill  = document.getElementById('shield-fill');
    this.katanaFill  = document.getElementById('katana-fill');

    this.wpnHeader   = document.getElementById('weapon-header');
    this.ammoMag     = document.getElementById('ammo-mag');
    this.ammoRes     = document.getElementById('ammo-res');
    this.reloadLabel = document.getElementById('reload-label');
    this.ordBarcode  = document.getElementById('ord-barcode');
    this.pillPulse   = document.getElementById('pill-pulse');
    this.pillRail    = document.getElementById('pill-rail');

    this.radarCanvas = document.getElementById('radar-canvas');
    this.radarCtx    = this.radarCanvas.getContext('2d');

    this.waveSpans = [];
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('span');
      this.waveBarsEl.appendChild(s);
      this.waveSpans.push(s);
    }

    this.hpSegs = [];
    for (let i = 0; i < 12; i++) {
      const d = document.createElement('div');
      d.className = 'hp-seg filled';
      this.hpSegsRoot.appendChild(d);
      this.hpSegs.push(d);
    }
  }

  update(state) {
    const {
      inSkyTower, sectorNum, elapsedTime,
      health, maxHealth, shield, maxShield,
      katanaCooldown, katanaCooldownMax,
      isPulse, pulseMag, railMag, railReserve, reloadTimer, recoil,
      enemies, totalKills, victory, activeBoss,
      bannerText, bannerTimer, portalHint,
      hurtFlash, healPulse, portalFlash, hitMarkerTimer, hitMarkerCrit,
      playerPos, playerYaw, portals, sectorUnlocked, bioWellPos
    } = state;

    // 1. Fullscreen Atmospheric Vignettes
    const lowHPTrauma = (inSkyTower && health < 40) ? (1 - health / 40) * (0.55 + 0.25 * Math.sin(elapsedTime * 7)) : 0;
    this.fxTrauma.style.opacity = String(Math.min(0.92, Math.max(hurtFlash * 0.85, lowHPTrauma)));
    this.fxHeal.style.opacity   = String(Math.min(0.85, healPulse * 0.75));
    this.fxPortal.style.opacity = String(Math.min(0.90, portalFlash * 0.85));

    // 2. Top-Left Realm Telemetry
    this.realmBadge.className = `badge-block ${inSkyTower ? 'orange' : 'emerald'}`;
    this.realmCode.textContent = inSkyTower ? '001' : '000';
    this.realmTitle.textContent = inSkyTower ? 'CONSTRUCT // SKY.TOWER' : 'REALITY // VOID.PLANET';
    this.sectorTitle.style.color = inSkyTower ? '#ff6616' : '#24f5a8';
    if (!inSkyTower) {
      this.sectorTitle.textContent = 'LOC // MEGASTRUCTURE SANCTUARY';
    } else {
      const sLabel = sectorNum === 1 ? 'SEC.01 COBALT ATRIUM' : (sectorNum === 2 ? 'SEC.02 CRIMSON CONCOURSE' : 'SEC.03 APEX SKY LOUNGE');
      this.sectorTitle.textContent = `LOC // ${sLabel}`;
    }

    for (let i = 0; i < this.waveSpans.length; i++) {
      const w = 0.3 + 0.7 * Math.abs(Math.sin(elapsedTime * 5.2 + i * 0.65));
      this.waveSpans[i].style.height = `${Math.round(3 + w * 13)}px`;
    }

    // 3. Top-Center Objective & Boss Bar
    if (activeBoss && inSkyTower) {
      this.bossBox.classList.remove('hidden');
      this.objBox.classList.add('hidden');
      const pct = Math.max(0, Math.min(1, activeBoss.health / activeBoss.maxHealth));
      this.bossPct.textContent = `${String(Math.round(pct * 100)).padStart(3, '0')}%`;
      this.bossFill.style.width = `${pct * 100}%`;
    } else {
      this.bossBox.classList.add('hidden');
      this.objBox.classList.remove('hidden');
      if (victory) {
        this.objText.textContent = `CONSTRUCT LIBERATED // ELIMINATED: ${String(totalKills).padStart(2, '0')}`;
      } else if (!inSkyTower) {
        this.objText.textContent = health < 99.5
          ? 'SANCTUARY // STEP IN EMERALD BIO-WELL TO HEAL'
          : 'VITALS OPTIMAL // ENTER PORTAL TO RESUME COMBAT';
      } else {
        this.objText.textContent = `HOSTILES ACTIVE: ${String(enemies.length).padStart(2, '0')}   //   ELIMINATED: ${String(totalKills).padStart(2, '0')}`;
      }
    }

    if (bannerTimer > 0) {
      this.bannerBox.style.opacity = String(Math.min(1, bannerTimer * 1.6));
      this.bannerText.textContent = bannerText;
    } else {
      this.bannerBox.style.opacity = '0';
    }

    // 4. Bottom-Left Bio Integrity
    const hpInt = Math.max(0, Math.ceil(health));
    const isCrit = health <= 36;
    this.hpValue.textContent = String(hpInt).padStart(3, '0');
    this.hpValue.style.color = isCrit ? '#ee1824' : '#ff6616';

    const filledCount = Math.round((health / maxHealth) * 12);
    for (let i = 0; i < 12; i++) {
      this.hpSegs[i].className = i < filledCount ? (isCrit ? 'hp-seg crit' : 'hp-seg filled') : 'hp-seg';
    }

    this.shieldFill.style.width = `${Math.max(0, Math.min(100, (shield / maxShield) * 100))}%`;
    const kdPct = 1 - Math.max(0, Math.min(1, katanaCooldown / katanaCooldownMax));
    this.katanaFill.style.width = `${kdPct * 100}%`;
    this.katanaStat.textContent = katanaCooldown <= 0.02
      ? 'KATANA [RMB/F]: READY'
      : `KATANA: ${katanaCooldown.toFixed(1)}S`;

    if (inSkyTower && health <= 40) {
      this.critWarn.classList.remove('hidden');
    } else {
      this.critWarn.classList.add('hidden');
    }

    // 5. Bottom-Right Ordnance
    this.wpnHeader.textContent = isPulse ? '002 // HIR-01 PULSE RIFLE' : '002 // HIR-02 RAIL SCATTER';
    this.ammoMag.textContent = String(isPulse ? pulseMag : railMag).padStart(2, '0');
    this.ammoRes.textContent = isPulse ? '/ INF' : `/ ${String(railReserve).padStart(2, '0')}`;
    this.pillPulse.classList.toggle('active', isPulse);
    this.pillRail.classList.toggle('active', !isPulse);
    this.reloadLabel.classList.toggle('hidden', reloadTimer <= 0);
    this.ordBarcode.classList.toggle('hidden', reloadTimer > 0);

    // 6. Reticle, Hitmarker & Portal Prompt
    const spreadPx = 6 + recoil * 11 + (isPulse ? 0 : 9);
    this.reticle.style.setProperty('--spread', `${spreadPx.toFixed(1)}px`);
    if (hitMarkerTimer > 0) {
      this.hitmarker.classList.remove('hidden');
      this.hitmarker.style.setProperty('--hm-color', hitMarkerCrit ? '#ee1824' : '#ff6616');
    } else {
      this.hitmarker.classList.add('hidden');
    }

    if (portalHint) {
      this.portalPrompt.classList.remove('hidden');
      this.portalPrompt.textContent = portalHint;
    } else {
      this.portalPrompt.classList.add('hidden');
    }

    // 7. Tactical Radar Canvas
    this._drawRadar(playerPos, playerYaw, inSkyTower, portals, sectorUnlocked, bioWellPos, enemies);
  }

  _drawRadar(playerPos, playerYaw, inSkyTower, portals, sectorUnlocked, bioWellPos, enemies) {
    const ctx = this.radarCtx;
    const w = this.radarCanvas.width;
    const h = this.radarCanvas.height;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const rMax = w * 0.42;

    ctx.clearRect(0, 0, w, h);

    // Grid & range rings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, rMax, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, rMax * 0.5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(14, cy); ctx.lineTo(w - 14, cy);
    ctx.moveTo(cx, 14); ctx.lineTo(cx, h - 14);
    ctx.stroke();

    // Player FOV Cone
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.30)';
    ctx.beginPath();
    ctx.moveTo(cx - 26, cy - 42);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + 26, cy - 42);
    ctx.stroke();

    const cosY = Math.cos(playerYaw);
    const sinY = Math.sin(playerYaw);
    const scale = rMax / 45.0;

    const plot = (wx, wz, color, sz, diamond = false) => {
      const dx = wx - playerPos.x;
      const dz = wz - playerPos.z;
      // Forward in Three.js YXZ at yaw is (-sin(yaw), 0, -cos(yaw)), Right is (cos(yaw), 0, -sin(yaw))
      const lx =  dx * cosY - dz * sinY;
      const lz =  dx * sinY + dz * cosY;
      let px = lx * scale;
      let py = lz * scale;
      const d = Math.hypot(px, py);
      if (d > rMax) {
        px = (px / d) * rMax;
        py = (py / d) * rMax;
      }
      ctx.fillStyle = color;
      if (diamond) {
        ctx.save();
        ctx.translate(cx + px, cy + py);
        ctx.rotate(Math.PI * 0.25);
        ctx.fillRect(-sz * 0.5, -sz * 0.5, sz, sz);
        ctx.restore();
      } else {
        ctx.fillRect(cx + px - sz * 0.5, cy + py - sz * 0.5, sz, sz);
      }
    };

    for (const p of portals) {
      if (!sectorUnlocked[p.index]) continue;
      const wp = inSkyTower ? p.skyPos : p.voidPos;
      plot(wp.x, wp.z, p.cssColor, 11, true);
    }

    if (!inSkyTower) {
      plot(bioWellPos.x, bioWellPos.z, '#24f5a8', 13, false);
    } else {
      for (const e of enemies) {
        const isBoss = e.kind === ENEMY_KIND.KATANA_BOSS;
        plot(e.position.x, e.position.z, isBoss ? '#ee1824' : '#ff6616', isBoss ? 14 : 9, isBoss);
      }
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 4, cy - 4, 8, 8);
  }
}
