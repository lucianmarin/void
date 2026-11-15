import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

const FULLSCREEN_VS = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const GLSL_NOISE = /* glsl */`
float ign(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

float readDepth01(sampler2D tDepth, vec2 uv) {
  return texture2D(tDepth, uv).x;
}

vec3 viewPosFromDepth(vec2 uv, float d, mat4 invProj) {
  vec4 ndc = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec4 vp = invProj * ndc;
  return vp.xyz / vp.w;
}
`;

const AO_FS = /* glsl */`
uniform sampler2D tDepth;
uniform sampler2D tNormal;
uniform mat4 uInvProj;
uniform mat4 uProj;
uniform vec2 uRes;
uniform float uRadius;
varying vec2 vUv;
${GLSL_NOISE}

void main() {
  float d0 = readDepth01(tDepth, vUv);
  if (d0 >= 0.9995) {
    gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
    return;
  }

  vec3 P = viewPosFromDepth(vUv, d0, uInvProj);
  vec3 N = normalize(texture2D(tNormal, vUv).rgb * 2.0 - 1.0);
  float dist = -P.z;

  // Fade AO cleanly beyond 65m so far megacity silhouettes stay atmospheric
  float distFade = 1.0 - smoothstep(40.0, 75.0, dist);
  if (distFade <= 0.01) {
    gl_FragColor = vec4(1.0, 1.0, 1.0, d0);
    return;
  }

  float jit = ign(gl_FragCoord.xy);
  float angOff = jit * 6.2831853;
  float rad = uRadius;

  // Screen-space projected radius capped cleanly for architectural corner & contact grounding
  vec4 projEdge = uProj * vec4(P + vec3(rad, 0.0, 0.0), 1.0);
  float pxRad = clamp(abs(projEdge.x / projEdge.w * 0.5 - (vUv.x - 0.5)) * uRes.x, 4.0, 62.0);
  vec2 texel = 1.0 / uRes;

  float occ = 0.0;
  const int SAMPLES = 8;
  for (int i = 0; i < SAMPLES; i++) {
    float fi = (float(i) + 0.5) / float(SAMPLES);
    float theta = float(i) * 2.3999632 + angOff;
    float rPx = fi * pxRad;
    vec2 suv = vUv + vec2(cos(theta), sin(theta)) * rPx * texel;
    if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) continue;

    float ds = readDepth01(tDepth, suv);
    if (ds >= 0.9995) continue;

    vec3 Ps = viewPosFromDepth(suv, ds, uInvProj);
    vec3 diff = Ps - P;
    float d2 = dot(diff, diff);
    float l = sqrt(d2) + 1e-4;
    vec3 dir = diff / l;

    float horizon = max(0.0, dot(N, dir) - 0.04);
    float range = 1.0 - smoothstep(rad * 0.22, rad * 1.55, l);
    occ += horizon * range;
  }

  float ao = 1.0 - clamp(occ / float(SAMPLES) * 2.95, 0.0, 0.76) * distFade;
  ao = mix(1.0, ao, 0.92);
  gl_FragColor = vec4(ao, ao, ao, d0);
}
`;

const AO_BLUR_FS = /* glsl */`
uniform sampler2D tAO;
uniform vec2 uTexel;
varying vec2 vUv;

void main() {
  vec4 center = texture2D(tAO, vUv);
  float d0 = center.a;
  if (d0 >= 0.999) {
    gl_FragColor = vec4(1.0);
    return;
  }
  float sum = 0.0;
  float wsum = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec4 s = texture2D(tAO, vUv + vec2(float(x), float(y)) * uTexel * 1.35);
      float w = 1.0 / (0.002 + abs(s.a - d0) * 65.0);
      sum += s.r * w;
      wsum += w;
    }
  }
  float ao = sum / max(wsum, 1e-4);
  gl_FragColor = vec4(ao, ao, ao, d0);
}
`;

const RAYS_FS = /* glsl */`
#include <packing>
uniform sampler2D tDepth;
uniform sampler2D tShadowMap;
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
uniform mat4 uShadowMatrix;
uniform vec3 uSunDir;
uniform vec3 uRayColor;
uniform float uTime;
uniform float uDensity;
uniform float uMaxDist;
uniform float uHasShadow;
uniform float uIndoorFloor;
varying vec2 vUv;
${GLSL_NOISE}

void main() {
  if (uDensity <= 0.001) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 900.0);
    return;
  }

  float d0 = readDepth01(tDepth, vUv);
  vec3 vPos = viewPosFromDepth(vUv, d0, uInvProj);
  vec4 wPos = uCamWorld * vec4(vPos, 1.0);
  vec3 camPos = (uCamWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;

  vec3 v = wPos.xyz - camPos;
  float sceneDist = (d0 >= 0.9995) ? uMaxDist : length(v);
  vec3 rd = normalize(v);
  float linearZ = -vPos.z;

  if (uIndoorFloor > 0.5) {
    float indoorDist = min(sceneDist, 42.0);
    float jitI = ign(gl_FragCoord.xy);
    float dtI = indoorDist / 6.0;
    float accI = 0.0;
    for (int i = 0; i < 6; i++) {
      float t = (float(i) + jitI) * dtI;
      vec3 p = camPos + rd * t;
      float yLocal = mod(max(p.y, 0.0), 12.0);
      float ceilingGlow = 0.35 + 0.65 * smoothstep(1.2, 10.5, yLocal);
      float mist = 0.72 + 0.28 * sin(p.x * 0.28 + uTime * 0.30) * cos(p.z * 0.24 - uTime * 0.22);
      accI += ceilingGlow * mist * exp(-t * 0.032);
    }
    vec3 indoorCol = uRayColor * (accI / 6.0) * (indoorDist * 0.012) * uDensity;
    gl_FragColor = vec4(min(indoorCol, vec3(0.32)), (d0 >= 0.9995) ? 900.0 : linearZ);
    return;
  }

  float marchDist = min(sceneDist, uMaxDist);

  float mu = max(dot(rd, normalize(uSunDir)), 0.0);
  float phase = 0.14 + 0.68 * pow(mu, 5.0) + 0.35 * pow(mu, 28.0);

  float jit = ign(gl_FragCoord.xy);
  const int STEPS = 12;
  float dt = marchDist / float(STEPS);

  float acc = 0.0;
  for (int i = 0; i < STEPS; i++) {
    float t = (float(i) + jit) * dt;
    vec3 p = camPos + rd * t;

    float vis = 0.0;
    if (uHasShadow > 0.5) {
      vec4 sc = uShadowMatrix * vec4(p, 1.0);
      vec3 s = sc.xyz / sc.w;
      if (s.x >= 0.01 && s.x <= 0.99 && s.y >= 0.01 && s.y <= 0.99 && s.z >= 0.0 && s.z <= 1.0) {
        float shD = unpackRGBAToDepth(texture2D(tShadowMap, s.xy));
        float lit = step(s.z - 0.003, shD);
        float edge = smoothstep(0.0, 0.14, min(min(s.x, 1.0 - s.x), min(s.y, 1.0 - s.y)));
        vis = lit * edge;
      }
    }

    // Subtle animated atmospheric dust density modulation inside real sunlit shafts
    float wave = 0.72 + 0.28 * sin(p.x * 0.24 + uTime * 0.35 + sin(p.z * 0.19 - uTime * 0.24))
                            * cos(p.y * 0.33 + uTime * 0.28);
    float atten = exp(-t * 0.022);
    acc += vis * wave * atten;
  }

  vec3 rayCol = uRayColor * (acc / float(STEPS)) * (marchDist * 0.014) * phase * uDensity;
  // Don't wash out sky celestial bodies with foreground volumetric scatter when looking straight into the sky
  if (d0 >= 0.9995) rayCol *= 0.22;
  rayCol = min(rayCol, vec3(0.55));
  gl_FragColor = vec4(rayCol, (d0 >= 0.9995) ? 900.0 : linearZ);
}
`;

const RAYS_BLUR_FS = /* glsl */`
uniform sampler2D tRays;
uniform vec2 uTexel;
varying vec2 vUv;

void main() {
  vec4 c = texture2D(tRays, vUv);
  vec3 acc = vec3(0.0);
  float ws = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec4 r = texture2D(tRays, vUv + vec2(float(x), float(y)) * uTexel * 1.4);
      float w = 1.0 / (0.04 + abs(r.a - c.a) / max(c.a, 1.0));
      acc += r.rgb * w;
      ws += w;
    }
  }
  gl_FragColor = vec4(acc / max(ws, 1e-4), c.a);
}
`;

const WORLD_COMPOSITE_FS = /* glsl */`
uniform sampler2D tWorld;
uniform sampler2D tAO;
uniform sampler2D tRays;
uniform float uAoStrength;
varying vec2 vUv;

void main() {
  vec4 world = texture2D(tWorld, vUv);
  float ao = texture2D(tAO, vUv).r;
  vec3 rays = texture2D(tRays, vUv).rgb;

  // Protect only true HDR emissive lights/sky from AO darkening while preserving AO on sunlit white architecture
  float luma = dot(world.rgb, vec3(0.2126, 0.7152, 0.0722));
  float aoMask = mix(ao, 1.0, smoothstep(2.4, 4.4, luma));
  float finalAO = mix(1.0, aoMask, uAoStrength);

  vec3 col = world.rgb * finalAO + rays;
  gl_FragColor = vec4(col, 1.0);
}
`;

const BLOOM_DOWN0_FS = /* glsl */`
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uKnee;
varying vec2 vUv;

vec4 karis(vec3 c) {
  c = min(c, vec3(18.0));
  float l = max(c.r, max(c.g, c.b));
  float soft = clamp(l - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = (soft * soft) / (4.0 * uKnee + 1e-5);
  float contrib = max(soft, l - uThreshold) / max(l, 1e-5);
  c *= max(contrib, 0.0);
  float w = 1.0 / (1.0 + max(c.r, max(c.g, c.b)));
  return vec4(c * w, w);
}

void main() {
  vec4 a = karis(texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb);
  vec4 b = karis(texture2D(tSrc, vUv + uTexel * vec2( 1.0, -1.0)).rgb);
  vec4 c = karis(texture2D(tSrc, vUv + uTexel * vec2(-1.0,  1.0)).rgb);
  vec4 d = karis(texture2D(tSrc, vUv + uTexel * vec2( 1.0,  1.0)).rgb);
  vec4 m = a + b + c + d;
  gl_FragColor = vec4(m.rgb / max(m.a, 1e-5), 1.0);
}
`;

const BLOOM_DOWN_FS = /* glsl */`
uniform sampler2D tSrc;
uniform vec2 uTexel;
varying vec2 vUv;

void main() {
  vec3 a = texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  vec3 b = texture2D(tSrc, vUv + uTexel * vec2( 1.0, -1.0)).rgb;
  vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-1.0,  1.0)).rgb;
  vec3 d = texture2D(tSrc, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
  gl_FragColor = vec4((a + b + c + d) * 0.25, 1.0);
}
`;

const BLOOM_UP_FS = /* glsl */`
uniform sampler2D tSrc;
uniform vec2 uTexel;
varying vec2 vUv;

void main() {
  vec3 a = texture2D(tSrc, vUv + uTexel * vec2(-0.85, -0.85)).rgb;
  vec3 b = texture2D(tSrc, vUv + uTexel * vec2( 0.85, -0.85)).rgb;
  vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-0.85,  0.85)).rgb;
  vec3 d = texture2D(tSrc, vUv + uTexel * vec2( 0.85,  0.85)).rgb;
  gl_FragColor = vec4((a + b + c + d) * 0.22, 1.0);
}
`;

const FINAL_POST_FS = /* glsl */`
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float uExposure;
uniform float uBloomStrength;
varying vec2 vUv;
${GLSL_NOISE}

vec3 acesTmap(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  vec3 bl = texture2D(tBloom, vUv).rgb;

  c += bl * uBloomStrength;
  c *= uExposure;

  // Subtle natural lens vignette
  vec2 q = vUv - 0.5;
  c *= 1.0 - dot(q, q) * 0.26;

  // ACES Filmic tone mapping + gentle shadow floor lift to preserve dark basalt detail
  c = acesTmap(c + vec3(0.005, 0.007, 0.010));

  // Subtle cinematic S-curve luminance contrast (from abyssal-garden)
  float l0 = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float l = mix(l0, l0 * l0 * (3.0 - 2.0 * l0), 0.12);
  c *= l / max(l0, 1e-4);

  // Gentle highlight roll-off + saturation polish
  c = mix(c, vec3(l), smoothstep(0.68, 1.0, l) * 0.08);
  c = mix(vec3(l), c, 1.04);

  // Linear -> sRGB (dithering applied after FXAA output pass)
  c = pow(max(c, vec3(0.0)), vec3(1.0 / 2.2));
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

const FXAA_FS = /* glsl */`
uniform sampler2D tSrc;
uniform vec2 uTexel;
varying vec2 vUv;
${GLSL_NOISE}

float luma(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec3 rgbM  = texture2D(tSrc, vUv).rgb;
  vec3 rgbNW = texture2D(tSrc, vUv + vec2(-1.0, -1.0) * uTexel).rgb;
  vec3 rgbNE = texture2D(tSrc, vUv + vec2( 1.0, -1.0) * uTexel).rgb;
  vec3 rgbSW = texture2D(tSrc, vUv + vec2(-1.0,  1.0) * uTexel).rgb;
  vec3 rgbSE = texture2D(tSrc, vUv + vec2( 1.0,  1.0) * uTexel).rgb;

  float lM  = luma(rgbM);
  float lNW = luma(rgbNW);
  float lNE = luma(rgbNE);
  float lSW = luma(rgbSW);
  float lSE = luma(rgbSE);

  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
  float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  float lRange = lMax - lMin;

  vec3 outCol = rgbM;
  if (lRange >= max(0.04, lMax * 0.105)) {
    vec2 dir;
    dir.x = -((lNW + lNE) - (lSW + lSE));
    dir.y =  ((lNW + lSW) - (lNE + lSE));
    float dirReduce = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078125);
    float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
    dir = clamp(dir * rcpDirMin, vec2(-8.0), vec2(8.0)) * uTexel;

    vec3 rgbA = 0.5 * (
      texture2D(tSrc, vUv + dir * (1.0 / 3.0 - 0.5)).rgb +
      texture2D(tSrc, vUv + dir * (2.0 / 3.0 - 0.5)).rgb
    );
    vec3 rgbB = rgbA * 0.5 + 0.25 * (
      texture2D(tSrc, vUv + dir * -0.5).rgb +
      texture2D(tSrc, vUv + dir *  0.5).rgb
    );
    float lB = luma(rgbB);
    outCol = (lB < lMin || lB > lMax) ? rgbA : rgbB;
  }

  float dither = (ign(gl_FragCoord.xy) + ign(gl_FragCoord.xy + 37.0) - 1.0) * (1.25 / 255.0);
  gl_FragColor = vec4(clamp(outCol + dither, 0.0, 1.0), 1.0);
}
`;

export class PostFXPipeline {
  constructor(renderer, width, height) {
    this.renderer = renderer;
    this.samples = Math.min(2, renderer.capabilities.maxSamples || 0);
    this.bloomLevels = 4;

    this.width = 1;
    this.height = 1;

    this.normalOverride = new THREE.MeshNormalMaterial({ blending: THREE.NoBlending });
    this.quad = new FullScreenQuad(null);

    this.aoMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VS,
      fragmentShader: AO_FS,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tDepth: { value: null },
        tNormal: { value: null },
        uInvProj: { value: new THREE.Matrix4() },
        uProj: { value: new THREE.Matrix4() },
        uRes: { value: new THREE.Vector2(1, 1) },
        uRadius: { value: 1.85 }
      }
    });

    this.aoBlurMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VS,
      fragmentShader: AO_BLUR_FS,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tAO: { value: null },
        uTexel: { value: new THREE.Vector2(1, 1) }
      }
    });

    this.raysMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VS,
      fragmentShader: RAYS_FS,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tDepth: { value: null },
        tShadowMap: { value: null },
        uInvProj: { value: new THREE.Matrix4() },
        uCamWorld: { value: new THREE.Matrix4() },
        uShadowMatrix: { value: new THREE.Matrix4() },
        uSunDir: { value: new THREE.Vector3(-0.6, 0.5, 0.4).normalize() },
        uRayColor: { value: new THREE.Vector3(1.0, 0.90, 0.78) },
        uTime: { value: 0 },
        uDensity: { value: 0.72 },
        uMaxDist: { value: 110.0 },
        uHasShadow: { value: 0.0 },
        uIndoorFloor: { value: 0.0 }
      }
    });

    this.raysBlurMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VS,
      fragmentShader: RAYS_BLUR_FS,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tRays: { value: null },
        uTexel: { value: new THREE.Vector2(1, 1) }
      }
    });

    this.worldCompMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VS,
      fragmentShader: WORLD_COMPOSITE_FS,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tWorld: { value: null },
        tAO: { value: null },
        tRays: { value: null },
        uAoStrength: { value: 0.96 }
      }
    });

    this.bloomDown0Mat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VS,
      fragmentShader: BLOOM_DOWN0_FS,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tSrc: { value: null },
        uTexel: { value: new THREE.Vector2(1, 1) },
        uThreshold: { value: 1.26 },
        uKnee: { value: 0.26 }
      }
    });

    this.bloomDownMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VS,
      fragmentShader: BLOOM_DOWN_FS,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tSrc: { value: null },
        uTexel: { value: new THREE.Vector2(1, 1) }
      }
    });

    this.bloomUpMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VS,
      fragmentShader: BLOOM_UP_FS,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      blending: THREE.AdditiveBlending,
      uniforms: {
        tSrc: { value: null },
        uTexel: { value: new THREE.Vector2(1, 1) }
      }
    });

    this.finalMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VS,
      fragmentShader: FINAL_POST_FS,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tScene: { value: null },
        tBloom: { value: null },
        uExposure: { value: 1.00 },
        uBloomStrength: { value: 0.22 }
      }
    });

    this.fxaaMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VS,
      fragmentShader: FXAA_FS,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tSrc: { value: null },
        uTexel: { value: new THREE.Vector2(1, 1) }
      }
    });

    this.targets = [];
    this._hiddenTmp = [];
    this.setSize(width, height);
  }

  _disposeTargets() {
    for (const t of this.targets) t.dispose();
    this.targets.length = 0;
  }

  setSize(width, height) {
    const dpr = this.renderer.getPixelRatio();
    const w = Math.max(2, Math.round(width * dpr));
    const h = Math.max(2, Math.round(height * dpr));
    if (w === this.width && h === this.height && this.targets.length) return;
    this.width = w;
    this.height = h;
    this._disposeTargets();

    const hw = Math.max(2, w >> 1);
    const hh = Math.max(2, h >> 1);

    this.worldRT = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      samples: this.samples,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter
    });
    this.hdrRT = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      samples: 0,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter
    });

    const depthTex = new THREE.DepthTexture(hw, hh);
    depthTex.minFilter = THREE.NearestFilter;
    depthTex.magFilter = THREE.NearestFilter;

    this.halfGeoRT = new THREE.WebGLRenderTarget(hw, hh, {
      type: THREE.HalfFloatType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthTexture: depthTex
    });

    this.aoRT = new THREE.WebGLRenderTarget(hw, hh, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter
    });
    this.aoBlurRT = new THREE.WebGLRenderTarget(hw, hh, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter
    });

    this.raysRT = new THREE.WebGLRenderTarget(hw, hh, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter
    });
    this.raysBlurRT = new THREE.WebGLRenderTarget(hw, hh, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter
    });

    this.ldrRT = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter
    });

    this.targets.push(this.worldRT, this.hdrRT, this.ldrRT, this.halfGeoRT, this.aoRT, this.aoBlurRT, this.raysRT, this.raysBlurRT);

    this.bloomRTs = [];
    for (let i = 0; i < this.bloomLevels; i++) {
      const bw = Math.max(1, w >> (i + 1));
      const bh = Math.max(1, h >> (i + 1));
      const rt = new THREE.WebGLRenderTarget(bw, bh, {
        type: THREE.HalfFloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter
      });
      this.bloomRTs.push(rt);
      this.targets.push(rt);
    }

    this.aoMat.uniforms.uRes.value.set(hw, hh);
    this.aoBlurMat.uniforms.uTexel.value.set(1 / hw, 1 / hh);
    this.raysBlurMat.uniforms.uTexel.value.set(1 / hw, 1 / hh);
    this.fxaaMat.uniforms.uTexel.value.set(1 / w, 1 / h);
  }

  render({ worldScene, worldCamera, weaponScene, weaponCamera, sunLight, rayColor, rayDensity, isIndoorFloor, time }) {
    const r = this.renderer;

    // 1. Render main world scene into 4x MSAA HDR target (also triggers shadow map & Reflectors)
    r.setRenderTarget(this.worldRT);
    r.clear(true, true, true);
    r.render(worldScene, worldCamera);

    // 2. Half-res normal + depth prepass (hiding sky domes, transparent glass & planar reflectors)
    this._hiddenTmp.length = 0;
    worldScene.traverse((obj) => {
      if (obj.visible && obj.userData?.noDepthPrepass) {
        obj.visible = false;
        this._hiddenTmp.push(obj);
      }
    });
    const prevOverride = worldScene.overrideMaterial;
    const prevBg = worldScene.background;
    worldScene.overrideMaterial = this.normalOverride;
    worldScene.background = null;
    r.setRenderTarget(this.halfGeoRT);
    r.clear(true, true, false);
    r.render(worldScene, worldCamera);
    worldScene.overrideMaterial = prevOverride;
    worldScene.background = prevBg;
    for (let i = 0; i < this._hiddenTmp.length; i++) {
      this._hiddenTmp[i].visible = true;
    }

    // 3. Half-res Horizon Ambient Occlusion + depth-aware blur
    this.aoMat.uniforms.tDepth.value = this.halfGeoRT.depthTexture;
    this.aoMat.uniforms.tNormal.value = this.halfGeoRT.texture;
    this.aoMat.uniforms.uInvProj.value.copy(worldCamera.projectionMatrixInverse);
    this.aoMat.uniforms.uProj.value.copy(worldCamera.projectionMatrix);
    this.quad.material = this.aoMat;
    r.setRenderTarget(this.aoRT);
    r.clear(true, false, false);
    this.quad.render(r);

    this.aoBlurMat.uniforms.tAO.value = this.aoRT.texture;
    this.quad.material = this.aoBlurMat;
    r.setRenderTarget(this.aoBlurRT);
    r.clear(true, false, false);
    this.quad.render(r);

    // 4. Half-res Volumetric God Rays + depth-aware blur
    const hasSh = sunLight && sunLight.shadow && sunLight.shadow.map;
    this.raysMat.uniforms.tDepth.value = this.halfGeoRT.depthTexture;
    this.raysMat.uniforms.uInvProj.value.copy(worldCamera.projectionMatrixInverse);
    this.raysMat.uniforms.uCamWorld.value.copy(worldCamera.matrixWorld);
    this.raysMat.uniforms.uTime.value = time;
    this.raysMat.uniforms.uDensity.value = rayDensity;
    this.raysMat.uniforms.uIndoorFloor.value = isIndoorFloor ? 1.0 : 0.0;
    this.raysMat.uniforms.uRayColor.value.copy(rayColor);
    if (hasSh) {
      this.raysMat.uniforms.uHasShadow.value = 1.0;
      this.raysMat.uniforms.tShadowMap.value = sunLight.shadow.map.texture;
      this.raysMat.uniforms.uShadowMatrix.value.copy(sunLight.shadow.matrix);
      this.raysMat.uniforms.uSunDir.value
        .subVectors(sunLight.position, sunLight.target.position)
        .normalize();
    } else {
      this.raysMat.uniforms.uHasShadow.value = 0.0;
    }
    this.quad.material = this.raysMat;
    r.setRenderTarget(this.raysRT);
    r.clear(true, false, false);
    this.quad.render(r);

    this.raysBlurMat.uniforms.tRays.value = this.raysRT.texture;
    this.quad.material = this.raysBlurMat;
    r.setRenderTarget(this.raysBlurRT);
    r.clear(true, false, false);
    this.quad.render(r);

    // 5. Composite World + AO + Rays into 4x MSAA hdrRT, then render Weapon Viewmodel on top with 4x MSAA
    this.worldCompMat.uniforms.tWorld.value = this.worldRT.texture;
    this.worldCompMat.uniforms.tAO.value = this.aoBlurRT.texture;
    this.worldCompMat.uniforms.tRays.value = this.raysBlurRT.texture;
    this.quad.material = this.worldCompMat;
    r.setRenderTarget(this.hdrRT);
    r.clear(true, true, false);
    this.quad.render(r);

    r.clearDepth();
    r.render(weaponScene, weaponCamera);

    // 6. Karis-averaged multi-mip HDR bloom chain
    this.bloomDown0Mat.uniforms.tSrc.value = this.hdrRT.texture;
    this.bloomDown0Mat.uniforms.uTexel.value.set(1 / this.width, 1 / this.height);
    this.quad.material = this.bloomDown0Mat;
    r.setRenderTarget(this.bloomRTs[0]);
    r.clear(true, false, false);
    this.quad.render(r);

    this.quad.material = this.bloomDownMat;
    for (let i = 1; i < this.bloomLevels; i++) {
      const prev = this.bloomRTs[i - 1];
      this.bloomDownMat.uniforms.tSrc.value = prev.texture;
      this.bloomDownMat.uniforms.uTexel.value.set(1 / prev.width, 1 / prev.height);
      r.setRenderTarget(this.bloomRTs[i]);
      r.clear(true, false, false);
      this.quad.render(r);
    }

    this.quad.material = this.bloomUpMat;
    for (let i = this.bloomLevels - 1; i > 0; i--) {
      const src = this.bloomRTs[i];
      const dst = this.bloomRTs[i - 1];
      this.bloomUpMat.uniforms.tSrc.value = src.texture;
      this.bloomUpMat.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      r.setRenderTarget(dst);
      this.quad.render(r);
    }

    // 7. ACES + S-curve grading + vignette into ldrRT, followed by crisp FXAA + IGN dither to screen
    this.finalMat.uniforms.tScene.value = this.hdrRT.texture;
    this.finalMat.uniforms.tBloom.value = this.bloomRTs[0].texture;
    this.quad.material = this.finalMat;
    r.setRenderTarget(this.ldrRT);
    r.clear(true, false, false);
    this.quad.render(r);

    this.fxaaMat.uniforms.tSrc.value = this.ldrRT.texture;
    this.quad.material = this.fxaaMat;
    r.setRenderTarget(null);
    r.clear(true, false, false);
    this.quad.render(r);
  }
}
