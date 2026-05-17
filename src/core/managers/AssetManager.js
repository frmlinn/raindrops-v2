/**
 * @file AssetManager.js
 * @description Handles asynchronous loading and memory management of textures and EXR environment maps.
 */

import * as THREE from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

export class AssetManager {
    constructor() {
        this.manager = new THREE.LoadingManager();
        this.textureLoader = new THREE.TextureLoader(this.manager);
        this.exrLoader = new EXRLoader(this.manager);
        this.textures = {};
    }

    /**
     * Loads all required visual assets and triggers progress callbacks.
     * @param {Function} [onProgress=null] - Callback triggered on load progress (returns percentage and url).
     * @returns {Promise<Object>} Dictionary containing loaded THREE.Texture objects.
     */
    async loadAssets(onProgress = null) {
        return new Promise((resolve, reject) => {
            if (onProgress) {
                this.manager.onProgress = (url, itemsLoaded, itemsTotal) => {
                    onProgress((itemsLoaded / itemsTotal) * 100, url);
                };
            }

            this.manager.onLoad = () => {
                this._prepareTextures();
                resolve(this.textures);
            };

            this.manager.onError = (url) => {
                console.error(`[AssetManager] Failed to load: ${url}`);
                reject(new Error(`Load failed: ${url}`));
            };

            this.textures.dropAlphaTex = this.textureLoader.load('drop-alpha.webp');
            this.textures.dropColorTex = this.textureLoader.load('drop-color.webp');
            this.textures.dropShineTex = this.textureLoader.load('drop-shine.webp');
            this.textures.floorColorTex = this.textureLoader.load('stone_pathway.webp');
            this.textures.splashTex = this.textureLoader.load('splash.webp');

            this.textures.floorNormalTex = this.exrLoader.load('stone_pathway_normal.exr');
            this.textures.floorRoughnessTex = this.exrLoader.load('stone_pathway_roughness.exr');
        });
    }

    /**
     * Pre-configures loaded textures regarding color spaces and wrapping modes.
     * @private
     */
    _prepareTextures() {
        this.textures.splashTex.colorSpace = THREE.SRGBColorSpace;
        this.textures.dropShineTex.wrapS = THREE.ClampToEdgeWrapping;
        this.textures.dropShineTex.wrapT = THREE.ClampToEdgeWrapping;
    }

    /**
     * Safely disposes of all loaded textures to release Video RAM (VRAM).
     */
    dispose() {
        Object.values(this.textures).forEach(tex => {
            if (tex && typeof tex.dispose === 'function') {
                tex.dispose();
            }
        });
        this.textures = {};
    }
}