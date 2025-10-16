1. Add package to monorepo `pnpm` workspaces.
2. `pnpm --filter @elizaos-plugins/plugin-zkproof install` (or root install)
3. `pnpm --filter @elizaos-plugins/plugin-zkproof run compile-circuits`
4. `pnpm --filter @elizaos-plugins/plugin-zkproof run build`
5. Copy build artifacts to your frontend `client/public/zk` or run `publish-artifacts` script once implemented.


---


### Notes / next steps
- Replace placeholders in `src/client.ts` with proper `noir_js` + Garaga WASM instantiation once you confirm WASM probe availability.
- Implement real Noir circuits (`.nr`) and add to `scripts/compile-circuits.sh` copying `target/*` into `build/`.
- Add unit tests in `tests/` to ensure `hashSecret` produces deterministic values.


---