// src/core/managers/InputManager.js

export class InputManager {
    constructor() {
        this.targetX = 0;
        this.targetY = 0;
        
        this.isTouching = false;
        this.lastTouchX = 0;
        this.lastTouchY = 0;
        
        this.touchSensitivity = 3.0; 

        this._initListeners();
    }

    _initListeners() {
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'touch') {
                this.isTouching = true;
                this.lastTouchX = e.clientX;
                this.lastTouchY = e.clientY;
            }
        });

        window.addEventListener('pointermove', (e) => {
            if (e.pointerType === 'mouse') {
                this.targetX = (e.clientX / window.innerWidth) * 2 - 1;
                this.targetY = (e.clientY / window.innerHeight) * 2 - 1;
                
            } else if (e.pointerType === 'touch' && this.isTouching) {
                const deltaX = e.clientX - this.lastTouchX;
                const deltaY = e.clientY - this.lastTouchY;
                
                this.lastTouchX = e.clientX;
                this.lastTouchY = e.clientY;

                const normDeltaX = (deltaX / window.innerWidth) * this.touchSensitivity;
                const normDeltaY = (deltaY / window.innerHeight) * this.touchSensitivity;

                this.targetX += normDeltaX;
                this.targetY += normDeltaY;

                this.targetX = Math.max(-1.5, Math.min(1.5, this.targetX));
                this.targetY = Math.max(-1.5, Math.min(1.5, this.targetY));
            }
        });

        const handlePointerEnd = (e) => {
            if (e.pointerType === 'touch') {
                this.isTouching = false;
            }
        };

        window.addEventListener('pointerup', handlePointerEnd);
        window.addEventListener('pointercancel', handlePointerEnd);
        
        window.addEventListener('pointerleave', (e) => {
            if (e.pointerType === 'mouse') {
                this.targetX = 0;
                this.targetY = 0;
            }
        });
    }
}