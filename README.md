# Raindrops V2

This experiment tries to recreate a realistic rain simulation featuring screen-space lens effects, SDF particles, and PBR environments. Optimized for performance via GPU-driven billboarding, FBO downsampling, and object pooling.

> [!NOTE]  
> This project originated as a fork of [RainEffect](https://github.com/codrops/RainEffect), but it has evolved significantly with a complete refactor of the core logic, GPU physics, and memory management, leading to the creation of this independent repository.

## Technical Architecture

### 1. Multipass Rendering & Refraction (FBOs)
The rendering pipeline utilizes a multipass approach via `WebGLRenderTarget`:
* **High-Res Background Pass (`rtBg`):** Renders the 3D environment (lights, floor, fog) at full resolution.
* **Downsampled Blur Pass (`rtFg`):** A secondary pass renders a downscaled version (1/8th resolution) of the background to simulate depth-of-field/blur. This drastically reduces the fill-rate and texture lookup overhead.
* **Composite Pass:** The custom `RainMaterial` combines both FBOs with the 2D glass canvas texture, applying refraction math based on the droplet normals.

### 2. GPU-Driven 3D Rain & SDFs
The 3D rain and splash collision systems are designed for extreme throughput:
* **Instancing:** Utilizes `InstancedBufferGeometry` to render 10,000+ simultaneous drops and splash flipbooks with a single draw call. Frustum culling is bypassed (`frustumCulled = false`) to avoid CPU-side bounding box recalculations.
* **Vertex Shader Billboarding:** Cylindrical billboarding, stretching (based on velocity/storm intensity), and spatial offsets are calculated natively in the Vertex Shader. 
* **Signed Distance Fields (SDF):** The physical shape of the falling drops is mathematically generated in the Fragment Shader using an uneven capsule SDF, avoiding the need for external meshes.

### 3. 2D Simulation & Memory Management (Object Pooling)
The condensation and droplet merging logic on the glass surface runs on a 2D Canvas mapped to a `THREE.CanvasTexture`:
* **Zero Garbage Collection:** Implements a strict **Object Pool** pattern (`this.dropPool`). Dead droplet objects are recycled rather than destroyed, eliminating GC spikes and guaranteeing a stable 60 FPS even on mobile browsers.
* **Area Multipliers:** Simulation constants scale dynamically based on the device's pixel ratio and viewport size to maintain consistent physical behavior across different screen sizes.

### 4. Input & Mobile Responsiveness
* **Universal Pointer API:** Camera parallax and screen interactions use `pointerdown`, `pointermove`, and `pointerup` with interpolation (damping) to support mouse, touch, and stylus natively.
* **Debounced Resize:** FBOs and 2D canvas resizing are wrapped in a debounce function to prevent performance thrashing caused by mobile browser UI bars appearing/disappearing during interactions.

---

## Installation & Development

This project uses [Vite](https://vitejs.dev/) for fast bundling and hot module replacement. 

### Prerequisites
* Node.js (v16+ recommended)
* `pnpm` (preferred, as `pnpm-lock.yaml` is present) or `npm`

### Setup

1. **Install dependencies:**
    ```bash
    pnpm install
    # or
    npm install
    ```
2. **Start development server**
    ```bash
    pnpm dev
    # or if you prefer npm
    npm run dev
    ```
The local server will start at http://localhost:5173.