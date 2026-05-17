// src/conf.js

export const conf = {
    stormIntensity: 0.35,
    rain: {
        minR: 10,
        maxR: 40,
        autoShrink: true,
        rainChance: 0.35,
        rainLimit: 6,
        dropletsRate: 50,
        globalTimeScale: 0.45
    },
    lights: {
        baseAmbientIntensity: 2.5,
        baseMoonIntensity: 1.5,
        baseFogDensity: 0.015,
        ambientColor: 0x222233,
        moonColor: 0x88aaff
    },
    scene: {
        bgColor: 0x050b14
    }
};