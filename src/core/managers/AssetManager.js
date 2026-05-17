// src/core/managers/AssetManager.js

import * as THREE from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

export class AssetManager {
    constructor() {
        this.manager = new THREE.LoadingManager();
        this.textureLoader = new THREE.TextureLoader(this.manager);
        this.exrLoader = new EXRLoader(this.manager);
        this.textures = {};
    }

    async loadAssets(onProgress = null) {
        return new Promise((resolve, reject) => {
            if (onProgress) {
                this.manager.onProgress = (url, itemsLoaded, itemsTotal) => {
                    const percent = (itemsLoaded / itemsTotal) * 100;
                    onProgress(percent.toFixed(0), url);
                };
            }

            this.manager.onLoad = () => {
                this._prepareTextures();
                resolve(this.textures);
            };

            this.manager.onError = (url) => {
                console.error(`[AssetManager] Error cargando asset: ${url}`);
                reject(new Error(`Fallo al cargar: ${url}`));
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

    _prepareTextures() {
        this.textures.splashTex.colorSpace = THREE.SRGBColorSpace;
        this.textures.dropShineTex.wrapS = THREE.ClampToEdgeWrapping;
        this.textures.dropShineTex.wrapT = THREE.ClampToEdgeWrapping;
    }
}