/**
 * Rain3D.js
 * High-performance 3D environmental rain and collision splashes.
 * Optimized: Data-Oriented CPU Loop + Vertex Shader Billboarding.
 */

import * as THREE from 'three';

export class Rain3D {
    constructor(scene, dropCount = 10000, splashTexture) {
        this.scene = scene;
        this.dropCount = dropCount;

        // --- DATA ARRAYS (Para rendimiento extremo en CPU) ---
        this.positions = new Float32Array(this.dropCount * 3);
        this.scales = new Float32Array(this.dropCount);
        this.velocities = new Float32Array(this.dropCount);
        
        this.splashPositions = new Float32Array(this.dropCount * 3);
        this.splashProgressArray = new Float32Array(this.dropCount).fill(1.0);

        for (let i = 0; i < this.dropCount; i++) {
            let i3 = i * 3;
            this.positions[i3 + 0] = (Math.random() - 0.5) * 40;
            this.positions[i3 + 1] = Math.random() * 25;
            this.positions[i3 + 2] = (Math.random() - 0.5) * 30 - 5;
            
            this.scales[i] = 0.5 + Math.random() * 0.8;
            this.velocities[i] = 0.5 + Math.random() * 0.3;
        }

        // ==========================================
        // 1. RAINDROP SYSTEM (InstancedBufferGeometry)
        // ==========================================
        const baseDropGeo = new THREE.PlaneGeometry(0.1, 0.4);
        const dropGeo = new THREE.InstancedBufferGeometry();
        dropGeo.copy(baseDropGeo);
        dropGeo.instanceCount = this.dropCount; // Definimos el total de instancias
        
        dropGeo.setAttribute('aInstPos', new THREE.InstancedBufferAttribute(this.positions, 3));
        dropGeo.setAttribute('aScale', new THREE.InstancedBufferAttribute(this.scales, 1));

        const dropMat = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            uniforms: { 
                uOpacity: { value: 0.5 },
                uStormIntensity: { value: 0.0 },
                uCameraPos: { value: new THREE.Vector3() }
            },
            vertexShader: `
                attribute vec3 aInstPos;
                attribute float aScale;
                uniform float uStormIntensity;
                uniform vec3 uCameraPos;
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    
                    // Cylindrical Billboarding 
                    vec3 lookDir = uCameraPos - aInstPos;
                    lookDir.y = 0.0; 
                    if(length(lookDir) > 0.001) {
                        lookDir = normalize(lookDir);
                    } else {
                        lookDir = vec3(0.0, 0.0, 1.0);
                    }
                    
                    vec3 right = cross(vec3(0.0, 1.0, 0.0), lookDir);
                    vec3 up = vec3(0.0, 1.0, 0.0);
                    
                    float stretch = 1.0 + (uStormIntensity * 1.5);
                    vec3 vertexOffset = right * (position.x * aScale) + up * (position.y * aScale * stretch);
                    
                    vec4 worldPosition = modelMatrix * vec4(aInstPos + vertexOffset, 1.0);
                    gl_Position = projectionMatrix * viewMatrix * worldPosition;
                }
            `,
            fragmentShader: `
                uniform float uOpacity;
                varying vec2 vUv;

                float sdUnevenCapsule( vec2 p, float r1, float r2, float h ) {
                    p.x = abs(p.x);
                    float b = (r1-r2)/h;
                    float a = sqrt(1.0-b*b);
                    float k = dot(p,vec2(-b,a));
                    if( k < 0.0 ) return length(p) - r1;
                    if( k > a*h ) return length(p-vec2(0.0,h)) - r2;
                    return dot(p, vec2(a,b) ) - r1;
                }

                void main() {
                    vec2 coord = vUv - 0.5;
                    coord *= 10.0;
                    float dropletDistance = sdUnevenCapsule(coord, 0.4, 0.0, 3.5);
                    float alpha = 1.0 - smoothstep(0.0, 0.15, dropletDistance);
                    if (alpha <= 0.0) discard;
                    gl_FragColor = vec4(0.8, 0.9, 1.0, alpha * uOpacity);
                }
            `
        });

        // Usamos THREE.Mesh normal. Es más rápido ya que gestionamos los atributos manualmente.
        this.dropMesh = new THREE.Mesh(dropGeo, dropMat);
        this.dropMesh.frustumCulled = false; // <--- SOLUCIÓN AL CULLING
        this.scene.add(this.dropMesh);

        // ==========================================
        // 2. SPLASH SYSTEM (InstancedBufferGeometry)
        // ==========================================
        const baseSplashGeo = new THREE.PlaneGeometry(0.3, 0.3);
        const splashGeo = new THREE.InstancedBufferGeometry();
        splashGeo.copy(baseSplashGeo);
        splashGeo.instanceCount = this.dropCount;

        splashGeo.setAttribute('aSplashPos', new THREE.InstancedBufferAttribute(this.splashPositions, 3));
        splashGeo.setAttribute('aSplashProgress', new THREE.InstancedBufferAttribute(this.splashProgressArray, 1));

        const splashMat = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            uniforms: {
                uFlipBook: { value: splashTexture },
                uOpacity: { value: 0.5 },
                uCameraPos: { value: new THREE.Vector3() }
            },
            vertexShader: `
                attribute vec3 aSplashPos;
                attribute float aSplashProgress;
                uniform vec3 uCameraPos;
                varying vec2 vUv;
                varying float vSplashProgress;

                float rand(float n){return fract(sin(n) * 43758.5453123);}

                void main() {
                    vUv = uv;
                    vSplashProgress = aSplashProgress;
                    
                    vec3 lookDir = uCameraPos - aSplashPos;
                    if(length(lookDir) > 0.001) {
                        lookDir = normalize(lookDir);
                    } else {
                        lookDir = vec3(0.0, 0.0, 1.0);
                    }
                    
                    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), lookDir));
                    vec3 up = normalize(cross(lookDir, right));
                    
                    float sScale = 0.4 + rand(float(gl_InstanceID)) * 0.3;
                    
                    vec3 pos = position;
                    pos.y += 0.15; 
                    vec3 vertexOffset = right * (pos.x * sScale) + up * (pos.y * sScale);
                    
                    vec4 worldPosition = modelMatrix * vec4(aSplashPos + vertexOffset, 1.0);
                    gl_Position = projectionMatrix * viewMatrix * worldPosition;
                }
            `,
            fragmentShader: `
                uniform sampler2D uFlipBook;
                uniform float uOpacity;
                varying vec2 vUv;
                varying float vSplashProgress;

                vec2 getFlipbookUv(vec2 uv, float width, float height, float tile) {
                    float tileX = mod(tile, width);
                    float tileY = floor(tile / width);
                    tileY = height - 1.0 - tileY; 
                    vec2 tileSize = vec2(1.0 / width, 1.0 / height);
                    return (uv + vec2(tileX, tileY)) * tileSize;
                }

                void main() {
                    if (vSplashProgress >= 1.0) discard;

                    float cols = 4.0;
                    float rows = 5.0;
                    float totalFrames = cols * rows;
                    float currentFrame = floor(vSplashProgress * totalFrames);
                    
                    vec2 uv = getFlipbookUv(vUv, cols, rows, currentFrame);
                    vec4 texel = texture2D(uFlipBook, uv);

                    if (texel.a <= 0.05) discard;
                    gl_FragColor = vec4(texel.rgb, texel.a * uOpacity);
                }
            `
        });

        this.splashMesh = new THREE.Mesh(splashGeo, splashMat);
        this.splashMesh.frustumCulled = false; // <--- SOLUCIÓN AL CULLING
        this.scene.add(this.splashMesh);
    }

    update(delta, stormIntensity, camera) {
        if (!this.dropMesh || !this.splashMesh || !camera) return;

        this.dropMesh.material.uniforms.uOpacity.value = 0.05 + (stormIntensity * 0.6);
        this.dropMesh.material.uniforms.uStormIntensity.value = stormIntensity;
        this.dropMesh.material.uniforms.uCameraPos.value.copy(camera.position);

        this.splashMesh.material.uniforms.uOpacity.value = 0.05 + (stormIntensity * 0.5);
        this.splashMesh.material.uniforms.uCameraPos.value.copy(camera.position);

        const baseSpeed = (10 + (stormIntensity * 25)) * delta; 
        let needsSplashUpdate = false;

        for (let i = 0; i < this.dropCount; i++) {
            let i3 = i * 3;

            this.positions[i3 + 1] -= this.velocities[i] * baseSpeed;

            if (this.positions[i3 + 1] < 0) {
                this.splashProgressArray[i] = 0.0;
                this.splashPositions[i3] = this.positions[i3];
                this.splashPositions[i3 + 1] = 0; 
                this.splashPositions[i3 + 2] = this.positions[i3 + 2];
                needsSplashUpdate = true;

                this.positions[i3] = (Math.random() - 0.5) * 40;
                this.positions[i3 + 1] = 20 + Math.random() * 5;
                this.positions[i3 + 2] = (Math.random() - 0.5) * 30 - 5;
            }

            if (this.splashProgressArray[i] < 1.0) {
                this.splashProgressArray[i] += delta * 2.5; 
                needsSplashUpdate = true;
            }
        }
        
        this.dropMesh.geometry.attributes.aInstPos.needsUpdate = true;
        if (needsSplashUpdate) {
            this.splashMesh.geometry.attributes.aSplashPos.needsUpdate = true;
            this.splashMesh.geometry.attributes.aSplashProgress.needsUpdate = true;
        }
    }
}