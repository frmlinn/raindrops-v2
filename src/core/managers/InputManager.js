/**
 * @file InputManager.js
 * @description Handles cross-platform user input (mouse/touch) applying delta calculations for mobile swipe gestures.
 */

export class InputManager {
    /**
     * Initializes state and binds event listeners safely.
     */
    constructor() {
        this.targetX = 0;
        this.targetY = 0;
        
        this.isTouching = false;
        this.lastTouchX = 0;
        this.lastTouchY = 0;
        this.touchSensitivity = 3.0; 

        // Context binding to prevent memory leaks during event listener removal
        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerEnd = this._onPointerEnd.bind(this);
        this._onPointerLeave = this._onPointerLeave.bind(this);

        this._initListeners();
    }

    /**
     * Attaches normalized pointer events to the window object.
     * @private
     */
    _initListeners() {
        window.addEventListener('pointerdown', this._onPointerDown);
        window.addEventListener('pointermove', this._onPointerMove);
        window.addEventListener('pointerup', this._onPointerEnd);
        window.addEventListener('pointercancel', this._onPointerEnd);
        window.addEventListener('pointerleave', this._onPointerLeave);
    }

    _onPointerDown(e) {
        if (e.pointerType === 'touch') {
            this.isTouching = true;
            this.lastTouchX = e.clientX;
            this.lastTouchY = e.clientY;
        }
    }

    _onPointerMove(e) {
        if (e.pointerType === 'mouse') {
            // Absolute positioning for standard mouse hover
            this.targetX = (e.clientX / window.innerWidth) * 2 - 1;
            this.targetY = (e.clientY / window.innerHeight) * 2 - 1;
        } else if (e.pointerType === 'touch' && this.isTouching) {
            // Delta calculation for natural swipe gestures on mobile
            const deltaX = e.clientX - this.lastTouchX;
            const deltaY = e.clientY - this.lastTouchY;
            
            this.lastTouchX = e.clientX;
            this.lastTouchY = e.clientY;

            const normDeltaX = (deltaX / window.innerWidth) * this.touchSensitivity;
            const normDeltaY = (deltaY / window.innerHeight) * this.touchSensitivity;

            this.targetX = Math.max(-1.5, Math.min(1.5, this.targetX + normDeltaX));
            this.targetY = Math.max(-1.5, Math.min(1.5, this.targetY + normDeltaY));
        }
    }

    _onPointerEnd(e) {
        if (e.pointerType === 'touch') {
            this.isTouching = false;
        }
    }

    _onPointerLeave(e) {
        if (e.pointerType === 'mouse') {
            this.targetX = 0;
            this.targetY = 0;
        }
    }

    /**
     * Safely unbinds all event listeners to allow garbage collection.
     */
    dispose() {
        window.removeEventListener('pointerdown', this._onPointerDown);
        window.removeEventListener('pointermove', this._onPointerMove);
        window.removeEventListener('pointerup', this._onPointerEnd);
        window.removeEventListener('pointercancel', this._onPointerEnd);
        window.removeEventListener('pointerleave', this._onPointerLeave);
    }
}