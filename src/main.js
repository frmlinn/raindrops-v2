// src/main.js

import * as THREE from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import GUI from 'lil-gui';
import { conf } from './conf.js';
import { Engine } from './core/Engine.js';
import { Environment } from './core/Environment.js';

async function init() {
    const container = document.getElementById('app');
    
    // 1. Inicialización del Motor (Render, FBOs)
    const engine = new Engine(container);

    // 2. Carga temporal de Assets (Será gestionada por AssetManager en Fase 2)
    const textureLoader = new THREE.TextureLoader();
    const exrLoader = new EXRLoader();

    const [
        dropAlphaTex, dropColorTex, dropShineTex,
        floorColorTex, floorNormalTex, floorRoughnessTex, splashTex 
    ] = await Promise.all([
        textureLoader.loadAsync('drop-alpha.webp'),
        textureLoader.loadAsync('drop-color.webp'),
        textureLoader.loadAsync('drop-shine.webp'),
        textureLoader.loadAsync('stone_pathway.webp'), 
        exrLoader.loadAsync('stone_pathway_normal.exr'),    
        exrLoader.loadAsync('stone_pathway_roughness.exr'),
        textureLoader.loadAsync('splash.webp')
    ]);

    splashTex.colorSpace = THREE.SRGBColorSpace;
    dropShineTex.wrapS = THREE.ClampToEdgeWrapping;
    dropShineTex.wrapT = THREE.ClampToEdgeWrapping;

    const textures = {
        dropAlphaTex, dropColorTex, dropShineTex,
        floorColorTex, floorNormalTex, floorRoughnessTex, splashTex
    };

    // 3. Inyección y conexión de Sistemas
    const environment = new Environment(textures);
    engine.initSimulation(textures, environment);

    // 4. GUI Temporal (Se migrará a Tweakpane en Fase 4)
    initTemporaryGUI(environment);

    // 5. Arranque
    engine.start();
}

function initTemporaryGUI(environment) {
    const gui = new GUI({ title: 'Rain Control' });
    
    const updateStormStrength = (value) => {
        conf.stormIntensity = value;
        conf.rain.rainChance = value * 0.8;            
        conf.rain.rainLimit = Math.max(1, Math.floor(value * 30)); 
        conf.rain.dropletsRate = value * 200;      
        conf.rain.globalTimeScale = 0.1 + (value * 0.9); 
        
        environment.updateAtmosphere(value);
        gui.controllersRecursive().forEach(c => c.updateDisplay());
    };

    gui.add(conf, 'stormIntensity', 0, 1, 0.01).name('Storm Intensity').onChange(updateStormStrength);
    
    const advFolder = gui.addFolder('Advanced Physics');
    advFolder.add(conf.rain, 'minR', 5, 30, 1).name('Min Radius');
    advFolder.add(conf.rain, 'maxR', 20, 100, 1).name('Max Radius');
    advFolder.add(conf.rain, 'autoShrink').name('Evaporation');
    advFolder.add(conf.rain, 'rainChance', 0, 1, 0.01).name('Rain Chance').listen();
    advFolder.add(conf.rain, 'rainLimit', 1, 50, 1).name('Drop Limit').listen();
    advFolder.add(conf.rain, 'dropletsRate', 0, 300, 1).name('Fog Rate').listen();
    advFolder.add(conf.rain, 'globalTimeScale', 0.1, 2, 0.01).name('Global Speed').listen();
    advFolder.close();

    const lightFolder = gui.addFolder('Atmosphere');
    lightFolder.add(environment.ambientLight, 'intensity', 0, 5, 0.1).name('Ambient Light').listen();
    lightFolder.add(environment.moonLight, 'intensity', 0, 3, 0.1).name('Moon Light').listen();
    lightFolder.add(environment.fog, 'density', 0, 0.1, 0.001).name('Fog Density').listen();
    lightFolder.close();

    updateStormStrength(conf.stormIntensity);

    if (window.innerWidth <= 768) {
        gui.close();
    }
}

init().catch(err => {
    console.error("Initialization error: ", err);
});