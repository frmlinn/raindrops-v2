// src/main.js

import { initTweakpane } from './conf.js';
import { Engine } from './core/Engine.js';
import { Environment } from './core/Environment.js';
import { AssetManager } from './core/managers/AssetManager.js';

async function init() {
    const container = document.getElementById('app');
    
    const engine = new Engine(container);
    const assetManager = new AssetManager();
    const textures = await assetManager.loadAssets();

    const environment = new Environment(textures);
    engine.initSimulation(textures, environment);

    initTweakpane(environment);

    await engine.warmUpAsync(textures);
    engine.start();
}

init().catch(err => {
    console.error("Initialization error: ", err);
});