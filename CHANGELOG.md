# 0.8.0-rc.45 — WebGPU environment background depth-attachment hotfix

- Fixed the WebGPU environment background pipeline so its attachment state matches the main render pass when `depth24plus` and MSAA are enabled.
- The background pipeline now declares `depthWriteEnabled: false` and `depthCompare: less-equal`, preserving far-background behavior without modifying scene depth.
- Added focused regression coverage for the main-pass depth/MSAA compatibility contract.
- WebGL2 behavior, public rendering APIs, Anyo world semantics, and material authoring remain unchanged.

# 0.8.0-rc.44 — WebGPU material-detail bind-group layout fix

- Fixed the WebGPU `Sekai64 object resources` bind-group layout so bindings 27–32 are declared for detail normal, detail roughness, and detail height samplers/textures already used by the WGSL shader and bind-group creation path.
- Added regression coverage that validates every bind-group entry against the declared mock WebGPU layout, preventing undeclared binding slots from passing headless tests.
- Added focused source-contract coverage for bindings 27–32.
- WebGL2 behavior and public material authoring remain unchanged.

# 0.8.0-rc.43 — procedural cloud quality

- Improved the existing procedural HDR sky cloud layer in place; no `CloudRenderer`, `CloudSystem`, cloud scene nodes, volume pass, or new package was introduced.
- Replaced the old single-fBm threshold with a deterministic large/medium/small cloud field that adds broad masses, medium breakup, and fine erosion while preserving the existing `cloudCoverage`, `cloudDensity`, `cloudScale`, and `cloudSeed` authoring contract.
- Added a lightweight pseudo-normal derived from the same deterministic cloud field so sun-facing regions receive warmer light, shadowed regions stay cooler, interiors retain depth, and bright edges can form without an extra render pass.
- Cloud shading now scales with procedural-sky sun intensity, so zero-sun night skies do not receive daytime silver-lining energy.
- The improved cloud layer remains part of the same one-time `EnvironmentResource`, so WebGL2/WebGPU automatically share identical environment/background pixels and cloud density does not create per-cloud draw calls or runtime simulation.
- Focused tests cover determinism, upper-hemisphere confinement, multi-scale edge structure, warm/cool response, forbidden cloud-system boundaries, and bounded 512x256 generation cost.
- Mesh-cloud drift/shape quality remains authored through generic Anyo geometry/composition/animation systems; true volumetric rendering is intentionally reserved for the Step 11 decision gate.

# 0.8.0-rc.42 — procedural night sky and environment background

- Extended the existing procedural HDR sky generator with deterministic seeded star distribution, bounded density, brightness variation, size variation, and warm/cool color-temperature variation; no `StarSystem` or per-star scene Nodes were introduced.
- Added one generic optional environment-background presentation path. WebGL2 and WebGPU reconstruct world viewing direction from inverse view-projection plus camera position, so the environment behaves as an infinite background and remains invariant to camera translation.
- The visible background reuses the same environment texture already used for IBL/reflections, adding one fullscreen triangle only when `environmentMap.background` is enabled. Existing environment maps keep background drawing disabled by default.
- Bright procedural stars retain HDR energy before LDR conversion so existing exposure/bloom can respond naturally; star generation is one-time resource authoring, not per-frame simulation.
- Focused tests cover seed determinism, upper-hemisphere placement, density scaling, bounded generation time, translation-invariant ray reconstruction, and single-draw WebGL2/WebGPU parity.
- Real moving-camera WebGL2/WebGPU visual acceptance remains a maintainer-machine gate before publication.

# 0.8.0-rc.41 — generic water quality

- Extended the existing `StandardMaterial` water shading path with opt-in renderer-owned multi-scale surface motion, directional flow, bounded renderer time, and configurable slope foam; no `WaterSystem`, ocean subsystem, or new render pass was introduced.
- `water.waveStrength` defaults to `0`, preserving the complete pre-Step-08 static water branch for existing direct Sekai64 and Anyo content.
- WebGL2 and WebGPU use the same water intent and shader structure: animated base/detail normal UVs, lightweight world-space macro-normal motion, IOR-derived Fresnel on the enhanced path, environment reflection, directional GGX highlights, and transmission-aware alpha.
- Existing PBR detail normals, texture transforms, environment lighting, shadows, transmission, and IOR are reused instead of duplicated. Renderer time is clamped per frame and wrapped periodically for long-session numerical stability.
- True scene-color refraction / scene-depth reconstruction remains deferred because it requires a dedicated sampled scene-color/depth architecture and would be disproportionate for this step.
- Real moving-camera WebGL2/WebGPU visual acceptance remains a maintainer-machine gate before publication.

# 0.8.0-rc.40 — alpha / thin-geometry stability

- Added renderer-owned MSAA alpha-to-coverage for masked materials in WebGL2 and WebGPU; non-MSAA/post-process targets keep the existing derivative-smoothed stochastic mask fallback.
- Masked shadow casters now sample base-color alpha with the same UV transform/texcoord choice and per-instance alpha, preventing leaves, fences, hair cards, and other cutout geometry from casting solid rectangular shadows.
- Double-sided thin geometry now remains double-sided in directional-shadow passes instead of inheriting front-face shadow culling.
- WebGPU shadow uniforms are isolated per mesh + material + cascade so grouped/multi-material meshes bind the correct alpha texture without per-frame bind-group churn.
- Reused existing mip generation/filtering, stochastic coverage, and MToon hair dithering; no vegetation-specific renderer, new Anyo schema knob, or extra color render pass was introduced.
- Stable cross-LOD fading remains deferred because the current render queue selects one LOD at a time; adding dual-LOD overlap solely for this pass would expand the render architecture disproportionately.

# 0.8.0-rc.39 — particle quality and lifetime appearance

- Extended the generic `ParticleEmitter` with normalized lifetime size, opacity, color, and rotation ramps while keeping compact typed-array simulation and one instanced draw path.
- Added generic per-instance RGBA to `InstancedMesh`; WebGL2 and WebGPU upload persistent matrix/color instance buffers in place instead of creating per-frame particle resources.
- Added renderer-owned distance density/fade policy keyed by particle quality and emitter importance, including smooth far fade/cull without exposing backend distances or particle counts to Anyo JSON.
- Preserved deterministic simulation and the same generic emitter state across WebGL2/WebGPU; no rain/snow/fire/smoke-specific branches or second animation system were introduced.
- True depth-aware soft-particle intersection was investigated but deferred: the current main render pass cannot safely sample its active depth attachment, so correct support would require an opaque-depth resolve or a separate transparent-particle pass rather than a fake screen-space approximation.

# 0.8.0-rc.37 — lightweight height detail + specular stability

- Added an optional generic detail-height channel to `StandardMaterial`; source-backed height maps use the same mip-safe detail texture path as detail normal/roughness.
- Added renderer-owned `surfaceDetail` quality policy (`off`, `balanced`, `high`) without exposing shader loop counts to Anyo world JSON.
- WebGL2 and WebGPU now apply matching lightweight view-dependent parallax; `high` adds one refinement sample rather than full parallax-occlusion mapping.
- Added inexpensive derivative-based specular stabilization for materials opting into micro-detail, keeping legacy materials visually unchanged.
- No extra render pass or object-specific subsystem was introduced.

# 0.8.0-rc.36 — pixel-level material detail

- Added optional high-frequency detail normal and detail roughness channels to `StandardMaterial` without changing existing material defaults.
- Added shared detail UV scale, normal strength, and roughness blend controls while keeping authoring renderer-neutral.
- WebGL2 and WebGPU use matching tangent-space detail-normal blending and matching PBR detail-roughness sampling.
- Source-backed detail maps default to trilinear mip filtering with generated mipmaps; externally supplied textures retain their authored sampler policy.
- Detail textures are batched through the existing material texture path; no new render pass or object-specific renderer was introduced.

# 0.8.0-rc.35 — generic material UV mapping controls

- Added a lightweight `textureTransform` contract to `StandardMaterial` with shared UV scale, offset, and rotation.
- Added `textureWrap` control (`clamp-to-edge`, `repeat`, `mirror-repeat`, including per-axis S/T selection) for source-backed StandardMaterial textures so authored UV transforms can tile correctly.
- WebGL2 and WebGPU apply the same transform in shader space with identity defaults, and both preserve the existing clamp-to-edge default, so existing materials are unchanged.
- The feature is generic and object-agnostic: procedural terrain, rocks, architecture, vegetation, props, clouds, and other authored surfaces can reuse it without renderer-specific object systems.
- Invalid direct renderer values fall back safely instead of producing non-finite shader coordinates.

# 0.8.0-rc.34

- Preserve generated mipmaps for dynamic textures on WebGPU instead of downgrading to the base level.
- Regenerate WebGPU mip chains after same-size dynamic texture updates so trilinear/anisotropic sampling never reads stale levels.
- Keep existing sRGB texture formats and renderer-wide anisotropy policy unchanged.

# Changelog

## 0.8.0-rc.45

### WebGPU environment background depth-attachment hotfix

- Fixed the WebGPU environment background pipeline so its attachment state matches the main render pass when `depth24plus` and MSAA are enabled.
- The environment background now declares `depthWriteEnabled: false` with `depthCompare: "less-equal"`; this preserves far-background behavior without modifying scene depth.
- Added regression coverage that requires the WebGPU environment background pipeline to declare the same depth format used by the main pass.
- No WebGL2 behavior, public rendering API, world semantics, or material authoring contracts changed.

## 0.8.0-rc.34-dev.4 — material draw groups

- Added renderer-native geometry draw groups with triangle-aligned index/vertex ranges and material slots.
- `Mesh` now supports multiple material slots while preserving `mesh.material` as backward-compatible slot 0.
- Added semantic group-name -> material-slot overrides on Mesh.
- RenderQueue emits per-group opaque/transparent/shadow items without duplicating geometry or semantic nodes.
- WebGL2 and WebGPU render group ranges directly, including shadows and MToon outline ranges.
- WebGPU object/shader uniform caches are now keyed per mesh + material so grouped materials keep independent texture/bind-group state.
- Static batching skips grouped/multi-material meshes until a dedicated grouped-instancing batching contract is added.
- Added grouped-material regression coverage.

## Unreleased — Native sphere geometry and WebGPU shadow stability

- Added `SphereGeometry` to the public geometry API for renderer-native rounded world geometry without Three.js.
- Added compact indexed UV-sphere generation with normals, UVs, validation, and regression coverage.
- Keeps cone authoring on the existing `CylinderGeometry({ radiusTop: 0 })` path so no duplicate geometry implementation is introduced.
- Fixed WebGPU directional-shadow lookup coordinates by converting projected Y into WebGPU texture space; this prevents mirrored/camera-relative shadow motion while moving.
- Stabilized cascaded directional shadows in the light projection plane rather than world XYZ so angled sunlight no longer causes avoidable shadow-map swimming.
- Added regression coverage for the WebGPU shadow-coordinate conversion and light-space cascade stabilization.

## 0.8.0-rc.33 — WebGPU sampler compatibility

- Fixed black-screen failures on glTF/VRM assets whose authored samplers use nearest or nearest-mipmap filtering while high anisotropy is enabled.
- WebGPU now enables anisotropic filtering only when minification, magnification, and mipmap filters are all linear, as required by WebGPU validation.
- Preserves authored nearest/mixed filtering instead of silently changing texture sampling semantics.
- Added regression coverage for mixed-filter glTF samplers under high-quality character rendering.

## 0.8.0-rc.32 — VRM / MToon visual fidelity

- Expanded `VRMC_materials_mtoon` loading with shade, shading-shift, matcap, and rim-multiply textures plus core MToon factors.
- Added a compatibility bridge for legacy VRM 0.x `extensions.VRM.materialProperties` MToon materials so older avatars use the character shading path too.
- Corrected MToon shade composition and linear color-factor handling instead of treating the extension as generic PBR/toon tinting.
- Added character material roles for skin, hair, and eyes with softer skin lighting, restrained AO, eye catchlights, and tangent-aligned hair highlights.
- Fixed tangent handedness under mirrored transforms in WebGL2 and WebGPU normal mapping.
- Added derivative-smoothed alpha masking and stochastic transparent-hair coverage for cleaner eyelashes, bangs, and cutout edges.
- Added MToon world/screen outline width handling and lighting-mixed outline colors.
- Added `CHARACTER_VISUAL_PRESET` with high-quality AA/supersampling (`fxaa-high`, 1.25x render scale, a 4x MSAA preference where the active post-process path permits it), 16x anisotropy, character-only inverted-hull outlines, and character-friendly environment/shadow tuning.
- Preserved the existing PBR/product rendering path and RC.30 focus-camera controls.

## 0.8.0-rc.30 — stable camera orientation and controls

- Added camera-friendly `YXZ` transform composition for stable yaw/pitch view rotation.
- Added `Camera.setViewAngles()`, `Camera.lookAt()`, and `Camera.getWorldDirection()` helpers.
- Fixed orbit controls so pointer movement no longer accumulates into runaway angular acceleration.
- Made orbit inertia and damping frame-rate aware and reset stale motion after camera resyncs.
- Added pointer capture/cancel handling so drags cannot remain stuck when the pointer leaves the canvas.
- Updated first-person controls to use stable YXZ camera orientation while preserving the current viewing direction on attach.
- Added pointer/wheel spike guards for more predictable camera interaction.

## 0.8.0-rc.28 — premium asset compatibility

- Added full glTF 2.0 sparse accessor decoding, including accessors with no base `bufferView`, normalized sparse values, sparse morph targets, skin/joint data, and strict sparse-index bounds/order validation.
- Added correct matrix accessor byte layout for MAT2/MAT3 component padding.
- Added lazy browser Draco decoding to `@blcklab/sekai64/gltf`; `KHR_draco_mesh_compression` now works out of the box in browsers and still supports custom/self-hosted decoders.
- Added `draco: false` to explicitly disable automatic decoding and `dracoDecoderPath` for offline/CSP-restricted deployments.
- Added loader capability flags for sparse accessors and automatic browser Draco decoding.
- Added a VRM-focused regression proving sparse POSITION data loads correctly through the public `GltfLoader`.
- Preserved RC.27 HDR/PBR viewer parity and all existing WebGPU/WebGL2 paths.

## 0.8.0-rc.27 — GLB viewer parity / HDR environment bridge

- Preserved authored glTF material factors as the source of truth; PC integration no longer needs material repainting for metal or glass.
- Fixed `EnvironmentRendererModule` so HDR `Float32Array` radiance reaches WebGL2/WebGPU as `rgba16f-linear` instead of being tone-mapped to LDR before lighting.
- Fixed the Anyo procedural-sky bridge to generate GGX-prefiltered linear HDR specular levels, diffuse irradiance, and a BRDF LUT before handing the environment to Sekai64.
- Added a neutral high-dynamic-range showroom reflection source for product/GLB viewing.
- Added regressions proving HDR values above 1.0 survive the bridge and the PC case's authored `PC_METAL`, `PC_FRAME`, and `PC_GLASS` factors are preserved by the glTF loader.
- Preserved RC.22+ multi-GLB ID namespacing and RC.23+ color/PBR correctness.

# Changelog

## 0.8.0-rc.34-dev.1

- Fix CPU-skinned meshes receiving root translation/rotation/scale twice. AnimationRendererModule now deforms into mesh-local space using a per-mesh palette; shared skeleton data remains unchanged.

## 0.8.0-rc.26 — reference PBR and glTF color fidelity

- Preserved the RC.22 multi-GLB descendant-ID namespacing fix.
- Preserved linear HDR values through diffuse irradiance and GGX specular prefiltering.
- Added split-sum BRDF/DFG LUT generation and WebGL2/WebGPU sampling.
- Removed double sRGB decoding of GPU sRGB environment and light-map textures.
- Added energy-conserving environment diffuse/specular response, specular occlusion, and IOR-aware dielectric Fresnel.
- Corrected normal transforms for non-uniformly scaled models in both backends.
- Added factor support for glTF clearcoat, sheen, specular, transmission, volume, and IOR material extensions.
- Fixed glTF linear color-factor handling so base color, emissive, specular, sheen, and volume attenuation are not incorrectly darkened as sRGB-authored UI colors.
- Fixed WebGL2 vertex-color composition so glTF `COLOR_0` remains linear.
- Fixed WebGPU base-color sampling parity so hardware-decoded sRGB textures are not decoded a second time after multiplication.
- Retuned `PRODUCT_VISUAL_PRESET` to a neutral high-key product-lighting baseline.
- Added RC.23/RC.24 visual-fidelity regressions for HDR preservation, BRDF IBL, shader color-space handling, normal transforms, imported glTF factors, vertex colors, texture color spaces, and product defaults.

## Local PC Studio integration hardening

- Namespaced generated glTF descendant IDs per imported model instance so multiple GLBs can coexist in one Scene without `gltf-node-*` collisions.
- Preserved the rc.22 Draco and `EXT_texture_webp` loader fixes.
## 0.8.0-rc.12 — TypeScript 6 binary ownership compatibility

- Normalized glTF data-URI buffers and embedded image bytes to guaranteed owned `ArrayBuffer` values before storing them in `ArrayBuffer[]` or passing them to `Blob`.
- Preserved exact byte ranges for buffer views and safely copied `SharedArrayBuffer`-backed views when encountered.
- Added a TypeScript 6 compatibility guard covering the generic typed-array and `BlobPart` boundaries.
- Preserved all S8.0–S8.10 runtime behavior, public APIs, optional-module boundaries, and bundle budgets from RC.11.

## 0.8.0-rc.11 — TypeScript 6 path-mapping compatibility

- Removed the deprecated TypeScript `baseUrl` option from the shared workspace configuration.
- Made every `paths` target explicitly relative to `tsconfig.base.json`.
- Preserved the complete S8.0–S8.10 runtime, public API, optional-subpath, and bundle boundaries from RC.10.
- Added a release check that rejects `baseUrl` and non-relative path targets.
- No runtime behavior or package bundle change.

## 0.8.0-rc.10 — Modular animation and asset expansion

### Added

- Added explicit renderer-module lifecycle through `@blcklab/sekai64/modules` with dependency ordering, capability reporting, recovery hooks, cleanup ownership, and asynchronous disposal.
- Added optional `@blcklab/sekai64/animation` with skeleton palettes, skin bindings, morph targets, clip sampling, mixers, markers, looping, seeking, blend weights, crossfades, and an explicit animated-glTF adapter.
- Added explicit animated glTF/GLB loading contracts. Animated assets require the animation adapter or an intentional static-pose fallback; no animation code is auto-imported.
- Added `@blcklab/sekai64/decoders`, `@blcklab/sekai64/streaming`, `@blcklab/sekai64/environment`, `@blcklab/sekai64/large-scene`, and `@blcklab/sekai64/recovery` optional subpaths.
- Added standalone zero-codec bridge packages: `@blcklab/sekai64-draco@0.1.0`, `@blcklab/sekai64-meshopt@0.1.0`, and `@blcklab/sekai64-ktx2@0.1.0`.
- Added HDR Radiance decoding, tone mapping, environment presentation, bounded spot lighting, shadow-budget selection, spatial mesh indexing, asset-task scheduling, worker-compatible task execution, and renderer recovery orchestration.
- Added WebGPU device recreation and WebGL context-restoration coordination contracts.

### Architecture

- Preserved one zero-runtime-dependency Sekai64 package with isolated optional subpath graphs.
- Kept the static root free from animation, decoder, streaming, environment, large-scene, and recovery imports.
- Added permanent root/subpath gzip budgets, packed-consumer coverage, optional-adapter package checks, and cross-subpath class-identity verification.

### Current implementation boundary

- Skinning and morph deformation use correctness-first dynamic geometry that uploads through both WebGL2 and WebGPU. Native vertex-shader skinning remains a later optimization.
- Environment lighting currently uses an ambient-probe approximation; full prefiltered cubemap IBL remains future work.
- Codec packages are explicit bridges and do not bundle Draco, Meshopt, Basis, or WASM implementations.
- Shadow budgets select work but do not yet implement shadow-map rendering.

## 0.7.0 — Stable rendering capability family

- Stable WebGL2/WebGPU renderers, dynamic textures, UV ray hits, ShaderMaterial execution, WebXR, and recovery semantics.
- Zero runtime dependencies and a frozen public subpath map.
- No Anyo-specific application or world semantics.


## 0.7.0-rc.6 — Optional dynamic textures

### Added

- Added the tree-shakable `@blcklab/sekai64/dynamic-texture` subpath without changing the mandatory renderer interface.
- Added renderer-neutral creation, update, resize, filtering, color-space, mipmap-policy, dimension-limit, diagnostic, and disposal contracts.
- Added focused capability, package-export, packed-consumer, repeated-update, resize, and renderer restoration smoke coverage.

### Hardened

- WebGL2 now uses `texSubImage2D` for compatible same-size dynamic updates and reallocates only for size or format changes.
- WebGPU now reuses compatible GPU textures and bind-group state across same-size updates and reallocates only when required.
- Multiple CPU updates before a render collapse into one observed GPU upload of the latest texture version.
- Retained CPU-side texture state supports lazy WebGL2 context restoration and reuse with a replacement renderer after WebGPU device loss.
- Dynamic texture dimensions are bounded by renderer capabilities and configurable limits.
- WebGPU mipmap requests downgrade explicitly with a structured diagnostic rather than silently claiming support.

### Compatibility

- Zero runtime dependencies.
- No Anyo semantics, material-slot lookup, UV interaction, application loop, or emulator runtime was added.
- Existing root, renderer, material, glTF, WebXR, and JSON APIs remain compatible.

## 0.7.0-rc.5

- Fixed WebGPU standard-material WGSL validation by evaluating `dpdx`/`dpdy` before the per-fragment tangent-availability branch, satisfying derivative uniform-control-flow requirements.
- Applied the same derivative ordering to WebGL2 so tangent reconstruction has defined quad behavior on geometry without tangent attributes.
- Added renderer smoke regressions that verify derivative operations remain outside tangent-dependent control flow.

## 0.7.0-rc.4 — Player lifecycle hardening

### Added

- Structured `SEKAI64_WEBGL_CONTEXT_LOST` and `SEKAI64_WEBGL_CONTEXT_RESTORED` diagnostics.
- Structured `SEKAI64_WEBGPU_DEVICE_LOST` diagnostics with backend, reason, and browser message details.
- Physical renderer-loss diagnostics now flow through the existing Engine diagnostic channel for Anyo and player hosts.

### Hardened

- Added explicit smoke coverage for WebGL context loss/restoration and WebGPU device loss.
- Preserved lazy GPU-resource reconstruction after WebGL context restoration.
- Preserved the existing asynchronous XR session manager and renderer disposal contracts used by Anyo's awaited world shutdown.
- Aligned every workspace, example, generated version constant, and public package to `0.7.0-rc.4`.

### Compatibility

- Zero runtime dependencies.
- No world, collision, interaction, or browser-player responsibilities moved into Sekai64.
- Existing textured glTF/GLB, WebGL2, WebGPU, picking, and WebXR APIs remain compatible.

## 0.7.0-rc.3 — Textured glTF and GLB

### Added
- Load embedded GLB images, external `.gltf` images, and image data URIs with PNG, JPEG, and WebP support.
- Map base-color, normal, metallic-roughness, emissive, and occlusion textures into native `StandardMaterial` resources.
- Support glTF samplers, UV0/UV1 selection, `COLOR_0`, `TANGENT`, alpha modes, and double-sided materials.
- Add shared texture caching, abort propagation, deterministic asset-level ownership, and structured glTF texture diagnostics.
- Evaluate imported material texture channels in both WebGL2 and WebGPU shaders.
- Advertise material-texture, vertex-color, alpha, and double-sided renderer capabilities.
- Add self-created embedded/external textured fixtures plus loader and renderer smoke suites.

### Fixed
- Prevent textured GLB models from falling back to white or gray scalar-only materials.
- Preserve sRGB versus linear texture semantics and glTF `flipY: false` behavior.
- Multiply base-color factor, vertex color, and base-color texture according to glTF semantics.
- Apply packed metallic/roughness channels, emissive factors, occlusion strength, and normal scale.
- Force `OPAQUE` and `MASK` output alpha while retaining `BLEND` alpha.
- Close images completing after cancellation and settle concurrent texture work before failed-load cleanup.

### Known limitation
- WebGPU currently samples the base mip level and warns when generated mipmaps are requested; WebGL2 generates the glTF mip chain. The standard shader is a lightweight metallic/roughness approximation rather than complete image-based Cook–Torrance PBR.

## 0.7.0-rc.2

### Fixed
- Generate the public `SEKAI64_VERSION` constant from `packages/sekai64/package.json` before builds and type checks.
- Make packed-consumer version assertions derive from package metadata instead of a stale literal.

## 0.7.0-rc.1 — WebXR backend hardening

- Added an explicit XR lifecycle state machine with atomic session entry and rollback.
- Added secure-context diagnostics and duplicate-session prevention.
- Added `local-floor`/`bounded-floor` reference-space fallback and actual selected-space reporting.
- Added a virtual player rig applied to headset, eye-camera, target-ray, and grip transforms.
- Added normalized WebXR input snapshots with stable IDs, axes, haptics capability, and corrected button semantics.
- Added tracking-loss/restoration and reference-space-reset events.
- Made the XR frame chain resilient and idempotent with guaranteed rescheduling.
- Hardened repeated session exit and asynchronous disposal.
- Retained the optional asset-loader registry and all `0.6.1` asset improvements.
- Added deterministic XR lifecycle smoke coverage.

## 0.6.0 — Renderer adapter readiness

- Added indexed `CylinderGeometry` with caps, frustums, cones, UVs, and configurable segments.
- Added independent mesh geometry/material ownership and safe replacement methods.
- Added `ImageMesh.setSource()` for in-place, race-safe image updates.
- Added bounded nearest-point-light evaluation to WebGPU and WebGL2.
- Added triangle-precise picking, bounds mode, and instanced hits with `instanceId`.
- Preserved the nearest-hit `Raycaster.intersectMesh()` API and added `intersectMeshAll()`.
- Added front, back, and double material-side culling while retaining `doubleSided`.
- Added renderer feature capabilities for media, lighting, picking, instancing, shadows, wireframe, and XR.
- Added diagnostics for point-light limits, unsupported spot lights, and unsupported wireframe requests.
- Added cylinder and material-side support to JSON scene v2.
- Added renderer-adapter documentation and clarified that advanced architectural compilation belongs in a dedicated world compiler such as Anyo.
- Kept one public package, zero runtime dependencies, lazy renderer imports, and enforced size budgets.

## 0.5.0 — Stable media and lightweight loading

- Added a dependency-free `Texture` resource with URL, Blob, ImageBitmap, Canvas, OffscreenCanvas, HTML image, and ImageData support.
- Added real texture sampling, UV buffers, texture caching, cleanup, and texture-memory statistics to WebGL2 and WebGPU.
- Added `TextureMaterial`, generated text textures, `TextMesh`, and asynchronous `ImageMesh`.
- Replaced placeholder building text/image panels with real four-vertex textured surfaces.
- Added explicit texture readiness, `loadTextures()`, async `StandardMaterial.create()`, and opt-in autoloading to `StandardMaterial`.
- Added bounded texture downloads, decoded-dimension limits, protocol validation, cancellation, source-race protection, and hardware-size diagnostics.
- Added one-call `loadModel()` ownership and fixed glTF model scene registration/disposal behavior.
- Fixed queued asset requests hanging when `AssetManager` was disposed.
- Fixed visibility changes not invalidating inherited `worldVisible` state.
- Changed engine renderer selection to dynamic imports so the root entry does not statically include both backends.
- Curated the root API while retaining advanced features through subpath exports.
- Replaced declaration maps with smaller declarations while retaining JavaScript source maps.
- Added static-entry gzip budgets and a real image poster to the explorable-store example.

## Packaging architecture update

- Converted the repository to a hybrid monorepo.
- Internal engine packages are private and cannot be published accidentally.
- `@blcklab/sekai64` is the only public npm package.
- Added tree-shakable subpath exports for math, controls, buildings, assets, glTF, renderers, post-processing, and XR.
- Removed all runtime dependencies from the public package.
- Added a single-package assembly, verification, dry-run, and publishing workflow.

## 0.4.0 — Developer preview

- Added controls, interaction, collision, buildings, lighting, assets, glTF, post-processing, and optional XR packages.
- Added first-person and orbit controls with input snapshots and pointer lock support.
- Added raycasting, pointer interaction, selection, event bubbling, and scene-action registries.
- Added spatially indexed architectural collision with gravity, wall sliding, stepping, jumping, and movement substeps.
- Added mathematical building generation with segmented openings, floors, ceilings, rooms, panels, and product displays.
- Added instanced rendering to WebGPU and WebGL2, active frustum culling, LOD, transparent sorting, WebGPU MSAA, and richer renderer statistics.
- Added standard, normal, and depth materials plus ambient/directional lighting.
- Added abortable reference-counted asset loading and a focused glTF 2 / GLB loader.
- Added JSON scene v2, prefabs, variables, migrations, async add patches, stronger validation, and a published schema source.
- Added WebXR session management, per-eye cameras, a real WebGL2 XR layer bridge, AR hit testing, placement helpers, and optional anchors.
- Added explorable-store, instancing, and WebXR examples.
- Fixed prefab variable resolution and horizontal collision resolution around floor contacts.

## 0.1.0

- Initial dual-backend rendering foundation, scene graph, math, cameras, basic geometry/materials, JSON scenes, disposal, tests, and examples.
