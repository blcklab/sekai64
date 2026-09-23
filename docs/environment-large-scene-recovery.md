# Environment, large scenes, and recovery

The environment module decodes Radiance HDR RGBE data, owns environment resources, performs CPU tone mapping, and supplies an ambient-probe lighting approximation plus optional background presentation.

The large-scene module provides deterministic shadow-budget allocation and a lazily rebuilt mesh-bounds index for picking candidates. It does not yet render shadow maps.

The recovery module coordinates backend recreation and optional resource restorers. WebGPU can request a replacement adapter/device and recreate layouts/render targets; WebGL coordinates browser context restoration. GPU resources are re-uploaded lazily from retained CPU state.
