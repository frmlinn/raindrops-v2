// src/conf.js

import { Pane } from 'tweakpane';
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';

export const conf = {
    stormIntensity: 0.35,
    rain: {
        minR: 10, maxR: 40, autoShrink: true, rainChance: 0.35, 
        rainLimit: 6, dropletsRate: 50, globalTimeScale: 0.45
    },
    lights: {
        baseAmbientIntensity: 2.5, baseMoonIntensity: 1.5, baseFogDensity: 0.060,
        ambientColor: 0x222233, moonColor: 0x88aaff,
        moonPad: { x: 0.4, y: -0.4 } 
    },
    scene: {
        bgColor: 0x050b14
    }
};

export let fpsGraph = null;
export let pane = null;

export function initTweakpane(environment) {
    pane = new Pane({ title: 'Environment Manager' });
    pane.registerPlugin(EssentialsPlugin);

    fpsGraph = pane.addBlade({ view: 'fpsgraph', label: 'FPS', lineCount: 2 });

    const updateStorm = (value) => {
        conf.stormIntensity = value;
        conf.rain.rainChance = value * 0.8;            
        conf.rain.rainLimit = Math.max(1, Math.floor(value * 30)); 
        conf.rain.dropletsRate = value * 200;      
        conf.rain.globalTimeScale = 0.1 + (value * 0.9); 
        
        environment.updateAtmosphere(value);
        pane.refresh(); 
    };

    pane.addBinding(conf, 'stormIntensity', { label: 'Storm Intensity', min: 0, max: 1, step: 0.01 })
        .on('change', (ev) => updateStorm(ev.value));
    
    const advFolder = pane.addFolder({ title: 'Advanced Physics', expanded: false });
    advFolder.addBinding(conf.rain, 'minR', { min: 5, max: 30, step: 1, label: 'Min Radius' });
    advFolder.addBinding(conf.rain, 'maxR', { min: 20, max: 100, step: 1, label: 'Max Radius' });
    advFolder.addBinding(conf.rain, 'autoShrink', { label: 'Evaporation' });
    advFolder.addBinding(conf.rain, 'rainChance', { min: 0, max: 1, label: 'Rain Chance', readonly: true });
    advFolder.addBinding(conf.rain, 'rainLimit', { min: 1, max: 50, label: 'Drop Limit', readonly: true });
    advFolder.addBinding(conf.rain, 'dropletsRate', { min: 0, max: 300, label: 'Fog Rate', readonly: true });
    advFolder.addBinding(conf.rain, 'globalTimeScale', { min: 0.1, max: 2, label: 'Global Speed', readonly: true });

    const lightFolder = pane.addFolder({ title: 'Atmosphere' });
    lightFolder.addBinding(environment.ambientLight, 'intensity', { min: 0, max: 5, label: 'Ambient Light' });
    lightFolder.addBinding(environment.moonLight, 'intensity', { min: 0, max: 3, label: 'Moon Light' });
    lightFolder.addBinding(environment.fog, 'density', { min: 0, max: 0.1, step: 0.001, label: 'Fog Density' });
    
    lightFolder.addBinding(conf.lights, 'moonPad', {
        label: 'Moon Vector', picker: 'inline', expanded: true,
        x: { min: -1.0, max: 1.0 }, y: { min: -1.0, max: 1.0 }
    }).on('change', (ev) => {
        let nx = ev.value.x;
        let nz = ev.value.y; 
        let distSq = nx * nx + nz * nz;
        
        if (distSq > 1.0) {
            const dist = Math.sqrt(distSq);
            nx /= dist; nz /= dist; distSq = 1.0;
            conf.lights.moonPad.x = nx;
            conf.lights.moonPad.y = nz;
            pane.refresh();
        }
        
        const ny = Math.max(0.05, Math.sqrt(Math.max(0.0, 1.0 - distSq)));
        environment.updateLightPosition(nx, ny, nz);
    });

    const nx = conf.lights.moonPad.x;
    const nz = conf.lights.moonPad.y;
    const ny = Math.max(0.05, Math.sqrt(Math.max(0.0, 1.0 - (nx*nx + nz*nz))));
    environment.updateLightPosition(nx, ny, nz);

    updateStorm(conf.stormIntensity);
    if (window.innerWidth <= 768) pane.expanded = false;

    return pane;
}

export function disposeTweakpane() {
    if (pane) {
        pane.dispose();
        pane = null;
        fpsGraph = null;
    }
}