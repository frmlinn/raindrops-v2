/**
 * @file Engine.js
 * @description Core rendering loop, Framebuffer Object (FBO) management, and rendering orchestration.
 */

import * as THREE from 'three';
import { RainSimulation } from '../simulation/RainSimulation.js';
import { createRainMaterial } from '../simulation/RainMaterial.js';
import { conf, fpsGraph } from '../conf.js'; 
import { InputManager } from './managers/InputManager.js';

export class Engine {
    /**
     * Initializes the WebGL Renderer, Scenes, and Render Targets.
     * @param {HTMLElement} container - The DOM element to attach the canvas to.
     */
    constructor(container) {
        this.renderer = new THREE.WebGLRenderer({ antialias: false });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        container.appendChild(this.renderer.domElement);

        this.scene2D = new THREE.Scene();
        this.camera2D = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        
        this.timer = new THREE.Timer(); 

        // Optimization: Instantiate vectors once to prevent Garbage Collection spikes on resize
        this.uvScale = new THREE.Vector2(1.0, 1.0);
        this.uvOffset = new THREE.Vector2(0.0, 0.0);

        // --- Render Targets (FBO) ---
        this.rtBg = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
        this.rtFg = new THREE.WebGLRenderTarget(window.innerWidth / 8, window.innerHeight / 8, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });

        this.copyScene = new THREE.Scene();
        const copyMat = new THREE.MeshBasicMaterial({ 
            map: this.rtBg.texture, 
            depthTest: false, 
            depthWrite: false 
        });
        this.copyMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), copyMat);
        this.copyScene.add(this.copyMesh);

        this.input = new InputManager();
        this.mouseX = 0;
        this.mouseY = 0;
        
        this.resizeTimeout = null;

        // Context binding to prevent memory leaks when removing the event listener
        this._onResizeBound = this._handleResizeEvent.bind(this);
        window.addEventListener('resize', this._onResizeBound);
    }

    /**
     * Handles the window resize event, splitting tasks between synchronous and debounced execution.
     * @private
     */
    _handleResizeEvent() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        // 1. Synchronous screen adjustment to prevent visual stretching on mobile device rotation
        this.renderer.setSize(width, height);

        if (this.environment && this.environment.camera) {
            this.environment.camera.aspect = width / height;
            this.environment.camera.updateProjectionMatrix();
        }

        if (this.planeMesh && this.planeMesh.material) {
            this.planeMesh.material.uniforms.uResolution.value.set(width, height);
            
            const bgTex = this.planeMesh.material.uniforms.tBg.value;
            const texRatio = bgTex.image ? (bgTex.image.width / bgTex.image.height) : (width / height);
            const ratio = width / height;
            const ratioDelta = ratio - texRatio;
            
            // Direct vector mutation using .set() avoiding "new Vector2" object creation
            if (ratioDelta >= 0.0) {
                this.planeMesh.material.uniforms.uUvScale.value.set(1.0, 1.0 + ratioDelta);
                this.planeMesh.material.uniforms.uUvOffset.value.set(0.0, ratioDelta / 2.0);
            } else {
                this.planeMesh.material.uniforms.uUvScale.value.set(1.0 - ratioDelta, 1.0);
                this.planeMesh.material.uniforms.uUvOffset.value.set(-ratioDelta / 2.0, 0.0);
            }
        }

        // 2. Asynchronous (Debounce) adjustment for heavy buffers to avoid GPU saturation
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => this._debounceResize(width, height), 150);
    }

    /**
     * Resizes heavy Framebuffer Objects and 2D canvas simulation.
     * @param {number} width - Viewport width
     * @param {number} height - Viewport height
     * @private
     */
    _debounceResize(width, height) {
        if(this.rtBg && this.rtFg) {
            this.rtBg.setSize(width, height);
            this.rtFg.setSize(width / 8, height / 8);
        }

        if(this.rainSimulation) {
            const simDpi = Math.min(window.devicePixelRatio, 1.25); 
            this.rainSimulation.width = width * simDpi;
            this.rainSimulation.height = height * simDpi;
            this.rainSimulation.scale = simDpi;
            
            this.rainSimulation.canvas.width = this.rainSimulation.width;
            this.rainSimulation.canvas.height = this.rainSimulation.height;
            this.rainSimulation.droplets.width = this.rainSimulation.width;
            this.rainSimulation.droplets.height = this.rainSimulation.height;
        }
    }

    /**
     * Bootstraps the 2D rain simulation and applies the final screen shader material.
     * @param {Object} textures - Dictionary of loaded textures.
     * @param {Environment} environment - 3D scene environment instance.
     */
    initSimulation(textures, environment) {
        this.environment = environment;
        const simDpi = Math.min(window.devicePixelRatio, 1.25); 

        this.rainSimulation = new RainSimulation(
            window.innerWidth * simDpi,
            window.innerHeight * simDpi,
            simDpi, 
            textures.dropAlphaTex.image,
            textures.dropColorTex.image
        );

        conf.rain.minR = this.rainSimulation.options.minR;
        conf.rain.maxR = this.rainSimulation.options.maxR;
        conf.rain.autoShrink = this.rainSimulation.options.autoShrink;

        const material = createRainMaterial(this.rtBg.texture, this.rtFg.texture, this.rainSimulation.canvasTexture, textures.dropShineTex, {
            renderShine: true,
            renderShadow: true,
            minRefraction: 256.0,
            refractionDelta: 256.0
        });

        this.planeMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        this.scene2D.add(this.planeMesh);

        this._handleResizeEvent();
    }

    /**
     * Pre-compiles WebGL shaders and uploads textures to VRAM asynchronously.
     * @param {Object} textures - Dictionary of loaded textures.
     * @returns {Promise<void>}
     */
    async warmUpAsync(textures) {
        if (!this.environment) return;
        
        await this.renderer.compileAsync(this.environment.scene, this.environment.camera);
        await this.renderer.compileAsync(this.copyScene, this.camera2D);
        await this.renderer.compileAsync(this.scene2D, this.camera2D);
    }

    /**
     * Starts the main animation loop.
     */
    start() {
        this.timer.reset(); 
        this.renderer.setAnimationLoop((timestamp) => this.animate(timestamp));
    }

    /**
     * Core rendering loop executed every frame.
     * @param {number} timestamp - RequestAnimationFrame timestamp.
     */
    animate(timestamp) {
        if (fpsGraph) fpsGraph.begin(); 

        this.timer.update(timestamp); 
        const delta = this.timer.getDelta(); 
        let timeScale = delta / (1 / 60); 
        if (timeScale > 1.1) timeScale = 1.1; 

        this.mouseX += (this.input.targetX - this.mouseX) * 0.1;
        this.mouseY += (this.input.targetY - this.mouseY) * 0.1;

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
            this.renderer.setRenderTarget(this.rtBg);
            this.renderer.render(this.environment.scene, this.environment.camera);
        }

        this.renderer.setRenderTarget(this.rtFg);
        this.renderer.render(this.copyScene, this.camera2D);

        this.renderer.setRenderTarget(null);
        this.renderer.render(this.scene2D, this.camera2D);

        if (fpsGraph) fpsGraph.end(); 
    }

    /**
     * Safely destroys the engine, clears WebGL context, and removes event listeners.
     */
    dispose() {
        this.renderer.setAnimationLoop(null);
        window.removeEventListener('resize', this._onResizeBound);
        clearTimeout(this.resizeTimeout);

        if (this.input) this.input.dispose();

        if (this.rtBg) this.rtBg.dispose();
        if (this.rtFg) this.rtFg.dispose();

        this.copyScene.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });

        this.scene2D.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });

        if (this.rainSimulation && typeof this.rainSimulation.dispose === 'function') {
             this.rainSimulation.dispose();
        }

        this.renderer.dispose();
    }
}