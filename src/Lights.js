/**
 * Lights.js
 * Encapsulates the 3D environment's lighting, fog, and dynamic atmospheric changes.
 */
import * as THREE from 'three';

export class Lights {
    constructor(scene) {
        this.scene = scene;

        // 1. Fog Configuration
        this.fog = new THREE.FogExp2(0x050b14, 0.015);
        this.scene.fog = this.fog;

        // 2. Base Lighting Config (Stored to allow dynamic updates)
        this.baseAmbientIntensity = 2.5;
        this.baseMoonIntensity = 1.5;
        this.baseFogDensity = 0.015;

        // 3. Instantiate Lights
        this.ambientLight = new THREE.AmbientLight(0x222233, this.baseAmbientIntensity);
        this.scene.add(this.ambientLight);

        this.moonLight = new THREE.DirectionalLight(0x88aaff, this.baseMoonIntensity);
        this.moonLight.position.set(10, 20, -10);
        this.scene.add(this.moonLight);

        this.streetLight = new THREE.PointLight(0xffaa55, 1000, 30);
        this.streetLight.position.set(2, 4, -5);
        this.scene.add(this.streetLight);
        
        this.backLight = new THREE.PointLight(0x5588ff, 800, 30);
        this.backLight.position.set(-5, 2, -15);
        this.scene.add(this.backLight);
    }

    /**
     * Updates the atmospheric lighting based on the current storm intensity.
     * @param {number} stormIntensity - Value between 0.0 (calm) and 1.0 (heavy storm)
     */
    updateAtmosphere(stormIntensity) {
        if (!this.ambientLight || !this.moonLight || !this.fog) return;

        // Decrease light and increase fog as the storm gets stronger
        this.ambientLight.intensity = this.baseAmbientIntensity - (stormIntensity * 1.5); 
        this.moonLight.intensity = this.baseMoonIntensity - (stormIntensity * 1.3);    
        this.fog.density = this.baseFogDensity + (stormIntensity * 0.035); 
    }
}