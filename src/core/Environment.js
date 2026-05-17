// src/core/Environment.js

import * as THREE from 'three';
import { Rain3D } from '../simulation/Rain3D.js';
import { conf } from '../conf.js';

export class Environment {
    constructor(textures) {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(conf.scene.bgColor);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 1.6, 0); 

        this._setupLights();
        this._setupFloor(textures);

        this.rain3D = new Rain3D(this.scene, 10000, textures.splashTex);
    }

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

    updateLightPosition(nx, ny, nz) {
        this.moonLight.position.set(nx * 30, ny * 30, nz * 30);
    }

    updateAtmosphere(stormIntensity) {
        if (!this.ambientLight || !this.moonLight || !this.fog) return;
        
        this.ambientLight.intensity = conf.lights.baseAmbientIntensity - (stormIntensity * 1.5); 
        this.moonLight.intensity = conf.lights.baseMoonIntensity - (stormIntensity * 1.3);    
        this.fog.density = conf.lights.baseFogDensity + (stormIntensity * 0.035); 
    }

    update(delta, stormIntensity) {
        this.rain3D.update(delta, stormIntensity, this.camera);
    }
}