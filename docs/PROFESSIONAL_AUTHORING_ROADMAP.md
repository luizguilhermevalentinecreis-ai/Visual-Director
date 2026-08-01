# Professional VFX Authoring Roadmap

Visual Director must preserve and manipulate native Roblox effects, not reduce a professional hierarchy to a smaller schema.

## Shipped through 0.3

- exact capture of a selected native VFX hierarchy;
- safe partial operations against selection, committed packages or attached packages;
- typed native values for sequences, ranges, enums, vectors, colors and CFrames;
- selectors by name, class, node ID and path fragment;
- clone, rename, attribute, property, burst and scoped delete operations;
- expanded ParticleEmitter flipbook, orientation, squash, time-scale, velocity and wind controls;
- expanded Beam and Trail lighting/texture controls.
- paginated snapshot inspection, compact inventory and bounded detail pages;
- property curves and deterministic Studio-native timeline playback;
- mobile/desktop VFX budget profiling and overdraw-risk warnings;
- one-time remote disclosure followed by automatic reconnect.
- compact deterministic impact, shockwave, aura, slash and trail compilers;
- relay-stored drafts staged by ID instead of retransmitting node arrays;
- sanitized native module library with compact listing and instantiation by name;
- shared Motion/Visual director marker channels in ReplicatedStorage.
- connected directional, attractor, vortex, turbulence and drag graphs compiled into spatial native emitter grids;
- element profiles for lighting, gravity, drag, breakup, orientation and continuous-loop behavior;
- procedural flipbook controls and water-specific scene lighting/foam treatment.

## P0: deterministic VFX timeline

- property F-Curves for every supported native property;
- event tracks for enable, emit, sound, camera and impact markers;
- real edit-mode playback with scrub, loop ranges and deterministic cleanup;
- time-warp, retime, stagger and layer-offset operations;
- reusable subgraphs and parameterized effect components.
- curve presets, expressions, driver links and seeded deterministic variation;
- timeline scopes for spawn/update/impact/dissipation and reusable event blocks.

## P1: node graph and element-aware operators

- graph nodes for emitters, forces, beams, trails, meshes, lights, post effects and UI;
- element-aware conversions such as fire-to-water that change motion, breakup, drag, gravity, palette, edge treatment and dissipation instead of recoloring;
- vector fields, attractors, vortices, splines and surface emitters;
- procedural slash, ring, shockwave, aura and impact-frame generators with exposed art-direction controls.
- curl-noise fields, turbulence, drag volumes, collision/deflection, distance fields and flow maps;
- spline, surface, volume and skeletal emitters with local/world-space conversion;
- signed-distance masks for controlled breakup, erosion and reveal;
- mesh ribbon generation, camera-facing ribbon repair and UV/flipbook diagnostics.

## P2: visual review and asset intelligence

- multi-angle/time thumbnail capture with before/after contact sheets;
- alpha coverage, value hierarchy, focal-point, silhouette and screen-occlusion measurements;
- asset catalog that records texture dimensions, flipbook grid, preview, attribution and approved use;
- visual similarity search over the user's approved effects;
- device budget profiler for emit rate, overdraw, lights, beams, trails and transparent geometry.
- viewport heat maps for overdraw, transparency depth, particle density and light overlap;
- deterministic seeds, local variant sweeps and contact-sheet comparison;
- automatic LOD tiers, distance culling, quality fallbacks and pooled-instance plans;
- effect linting for missing attachments, invalid flipbook grids, invisible ranges and lifetime leaks.

## P3: shared cinematic timeline

Motion Director and Visual Director should share actor IDs, contacts, impact markers, camera cuts and time bases. A punch impact can drive VFX release, hit-stop, camera impulse, sound and victim reaction without the AI resending timing data to each plugin.

## P4: native texture, mesh and compositing tools

- EditableImage texture lab: masks, gradients, noise, distortion, dissolve, normal-like lighting and atlas packing;
- EditableMesh procedural cards, rings, cones, slashes, shockwaves and deformation cages;
- multi-pass flipbook builder for color, emissive, opacity, distortion, normal/depth-like data and soft-particle fades;
- 2D impact-frame/HUD compositor with safe areas, typography motion, chromatic offsets and camera-linked parallax;
- color-management helpers, value checks, emissive clipping warnings and palette harmonization;
- screenshot/playblast review with hero-frame extraction and visual-difference overlays.

## P5: modular authoring and collaboration

- Niagara-like local modules with typed inputs, context rules, notes, dependencies and promotion to shared library;
- reusable force, spawn, render and post-process stacks;
- asset provenance, licensing notes, ownership checks and project-safe replacement suggestions;
- frame-addressed annotations, approval states, A/B takes and global approved-pattern knowledge;
- shared Motion/Visual/Camera/Audio marker bus so impact timing is authored once.

## Token architecture

- capture once, reference by stable package/snapshot ID;
- send property deltas and procedural operators, never unchanged hierarchies;
- inspect by summaries and pages, with exact native fields on demand;
- run variants locally and return thumbnails plus measured deltas;
- preserve user-approved components as reusable parameterized graphs.
