// src/core/Engine.js

import * as THREE from 'three';
import { RainSimulation } from '../simulation/RainSimulation.js';
import { createRainMaterial } from '../simulation/RainMaterial.js';
import { conf } from '../conf.js';

export class Engine {
    constructor(container) {
        this.renderer = new THREE.WebGLRenderer({ antialias: false });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        container.appendChild(this.renderer.domElement);

        this.scene2D = new THREE.Scene();
        this.camera2D = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.timer = new THREE.Timer(); 

        // --- Render Targets (FBO) ---
        this.rtBg = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
        this.rtFg = new THREE.WebGLRenderTarget(window.innerWidth / 8, window.innerHeight / 8, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });

        // --- Downsampling Scene ---
        this.copyScene = new THREE.Scene();
        const copyMat = new THREE.MeshBasicMaterial({ 
            map: this.rtBg.texture, 
            depthTest: false, 
            depthWrite: false 
        });
        this.copyMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), copyMat);
        this.copyScene.add(this.copyMesh);

        // Estado del input (Se moverá en Fase 3 al InputManager)
        this.mouseX = 0;
        this.mouseY = 0;
        this.targetMouseX = 0;
        this.targetMouseY = 0;
        this.isTouching = false;
        
        this.resizeTimeout = null;

        this._setupInputListeners();
        window.addEventListener('resize', () => {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => this.onResize(), 150);
        });
    }

    initSimulation(textures, environment) {
        this.environment = environment;
        const simDpi = Math.min(window.devicePixelRatio, 1.25); 

        this.rainSimulation = new RainSimulation(
            window.innerWidth * simDpi,
            window.innerHeight * simDpi,
            simDpi, 
            textures.dropAlphaTex.image,
            textures.dropColorTex.image,
            conf.rain
        );

        const material = createRainMaterial(this.rtBg.texture, this.rtFg.texture, this.rainSimulation.canvasTexture, textures.dropShineTex, {
            renderShine: true,
            renderShadow: true,
            minRefraction: 256.0,
            refractionDelta: 256.0
        });

        this.planeMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        this.scene2D.add(this.planeMesh);

        this.onResize();
    }

    _setupInputListeners() {
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'touch') this.isTouching = true;
            this.targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
            this.targetMouseY = (e.clientY / window.innerHeight) * 2 - 1;
        });

        window.addEventListener('pointermove', (e) => {
            if (e.pointerType === 'mouse' || this.isTouching) {
                this.targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
                this.targetMouseY = (e.clientY / window.innerHeight) * 2 - 1;
            }
        });

        const handlePointerEnd = (e) => {
            if (e.pointerType === 'touch') {
                this.isTouching = false;
                this.targetMouseX = 0;
                this.targetMouseY = 0;
            }
        };

        window.addEventListener('pointerup', handlePointerEnd);
        window.addEventListener('pointercancel', handlePointerEnd);
        window.addEventListener('pointerleave', (e) => {
            if (e.pointerType === 'mouse') {
                this.targetMouseX = 0;
                this.targetMouseY = 0;
            }
        });
    }

    onResize() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        if(this.environment && this.environment.camera) {
            this.environment.camera.aspect = window.innerWidth / window.innerHeight;
            this.environment.camera.updateProjectionMatrix();
        }
        
        if(this.rtBg && this.rtFg) {
            this.rtBg.setSize(window.innerWidth, window.innerHeight);
            this.rtFg.setSize(window.innerWidth / 8, window.innerHeight / 8);
        }

        if (this.planeMesh && this.planeMesh.material) {
            this.planeMesh.material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
            
            const bgTex = this.planeMesh.material.uniforms.tBg.value;
            const texRatio = bgTex.image ? (bgTex.image.width / bgTex.image.height) : (window.innerWidth / window.innerHeight);
            const ratio = window.innerWidth / window.innerHeight;
            
            const scale = new THREE.Vector2(1.0, 1.0);
            const offset = new THREE.Vector2(0.0, 0.0);
            const ratioDelta = ratio - texRatio;
            
            if (ratioDelta >= 0.0) {
                scale.y = 1.0 + ratioDelta;
                offset.y = ratioDelta / 2.0;
            } else {
                scale.x = 1.0 - ratioDelta;
                offset.x = -ratioDelta / 2.0;
            }
            
            this.planeMesh.material.uniforms.uUvScale.value.copy(scale);
            this.planeMesh.material.uniforms.uUvOffset.value.copy(offset);
        }
        
        if(this.rainSimulation) {
            const simDpi = Math.min(window.devicePixelRatio, 1.25); 
            this.rainSimulation.width = window.innerWidth * simDpi;
            this.rainSimulation.height = window.innerHeight * simDpi;
            this.rainSimulation.scale = simDpi;
            
            this.rainSimulation.canvas.width = this.rainSimulation.width;
            this.rainSimulation.canvas.height = this.rainSimulation.height;
            this.rainSimulation.droplets.width = this.rainSimulation.width;
            this.rainSimulation.droplets.height = this.rainSimulation.height;
        }
    }

    start() {
        this.renderer.setAnimationLoop((timestamp) => this.animate(timestamp));
    }

    animate(timestamp) {
        this.timer.update(timestamp); 
        const delta = this.timer.getDelta(); 
        let timeScale = delta / (1 / 60); 
        if (timeScale > 1.1) timeScale = 1.1; 

        // Interpolación suave del cursor
        this.mouseX += (this.targetMouseX - this.mouseX) * 0.1;
        this.mouseY += (this.targetMouseY - this.mouseY) * 0.1;

        if (this.environment) {
            const camera3D = this.environment.camera;
            const targetPitch = -0.1 - (this.mouseY * 0.3);
            const targetYaw = - (this.mouseX * 0.3);

            camera3D.rotation.x += (targetPitch - camera3D.rotation.x) * 0.05;
            camera3D.rotation.y += (targetYaw - camera3D.rotation.y) * 0.05;

            if (this.planeMesh && this.planeMesh.material) {
                this.planeMesh.material.uniforms.uShineOffset.value.set(
                    camera3D.rotation.y * 0.25, 
                    (camera3D.rotation.x + 0.1) * 0.25 
                );
            }

            this.environment.update(delta, conf.stormIntensity);
        }

        if (this.rainSimulation) {
            // Sincronizamos las opciones con la configuración en tiempo real
            this.rainSimulation.options.rainChance = conf.rain.rainChance;
            this.rainSimulation.options.rainLimit = conf.rain.rainLimit;
            this.rainSimulation.options.dropletsRate = conf.rain.dropletsRate;
            this.rainSimulation.options.globalTimeScale = conf.rain.globalTimeScale;
            this.rainSimulation.options.minR = conf.rain.minR;
            this.rainSimulation.options.maxR = conf.rain.maxR;
            this.rainSimulation.options.autoShrink = conf.rain.autoShrink;

            this.rainSimulation.update(timeScale);
        }

        if (this.environment) {
            // Pass 1: Render 3D environment a FBO
            this.renderer.setRenderTarget(this.rtBg);
            this.renderer.render(this.environment.scene, this.environment.camera);
        }

        // Pass 2: Downsample rtBg a rtFg (Blur pass)
        this.renderer.setRenderTarget(this.rtFg);
        this.renderer.render(this.copyScene, this.camera2D);

        // Pass 3: Composite final 
        this.renderer.setRenderTarget(null);
        this.renderer.render(this.scene2D, this.camera2D);
    }
}