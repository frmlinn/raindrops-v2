/**
 * RainMaterial.js
 * Custom ShaderMaterial for realistic rain refraction and glass effects.
 * Optimized: Branchless + Pre-calculated UV Scales to prevent ALU bottlenecks.
 */

import * as THREE from 'three';

export function createRainMaterial(bgTexture, fgTexture, canvasTexture, shineTexture, options = {}) {
    const config = {
        brightness: 1.04,
        alphaMultiply: 6.0,
        alphaSubtract: 3.0,
        minRefraction: 256.0,
        refractionDelta: 256.0,
        renderShine: true,
        renderShadow: true,
        ...options
    };

    const material = new THREE.ShaderMaterial({
        transparent: true,
        defines: {
            USE_SHINE: config.renderShine ? 1 : 0,
            USE_SHADOW: config.renderShadow ? 1 : 0
        },
        uniforms: {
            tBg: { value: bgTexture },
            tFg: { value: fgTexture },
            tWater: { value: canvasTexture },
            tShine: { value: shineTexture },
            uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            uUvScale: { value: new THREE.Vector2(1.0, 1.0) },
            uUvOffset: { value: new THREE.Vector2(0.0, 0.0) },
            uBrightness: { value: config.brightness },
            uAlphaMultiply: { value: config.alphaMultiply },
            uAlphaSubtract: { value: config.alphaSubtract },
            uMinRefraction: { value: config.minRefraction },
            uRefractionDelta: { value: config.refractionDelta },
            uShineOffset: { value: new THREE.Vector2(0.0, 0.0) }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D tBg;
            uniform sampler2D tFg;
            uniform sampler2D tWater;
            uniform sampler2D tShine;
            uniform vec2 uResolution;
            
            uniform vec2 uUvScale;
            uniform vec2 uUvOffset;
            
            uniform float uBrightness;
            uniform float uAlphaMultiply;
            uniform float uAlphaSubtract;
            uniform float uMinRefraction;
            uniform float uRefractionDelta;
            uniform vec2 uShineOffset;

            varying vec2 vUv;

            vec4 blend(vec4 bg, vec4 fg){
                vec3 bgm = bg.rgb * bg.a;
                vec3 fgm = fg.rgb * fg.a;
                float ia = 1.0 - fg.a;
                float a = (fg.a + bg.a * ia);
                vec3 rgb = vec3(0.0);
                if(a != 0.0){
                    rgb = (fgm + bgm * ia) / a;
                }
                return vec4(rgb, a);
            }

            void main() {
                vec4 water = texture2D(tWater, vUv);
                float y = water.r;
                float x = water.g;
                float d = water.b; 
                float a = clamp(water.a * uAlphaMultiply - uAlphaSubtract, 0.0, 1.0);

                vec2 pixel = vec2(1.0, 1.0) / uResolution;
                vec2 refraction = (vec2(x, y) - 0.5) * 2.0;
                vec2 refractionOffset = pixel * refraction * (uMinRefraction + (d * uRefractionDelta));
                
                // OPTIMIZACIÓN: Aplicamos directamente la escala y el offset calculados en la CPU
                vec2 baseUV = (vUv + uUvOffset) / uUvScale;
                vec2 refractedUV = baseUV + refractionOffset;

                vec4 bgNode = texture2D(tBg, baseUV);
                vec4 tex = texture2D(tFg, refractedUV);

                #if USE_SHINE == 1
                    float maxShine = 490.0;
                    float minShine = maxShine * 0.18;
                    vec2 shinePos = vec2(0.5, 0.5) + uShineOffset + ((1.0 / 512.0) * refraction) * -(minShine + ((maxShine - minShine) * d));
                    vec4 shine = texture2D(tShine, shinePos);
                    tex = blend(tex, shine);
                #endif

                vec4 fgNode = vec4(tex.rgb * uBrightness, a);

                #if USE_SHADOW == 1
                    vec2 shadowOffset = pixel * vec2(0.0, -(d * 6.0));
                    float borderAlpha = texture2D(tWater, vUv + shadowOffset).a;
                    borderAlpha = borderAlpha * uAlphaMultiply - (uAlphaSubtract + 0.5);
                    borderAlpha = clamp(borderAlpha, 0.0, 1.0);
                    borderAlpha *= 0.2; 
                    vec4 border = vec4(0.0, 0.0, 0.0, borderAlpha);
                    fgNode = blend(border, fgNode);
                #endif

                gl_FragColor = blend(bgNode, fgNode);
            }
        `
    });

    return material;
}