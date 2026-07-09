const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web backend loads a .wasm worker; Metro's default asset
// extensions don't include it, so the web bundler can't resolve
// "./wa-sqlite/wa-sqlite.wasm" and every SQLite write silently hangs on web.
config.resolver.assetExts.push('wasm');

module.exports = config;
