/**
 * Barrel file — Metro resolves .native.ts / .web.ts automatically
 * when this file exists WITHOUT platform suffix.
 * On native builds Metro picks revenueCatService.native.ts,
 * on web builds Metro picks revenueCatService.web.ts.
 *
 * This file is intentionally empty — it just needs to exist
 * so that bare imports like `import * as RC from './revenueCatService'`
 * trigger Metro's platform-specific resolution.
 *
 * ⚠️ DO NOT add code here. Add code to the .native.ts / .web.ts files.
 */
export * from './revenueCatService.web';
