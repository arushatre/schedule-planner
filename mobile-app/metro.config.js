const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// The app imports pure logic from the web app's src/ (via the "@/" alias in tsconfig.json).
config.watchFolders = [path.resolve(__dirname, '../src')]
// Resolve packages from mobile-app/node_modules first, so shared files use this app's copies.
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')]

module.exports = config
