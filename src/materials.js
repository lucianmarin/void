import * as THREE from 'three';

export const PALETTE = {
  pureWhite:     0xf8faff,
  boneWhite:     0xe9eef5,
  obsidian:      0x11141c,
  carbon:        0x222733,
  signalCrimson: 0xec1822,
  safetyOrange:  0xff6616,
  solarAmber:    0xffb60f,
  cobaltBlue:    0x215ce8,
  deepCobalt:    0x132c6e,
  holoCyan:      0x24e0ff,
  holoCoral:     0xff4472,
  bioEmerald:    0x24f5a8
};

export class MaterialLibrary {
  constructor(renderer) {
    this.renderer = renderer;
    this.loader = new THREE.TextureLoader();
    this.maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    this.texSets = {};
    this.matCache = new Map();
    this.timeUniform = { value: 0.0 };
  }

  _loadTex(path, isSRGB) {
    const tex = this.loader.load(path);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = this.maxAniso;
    tex.colorSpace = isSRGB ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    return tex;
  }

  getTexSet(prefix, hasMetallic = false) {
    if (this.texSets[prefix]) return this.texSets[prefix];
    const set = {
      map:          this._loadTex(`/textures/${prefix}_albedo.jpg`, true),
      normalMap:    this._loadTex(`/textures/${prefix}_normal.png`, false),
      roughnessMap: this._loadTex(`/textures/${prefix}_roughness.png`, false),
      metalnessMap: hasMetallic ? this._loadTex(`/textures/${prefix}_metallic.png`, false) : null
    };
    this.texSets[prefix] = set;
    return set;
  }

  getPBR(key, prefix, opts = {}) {
    if (this.matCache.has(key)) return this.matCache.get(key);
    const set = this.getTexSet(prefix, Boolean(opts.hasMetallic));
    const mat = new THREE.MeshStandardMaterial({
      color: opts.color ?? 0xffffff,
      map: set.map,
      normalMap: set.normalMap,
      normalScale: new THREE.Vector2(opts.normalScale ?? 1.0, opts.normalScale ?? 1.0),
      roughnessMap: set.roughnessMap,
      roughness: opts.roughness ?? 1.0,
      metalnessMap: set.metalnessMap,
      metalness: opts.hasMetallic ? 1.0 : (opts.metalness ?? 0.05),
      envMapIntensity: opts.envMapIntensity ?? 1.15
    });
    this.matCache.set(key, mat);
    return mat;
  }

  getEmissive(key, hexColor, intensity = 2.6) {
    if (this.matCache.has(key)) return this.matCache.get(key);
    const col = new THREE.Color(hexColor);
    const mat = new THREE.MeshStandardMaterial({
      color: col,
      emissive: col,
      emissiveIntensity: intensity,
      roughness: 0.18,
      metalness: 0.1
    });
    this.matCache.set(key, mat);
    return mat;
  }

  getGlass(key, hexColor = 0x9ad4ff, opacity = 0.24) {
    if (this.matCache.has(key)) return this.matCache.get(key);
    const mat = new THREE.MeshStandardMaterial({
      color: hexColor,
      transparent: true,
      opacity,
      roughness: 0.06,
      metalness: 0.15,
      envMapIntensity: 1.6,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.matCache.set(key, mat);
    return mat;
  }

  // Scanline hologram; `glitch` adds horizontal slice-tearing (glitch-coral-holo-runner-19 / phase-neon-pixel-strider-20)
  getHoloConstruct(key, hexColor, glitch = 0.0) {
    if (this.matCache.has(key)) return this.matCache.get(key);
    const col = new THREE.Color(hexColor);
    const mat = new THREE.MeshStandardMaterial({
      color: col,
      emissive: col,
      emissiveIntensity: 1.8,
      transparent: true,
      opacity: 0.62,
      roughness: 0.12,
      side: THREE.DoubleSide
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.timeUniform;
      shader.uniforms.uGlitch = { value: glitch };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          uniform float uTime;
          uniform float uGlitch;
          varying float vHoloY;
          float holoHash(float n) { return fract(sin(n) * 43758.5453); }`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float hWorldY = (modelMatrix * vec4(transformed, 1.0)).y;
          float hSlice = floor(hWorldY * 11.0);
          float hTick = floor(uTime * 8.0);
          float hOn = step(0.82, holoHash(hSlice * 17.13 + hTick * 3.71));
          transformed.x += hOn * (holoHash(hSlice + hTick) - 0.5) * 0.16 * uGlitch;
          vHoloY = hWorldY;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform float uTime;
          varying float vHoloY;`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float hScan = 0.55 + 0.45 * step(0.45, fract(vHoloY * 38.0 - uTime * 1.6));
          float hBand = smoothstep(0.93, 1.0, fract(vHoloY * 0.45 - uTime * 0.55));
          diffuseColor.a *= hScan * (0.85 + hBand * 0.6);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance *= 0.75 + 0.35 * hScan + hBand * 1.6;`);
    };
    mat.customProgramCacheKey = () => `holo_${glitch}`;
    this.matCache.set(key, mat);
    return mat;
  }

  // World-space UV BoxGeometry so 1K PBR tiles never stretch regardless of wall/floor dimensions!
  makeWorldBoxGeometry(sx, sy, sz, metersPerTile = 4.0) {
    const geom = new THREE.BoxGeometry(sx, sy, sz);
    const pos = geom.attributes.position;
    const norm = geom.attributes.normal;
    const uv = geom.attributes.uv;
    const invScale = 1.0 / metersPerTile;

    for (let i = 0; i < pos.count; i++) {
      const nx = Math.abs(norm.getX(i));
      const ny = Math.abs(norm.getY(i));
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);

      if (ny > 0.7) {
        uv.setXY(i, (x + sx * 0.5) * invScale, (z + sz * 0.5) * invScale);
      } else if (nx > 0.7) {
        uv.setXY(i, (z + sz * 0.5) * invScale, (y + sy * 0.5) * invScale);
      } else {
        uv.setXY(i, (x + sx * 0.5) * invScale, (y + sy * 0.5) * invScale);
      }
    }
    uv.needsUpdate = true;
    return geom;
  }

  // Custom Sky Tower Dome Shader (Azure zenith -> White Mega City mist + Giant Crimson Sun + Construct dome lattice)
  createSkyTowerDome() {
    const geom = new THREE.SphereGeometry(920, 48, 32);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTime: this.timeUniform
      },
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uTime;
        varying vec3 vDir;

        float h11(float n) { return fract(sin(n * 127.1) * 43758.5453); }

        // Procedural distant skyline: returns building-top elevation (in dir.y units) for an azimuth
        float skyline(float az, float cells, float seed, float minH, float maxH) {
          float x = az / 6.2831853 * cells;
          float i = floor(x);
          float r = h11(i + seed);
          float gap = step(0.22, h11(i * 1.7 + seed * 3.1));
          float h = mix(minH, maxH, r * r * r) * gap;
          // occasional needle spire on top of a tower
          float f = fract(x);
          float needle = step(0.93, h11(i + seed * 7.7)) * step(abs(f - 0.5), 0.07) * maxH * 0.9;
          return max(h, needle);
        }

        void main() {
          vec3 dir = normalize(vDir);
          float up = clamp(dir.y, 0.0, 1.0);
          vec3 zenith = vec3(0.11, 0.39, 0.90);
          vec3 horizon = vec3(0.92, 0.96, 1.00);
          vec3 col = mix(horizon, zenith, pow(up, 0.52));

          // High thin cirrus streaks
          if (dir.y > 0.04) {
            vec2 cuv = dir.xz / (dir.y + 0.25);
            float cir = sin(cuv.x * 3.1 + sin(cuv.y * 1.7) * 1.6 + uTime * 0.02) * sin(cuv.y * 0.9 - cuv.x * 0.4);
            col = mix(col, vec3(0.97, 0.98, 1.0), smoothstep(0.55, 1.0, cir) * 0.22 * smoothstep(0.04, 0.3, dir.y));
          }

          // Iconic Giant Crimson Sun disc (silhouette-crimson-sun-spire-04.jpg)
          vec3 sunDir = normalize(vec3(0.36, 0.13, -0.92));
          float scos = dot(dir, sunDir);
          float disc = smoothstep(0.9912, 0.9926, scos);
          float halo = pow(clamp(scos, 0.0, 1.0), 26.0) * 0.32;
          col += vec3(1.0, 0.24, 0.16) * halo;
          col = mix(col, vec3(1.55, 0.08, 0.12), disc * smoothstep(-0.06, 0.02, dir.y));

          // Layered bone-white megacity silhouettes fading into horizon mist (massing-white-city-grid-02 / perspective-bonewhite-canyon-plaza-08)
          float az = atan(dir.z, dir.x);
          float farH  = skyline(az, 260.0, 3.0, 0.004, 0.045);
          float nearH = skyline(az + 0.37, 140.0, 11.0, 0.002, 0.075);
          vec3 farCol  = vec3(0.80, 0.86, 0.94);
          vec3 nearCol = vec3(0.70, 0.76, 0.86);
          float hz = dir.y + 0.015;
          col = mix(col, farCol, step(hz, farH) * 0.55 * smoothstep(-0.02, 0.0, dir.y));
          float nearMask = step(hz, nearH);
          float facade = 0.94 + 0.06 * step(0.5, fract(dir.y * 900.0));
          col = mix(col, nearCol * facade, nearMask * 0.75 * smoothstep(-0.02, 0.0, dir.y));

          // Monumental spire silhouetted beside the crimson sun
          float sunAz = atan(sunDir.z, sunDir.x) - 0.045;
          float da = abs(az - sunAz);
          float spireH = clamp(dir.y / 0.24, 0.0, 1.0);
          float spireW = mix(0.016, 0.0012, pow(spireH, 0.7));
          float spire = step(da, spireW) * step(dir.y, 0.24) * step(-0.02, dir.y);
          col = mix(col, vec3(0.62, 0.66, 0.74), spire * 0.92);

          if (dir.y < 0.06) {
            float mist = smoothstep(0.06, -0.20, dir.y);
            col = mix(col, vec3(0.96, 0.98, 1.0), mist * 0.95);
          }

          // Subtle Construct dome grid
          if (dir.y > 0.16) {
            vec2 duv = dir.xz / (dir.y + 0.35) * 9.5;
            vec2 g = abs(fract(duv) - 0.5);
            float line = smoothstep(0.47, 0.498, max(g.x, g.y));
            float pulse = 0.5 + 0.5 * sin(uTime * 1.5 - length(duv) * 0.7);
            col += vec3(0.18, 0.80, 1.0) * line * 0.09 * pulse * smoothstep(0.16, 0.65, dir.y);
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    return new THREE.Mesh(geom, mat);
  }

  // Custom Void Planet Dome Shader (Overcast storm clouds + Twin-Planet Eclipse corona)
  createVoidPlanetDome() {
    const geom = new THREE.SphereGeometry(460, 48, 32);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTime: this.timeUniform
      },
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uTime;
        varying vec3 vDir;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
            mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }
        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
          for (int i = 0; i < 5; i++) {
            v += a * vnoise(p);
            p = rot * p * 2.02 + vec2(13.7, 29.3);
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 dir = normalize(vDir);
          float up = clamp(dir.y, 0.0, 1.0);
          vec3 zenith = vec3(0.035, 0.05, 0.095);
          vec3 horizon = vec3(0.22, 0.31, 0.36);
          vec3 col = mix(horizon, zenith, pow(up, 0.55));

          // Sparse star field visible through the cloud breaks
          if (dir.y > 0.04) {
            vec2 suv = dir.xz / (dir.y + 0.45) * 170.0;
            vec2 cell = floor(suv);
            float sh = hash21(cell);
            float d = length(fract(suv) - 0.5 - (vec2(hash21(cell + 7.1), hash21(cell + 3.3)) - 0.5) * 0.6);
            float tw = 0.65 + 0.35 * sin(uTime * (1.5 + sh * 3.0) + sh * 40.0);
            col += vec3(0.85, 0.92, 1.0) * step(0.9965, sh) * smoothstep(0.12, 0.0, d) * tw * smoothstep(0.04, 0.4, dir.y);
          }

          // Pale banded gas giant rising on the horizon, lit as a crescent
          vec3 gDir = normalize(vec3(0.60, 0.21, -0.77));
          float gR = 0.20;
          vec3 gRight = normalize(cross(vec3(0.0, 1.0, 0.0), gDir));
          vec3 gUp = cross(gDir, gRight);
          vec2 q = vec2(dot(dir, gRight), dot(dir, gUp)) / sin(gR);
          float qd = length(q);
          float gFront = step(0.0, dot(dir, gDir));
          if (qd < 1.25 && gFront > 0.5) {
            vec3 n = vec3(q, sqrt(max(0.0, 1.0 - qd * qd)));
            vec3 L = normalize(vec3(-0.85, 0.30, 0.35));
            float lit = smoothstep(-0.08, 0.55, dot(n, L));
            float lat = q.y * 0.94 + q.x * 0.22;
            float bands = fbm(vec2(lat * 9.0, q.x * 0.8 + uTime * 0.004)) * 0.7 + 0.3 * sin(lat * 31.0);
            vec3 gCol = mix(vec3(0.42, 0.40, 0.42), vec3(0.88, 0.80, 0.68), smoothstep(0.25, 0.85, bands));
            gCol = gCol * lit * 0.95 + vec3(0.35, 0.65, 0.70) * pow(1.0 - n.z, 3.0) * lit * 0.6;
            float diskA = smoothstep(1.0, 0.985, qd);
            col = mix(col, gCol + col * 0.18, diskA);
            float atm = smoothstep(1.25, 1.0, qd) * (1.0 - diskA);
            col += vec3(0.30, 0.55, 0.62) * atm * 0.22 * smoothstep(-0.3, 0.6, dot(normalize(q), normalize(L.xy)));
          }

          if (dir.y > -0.04) {
            vec2 cuv = dir.xz / max(0.13, dir.y + 0.16) * 1.3 + vec2(uTime * 0.01, -uTime * 0.007);
            float c1 = fbm(cuv);
            float c2 = fbm(cuv * 2.4 - vec2(uTime * 0.014, 0.0));
            float cloud = smoothstep(0.38, 0.86, c1 * 0.65 + c2 * 0.35);
            vec3 cloudCol = mix(vec3(0.09, 0.13, 0.18), vec3(0.42, 0.52, 0.58), cloud);
            col = mix(col, cloudCol, cloud * 0.72 * smoothstep(-0.02, 0.22, dir.y));
          } else {
            col = mix(horizon, vec3(0.05, 0.07, 0.10), smoothstep(0.0, -0.25, dir.y));
          }

          // Low teal mist band hugging the horizon (anomaly-glowing-red-monolith-14 / mystery-mist-triangle-artifact-15)
          col = mix(col, vec3(0.30, 0.42, 0.46), exp(-abs(dir.y) * 16.0) * 0.55);

          // Twin-Planet Eclipse silhouette & amber corona (eclipse-twin-planet-pyramid-09.jpg)
          vec3 pdir = normalize(vec3(-0.32, 0.36, -0.88));
          float pcos = dot(dir, pdir);
          float corona = pow(clamp(pcos, 0.0, 1.0), 40.0) * 0.55;
          float rim = smoothstep(0.9835, 0.9862, pcos) * (1.0 - smoothstep(0.9862, 0.9882, pcos));
          float body = smoothstep(0.9865, 0.9880, pcos);
          col += vec3(0.95, 0.54, 0.26) * corona * 0.45 + vec3(1.15, 0.68, 0.30) * rim * 1.2;
          col = mix(col, vec3(0.03, 0.04, 0.07), body * 0.92);

          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    return new THREE.Mesh(geom, mat);
  }

  // Bake PMREM IBL Environment Texture from Sky Dome!
  bakeEnvironmentFromDome(domeMesh) {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileCubemapShader();
    const envScene = new THREE.Scene();
    const clone = domeMesh.clone();
    envScene.add(clone);
    const rt = pmrem.fromScene(envScene, 0.02);
    pmrem.dispose();
    return rt.texture;
  }

  // Animated Reflective Void Ocean Material
  createVoidOceanMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: this.timeUniform
      },
      vertexShader: /* glsl */`
        uniform float uTime;
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          wp.y += sin(wp.x * 0.32 + uTime * 1.2) * cos(wp.z * 0.26 - uTime * 0.9) * 0.06;
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uTime;
        varying vec3 vWorldPos;
        void main() {
          vec2 p = vWorldPos.xz * 0.42;
          float n1 = sin(p.x * 2.9 + uTime * 1.35 + cos(p.y * 2.3 - uTime * 0.85));
          float n2 = cos(p.y * 4.5 - uTime * 1.65 + sin(p.x * 3.7 + uTime * 1.10));
          vec2 p2 = vWorldPos.xz * 1.7;
          float n3 = sin(p2.x * 1.3 - p2.y * 0.8 + uTime * 2.1) * cos(p2.y * 1.1 + uTime * 1.7);
          float n4 = sin(p2.y * 1.9 + p2.x * 0.6 - uTime * 2.4);
          float dist = length(vWorldPos - cameraPosition);
          float detail = 1.0 - smoothstep(20.0, 120.0, dist);
          vec3 N = normalize(vec3(n1 * 0.06 + n3 * 0.035 * detail, 1.0, n2 * 0.06 + n4 * 0.035 * detail));
          vec3 V = normalize(cameraPosition - vWorldPos);
          float fresnel = 0.02 + 0.98 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0);

          // Reflect the Void dome gradient (horizon -> zenith) so water and sky meet seamlessly
          vec3 R = reflect(-V, N);
          vec3 horizon = vec3(0.22, 0.31, 0.36);
          vec3 zenith = vec3(0.035, 0.05, 0.095);
          vec3 skyRefl = mix(horizon, zenith, pow(clamp(R.y, 0.0, 1.0), 0.55));
          skyRefl = mix(skyRefl, vec3(0.30, 0.42, 0.46), exp(-abs(R.y) * 16.0) * 0.55);

          // Glint path under the gas giant & the eclipse corona
          vec3 gDir = normalize(vec3(0.60, 0.21, -0.77));
          vec3 eDir = normalize(vec3(-0.32, 0.36, -0.88));
          vec3 glintCol = vec3(0.85, 0.78, 0.66) * pow(max(dot(R, gDir), 0.0), 180.0) * 1.4
                        + vec3(1.15, 0.68, 0.30) * pow(max(dot(R, eDir), 0.0), 300.0) * 1.8;

          vec3 deep = vec3(0.018, 0.035, 0.05);
          float sss = clamp(n1 * 0.5 + 0.5, 0.0, 1.0) * (1.0 - fresnel) * 0.05;
          vec3 col = deep + vec3(0.05, 0.16, 0.17) * sss;
          col = mix(col, skyRefl, clamp(fresnel, 0.0, 0.92)) + glintCol;

          float fog = 1.0 - exp(-pow(dist * 0.0042, 1.5));
          col = mix(col, horizon, clamp(fog, 0.0, 0.96));
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
  }

  // Faceted Crimson Wedge Colossus Material (1K PBR + Indigo-to-Crimson Vertical Gradient)
  createCrimsonWedgeMaterial() {
    const set = this.getTexSet('crimson_monolith', false);
    const mat = new THREE.MeshStandardMaterial({
      map: set.map,
      normalMap: set.normalMap,
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughnessMap: set.roughnessMap,
      roughness: 0.85,
      metalness: 0.08
    });
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldYPos;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldYPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldYPos;')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           float hGrad = clamp((vWorldYPos.y + 2.0) / 86.0, 0.0, 1.0);
           vec3 lowIndigo = vec3(0.16, 0.19, 0.34);
           vec3 midCoral  = vec3(0.86, 0.33, 0.31);
           vec3 topCrim   = vec3(0.98, 0.09, 0.12);
           vec3 wGrad = mix(lowIndigo, midCoral, smoothstep(0.0, 0.50, hGrad));
           wGrad = mix(wGrad, topCrim, smoothstep(0.46, 0.95, hGrad));
           diffuseColor.rgb *= wGrad * 1.18;`
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           float eGrad = smoothstep(0.55, 1.0, clamp((vWorldYPos.y + 2.0) / 86.0, 0.0, 1.0));
           totalEmissiveRadiance += vec3(0.98, 0.09, 0.12) * eGrad * 0.35;`
        );
    };
    return mat;
  }

  // Live See-Through Portal Aperture Shader
  createPortalApertureMaterial(portalRenderTexture, hexNeon) {
    const col = new THREE.Color(hexNeon);
    return new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        uPortalTex: { value: portalRenderTexture },
        uNeonColor: { value: new THREE.Vector3(col.r, col.g, col.b) },
        uUnlocked:  { value: 1.0 },
        uTime:      this.timeUniform
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform sampler2D uPortalTex;
        uniform vec3 uNeonColor;
        uniform float uUnlocked;
        uniform float uTime;
        varying vec2 vUv;

        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float edge = max(abs(p.x), abs(p.y));

          if (uUnlocked < 0.5) {
            float bars = step(0.65, fract(vUv.y * 6.0));
            vec3 lockedCol = mix(vec3(0.05, 0.06, 0.09), vec3(0.55, 0.12, 0.15), bars * 0.65);
            gl_FragColor = vec4(lockedCol, 1.0);
            return;
          }

          float ripple = sin(length(p) * 16.0 - uTime * 4.5) * 0.012 * smoothstep(0.2, 1.0, edge);
          vec2 suv = clamp(vec2(1.0 - vUv.x, vUv.y) + p * ripple, vec2(0.01), vec2(0.99));
          vec3 viewCol = texture2D(uPortalTex, suv).rgb;

          float scan = 0.94 + 0.06 * sin(vUv.y * 120.0 - uTime * 8.0);
          float borderGlow = smoothstep(0.68, 1.0, edge);
          float innerRim   = smoothstep(0.88, 1.0, edge);

          vec3 col = viewCol * scan;
          col = mix(col, uNeonColor * 1.6, borderGlow * 0.60);
          col += uNeonColor * innerRim * 2.4;
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
  }
}
