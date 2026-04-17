/**
 * main.js
 * Entry point for the hyper-realistic rain simulation.
 * Manages 3D environment rendering, screen-space lens effects, and UI controls.
 */

import * as THREE from 'three';
import GUI from 'lil-gui';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { RainSimulation } from './RainSimulation.js';
import { createRainMaterial } from './RainMaterial.js';
import { Rain3D } from './Rain3D.js';
import { Lights } from './Lights.js';

const container = document.getElementById('app');

// --- Global State Variables ---
let renderer, scene, camera, planeMesh;
let rainSimulation;
let timer;
let copyScene;

// 3D Environment State
let scene3D, camera3D;
let environmentLights;
let rtBg, rtFg; 
let mouseX = 0;
let mouseY = 0;

// Environment Rain State
let environmentRain; 
let stormIntensity3D = 0.5; 

async function init() {
    // Renderer Configuration
    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // 2D Post-processing Scene (Lens Effect)
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    timer = new THREE.Timer(); 

    // --- Asset Loading ---
    const textureLoader = new THREE.TextureLoader();
    const exrLoader = new EXRLoader();

    const [
        dropAlphaTex, dropColorTex, dropShineTex,
        floorColorTex, floorNormalTex, floorRoughnessTex, splashTex 
    ] = await Promise.all([
        textureLoader.loadAsync('/drop-alpha.webp'),
        textureLoader.loadAsync('/drop-color.webp'),
        textureLoader.loadAsync('/drop-shine.webp'),
        textureLoader.loadAsync('/stone_pathway.webp'), 
        exrLoader.loadAsync('/stone_pathway_normal.exr'),    
        exrLoader.loadAsync('/stone_pathway_roughness.exr'),
        textureLoader.loadAsync('/splash.webp')
    ]);

    splashTex.colorSpace = THREE.SRGBColorSpace;
    dropShineTex.wrapS = THREE.ClampToEdgeWrapping;
    dropShineTex.wrapT = THREE.ClampToEdgeWrapping;

    // --- Render Targets (FBO) ---
    rtBg = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    rtFg = new THREE.WebGLRenderTarget(window.innerWidth / 8, window.innerHeight / 8, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });

    // --- Downsampling Copy Scene ---
    copyScene = new THREE.Scene();
    const copyMat = new THREE.MeshBasicMaterial({ 
        map: rtBg.texture, 
        depthTest: false, 
        depthWrite: false 
    });
    const copyMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), copyMat);
    copyScene.add(copyMesh);

    // --- 3D Scene Setup (The Environment) ---
    scene3D = new THREE.Scene();
    scene3D.background = new THREE.Color(0x050b14);

    camera3D = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera3D.position.set(0, 1.6, 0); 

    environmentLights = new Lights(scene3D);

    // Floor PBR Material Configuration
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
    scene3D.add(floor);

    // --- Subsystems Initialization ---
    environmentRain = new Rain3D(scene3D, 10000, splashTex);

    // const dpi = window.devicePixelRatio;
    const simDpi = Math.min(window.devicePixelRatio, 1.25); 

    rainSimulation = new RainSimulation(
        window.innerWidth * simDpi,
        window.innerHeight * simDpi,
        simDpi, 
        dropAlphaTex.image,
        dropColorTex.image
    );

    const material = createRainMaterial(rtBg.texture, rtFg.texture, rainSimulation.canvasTexture, dropShineTex, {
        renderShine: true,
        renderShadow: true,
        minRefraction: 256.0,
        refractionDelta: 256.0
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    planeMesh = new THREE.Mesh(geometry, material);
    scene.add(planeMesh);

    // --- UI Controls (lil-gui) ---
    const gui = new GUI({ title: 'Rain Control' });
    const rainParams = {
        stormStrength: 0.35,
        minR: rainSimulation.options.minR,
        maxR: rainSimulation.options.maxR,
        autoShrink: rainSimulation.options.autoShrink,
        rainChance: rainSimulation.options.rainChance,
        rainLimit: rainSimulation.options.rainLimit,
        dropletsRate: rainSimulation.options.dropletsRate,
        globalTimeScale: rainSimulation.options.globalTimeScale,
    };

    /** Updates simulation parameters based on storm intensity slider */
    const updateStormStrength = (value) => {
        const newChance = value * 0.8;            
        const newLimit = Math.max(1, Math.floor(value * 30)); 
        const newDropletsRate = value * 200;      
        const newTimeScale = 0.1 + (value * 0.9); 

        rainSimulation.options.rainChance = newChance;
        rainSimulation.options.rainLimit = newLimit;
        rainSimulation.options.dropletsRate = newDropletsRate;
        rainSimulation.options.globalTimeScale = newTimeScale;

        rainParams.rainChance = newChance;
        rainParams.rainLimit = newLimit;
        rainParams.dropletsRate = newDropletsRate;
        rainParams.globalTimeScale = newTimeScale;

        if (environmentLights) {
            environmentLights.updateAtmosphere(value);
        }
        
        gui.controllersRecursive().forEach(c => c.updateDisplay());
        stormIntensity3D = value; 
    };

    gui.add(rainParams, 'stormStrength', 0, 1, 0.01).name('Storm Intensity').onChange(updateStormStrength);
    
    const advFolder = gui.addFolder('Advanced Physics');
    advFolder.add(rainParams, 'minR', 5, 30, 1).name('Min Radius').onChange(v => rainSimulation.options.minR = v);
    advFolder.add(rainParams, 'maxR', 20, 100, 1).name('Max Radius').onChange(v => rainSimulation.options.maxR = v);
    advFolder.add(rainParams, 'autoShrink').name('Evaporation').onChange(v => rainSimulation.options.autoShrink = v);
    advFolder.add(rainParams, 'rainChance', 0, 1, 0.01).name('Rain Chance').onChange(v => rainSimulation.options.rainChance = v).listen();
    advFolder.add(rainParams, 'rainLimit', 1, 50, 1).name('Drop Limit').onChange(v => rainSimulation.options.rainLimit = v).listen();
    advFolder.add(rainParams, 'dropletsRate', 0, 300, 1).name('Fog Rate').onChange(v => rainSimulation.options.dropletsRate = v).listen();
    advFolder.add(rainParams, 'globalTimeScale', 0.1, 2, 0.01).name('Global Speed').onChange(v => rainSimulation.options.globalTimeScale = v).listen();
    advFolder.close();

    const lightFolder = gui.addFolder('Atmosphere');
    lightFolder.add(environmentLights.ambientLight, 'intensity', 0, 5, 0.1).name('Ambient Light').listen();
    lightFolder.add(environmentLights.moonLight, 'intensity', 0, 3, 0.1).name('Moon Light').listen();
    lightFolder.add(environmentLights.fog, 'density', 0, 0.1, 0.001).name('Fog Density').listen();
    lightFolder.close();

    updateStormStrength(rainParams.stormStrength);

    // Event Listeners
    window.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX / window.innerWidth) * 2 - 1; 
        mouseY = (e.clientY / window.innerHeight) * 2 - 1;
    });
    window.addEventListener('resize', onWindowResize);
    
    onWindowResize();
    renderer.setAnimationLoop(animate);
}

function onWindowResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    if(camera3D) {
        camera3D.aspect = window.innerWidth / window.innerHeight;
        camera3D.updateProjectionMatrix();
    }
    
    if(rtBg && rtFg) {
        rtBg.setSize(window.innerWidth, window.innerHeight);
        rtFg.setSize(window.innerWidth / 8, window.innerHeight / 8);
    }

    if (planeMesh && planeMesh.material) {
        planeMesh.material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
        
        const bgTex = planeMesh.material.uniforms.tBg.value;
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
        
        planeMesh.material.uniforms.uUvScale.value.copy(scale);
        planeMesh.material.uniforms.uUvOffset.value.copy(offset);
    }
    
    if(rainSimulation) {
        const simDpi = Math.min(window.devicePixelRatio, 1.25); 
        rainSimulation.width = window.innerWidth * simDpi;
        rainSimulation.height = window.innerHeight * simDpi;
        rainSimulation.scale = simDpi;
        
        rainSimulation.canvas.width = rainSimulation.width;
        rainSimulation.canvas.height = rainSimulation.height;
        rainSimulation.droplets.width = rainSimulation.width;
        rainSimulation.droplets.height = rainSimulation.height;
    }
}

function animate(timestamp) {
    timer.update(timestamp); 
    const delta = timer.getDelta(); 
    let timeScale = delta / (1 / 60); 
    if (timeScale > 1.1) timeScale = 1.1; 

    if(camera3D) {
        const targetPitch = -0.1 - (mouseY * 0.3);
        const targetYaw = - (mouseX * 0.3);

        camera3D.rotation.x += (targetPitch - camera3D.rotation.x) * 0.05;
        camera3D.rotation.y += (targetYaw - camera3D.rotation.y) * 0.05;

        if (planeMesh && planeMesh.material) {
            planeMesh.material.uniforms.uShineOffset.value.set(
                camera3D.rotation.y * 0.25, 
                (camera3D.rotation.x + 0.1) * 0.25 
            );
        }
    }

    if (environmentRain) {
        environmentRain.update(delta, stormIntensity3D, camera3D);
    }

    if (rainSimulation) {
        rainSimulation.update(timeScale);
    }

    // Pass 1: Render 3D environment to background FBO (Full Res)
    renderer.setRenderTarget(rtBg);
    renderer.render(scene3D, camera3D);

    // Pass 2: Downsample rtBg to rtFg (Blur pass)
    renderer.setRenderTarget(rtFg);
    renderer.render(copyScene, camera);

    // Pass 3: Composite final scene to screen
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
}

init().catch(err => {
    console.error("Initialization error: ", err);
});