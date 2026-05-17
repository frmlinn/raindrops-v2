// src/main.js

import { initTweakpane, disposeTweakpane } from './conf.js';
import { Engine } from './core/Engine.js';
import { Environment } from './core/Environment.js';
import { AssetManager } from './core/managers/AssetManager.js';

let engine, assetManager, environment;

async function init() {
    const container = document.getElementById('app');
    
    const loaderUI = document.getElementById('loader');
    const text = document.getElementById('loader-text');
    const bar = document.getElementById('loader-bar');

    engine = new Engine(container);
    assetManager = new AssetManager();
    
    const textures = await assetManager.loadAssets((progress) => {
        if (text) text.innerText = `Loading resources... ${Math.floor(progress)}%`;
        if (bar) bar.style.width = `${progress}%`;
    });

    environment = new Environment(textures);
    engine.initSimulation(textures, environment);

    await engine.warmUpAsync(textures);
    initTweakpane(environment);

    if (loaderUI) {
        loaderUI.style.opacity = '0';
        setTimeout(() => loaderUI.remove(), 500);
    }

    engine.start();
}

window.destroyApp = () => {
    disposeTweakpane();
    if (engine) engine.dispose();
    if (environment) environment.dispose();
    if (assetManager) assetManager.dispose();
};

init().catch(err => {
    console.error("Error initializing: ", err);
});