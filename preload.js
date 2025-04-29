const { contextBridge, ipcRenderer } = require('electron/renderer');

contextBridge.exposeInMainWorld('electronAPI', {
	openFile: () => ipcRenderer.invoke('openFile'),
	submitForm: (formData) => ipcRenderer.invoke('submitForm', formData),
	updateDifficulty: (data) => ipcRenderer.invoke("updateDifficulty", data),
	deleteChallenge: (data) => ipcRenderer.invoke("deleteChallenge", data),
	syncToServer: () => ipcRenderer.invoke("syncToServer")
});