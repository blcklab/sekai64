# Sekai64 stability contracts

## Stable 0.7 baseline

Sekai64 0.7.0 remains the stable rendering baseline for Anyo 0.9.0 and the Web Surface package family.

## 0.8 release-candidate contract

Sekai64 0.8 adds optional modular features without changing the core ownership principles:

- one zero-runtime-dependency public Sekai64 package;
- explicit side-effect-free optional subpaths;
- no animation, decoder, streaming, environment, large-scene, or recovery implementation imported by the static root;
- explicit module setup and awaited reverse-order disposal;
- no Anyo, Player, Editor, DOM-application, or gameplay state-machine semantics;
- explicit host ownership of codec implementations and workers;
- safe static-pose fallback or clear errors when animated assets are loaded without animation support.

Until `0.8.0` stable, optional module interfaces may receive compatible RC refinements. Breaking 0.7 root rendering contracts remain out of scope.
