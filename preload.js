const { contextBridge, ipcRenderer } = require('electron/renderer');

contextBridge.exposeInMainWorld('electronAPI', {
	setAuth: (auth) => ipcRenderer.invoke("setAuth", auth),
	getAuth: () => ipcRenderer.invoke("getAuth"),
	getSaveLocation: () => ipcRenderer.invoke("getSaveLocation"),
	openFile: () => ipcRenderer.invoke('openFile'),
	submitForm: (formData) => ipcRenderer.invoke('submitForm', formData),
	updateChallenge: (data) => ipcRenderer.invoke("updateChallenge", data),
	deleteChallenge: (data) => ipcRenderer.invoke("deleteChallenge", data),
	syncToServer: () => ipcRenderer.invoke("syncToServer"),
	onUpdateStatus: (callback) => ipcRenderer.on("uploadStatus", (_event, value) => callback(value)),
	uploadDebug: (callback) => ipcRenderer.on("uploadDebug", (_event, value) => callback(value)),
	cameFromLogin: (bool) => ipcRenderer.invoke("cameFromLogin", (bool))
});