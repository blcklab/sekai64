# Renderer adapters

A renderer adapter connects your app's objects to Sekai64 nodes. Keep document state, collision rules, portals, and undo history in your app; use the adapter to create and update what gets rendered.

## Map objects and share resources

Keep mappings you can use for updates and picking:

| App identifier | Sekai64 resource |
| --- | --- |
| Primitive ID | Node |
| Material ID | Shared material |
| Reusable geometry key | Shared geometry |
| Room ID | Node group |

For repeated shapes, share unit geometry and scale each mesh. This example assumes an existing `engine` and a wall size in `width`, `height`, and `thickness`.

```ts
import { BoxGeometry, Mesh, StandardMaterial } from '@blcklab/sekai64'

const scope = engine.resources.createScope('compiled-world')
const unitBox = scope.track(new BoxGeometry())
const wallMaterial = scope.track(new StandardMaterial({ baseColor: '#eeeeee' }))

const wall = new Mesh({
  geometry: unitBox,
  material: wallMaterial,
  ownsResources: false
})
wall.scale.set(width, height, thickness)
```

`ownsResources: false` lets a wall be removed without destroying geometry or materials used by other walls. When replacing the world, dispose its nodes first, then call `scope.dispose()` once to release the shared resources.

## Apply changes

| Change | Call |
| --- | --- |
| Transform | `node.setTransform()` |
| Visibility | `node.setVisible()` |
| Geometry | `mesh.setGeometry()` with an explicit ownership choice |
| Material | `mesh.setMaterial()` with an explicit ownership choice |
| Text | `textMesh.setText()` |
| Image | `await imageMesh.setSource()` |
| Removal | `node.dispose()`, then delete the mapping |

## Picking

Use triangle precision when the hit needs to follow the visible surface, such as a product or model. Bounds precision is cheaper for walls and simple architecture when an approximate hit is enough.

For large scenes, use `SpatialMeshIndex` to narrow candidates before exact tests. Instanced hits include `instanceId`; map that index back to your app's primitive ID.

## Check renderer capabilities

Read `engine.capabilities.features` after engine creation before exposing options such as shadows, spot lights, or wireframe. Check optional module capabilities separately. Only enable an option when the active renderer or module supports it.
