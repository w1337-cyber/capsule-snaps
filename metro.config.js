// Firebase's JS SDK needs these two tweaks to load its React Native build under Metro.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push('cjs');
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
