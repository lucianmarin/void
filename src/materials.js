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
      map:          this._loadTex(`/textures/${prefix}_albedo.png`, true),
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
    const mat = new THREE.MeshPhysicalMaterial({
      color: hexColor,
      transparent: true,
      opacity,
      roughness: 0.05,
      metalness: 0.15,
      reflectivity: 1.0,
      envMapIntensity: 1.6,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.matCache.set(key, mat);
    return mat;
  }

  getHoloConstruct(key, hexColor) {
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
        void main() {
          vec3 dir = normalize(vDir);
          float up = clamp(dir.y, 0.0, 1.0);
          vec3 zenith = vec3(0.11, 0.39, 0.90);
          vec3 horizon = vec3(0.92, 0.96, 1.00);
          vec3 col = mix(horizon, zenith, pow(up, 0.52));

          if (dir.y < 0.06) {
            float mist = smoothstep(0.06, -0.20, dir.y);
            col = mix(col, vec3(0.96, 0.98, 1.0), mist * 0.95);
          }

          // Iconic Giant Crimson Sun disc (silhouette-crimson-sun-spire-04.jpg)
          vec3 sunDir = normalize(vec3(0.36, 0.13, -0.92));
          float scos = dot(dir, sunDir);
          float disc = smoothstep(0.9912, 0.9926, scos);
          float halo = pow(clamp(scos, 0.0, 1.0), 26.0) * 0.32;
          col += vec3(1.0, 0.24, 0.16) * halo;
          col = mix(col, vec3(1.55, 0.08, 0.12), disc * smoothstep(-0.06, 0.02, dir.y));

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
          vec3 zenith = vec3(0.06, 0.09, 0.16);
          vec3 horizon = vec3(0.28, 0.35, 0.46);
          vec3 col = mix(horizon, zenith, pow(up, 0.65));

          if (dir.y > -0.04) {
            vec2 cuv = dir.xz / max(0.13, dir.y + 0.16) * 1.3 + vec2(uTime * 0.01, -uTime * 0.007);
            float c1 = fbm(cuv);
            float c2 = fbm(cuv * 2.4 - vec2(uTime * 0.014, 0.0));
            float cloud = smoothstep(0.30, 0.82, c1 * 0.65 + c2 * 0.35);
            col = mix(col, mix(vec3(0.11, 0.15, 0.23), vec3(0.50, 0.58, 0.70), cloud), 0.70 * smoothstep(-0.02, 0.22, dir.y));
          } else {
            col = mix(horizon, vec3(0.05, 0.07, 0.12), smoothstep(0.0, -0.25, dir.y));
          }

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
          vec3 N = normalize(vec3(n1 * 0.06, 1.0, n2 * 0.06));
          vec3 V = normalize(cameraPosition - vWorldPos);
          float fresnel = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);

          vec3 deep = vec3(0.04, 0.06, 0.10);
          vec3 skyRefl = vec3(0.32, 0.40, 0.54);
          vec3 col = mix(deep, skyRefl, clamp(fresnel * 0.85 + 0.08, 0.0, 0.88));

          float dist = length(vWorldPos - cameraPosition);
          float fog = 1.0 - exp(-pow(dist * 0.0042, 1.5));
          col = mix(col, vec3(0.24, 0.30, 0.40), clamp(fog, 0.0, 0.94));
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
