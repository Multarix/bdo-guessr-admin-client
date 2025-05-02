const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron/main");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const path = require('path');
const fs = require("fs");
const fsPromise = require("fs/promises");

const saveLocation = path.join(app.getPath("documents"), "BDOGuessr/");
if(!fs.existsSync(saveLocation)) fs.mkdirSync(saveLocation, { recursive: true });

const challengesPath = path.join(saveLocation, "challenges.json");
if(!fs.existsSync(challengesPath)) fs.writeFileSync(challengesPath, JSON.stringify({ "easy": [], "medium": [], "hard": [], "impossible": [], "auth": "" }, null, "\t"), { encoding: "utf8" });
const challengeFile = require(challengesPath);

const screenshotFolder = path.join(saveLocation, "screenshots/");
if(!fs.existsSync(screenshotFolder)) fs.mkdirSync(screenshotFolder, { recursive: true });

const bdoScreenshotFolder = path.join(app.getPath("documents"), "Black Desert/ScreenShot");

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
*/

/**
 * @typedef ChallengeFile
 * @property {ChallengeData[]} easy
 * @property {ChallengeData[]} medium
 * @property {ChallengeData[]} hard
 * @property {ChallengeData[]} impossible
 * @property {string} auth
 */

/** @type {ChallengeFile} */
const invertDifficultyFormat = {
	"easy": 		"1",
	"medium":		"2",
	"hard":			"3",
	"impossible":	"4",
	"1":			"easy",
	"2":			"medium",
	"3":			"hard",
	"4":			"impossible"
};

// TODO: Swap between beta and prod server auth
const getAuth = () => challengeFile.auth;
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
/*           Set Auth           */
/*                              */
/* **************************** */

async function setAuth(_event, auth){
	if(auth === ""){
		challengeFile.auth = "";

		const saveSuccess = await saveChallenges();
		if(saveSuccess) return { code: 200, message: "Auth set successfully." };
		return { code: 500, message: "Something went wrong with the request." };
	}

	// Check with the server if auth is valid, otherwise return an error to the user
	const response = await fetch("https://beta.bdoguessr.moe/admin", {
		method: "GET",
		headers: {
			"Authorization": `Basic ${auth}`
		}
	});

	if(response.status !== 200) return { code: 401, message: "Invalid username/ password." };

	challengeFile.auth = auth;
	const saveSuccess = await saveChallenges();
	if(saveSuccess) return { code: 200, message: "Auth set successfully." };
	return { code: 500, message: "Something went wrong with the request." };
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
	const oldDiff = invertDifficultyFormat[data.oldDifficulty];	// To String
	const newDiff = invertDifficultyFormat[data.difficulty];	// To String

	// Make sure the challenge exists and all that jazz
	const original = challengeFile[oldDiff].findIndex((item) => item.src === data.src);
	if(original === -1) return { code: 404, message: "That challenge seems to be missing." };

	// Update the entry
	challengeFile[oldDiff][original].fact = data.fact;
	challengeFile[oldDiff][original].hint = data.hint;
	challengeFile[oldDiff][original].difficulty = data.difficulty;

	// If the difficulty changed, move the entry to the new difficulty
	if(data.oldDifficulty !== data.difficulty){
		challengeFile[newDiff].push(challengeFile[oldDiff][original]);
		challengeFile[oldDiff].splice(original, 1);
	}

	const saveSuccess = await saveChallenges();
	if(saveSuccess) return { code: 200, message: "Challenge updated successfully." };
	return { code: 500, message: "Something went wrong with the request." };
}


/* **************************** */
/*                              */
/*       Delete Challenge       */
/*                              */
/* **************************** */

async function handleDeleteChallenge(_event, data){
	// Make sure the challenge exists and all that jazz
	const difficulty = invertDifficultyFormat[data.difficulty];

	const original = challengeFile[difficulty].findIndex((item) => item.src === data.src);
	if(original === -1) return { code: 404, message: "That challenge seems to be missing." };

	// Delete the entry
	challengeFile[difficulty].splice(original, 1);

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
		return { code: 500, message: "Something went wrong with the request." };
	}

	const saveSuccess = await saveChallenges();
	if(saveSuccess) return { code: 200, message: "Challenge deleted successfully." };
	return { code: 500, message: "Something went wrong with the request." };
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

		// Copy and delete the old file (Janky but whatever)
		await fsPromise.copyFile(form.src, filePath);
		await fsPromise.unlink(filePath);

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
			}
		};

		// Add new entry
		const diff = invertDifficultyFormat[form.difficulty]; // Converts the number to word
		challengeFile[diff].push(newChallenge);
	} catch (e){
		console.log(e);
		return { code: 500, message: "Something went wrong with the request." };
	}

	const saveSuccess = await saveChallenges();
	if(saveSuccess) return { code: 200, message: "Challenge added successfully." };
	return { code: 500, message: "Something went wrong with the request." };
}


/* **************************** */
/*                              */
/*       Upload to Server       */
/*                              */
/* **************************** */

async function upload(difficulty, win, successes){
	/** @type {ChallengeData[]} */
	const challenges = challengeFile[difficulty];
	if(challenges.length === 0) return successes;

	for(const challenge of challenges){
		try {
			const blob = new Blob([await fsPromise.readFile(challenge.src)]);
			const fileName = challenge.src.split("/").pop();

			const body = new FormData();
			body.append("lat", challenge.actualLocation.lat);
			body.append("lng", challenge.actualLocation.lng);
			body.append("difficulty", challenge.difficulty);
			body.append("tags", challenge.tags);
			body.append("hint", challenge.hint);
			body.append("fact", challenge.fact);
			body.set("screenshot", blob, fileName);

			const response = await fetch("https://beta.bdoguessr.moe/upload", {
				method: "POST",
				headers: {
					"Authorization": `Basic ${challengeFile.auth}`
				},
				body
			});

			if(response.status === 200){
				const fileName = challenge.src.split("/").pop();
				const uploadedPath = `./data/uploaded/${fileName}`;

				// Remove challenge from json
				const index = challengeFile[difficulty].findIndex((item) => item.src === challenge.src);
				if(index !== -1) challengeFile[difficulty].splice(index, 1);


				// Move the file to "uploaed" folder
				if(!fs.existsSync("./data/uploaded/")) fs.mkdirSync("./data/uploaded/");
				if(fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
				await fsPromise.rename(challenge.src, uploadedPath);

				// Save the json
				await fsPromise.writeFile("./data/challenges.json", JSON.stringify(challengeFile, null, "\t"), { encoding: "utf8" });

				successes += 1;
				win.webContents.send("uploadStatus", { code: 200, message: `${fileName} was uploaded successfully.` });
				continue;
			}

			win.webContents.send("uploadStatus", { code: 500, message: `${fileName} failed to upload.` });
			continue;

		} catch (e){
			console.log(e);
			win.webContents.send("uploadStatus", { code: 500, message: "Something went wrong with the request." });
			continue;
		}
	}

	return successes;
}


/* **************************** */
/*                              */
/*        Sync to Server        */
/*                              */
/* **************************** */

async function syncChallengesToServer(){
	const challengeCount = challengeFile["easy"].length + challengeFile["medium"].length + challengeFile["hard"].length + challengeFile["impossible"].length;
	if(challengeCount === 0) return { code: 400, message: "No challenges were available to upload." };
	const win = BrowserWindow.getAllWindows()[0];

	let successes = 0;
	console.log("Starting upload of easy...");
	successes = await upload("easy", win, successes);

	console.log("Starting upload of medium...");
	successes = await upload("medium", win, successes);

	console.log("Starting upload of hard...");
	successes = await upload("hard", win, successes);

	console.log("Starting upload of impossible...");
	successes = await upload("impossible", win, successes);

	await new Promise((resolve) => {
		setTimeout(() => {
			resolve();
		}, 6000);
	});

	return { code: 200, message: `${successes}/${challengeCount} challenges were uploaded.` };
}



/* **************************** */
/*                              */
/*        Electron Setup        */
/*                              */
/* **************************** */

const createWindow = () => {
	const initialPage = (challengeFile.auth) ? "./index.html" : "./login.html";

	const win = new BrowserWindow({
		width: 1840,
		height: 1035,
		webPreferences: {
			preload: path.join(__dirname, 'preload.js')
		}
	});


	win.loadFile(initialPage);
	// win.setMenu(null); // This hides the file/edit/view/ menu bar at the top of the window
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