const { app, BrowserWindow, ipcMain, dialog, Menu, MenuItem } = require("electron/main");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const sound = require("sound-play");

const path = require('path');
const fs = require("fs");
const fsPromise = require("fs/promises");

const resourcesPath = (app.isPackaged) ? process.resourcesPath : path.join(__dirname, "/static/");
let loggedIn = false;

/**
 * @typedef Latlng
 * @property {string} lat
 * @property {string} lng
*/

/**
 * @typedef ChallengeData
 * @property {string} date
 * @property {string} hint
 * @property {string} fact
 * @property {string} src
 * @property {Latlng} actualLocation
 * @property {string|undefined} difficulty
 * @property {boolean} [uploaded]
*/

/**
 * @typedef ChallengeFile
 * @property {ChallengeData[]} challenges
 */

/**
 * @typedef LoginFile
 * @property {string} auth
 * @property {string} role
 */

const saveLocation = path.join(app.getPath("documents"), "BDOGuessr/");
if(!fs.existsSync(saveLocation)) fs.mkdirSync(saveLocation, { recursive: true });

const challengesPath = path.join(saveLocation, "challenges.json");
if(!fs.existsSync(challengesPath)) fs.writeFileSync(challengesPath, JSON.stringify({ challenges: [] }, null, "\t"), { encoding: "utf8" });

/** @type {ChallengeFile} */
const challengeFile = require(challengesPath);

const screenshotFolder = path.join(saveLocation, "screenshots/");
if(!fs.existsSync(screenshotFolder)) fs.mkdirSync(screenshotFolder, { recursive: true });

const bdoScreenshotFolder = path.join(app.getPath("documents"), "Black Desert/ScreenShot");

const loginPath = path.join(app.getPath("userData"), "config.json");
if(!fs.existsSync(loginPath)) fs.writeFileSync(loginPath, JSON.stringify({ "auth": "", "role": "" }, null, "\t"), { encoding: "utf8" });

/** @type {LoginFile} */
const loginFile = require(loginPath);


const getSaveLocation = () => saveLocation;
const saveChallenges = async () => {
	try {
		await fsPromise.writeFile(challengesPath, JSON.stringify(challengeFile, null, "\t"), { encoding: "utf8" }); // Save the json
		return true;
	} catch (e){
		console.log(e);
		return false;
	}
};


/* **************************** */
/*                              */
/*        Authorization         */
/*                              */
/* **************************** */

const saveLoginInfo = async () => {
	try {
		await fsPromise.writeFile(loginPath, JSON.stringify(loginFile, null, "\t"), { encoding: "utf8" }); // Save the json
		return true;
	} catch (e){
		console.log(e);
		return false;
	}
};

async function setAuth(_event, auth){
	if(auth === ""){
		loginFile.auth = "";
		loginFile.role = "";

		const saveSuccess = await saveLoginInfo();
		if(saveSuccess) return { code: 202, message: "Auth unset successfully." };
		return { code: 418, message: "Something went wrong with the request." }; // Teapot
	}

	// Check with the server if auth is valid, otherwise return an error to the user
	const response = await fetch("https://beta.bdoguessr.moe/auth", {
		method: "POST",
		headers: {
			"Authorization": `Basic ${auth}`
		}
	});

	// Server error, could be anything
	if(response.status >= 500){
		return { code: response.status, message: "The server had an error with the request" };
	}

	// Client error, most likely invalid username/password
	if(response.status >= 400){
		if(response.status === 401){
			await setAuth(null, "");
			return { code: 401, message: "Invalid username/password." };
		}

		// Cover other errors
		return { code: response.status, message: response.statusText };
	}

	if(response.status === 200){
		loggedIn = true; // Set loggedIn to true
		const data = await response.json();

		loginFile.auth = auth;
		loginFile.role = data.role;
		loginFile.username = atob(auth).split(":")[0]; // Decode the username from base64 (This feels wrong)

		const saveSuccess = await saveLoginInfo();
		if(saveSuccess) return { code: 200, message: `Auth set successfully.` };
		return { code: 418, message: "Something went wrong with the request." }; // Teapot
	}
}

const getAuth = async () => {
	if(!loggedIn) await setAuth(null, loginFile.auth); // Hacky, but I don't care.

	return {
		auth: loginFile.auth,
		role: loginFile.role,
		username: loginFile.username
	};
};

function cameFromLogin(_event, bool = false){
	loggedIn = bool;
	return loggedIn;
}



/* **************************** */
/*                              */
/*          Open File           */
/*                              */
/* **************************** */
async function openFile(){
	const options = {
		defaultPath: app.getPath("home"),
		title: "Select an Image",
		filters: [
			{ name: "Images", extensions: ["png", "jpg", "bmp"] },
			{ name: "All Files", extensions: ["*"] }
		]
	};

	if(fs.existsSync(bdoScreenshotFolder)) options.defaultPath = bdoScreenshotFolder;
	const { canceled, filePaths } = await dialog.showOpenDialog(options);

	if(!canceled) return filePaths[0];
	return null;
}



/* **************************** */
/*                              */
/*       Update Challenge       */
/*                              */
/* **************************** */
async function handleUpdateChallenge(_event, data){
	// return { code: 500, message: "Not implemented yet." };
	// Make sure the challenge exists and all that jazz
	const original = challengeFile.challenges.findIndex((item) => item.src === data.src);
	if(original === -1) return { code: 404, message: "That challenge seems to be missing." };


	// Update the entry
	challengeFile.challenges[original].fact = data.fact;
	challengeFile.challenges[original].hint = data.hint;
	challengeFile.challenges[original].difficulty = data.difficulty;
	challengeFile.challenges[original].tags = data.tags;

	const saveSuccess = await saveChallenges();
	if(saveSuccess) return { code: 200, message: "Challenge updated successfully." };
	return { code: 418, message: "Something went wrong with the request." }; // Teapot
}



/* **************************** */
/*                              */
/*       Delete Challenge       */
/*                              */
/* **************************** */
async function handleDeleteChallenge(_event, data){
	const original = challengeFile.challenges.findIndex((item) => item.src === data.src);
	if(original === -1) return { code: 404, message: "That challenge seems to be missing." };

	// Delete the entry
	challengeFile.challenges.splice(original, 1);

	// Move the file to "deleted" folder
	const fileName = data.src.split("/").pop();
	const currentPath = path.join(screenshotFolder, fileName);
	const deletedFolder = path.join(screenshotFolder, "deleted/");
	const deletedPath = path.join(deletedFolder, fileName);

	try {
		if(!fs.existsSync(deletedFolder)) fs.mkdirSync(deletedFolder, { recursive: true });
		if(fs.existsSync(deletedPath)) fs.unlinkSync(deletedPath);	// Delete the old file if it for some reason already exists
		if(!fs.existsSync(currentPath)) return { code: 404, message: "The selected file seems to be missing." };

		await fsPromise.rename(currentPath, deletedPath);
	} catch (e){
		console.log(e);
		return { code: 418, message: "Something went wrong with the request." }; // Teapot
	}

	const saveSuccess = await saveChallenges();
	if(saveSuccess) return { code: 200, message: "Challenge deleted successfully." };
	return { code: 418, message: "Something went wrong with the request." }; // Teapot
}



/* **************************** */
/*                              */
/*         Form Submit          */
/*                              */
/* **************************** */
async function handleFormSubmission(_event, form){
	// Make sure the data is set correctly
	if(!["1", "2", "3", "4"].includes(form.difficulty)) return { code: 400, message: "Difficulty should be 1, 2, 3 or 4" };
	if(form.src === "") return { code: 400, response: "Screenshot should not be empty." };


	try {
		if(!fs.existsSync(form.src)) return { code: 400, message: "The selected file seems to be missing." };
		const fileName = form.src.split("\\").pop();
		const filePath = path.join(screenshotFolder, fileName);

		// Copy and delete the old file (Janky but whatever, only way to support different drives)
		await fsPromise.copyFile(form.src, filePath);
		await fsPromise.unlink(form.src);

		const date = new Date;
		const newChallenge = {
			date: `${date.getUTCDate()}/${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`,
			src: fileName,
			fact: form.fact,
			hint: form.hint,
			tags: form.tags,
			difficulty: form.difficulty,
			actualLocation: {
				lat: form.lat,
				lng: form.lng
			},
			uploaded: false
		};

		// Add new entry
		challengeFile.challenges.push(newChallenge);
	} catch (e){
		console.log(e);
		return { code: 418, message: "Something went wrong with the request." }; // Teapot
	}

	const saveSuccess = await saveChallenges();
	if(saveSuccess) return { code: 200, message: "Challenge added successfully." };
	return { code: 418, message: "Something went wrong with the request." }; // Teapot
}



/* **************************** */
/*                              */
/*       Upload to Server       */
/*                              */
/* **************************** */
async function upload(win){
	const window = win;
	// const uploadedChallenges = ();

	let successes = 0;
	let failures = 0;
	const fullChallengeCount = challengeFile.challenges.length;

	if(challengeFile.challenges.length === 0) return 0;

	const nonUploaded = challengeFile.challenges.filter(x => !x.uploaded);
	if(nonUploaded.length === 0) return 0;

	const progressIncrement = 1 / fullChallengeCount;

	const start = performance.now();
	while(challengeFile.challenges.length > failures){
		const challenge = challengeFile.challenges[failures];
		const count = successes + failures + 1;
		window.setProgressBar(count * progressIncrement); // Set the progress bar
		try {
			const screenshotLocation = path.join(screenshotFolder, challenge.src);
			const blob = new Blob([await fsPromise.readFile(screenshotLocation)]);
			const fileName = challenge.src.split("/").pop();

			const formData = new FormData();
			formData.set("lat", challenge.actualLocation.lat);
			formData.set("lng", challenge.actualLocation.lng);
			formData.set("difficulty", challenge.difficulty);
			formData.set("fact", challenge.fact);
			formData.set("hint", challenge.hint);
			formData.set("tags", JSON.stringify(challenge.tags));
			formData.set("screenshot", blob, fileName);

			window.webContents.send("uploadDebug", `[${count}/${fullChallengeCount}] Starting upload of '${fileName.toLowerCase()}'...`);
			const response = await fetch("https://beta.bdoguessr.moe/upload", {
				method: "POST",
				headers: {
					"Authorization": `Basic ${loginFile.auth}`
				},
				body: formData
			});
			window.webContents.send("uploadDebug", `[${count}/${fullChallengeCount}] Response received: ${response.status} ${response.statusText}`);

			if(response.status === 200){
				const uploadedFolder = path.join(screenshotFolder, "uploaded/");
				const uploadedPath = path.join(uploadedFolder, fileName);

				// Remove challenge from json
				const index = challengeFile.challenges.findIndex((item) => item.src === challenge.src);
				if(index !== -1) challengeFile.challenges[index].uploaded = true;

				// Move the file to "uploaded" folder
				if(!fs.existsSync(uploadedFolder)) fs.mkdirSync(uploadedFolder);
				if(fs.existsSync(uploadedPath)){
					fs.unlinkSync(uploadedPath);
					console.warn(`File ${fileName} already exists in the uploaded folder. Deleting it...`);
				}
				await fsPromise.rename(screenshotLocation, uploadedPath);

				// Save the json
				const saveSuccess = await saveChallenges();
				const uploadStatus = { code: 200, message: `${fileName} was uploaded successfully. (${count}/${fullChallengeCount})` };
				console.log(uploadStatus.message);
				if(saveSuccess) window.webContents.send("uploadStatus", uploadStatus);

				successes += 1;
				continue; // Go to next iteration+
			}

			const uploadStatus = { code: response.status, message: `${response.status} ${response.statusText}: ${fileName} failed to upload. (${count}/${fullChallengeCount})` };
			console.log(uploadStatus.message);
			window.webContents.send("uploadStatus", uploadStatus);
			failures += 1;

		} catch (e){
			console.log(e);
			window.webContents.send("uploadStatus", { code: 500, message: "Something went wrong with the request." });
			failures += 1;
		}
	}
	const end = performance.now();
	const time = Math.round((end - start) / 1000);
	window.webContents.send("uploadDebug", `Upload took ${time} seconds.`);
	return successes;
}



/* **************************** */
/*                              */
/*        Sync to Server        */
/*                              */
/* **************************** */
async function syncChallengesToServer(){
	const challengeCount = challengeFile.challenges.length;
	if(challengeCount === 0) return { code: 400, message: "No challenges were available to upload." };

	const window = BrowserWindow.getAllWindows()[0];

	console.log("Starting upload of challenges...");
	const successes = await upload(window);

	window.setProgressBar(-1); // Removes the progress bar
	sound.play(path.join(resourcesPath, "finished.mp3")); // Play finished sound

	if(!window.isFocused()){
		window.flashFrame(true);
		window.once('focus', () => window.flashFrame(false));
	}

	return { code: 200, message: `${successes}/${challengeCount} challenges were uploaded.` };
}



/* **************************** */
/*                              */
/*        Electron Setup        */
/*                              */
/* **************************** */
const createWindow = () => {
	const initialPage = (loginFile.auth) ? "./index.html" : "./login.html";

	const win = new BrowserWindow({
		width: 1840,
		height: 1035,
		webPreferences: {
			preload: path.join(__dirname, 'preload.js')
		}
	});

	// win.setMenu(null); // This hides the file/edit/view/ menu bar at the top of the window

	const menu = new Menu();
	menu.append(new MenuItem({
		accelerator: "f5",
		click: () => win.reload()
	}));

	menu.append(new MenuItem({
		accelerator: "CommandOrControl+R",
		click: () => win.reload()
	}));

	menu.append(new MenuItem({
		accelerator: "CommandOrControl+Shift+I",
		click: () => {
			sound.play(path.join(resourcesPath, "./devtools.mp3"));
			setTimeout(() => win.webContents.openDevTools(), 1000);
		}
	}));

	menu.append(new MenuItem({
		accelerator: "CommandOrControl+F11",
		click: () => {
			if(!win.isFullScreen()) return win.setFullScreen(true);
			return win.setFullScreen(false);
		}
	}));

	Menu.setApplicationMenu(menu); // Set the menu as the application menu
	win.setMenuBarVisibility(false); // Hide the menu bar

	win.loadFile(initialPage);
};


// Init Function
async function init(){
	app.whenReady().then(() => {
		ipcMain.handle("getSaveLocation", getSaveLocation);
		ipcMain.handle("openFile", openFile);
		ipcMain.handle("submitForm", handleFormSubmission);
		ipcMain.handle("updateChallenge", handleUpdateChallenge);
		ipcMain.handle("deleteChallenge", handleDeleteChallenge);
		ipcMain.handle("syncToServer", syncChallengesToServer);
		ipcMain.handle("setAuth", setAuth);
		ipcMain.handle("getAuth", getAuth);
		ipcMain.handle("cameFromLogin", cameFromLogin);

		createWindow();

		app.on('activate', () => {
			if(BrowserWindow.getAllWindows().length === 0) createWindow();
		});
	});

	// Close all windows
	app.on('window-all-closed', () => {
		if(process.platform !== 'darwin') app.quit();
	});
}

init();