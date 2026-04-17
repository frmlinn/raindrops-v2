/**
 * RainSimulation.js
 * Core physics engine for 2D rain simulation on a glass surface.
 * Optimized: Object Pooling (Zero Garbage Collection).
 */

import * as THREE from 'three';
import { random, chance, times } from './utils.js';

const DROP_SIZE = 128;

const DEFAULT_OPTIONS = {
    minR: 10, maxR: 40, maxDrops: 900, rainChance: 0.35, rainLimit: 6, dropletsRate: 50,
    dropletsSize: [2, 4], dropletsCleaningRadiusMultiplier: 0.28, globalTimeScale: 0.45,
    trailRate: 1, autoShrink: true, spawnArea: [-0.1, 0.95], trailScaleRange: [0.2, 0.45],
    collisionRadius: 0.45, collisionRadiusIncrease: 0.01, dropFallMultiplier: 1,
    collisionBoostMultiplier: 0.05, collisionBoost: 1,
};

export class RainSimulation {
    constructor(width, height, scale, dropAlphaImg, dropColorImg, options = {}) {
        this.width = width;
        this.height = height;
        this.scale = scale;
        this.dropAlpha = dropAlphaImg;
        this.dropColor = dropColorImg;
        this.options = { ...DEFAULT_OPTIONS, ...options };

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

        this.droplets = document.createElement('canvas');
        this.droplets.width = this.width;
        this.droplets.height = this.height;
        this.dropletsCtx = this.droplets.getContext('2d', { willReadFrequently: true });

        // MAGIA 2: Object Pool. Ya no creamos objetos nuevos, reciclamos los muertos.
        this.drops = []; 
        this.dropPool = []; 

        this.dropsGfx = [];         
        this.clearDropletsGfx = null;
        this.dropletsCounter = 0;
        this.textureCleaningIterations = 0;

        this.canvasTexture = new THREE.CanvasTexture(this.canvas);
        this.canvasTexture.generateMipmaps = false;
        this.canvasTexture.minFilter = THREE.LinearFilter;
        this.canvasTexture.magFilter = THREE.LinearFilter;

        this._initRenderGraphics();
    }

    get deltaR() { return this.options.maxR - this.options.minR; }
    get areaMultiplier() { return Math.sqrt((this.width * this.height) / (this.scale * 1024 * 768)); }

    _initRenderGraphics() {
        const dropBuffer = document.createElement('canvas');
        dropBuffer.width = DROP_SIZE; dropBuffer.height = DROP_SIZE;
        const dropBufferCtx = dropBuffer.getContext('2d');

        this.dropsGfx = Array.from({ length: 255 }).map((_, i) => {
            const drop = document.createElement('canvas');
            drop.width = DROP_SIZE; drop.height = DROP_SIZE;
            const dropCtx = drop.getContext('2d');

            dropBufferCtx.clearRect(0, 0, DROP_SIZE, DROP_SIZE);
            dropBufferCtx.globalCompositeOperation = "source-over";
            dropBufferCtx.drawImage(this.dropColor, 0, 0, DROP_SIZE, DROP_SIZE);
            dropBufferCtx.globalCompositeOperation = "screen";
            dropBufferCtx.fillStyle = `rgba(0,0,${i},1)`;
            dropBufferCtx.fillRect(0, 0, DROP_SIZE, DROP_SIZE);

            dropCtx.globalCompositeOperation = "source-over";
            dropCtx.drawImage(this.dropAlpha, 0, 0, DROP_SIZE, DROP_SIZE);
            dropCtx.globalCompositeOperation = "source-in";
            dropCtx.drawImage(dropBuffer, 0, 0, DROP_SIZE, DROP_SIZE);
            return drop;
        });

        this.clearDropletsGfx = document.createElement('canvas');
        this.clearDropletsGfx.width = 128; this.clearDropletsGfx.height = 128;
        const clearDropletsCtx = this.clearDropletsGfx.getContext("2d");
        clearDropletsCtx.fillStyle = "#000";
        clearDropletsCtx.beginPath();
        clearDropletsCtx.arc(64, 64, 64, 0, Math.PI * 2);
        clearDropletsCtx.fill();
    }

    createDrop(options) {
        if (this.drops.length >= this.options.maxDrops * this.areaMultiplier) return null;
        
        let drop = this.dropPool.pop();
        if (!drop) {
            drop = {};
        }

        drop.x = options.x || 0;
        drop.y = options.y || 0;
        drop.r = options.r || 0;
        drop.spreadX = options.spreadX || 0;
        drop.spreadY = options.spreadY || 0;
        drop.momentum = options.momentum || 0;
        drop.momentumX = options.momentumX || 0;
        drop.lastSpawn = options.lastSpawn || 0;
        drop.nextSpawn = options.nextSpawn || 0;
        drop.parent = options.parent || null;
        drop.isNew = true;
        drop.killed = false;
        drop.shrink = 0;

        return drop;
    }

    drawDrop(ctx, drop) {
        if (this.dropsGfx.length === 0) return;
        const scaleX = 1; const scaleY = 1.5; 
        let d = Math.max(0, Math.min(1, ((drop.r - this.options.minR) / this.deltaR) * 0.9));
        d *= 1 / (((drop.spreadX + drop.spreadY) * 0.5) + 1);
        d = Math.floor(d * (this.dropsGfx.length - 1));

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        ctx.drawImage(
            this.dropsGfx[d],
            (drop.x - (drop.r * scaleX * (drop.spreadX + 1))) * this.scale,
            (drop.y - (drop.r * scaleY * (drop.spreadY + 1))) * this.scale,
            (drop.r * 2 * scaleX * (drop.spreadX + 1)) * this.scale,
            (drop.r * 2 * scaleY * (drop.spreadY + 1)) * this.scale
        );
    }

    drawDroplet(x, y, r) {
        const drop = this.createDrop({ x, y, r });
        if (!drop) return; 
        this.drawDrop(this.dropletsCtx, drop);
        this.dropPool.push(drop); 
    }

    clearDroplets(x, y, r = 30) {
        const ctx = this.dropletsCtx;
        ctx.globalCompositeOperation = "destination-out";
        ctx.drawImage(
            this.clearDropletsGfx,
            (x - r) * this.scale, (y - r) * this.scale,
            (r * 2) * this.scale, (r * 2) * this.scale * 1.5
        );
    }

    updateRain(timeScale) {
        let newRainDrops = [];
        let limit = this.options.rainLimit * timeScale * this.areaMultiplier;
        let count = 0;

        while (chance(this.options.rainChance * timeScale * this.areaMultiplier) && count < limit) {
            count++;
            let r = random(this.options.minR, this.options.maxR, (n) => Math.pow(n, 3));
            let rainDrop = this.createDrop({
                x: random(this.width / this.scale),
                y: random((this.height / this.scale) * this.options.spawnArea[0], (this.height / this.scale) * this.options.spawnArea[1]),
                r: r,
                momentum: 1 + ((r - this.options.minR) * 0.1) + random(2),
                spreadX: 1.5, spreadY: 1.5,
            });
            if (rainDrop) newRainDrops.push(rainDrop);
        }
        return newRainDrops;
    }

    updateDroplets(timeScale) {
        if (this.textureCleaningIterations > 0) {
            this.textureCleaningIterations -= 1 * timeScale;
            this.dropletsCtx.globalCompositeOperation = "destination-out";
            this.dropletsCtx.fillStyle = `rgba(0,0,0,${0.05 * timeScale})`;
            this.dropletsCtx.fillRect(0, 0, this.width, this.height);
        }
        this.dropletsCounter += this.options.dropletsRate * timeScale * this.areaMultiplier;
        
        times(Math.floor(this.dropletsCounter), () => {
            this.dropletsCounter--;
            this.drawDroplet(
                random(this.width / this.scale),
                random(this.height / this.scale),
                random(...this.options.dropletsSize, (n) => n * n)
            );
        });
        
        this.ctx.drawImage(this.droplets, 0, 0, this.width, this.height);
    }

    update(timeScale) {
        timeScale *= this.options.globalTimeScale;

        this.ctx.clearRect(0, 0, this.width, this.height);
        let activeDrops = [];

        this.updateDroplets(timeScale);
        
        let newRain = this.updateRain(timeScale);
        for(let i = 0; i < newRain.length; i++) activeDrops.push(newRain[i]);

        // Optimización de la función sort
        this.drops.sort((a, b) => {
            return ((a.y * (this.width / this.scale)) + a.x) - ((b.y * (this.width / this.scale)) + b.x);
        });

        for(let i = 0; i < this.drops.length; i++) {
            let drop = this.drops[i];
            
            if (drop.killed) {
                this.dropPool.push(drop);
                continue;
            }

            if (chance((drop.r - (this.options.minR * this.options.dropFallMultiplier)) * (0.1 / this.deltaR) * timeScale)) {
                drop.momentum += random((drop.r / this.options.maxR) * 4);
            }

            if (this.options.autoShrink && drop.r <= this.options.minR && chance(0.05 * timeScale)) {
                drop.shrink += 0.01;
            }

            drop.r -= drop.shrink * timeScale;
            if (drop.r <= 0) drop.killed = true;

            drop.lastSpawn += drop.momentum * timeScale * this.options.trailRate;
            if (drop.lastSpawn > drop.nextSpawn) {
                let trailDrop = this.createDrop({
                    x: drop.x + (random(-drop.r, drop.r) * 0.1),
                    y: drop.y - (drop.r * 0.01),
                    r: drop.r * random(...this.options.trailScaleRange),
                    spreadY: drop.momentum * 0.1,
                    parent: drop,
                });

                if (trailDrop) {
                    activeDrops.push(trailDrop);
                    drop.r *= Math.pow(0.97, timeScale);
                    drop.lastSpawn = 0;
                    drop.nextSpawn = random(this.options.minR, this.options.maxR) - (drop.momentum * 2 * this.options.trailRate) + (this.options.maxR - drop.r);
                }
            }

            drop.spreadX *= Math.pow(0.4, timeScale);
            drop.spreadY *= Math.pow(0.7, timeScale);

            let moved = drop.momentum > 0;
            if (moved && !drop.killed) {
                drop.y += drop.momentum;
                drop.x += drop.momentumX;
                if (drop.y > (this.height / this.scale) + drop.r) drop.killed = true;
            }

            let checkCollision = (moved || drop.isNew) && !drop.killed;
            drop.isNew = false;

            if (checkCollision) {
                for(let j = i + 1; j < Math.min(this.drops.length, i + 70); j++) {
                    let drop2 = this.drops[j];
                    if (drop !== drop2 && drop.r > drop2.r && drop.parent !== drop2 && drop2.parent !== drop && !drop2.killed) {
                        let dx = drop2.x - drop.x;
                        let dy = drop2.y - drop.y;
                        var d = Math.sqrt((dx * dx) + (dy * dy));
                        
                        if (d < (drop.r + drop2.r) * (this.options.collisionRadius + (drop.momentum * this.options.collisionRadiusIncrease * timeScale))) {
                            let pi = Math.PI;
                            let targetR = Math.sqrt(((pi * (drop.r * drop.r)) + ((pi * (drop2.r * drop2.r)) * 0.8)) / pi);
                            if (targetR > this.options.maxR) targetR = this.options.maxR;
                            drop.r = targetR;
                            drop.momentumX += dx * 0.1;
                            drop.spreadX = 0; drop.spreadY = 0;
                            drop2.killed = true;
                            drop.momentum = Math.max(drop2.momentum, Math.min(40, drop.momentum + (targetR * this.options.collisionBoostMultiplier) + this.options.collisionBoost));
                        }
                    }
                }
            }

            drop.momentum -= Math.max(1, (this.options.minR * 0.5) - drop.momentum) * 0.1 * timeScale;
            if (drop.momentum < 0) drop.momentum = 0;
            drop.momentumX *= Math.pow(0.7, timeScale);

            if (!drop.killed) {
                activeDrops.push(drop);
                if (moved && this.options.dropletsRate > 0) this.clearDroplets(drop.x, drop.y, drop.r * this.options.dropletsCleaningRadiusMultiplier);
                this.drawDrop(this.ctx, drop);
            } else {
                this.dropPool.push(drop);
            }
        }

        this.drops = activeDrops;
        this.canvasTexture.needsUpdate = true;
    }
}