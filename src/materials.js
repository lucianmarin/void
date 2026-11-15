import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

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
    const hasMetallic = Boolean(opts.hasMetallic);
    const mat = new THREE.MeshPhysicalMaterial({
      color: opts.color ?? 0xffffff,
      map: set.map,
      normalMap: set.normalMap,
      normalScale: new THREE.Vector2(opts.normalScale ?? 1.0, opts.normalScale ?? 1.0),
      roughnessMap: set.roughnessMap,
      roughness: opts.roughness ?? 1.0,
      metalnessMap: set.metalnessMap,
      metalness: hasMetallic ? 1.0 : (opts.metalness ?? 0.05),
      envMapIntensity: opts.envMapIntensity ?? (hasMetallic ? 1.85 : 1.25),
      clearcoat: opts.clearcoat ?? 0.0,
      clearcoatRoughness: opts.clearcoatRoughness ?? 0.14,
      reflectivity: opts.reflectivity ?? 0.65
    });

    // Multi-frequency world-space micro-grain & subtle grazing sheen (inspired by abyssal-garden)
    const micro = opts.microScale ?? (hasMetallic ? 0.035 : 0.045);
    const boost = opts.albedoBoost ?? 1.0;
    const minRough = opts.minRoughness ?? 0.04;
    if (micro > 0 || boost !== 1.0 || minRough > 0.04) {
      mat.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vMatWorldPos;\nvarying vec3 vMatWorldNorm;')
          .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
            vMatWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
            vMatWorldNorm = normalize(mat3(modelMatrix) * objectNormal);`);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>
            varying vec3 vMatWorldPos;
            varying vec3 vMatWorldNorm;
            float matMicroNoise(vec3 p) {
              vec3 q = p * 1.45;
              return (sin(q.x * 1.3 + sin(q.z * 1.7)) * cos(q.y * 1.5 + q.z * 1.1)) * 0.50
                   + (sin(q.x * 4.7 + q.y * 3.9) * cos(q.z * 4.3)) * 0.30
                   + (sin(q.x * 11.3 - q.z * 9.7) * cos(q.y * 10.1)) * 0.20;
            }`)
          .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
            float mVar = matMicroNoise(vMatWorldPos * 0.55);
            float mMacroR = matMicroNoise(vMatWorldPos * 0.12);
            vec3 pCellR = floor(vMatWorldPos * 0.25 + 0.02);
            float pHashR = fract(sin(dot(pCellR, vec3(12.9898, 78.233, 37.719))) * 43758.5453) - 0.5;
            roughnessFactor = clamp(roughnessFactor + mVar * ${(micro * 2.2).toFixed(4)} + mMacroR * ${(micro * 2.8).toFixed(4)} + pHashR * 0.12, ${minRough.toFixed(3)}, 1.0);`)
          .replace('#include <color_fragment>', `#include <color_fragment>
            float mMacro = matMicroNoise(vMatWorldPos * 0.085);
            float mLarge = matMicroNoise(vMatWorldPos * 0.22);
            float mMed   = matMicroNoise(vMatWorldPos * 0.68);
            vec3 pCell = floor(vMatWorldPos * 0.25 + 0.02);
            float pHash = fract(sin(dot(pCell, vec3(12.9898, 78.233, 37.719))) * 43758.5453) - 0.5;
            // Architectural floor/ceiling crevice grounding + subtle warm floor / cool sky bounce gradient
            float yFloor = mod(max(vMatWorldPos.y, 0.0), 12.0);
            float wallMask = 1.0 - abs(vMatWorldNorm.y);
            float edgeAO = mix(1.0, 0.72 + 0.28 * smoothstep(0.0, 1.15, yFloor) * smoothstep(12.0, 10.80, yFloor), wallMask);
            vec3 bounceTint = mix(vec3(1.02, 1.00, 0.98), vec3(0.95, 0.98, 1.03), smoothstep(1.5, 9.5, yFloor));
            float grainVar = 1.0 + mMacro * 0.16 + mLarge * 0.13 + mMed * 0.07 + pHash * 0.11;
            diffuseColor.rgb = diffuseColor.rgb * ${boost.toFixed(3)} * grainVar * edgeAO * mix(vec3(1.0), bounceTint, wallMask);`);
      };
      mat.customProgramCacheKey = () => `pbr_micro_${micro.toFixed(3)}_${boost.toFixed(2)}_${minRough.toFixed(2)}`;
    }

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
    const mat = new THREE.MeshPhysicalMaterial({
      color: hexColor,
      transparent: true,
      opacity,
      roughness: 0.05,
      metalness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      reflectivity: 1.0,
      envMapIntensity: 2.3,
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
      emissiveIntensity: 0.78,
      transparent: true,
      opacity: 0.94,
      roughness: 0.28,
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
    return this._applyWorldBoxUVs(geom, sx, sy, sz, metersPerTile);
  }

  // Chamfered / beveled box geometry with seamless world-space PBR UVs for close-up architecture & props
  makeChamferBoxGeometry(sx, sy, sz, radius = 0.06, segments = 2, metersPerTile = 4.0) {
    const safeR = Math.min(radius, sx * 0.28, sy * 0.28, sz * 0.28);
    if (safeR <= 0.002) return this.makeWorldBoxGeometry(sx, sy, sz, metersPerTile);
    const geom = new RoundedBoxGeometry(sx, sy, sz, segments, safeR);
    return this._applyWorldBoxUVs(geom, sx, sy, sz, metersPerTile);
  }

  _applyWorldBoxUVs(geom, sx, sy, sz, metersPerTile = 4.0) {
    const pos = geom.attributes.position;
    const norm = geom.attributes.normal;
    const uv = geom.attributes.uv;
    const invScale = 1.0 / metersPerTile;

    for (let i = 0; i < pos.count; i++) {
      const nx = Math.abs(norm.getX(i));
      const ny = Math.abs(norm.getY(i));
      const nz = Math.abs(norm.getZ(i));
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);

      if (ny >= nx && ny >= nz) {
        uv.setXY(i, (x + sx * 0.5) * invScale, (z + sz * 0.5) * invScale);
      } else if (nx >= ny && nx >= nz) {
        uv.setXY(i, (z + sz * 0.5) * invScale, (y + sy * 0.5) * invScale);
      } else {
        uv.setXY(i, (x + sx * 0.5) * invScale, (y + sy * 0.5) * invScale);
      }
    }
    uv.needsUpdate = true;
    return geom;
  }

  // Real-time planar floor reflector for glossy showcase floors (Magenta Gallery, Sky Lounge)
  createFloorReflector(width, depth, tintHex = 0xffffff, reflOpacity = 0.24, texRes = 1024) {
    const geom = new THREE.PlaneGeometry(width, depth);
    const reflector = new Reflector(geom, {
      color: tintHex,
      textureWidth: texRes,
      textureHeight: texRes,
      clipBias: 0.004,
      multisample: 0
    });
    reflector.rotation.x = -Math.PI * 0.5;
    reflector.userData.noDepthPrepass = true;

    const baseMat = reflector.material;
    baseMat.transparent = true;
    baseMat.depthWrite = false;
    baseMat.uniforms.uOpacity = { value: reflOpacity };
    baseMat.vertexShader = /* glsl */`
      uniform mat4 textureMatrix;
      varying vec4 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = textureMatrix * vec4(position, 1.0);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `;
    baseMat.fragmentShader = /* glsl */`
      uniform vec3 color;
      uniform sampler2D tDiffuse;
      uniform float uOpacity;
      varying vec4 vUv;
      varying vec3 vWorldPos;
      void main() {
        vec3 base = texture2DProj(tDiffuse, vUv).rgb;
        vec3 V = normalize(cameraPosition - vWorldPos);
        float dist = length(cameraPosition - vWorldPos);
        // Grazing Fresnel response keeps foreground crisp & uncluttered while far walls shimmer cleanly
        float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 4.2);
        float distFade = 1.0 - smoothstep(20.0, 44.0, dist);
        vec3 col = base * color;
        gl_FragColor = vec4(col, clamp(uOpacity * fres * (0.35 + 0.65 * distFade), 0.0, 0.36));
      }
    `;
    return reflector;
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
          vec3 zenith = vec3(0.11, 0.36, 0.84);
          vec3 horizon = vec3(0.60, 0.73, 0.88);
          vec3 col = mix(horizon, zenith, pow(up, 0.56));

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
            col = mix(col, vec3(0.68, 0.78, 0.90), mist * 0.90);
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
    const mesh = new THREE.Mesh(geom, mat);
    mesh.userData.noDepthPrepass = true;
    return mesh;
  }

  // Custom Void Planet Dome Shader (Overcast storm clouds + Twin-Planet Eclipse corona)
  createVoidPlanetDome() {
    const geom = new THREE.SphereGeometry(460, 128, 96);
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
        float snoise(vec2 v) {
          const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
          vec2 i = floor(v + dot(v, C.yy));
          vec2 x0 = v - i + dot(i, C.xx);
          vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz;
          x12.xy -= i1;
          i = mod(i, 289.0);
          vec3 p = mod(((i.y + vec3(0.0, i1.y, 1.0)) * 34.0 + 1.0) * (i.y + vec3(0.0, i1.y, 1.0)), 289.0);
          p = mod(((p + i.x + vec3(0.0, i1.x, 1.0)) * 34.0 + 1.0) * (p + i.x + vec3(0.0, i1.x, 1.0)), 289.0);
          vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
          m = m * m;
          m = m * m;
          vec3 x = 2.0 * fract(p * C.www) - 1.0;
          vec3 h = abs(x) - 0.5;
          vec3 ox = floor(x + 0.5);
          vec3 a0 = x - ox;
          m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
          vec3 g;
          g.x = a0.x * x0.x + h.x * x0.y;
          g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g) * 0.5 + 0.5;
        }
        float vnoise(vec2 p) { return snoise(p); }
        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
          for (int i = 0; i < 6; i++) {
            v += a * snoise(p);
            p = rot * p * 2.04 + vec2(13.7, 29.3);
            a *= 0.5;
          }
          return v;
        }

        void main() {
          // Deep twilight-cosmos sky gradient with dramatic low storm clouds & crisp stars
          vec3 dir = normalize(vDir);
          float up = clamp(dir.y, 0.0, 1.0);
          vec3 zenith = vec3(0.008, 0.015, 0.038);
          vec3 horizon = vec3(0.105, 0.178, 0.248);
          vec3 col = mix(horizon, zenith, pow(up, 0.48));

          // Crisp star field
          if (dir.y > 0.03) {
            vec2 suv = dir.xz / (dir.y + 0.45) * 185.0;
            vec2 cell = floor(suv);
            float sh = hash21(cell);
            float d = length(fract(suv) - 0.5 - (vec2(hash21(cell + 7.1), hash21(cell + 3.3)) - 0.5) * 0.6);
            float tw = 0.65 + 0.35 * sin(uTime * (1.5 + sh * 3.0) + sh * 40.0);
            col += vec3(0.92, 0.96, 1.0) * step(0.9955, sh) * smoothstep(0.11, 0.0, d) * tw * smoothstep(0.03, 0.35, dir.y);
          }

          // Crescent Companion World (smooth atmospheric bands, zero noisy mottling)
          vec3 gDir = normalize(vec3(0.20, 0.48, -0.85));
          float gR = 0.078;
          float R = sin(gR);
          vec3 gRight = normalize(cross(vec3(0.0, 1.0, 0.0), gDir));
          vec3 gUp = cross(gDir, gRight);
          vec2 q = vec2(dot(dir, gRight), dot(dir, gUp)) / R;
          float qd = length(q);
          float gFront = step(0.0, dot(dir, gDir));
          vec3 L = normalize(vec3(-0.82, 0.22, 0.52));

          if (qd < 1.01 && gFront > 0.5) {
            vec3 n = vec3(q, sqrt(max(0.0, 1.0 - qd * qd)));
            float ndl = dot(n, L);
            float lit = pow(smoothstep(-0.06, 0.70, ndl), 1.15);
            float limb = pow(clamp(n.z, 0.0, 1.0), 0.42);
            float lat = asin(clamp(n.y, -0.99, 0.99)) + n.x * 0.08;
            float bands = 0.5 + 0.5 * sin(lat * 7.0 + snoise(n.xy * 1.4) * 0.9);
            vec3 gCol = mix(vec3(0.34, 0.42, 0.54), vec3(0.80, 0.78, 0.74), smoothstep(0.15, 0.85, bands));
            float rimScatter = pow(clamp(1.0 - n.z, 0.0, 1.0), 3.0) * smoothstep(-0.08, 0.55, ndl);
            vec3 litSide = gCol * limb * lit + vec3(0.46, 0.66, 0.92) * rimScatter * 0.36;
            vec3 planetSurf = mix(col * 0.92, litSide + col * 0.14, smoothstep(-0.06, 0.56, ndl));
            float diskA = smoothstep(1.0, 0.992, qd);
            col = mix(col, planetSurf, diskA);
          }

          // Twin-Planet Eclipse: earthshine-lit cratered moon with broad airy solar corona (no thin outline ring)
          vec3 pdir = normalize(vec3(-0.30, 0.46, -0.83));
          float pcos = dot(dir, pdir);
          vec3 eRight = normalize(cross(vec3(0.0, 1.0, 0.0), pdir));
          vec3 eUp = cross(pdir, eRight);
          vec2 eq = vec2(dot(dir, eRight), dot(dir, eUp)) / sin(0.128);
          float eqd = length(eq);
          float eFront = step(0.0, pcos);
          float limbAngle = atan(eq.y, eq.x) - 0.62;
          float cAng = 0.5 + 0.5 * cos(limbAngle);
          float asym = 0.10 + 0.90 * pow(cAng, 2.4);
          float dEdge = max(0.0, eqd - 1.0);
          float wideGlow = pow(clamp(pcos, 0.0, 1.0), 28.0) * 0.22 * eFront;
          float innerCorona = exp(-dEdge * 7.8) * asym * eFront;
          float outerCorona = exp(-dEdge * 2.6) * pow(cAng, 1.5) * eFront;
          vec3 coronaCol = vec3(1.05, 0.64, 0.28) * (innerCorona * 0.34 + outerCorona * 0.16 + wideGlow);
          if (eqd < 1.0 && eFront > 0.5) {
            vec3 en = vec3(eq, sqrt(max(0.0, 1.0 - eqd * eqd)));
            float earthshine = 0.26 + 0.74 * clamp(dot(en, normalize(vec3(0.7, 0.35, 0.6))), 0.0, 1.0);
            float mare = fbm(eq * 3.2 + 1.4);
            float relief = smoothstep(0.24, 0.78, mare);
            vec3 moonSurf = mix(vec3(0.015, 0.022, 0.042), vec3(0.062, 0.082, 0.118), relief) * earthshine;
            moonSurf += vec3(0.12, 0.06, 0.025) * pow(max(0.0, eqd), 4.0) * pow(cAng, 2.2);
            moonSurf = mix(moonSurf, col * 0.68, 0.14);
            float diskE = smoothstep(1.0, 0.992, eqd);
            col = mix(col + coronaCol, moonSurf, diskE * 0.97);
          } else {
            col += coronaCol;
          }

          // Layered twilight storm clouds & atmospheric eclipse scatter
          if (dir.y > -0.04) {
            vec2 cuv = dir.xz / max(0.18, dir.y + 0.22) * 1.45 + vec2(uTime * 0.01, -uTime * 0.007);
            float c1 = fbm(cuv);
            float c2 = fbm(cuv * 2.8 - vec2(uTime * 0.014, 0.0));
            float cloud = smoothstep(0.35, 0.86, c1 * 0.58 + c2 * 0.42);
            vec3 cloudCol = mix(vec3(0.03, 0.055, 0.095), vec3(0.23, 0.34, 0.42), cloud);
            cloudCol += vec3(0.24, 0.13, 0.06) * pow(clamp(pcos, 0.0, 1.0), 16.0) * cloud;
            float altFade = smoothstep(-0.02, 0.18, dir.y) * (0.40 + 0.60 * (1.0 - smoothstep(0.26, 0.62, dir.y)));
            col = mix(col, cloudCol, cloud * 0.54 * altFade);
          } else {
            col = mix(horizon, vec3(0.03, 0.05, 0.08), smoothstep(0.0, -0.25, dir.y));
          }

          // Atmospheric mist band hugging the horizon
          col = mix(col, vec3(0.16, 0.25, 0.31), exp(-abs(dir.y) * 15.0) * 0.42);

          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.userData.noDepthPrepass = true;
    return mesh;
  }

  // Bake PMREM IBL Environment Texture from Sky Dome + ground/interior bounce!
  bakeEnvironmentFromDome(domeMesh, bounceHex = 0x8ea2be) {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileCubemapShader();
    const envScene = new THREE.Scene();
    const clone = domeMesh.clone();
    envScene.add(clone);
    const bounceDisc = new THREE.Mesh(
      new THREE.CircleGeometry(420, 24),
      new THREE.MeshBasicMaterial({ color: bounceHex, side: THREE.DoubleSide })
    );
    bounceDisc.rotation.x = Math.PI * 0.5;
    bounceDisc.position.y = -45;
    envScene.add(bounceDisc);
    const rt = pmrem.fromScene(envScene, 0.025);
    bounceDisc.geometry.dispose();
    bounceDisc.material.dispose();
    pmrem.dispose();
    return rt.texture;
  }

  // Real-time Planar-Reflective Animated Void Ocean (Reflector + wave-normal distortion + shoreline foam)
  createVoidOceanReflector(width = 920, depth = 920) {
    const geom = new THREE.PlaneGeometry(width, depth, 96, 96);
    const oceanShader = {
      name: 'VoidOceanReflector',
      uniforms: {
        color: { value: null },
        tDiffuse: { value: null },
        textureMatrix: { value: null },
        uTime: { value: 0 }
      },
      vertexShader: /* glsl */`
        uniform mat4 textureMatrix;
        uniform float uTime;
        varying vec4 vReflUv;
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          wp.y += sin(wp.x * 0.32 + uTime * 1.2) * cos(wp.z * 0.26 - uTime * 0.9) * 0.06;
          vWorldPos = wp.xyz;
          vReflUv = textureMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform float uTime;
        varying vec4 vReflUv;
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
          vec3 N = normalize(vec3(n1 * 0.055 + n3 * 0.032 * detail, 1.0, n2 * 0.055 + n4 * 0.032 * detail));
          vec3 V = normalize(cameraPosition - vWorldPos);
          float fresnel = 0.04 + 0.96 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.5);

          // Sample planar reflection with wave-normal distortion
          vec4 ruv = vReflUv;
          ruv.xy += N.xz * ruv.w * 0.14;
          vec3 planarRefl = texture2DProj(tDiffuse, ruv).rgb;

          vec3 R = reflect(-V, N);
          vec3 horizon = vec3(0.22, 0.31, 0.36);

          // Glint path under the gas giant & the eclipse corona
          vec3 gDir = normalize(vec3(0.60, 0.21, -0.77));
          vec3 eDir = normalize(vec3(-0.32, 0.36, -0.88));
          vec3 glintCol = vec3(0.85, 0.78, 0.66) * pow(max(dot(R, gDir), 0.0), 180.0) * 1.4
                        + vec3(1.25, 0.72, 0.34) * pow(max(dot(R, eDir), 0.0), 280.0) * 1.9;

          vec3 deep = vec3(0.018, 0.038, 0.055);
          float sss = clamp(n1 * 0.5 + 0.5, 0.0, 1.0) * (1.0 - fresnel) * 0.06;
          vec3 col = deep + vec3(0.05, 0.18, 0.20) * sss;
          col = mix(col, planarRefl, clamp(fresnel * 0.92, 0.12, 0.92)) + glintCol;

          // Subtle foam/ripple accent near the Sanctuary volcanic shore
          float dShore = max(abs(vWorldPos.x) - 33.0, abs(vWorldPos.z + 10.0) - 41.0);
          float foamBand = smoothstep(2.8, 0.0, abs(dShore)) * smoothstep(0.25, 0.85, 0.5 + 0.5 * (n1 * n3));
          col = mix(col, vec3(0.45, 0.58, 0.62), foamBand * 0.32);

          float fog = 1.0 - exp(-pow(dist * 0.0040, 1.5));
          col = mix(col, horizon, clamp(fog, 0.0, 0.96));
          gl_FragColor = vec4(col, 1.0);
        }
      `
    };
    const reflector = new Reflector(geom, {
      color: 0xffffff,
      textureWidth: 512,
      textureHeight: 512,
      clipBias: 0.003,
      multisample: 0,
      shader: oceanShader
    });
    reflector.rotation.x = -Math.PI * 0.5;
    reflector.position.set(0, -0.68, -30);
    reflector.material.uniforms.uTime = this.timeUniform;
    reflector.userData.noDepthPrepass = true;
    return reflector;
  }

  // Faceted Crimson Wedge Colossus Material (1K PBR + Deep Architectural Corten-Crimson Gradient + panel seams)
  createCrimsonWedgeMaterial() {
    const set = this.getTexSet('crimson_monolith', false);
    const mat = new THREE.MeshStandardMaterial({
      map: set.map,
      normalMap: set.normalMap,
      normalScale: new THREE.Vector2(1.4, 1.4),
      roughnessMap: set.roughnessMap,
      roughness: 0.78,
      metalness: 0.18,
      envMapIntensity: 1.35
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
           float hGrad = clamp((vWorldYPos.y + 2.0) / 92.0, 0.0, 1.0);
           vec3 lowIndigo = vec3(0.08, 0.10, 0.17);
           vec3 midCrim   = vec3(0.48, 0.11, 0.13);
           vec3 topCrim   = vec3(0.68, 0.10, 0.12);
           vec3 wGrad = mix(lowIndigo, midCrim, smoothstep(0.0, 0.45, hGrad));
           wGrad = mix(wGrad, topCrim, smoothstep(0.45, 0.96, hGrad));
           // Fine poured-concrete panel joints & vertical weathering streaks
           float seamY = 0.88 + 0.12 * smoothstep(0.0, 0.07, abs(fract(vWorldYPos.y * 0.125) - 0.5));
           float seamX = 0.90 + 0.10 * smoothstep(0.0, 0.06, abs(fract((vWorldYPos.x + vWorldYPos.z) * 0.09) - 0.5));
           float streak = 0.90 + 0.10 * sin(vWorldYPos.x * 0.42 + sin(vWorldYPos.z * 0.31) * 1.6);
           diffuseColor.rgb *= wGrad * seamY * seamX * streak * 1.15;`
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

          float ripple = sin(length(p) * 18.0 - uTime * 4.5) * 0.0025 * smoothstep(0.82, 1.0, edge);
          float disp = 0.003 * smoothstep(0.84, 1.0, edge);
          vec2 baseUv = vec2(1.0 - vUv.x, vUv.y) + p * ripple;
          vec3 viewCol;
          viewCol.r = texture2D(uPortalTex, clamp(baseUv + p * disp, vec2(0.01), vec2(0.99))).r;
          viewCol.g = texture2D(uPortalTex, clamp(baseUv, vec2(0.01), vec2(0.99))).g;
          viewCol.b = texture2D(uPortalTex, clamp(baseUv - p * disp, vec2(0.01), vec2(0.99))).b;

          float borderGlow = smoothstep(0.935, 1.0, edge);
          float innerRim   = smoothstep(0.968, 1.0, edge);
          float wisp = 0.5 + 0.5 * sin(atan(p.y, p.x) * 6.0 + uTime * 2.5 - length(p) * 5.0);

          // Crisp contrast boost inside portal aperture so destination sanctuary reads clearly
          vec3 col = pow(max(viewCol, vec3(0.0)), vec3(1.02)) * 1.24;
          col = mix(col, uNeonColor * (0.95 + 0.10 * wisp), borderGlow * 0.12);
          col += uNeonColor * innerRim * (0.28 + 0.10 * wisp);
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
  }
}
