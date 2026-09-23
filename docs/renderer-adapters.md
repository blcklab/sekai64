# Renderer Adapter Guidance

Sekai64 is designed to render scenes directly and to serve as a backend for renderer-independent compilers.

## Recommended boundary

A compiler or world runtime should keep its own document, constraints, entity state, collision descriptions, portals, and history. Its renderer adapter should translate compiled primitives into Sekai64 nodes.

```txt
Compiled primitive ID → Sekai64 Node
Compiled material ID  → shared Sekai64 Material
Reusable geometry key → shared Sekai64 Geometry
Room ID               → Sekai64 Node group
```

## Shared resources

Create one unit geometry per reusable primitive and scale scene nodes:

```ts
const scope = engine.resources.createScope('compiled-world')
const unitBox = scope.track(new BoxGeometry())
const unitPlane = scope.track(new PlaneGeometry())
const unitCylinder = scope.track(new CylinderGeometry())

const wall = new Mesh({
  geometry: unitBox,
  material: sharedWallMaterial,
  ownsResources: false
})
wall.scale.set(width, height, thickness)
```

Dispose nodes independently, then dispose the shared scope once when the mounted world is replaced.

## Incremental updates

- Transform: call `node.setTransform()`.
- Visibility: call `node.setVisible()`.
- Geometry replacement: call `mesh.setGeometry()` with explicit ownership.
- Material replacement: call `mesh.setMaterial()` with explicit ownership.
- Text: call `textMesh.setText()`.
- Image: call `await imageMesh.setSource()`.
- Removal: call `node.dispose()` and delete the adapter mapping.

## Picking

Use triangle precision for products, models, image panels, and selectable objects. Use bounds precision for walls and other non-interactive architecture.

Instanced picking returns `instanceId`; adapters should map each instance index back to the compiler primitive ID.

## Capability negotiation

Read `engine.capabilities.features` before declaring support to a host runtime. Do not silently claim shadows, spot lights, or wireframe support while those fields are false.
