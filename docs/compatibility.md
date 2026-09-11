# Compatibility

The 0.8 series is in release candidate. Pin the version you test with and check the [changelog](../CHANGELOG.md) before upgrading; optional module APIs may change between candidates.

## Package boundaries

Sekai64 ships as one public package with no third-party runtime dependencies. Import optional features from subpaths such as `@blcklab/sekai64/animation` or `@blcklab/sekai64/xr`.

The root import does not pull in animation, decoder, streaming, environment, large-scene, or recovery implementations. Importing a module does not install it: pass it to `createEngine({ modules })`. Setup follows dependency order, and asynchronous cleanup runs in reverse order.

Your app supplies gameplay logic, codec implementations, and workers. The glTF loader can also fetch a Draco decoder on demand; see [decoder setup](assets-gltf.md#draco-compression) if you need to control that request.

## Upgrading from 0.7

The 0.8 series aims to preserve the 0.7 root rendering API and resource ownership rules while adding optional modules. Existing Anyo 0.9.0 and Web Surface integrations use the 0.7 baseline; check each integration's version requirements before upgrading it.

Animated models need the animation adapter. Without it, loading fails unless you explicitly choose a static pose. See [animation setup](animation-and-animated-gltf.md).

## Backend support

Read `engine.capabilities.features` after engine creation to check the active renderer's features. Installed modules expose their capabilities separately. WebXR presentation requires WebGL2.

See [known limitations](limitations.md) for feature-specific gaps.
