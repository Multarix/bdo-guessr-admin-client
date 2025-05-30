const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
	packagerConfig: {
		asar: true,
		name: "BDOGuessr_Admin",
		icon: "./icon",
		ignore: "^/data",
		extraResource: ["./static/finished.mp3", "./static/devtools.mp3"]
	},
	rebuildConfig: {},
	makers: [
		// {
		// 	name: '@electron-forge/maker-squirrel',
		// 	config: {
		// 		description: 'BDOGuessr admin client',
		// 		shortName: 'BDOGuessr'
		// 	}
		// },
		{
			name: '@electron-forge/maker-zip',
			config: {
				description: 'BDOGuessr admin client',
				shortName: 'BDOGuessr'
			}
		},
		{
			name: '@electron-forge/maker-deb',
			config: {
				description: 'BDOGuessr admin client',
				shortName: 'BDOGuessr'
			}
		},
		{
			name: '@electron-forge/maker-rpm',
			config: {
				description: 'BDOGuessr admin client',
				shortName: 'BDOGuessr'
			}
		}
	],
	plugins: [
		{
			name: '@electron-forge/plugin-auto-unpack-natives',
			config: {}
		},
		// Fuses are used to enable/disable various Electron functionality
		// at package time, before code signing the application
		new FusesPlugin({
			version: FuseVersion.V1,
			[FuseV1Options.RunAsNode]: false,
			[FuseV1Options.EnableCookieEncryption]: true,
			[FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
			[FuseV1Options.EnableNodeCliInspectArguments]: false,
			[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
			[FuseV1Options.OnlyLoadAppFromAsar]: true
		})
	]
};
