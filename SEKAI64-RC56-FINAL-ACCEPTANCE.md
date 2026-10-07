# Sekai64 0.8.0-rc.56 — final VRM WebGPU acceptance

The user's exact VRM which previously rendered nearly black skin is confirmed fixed on real WebGPU hardware with final `0.8.0-rc.56`. Final rc.56 includes both the missing-`TANGENT` derivative-handedness correction and MToon shade-multiply texCoord parity (`textureFlags3.z`). The fix remains renderer-owned; no compensating changes belong in Anyo, Player, World Loader, or the avatar asset. Automated validation before hardware acceptance: 85/85 tests, 32 public exports, zero runtime dependencies.
