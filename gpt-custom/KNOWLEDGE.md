# Visual Director reference

This file is technical reference material for the Visual Director Custom GPT. Operational behavior belongs in `INSTRUCTIONS.md`.

## Public service

- Relay: `https://visual-director-relay.onrender.com`
- OpenAPI: `https://visual-director-relay.onrender.com/openapi.json`
- Privacy: `https://visual-director-relay.onrender.com/privacy`
- Authentication: `None` during the pairing-code beta. Studio operations require the user's plugin code.

## Action groups

### Inspect and profile

- `getVfxCapabilities`
- `getSceneSelection`
- `listDirectorMarkers`
- `inspectSelectedVfx`
- `inspectVfxSnapshotPage`
- `profileSelectedVfx`

### Author and reuse

- `generateProceduralVfxModule`
- `compileVfxNodeGraph`
- `captureSelectedVfx`
- `saveSelectedVfxAsModule`
- `listVfxModules`
- `instantiateVfxModule`
- `applyVfxOperations`

### Validate and deliver

- `validateVfxDraft`
- `stageVfxDraft`
- `commitVfxDraft`
- `attachCommittedVfx`
- `previewCommittedVfx`
- `playCommittedVfxTimeline`
- `stopVfxTimelinePreview`
- `smokeVisualRuntime`
- `getVisualDirectorJob`

## Layer checklist

- Primary shape: one readable dominant form.
- Secondary shape: supports motion or scale without competing.
- Breakup: particles, debris, foam, embers, mist, residue.
- Direction: beam, trail, streak, arc, or flow field.
- Integration: light, shadow/value relationship, environment contact.
- Impact: flash, lines, ring, camera/FOV impulse, hit stop marker.
- Dissipation: shrink, fade, cooling, fragmentation, evaporation, or settling.

## Element profiles

### Fire

- Bright core, warmer midtone, darker/orange edge.
- Higher emission and lower scene-light influence can be appropriate.
- Buoyancy, turbulence, licking shapes, embers, smoke, and cooling breakup.

### Water

- Lower self-emission and stronger scene-light influence.
- Teal/desaturated body with brighter foam near breakup/end of life.
- Stronger gravity, drag, ballistic droplets, cohesive ribbons, splash sheets, mist, and surface residue.
- Velocity-parallel orientation for streaks/droplets, not slow aura motes.

### Electricity

- Thin high-value core, branching secondary paths, rapid temporal contrast.
- Avoid uniform smooth curves; use controlled discontinuity and short-lived residue.

### Aura

- Continuous rates or authored repeated windows when truly looped.
- Distribute orbit elements by actual count; do not place both 0 and 2π as separate identical arcs.
- Mix large slow masses with sparse directional accents and localized breakup.

## Node graph guidance

- Use fields for directional acceleration, attraction, vortex, turbulence, and drag.
- Keep cell counts proportional to visible scale and budget.
- Place emitters where the spatial field changes meaningfully; do not expand a dense grid merely to appear complex.
- Native ParticleEmitters do not expose arbitrary per-particle position control. The compiler approximates fields through spatially sampled native emitters and acceleration/drag.

## Timing semantics

- `startTime` and `endTime` define authored node windows.
- Burst nodes emit a finite count at activation.
- Rate nodes are appropriate for sustained effects and must be disabled/cleaned up at the runtime boundary.
- Edit mode may intentionally loop attached VFX for continuous art review.
- Play/runtime must execute the real authored timeline and clean up after completion.
- Shared Director markers are the source of truth for impacts synchronized across Motion and Visual Director.

## Performance review

- Profile emitter count, aggregate rates/bursts, particle lifetime, texture area, transparency layers, beams, trails, lights, GUI coverage, and spatial node expansion.
- Validate on both desktop and mobile targets.
- Overdraw often matters more than raw object count.
- One dominant light is usually better than many weak lights.
- Prefer bounded one-shot bursts for impacts and carefully budgeted rates for auras.

## Visual review

Inspect anticipation, focal point, value hierarchy, silhouette, scale, depth, direction, contact, timing, decay, camera obstruction, color response under scene lighting, and whether the effect still reads without bloom. Numerical validation cannot approve taste or clarity.

## Security boundary

The Action exposes declarative VFX operations only. It does not provide arbitrary Luau. Pairing codes are persistent capability secrets while the plugin is connected and must not appear in public files or examples.
