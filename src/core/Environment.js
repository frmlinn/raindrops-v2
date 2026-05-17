/**
 * @file Environment.js
 * @description Orchestrates the 3D scene, lighting, materials, and atmospheric fog properties.
 */

import * as THREE from 'three';
import { Rain3D } from '../simulation/Rain3D.js';
import { conf } from '../conf.js';

export class Environment {
    /**
     * Creates the 3D environment, initializes lights, and sets up PBR floor materials.
     * @param {Object} textures - Dictionary of preloaded textures.
     */
    constructor(textures) {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(conf.scene.bgColor);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 1.6, 0); 

        this._setupLights();
        this._setupFloor(textures);

        this.rain3D = new Rain3D(this.scene, 10000, textures.splashTex);
    }

    /**
     * Initializes fog and environmental lighting.
     * @private
     */
    _setupLights() {
        this.fog = new THREE.FogExp2(conf.scene.bgColor, conf.lights.baseFogDensity);
        this.scene.fog = this.fog;

        this.ambientLight = new THREE.AmbientLight(conf.lights.ambientColor, conf.lights.baseAmbientIntensity);
        this.scene.add(this.ambientLight);

        this.moonLight = new THREE.DirectionalLight(conf.lights.moonColor, conf.lights.baseMoonIntensity);
        this.scene.add(this.moonLight);

        this.streetLight = new THREE.PointLight(0xffaa55, 1000, 30);
        this.streetLight.position.set(2, 4, -5);
        this.scene.add(this.streetLight);
        
        this.backLight = new THREE.PointLight(0x5588ff, 800, 30);
        this.backLight.position.set(-5, 2, -15);
        this.scene.add(this.backLight);
    }

    /**
     * Initializes the PBR floor mesh with corresponding normal and roughness maps.
     * @param {Object} textures - Dictionary of preloaded textures.
     * @private
     */
    _setupFloor(textures) {
        const { floorColorTex, floorNormalTex, floorRoughnessTex } = textures;
        
        floorColorTex.colorSpace = THREE.SRGBColorSpace;
        [floorColorTex, floorNormalTex, floorRoughnessTex].forEach(tex => {
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(10, 10);
        });

        const floorGeo = new THREE.PlaneGeometry(50, 50);
        const floorMat = new THREE.MeshStandardMaterial({
            map: floorColorTex,
            normalMap: floorNormalTex,
            roughnessMap: floorRoughnessTex,
            color: 0xffffff, 
            roughness: 0.35, 
            metalness: 0.0   
        });

        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        this.scene.add(floor);
    }

    /**
     * Updates the moon directional light position based on 3D gimbal coordinates.
     * @param {number} nx - Normalized X coordinate.
     * @param {number} ny - Normalized Y coordinate.
     * @param {number} nz - Normalized Z coordinate.
     */
    updateLightPosition(nx, ny, nz) {
        this.moonLight.position.set(nx * 30, ny * 30, nz * 30);
    }

    /**
     * Dynamically adjusts lighting and fog density based on storm intensity.
     * @param {number} stormIntensity - Value from 0.0 to 1.0 representing the storm strength.
     */
    updateAtmosphere(stormIntensity) {
        if (!this.ambientLight || !this.moonLight || !this.fog) return;
        
        this.ambientLight.intensity = conf.lights.baseAmbientIntensity - (stormIntensity * 1.5); 
        this.moonLight.intensity = conf.lights.baseMoonIntensity - (stormIntensity * 1.3);    
        this.fog.density = conf.lights.baseFogDensity + (stormIntensity * 0.035); 
    }

    /**
     * Updates the 3D environmental rain particles.
     * @param {number} delta - Frame delta time.
     * @param {number} stormIntensity - Global storm strength modifier.
     */
    update(delta, stormIntensity) {
        if (this.rain3D) {
            this.rain3D.update(delta, stormIntensity, this.camera);
        }
    }

    /**
     * Safely traverses the scene and disposes of all geometries and materials.
     */
    dispose() {
        this.scene.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });

        if (this.rain3D && typeof this.rain3D.dispose === 'function') {
            this.rain3D.dispose();
        }

        this.scene.clear();
    }
}