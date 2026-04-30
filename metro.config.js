const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude backend directory from Metro's watch list and resolver
config.resolver.blacklistRE = /backend\/.*/;
config.watchFolders = config.watchFolders.filter(f => !f.includes('backend'));

module.exports = config;
