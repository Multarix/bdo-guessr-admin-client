const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron/main");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const path = require('path');
const fs = require("fs");
const fsPromise = require("fs/promises");

if(!fs.existsSync("./data/")) fs.mkdirSync("./data/");
if(!fs.existsSync("./data/challenges.json")) fs.writeFileSync("./data/challenges.json", JSON.stringify({ "easy": [], "medium": [], "hard": [], "impossible": [], "auth": "" }, null, "\t"), { encoding: "utf8" });

/**
 * @typedef Latlng
 * @property {string} lat
 * @property {string} lng
*/

/**
 * @typedef ChallengeData
 * @property {string} date
 * @property {string} src
 * @property {Latlng} actualLocation
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
const challengeFile = require("./data/challenges.json");


// Set the auth required for uploading.
async function setAuth(_event, auth){
	challengeFile.auth = auth;
	try {
		// Save the json
		await fsPromise.writeFile("./data/challenges.json", JSON.stringify(challengeFile, null, "\t"), { encoding: "utf8" });
		return { code: 200, message: `Auth ${(auth) ? "Set" : "Unset"} Successfully` };
	} catch (e){
		console.log(e);
		return { code: 500, message: "Something went wrong with the request." };
	}
}


// Handle opening a file
async function openFile(){
	const { canceled, filePaths } = await dialog.showOpenDialog({
		title: "Select an Image",
		filters: [
			{ name: "Images", extensions: ["png", "jpg", "bmp"] },
			{ name: "All Files", extensions: ["*"] }
		]
	});

	if(!canceled) return filePaths[0];
	return null;
}


// Handle updating the difficulty
async function handleUpdateChallenge(_event, data){
	const { originalDiff, newDiff, imageFile } = data;
	// console.log(data);

	// Make sure the challenge exists and all that jazz
	const original = challengeFile[originalDiff].findIndex((item) => item.src === imageFile);
	if(original === -1) return { code: 400, message: "That challenge seems to be missing." };

	const newEntry = challengeFile[newDiff].findIndex((item) => item.src === imageFile);
	if(newEntry !== -1) return { code: 400, message: "That challenge already exists in that difficulty." };

	// Swap to the new entry.
	const entry = challengeFile[originalDiff][original];
	challengeFile[newDiff].push(entry);
	challengeFile[originalDiff].splice(original, 1);

	try {
		// Save the json
		await fsPromise.writeFile("./data/challenges.json", JSON.stringify(challengeFile, null, "\t"), { encoding: "utf8" });
		return { code: 200, message: "Challenge updated successfully." };
	} catch (e){
		console.log(e);
		return { code: 500, message: "Something went wrong with the request." };
	}
}


async function handleDeleteChallenge(_event, data){
	const { difficulty, imageFile } = data;
	// console.log(data);

	// Make sure the challenge exists and all that jazz
	const original = challengeFile[difficulty].findIndex((item) => item.src === imageFile);
	if(original === -1) return { code: 400, message: "That challenge seems to be missing." };

	// Delete the entry
	challengeFile[difficulty].splice(original, 1);

	// Move the file to "deleted" folder
	const fileName = imageFile.split("/").pop();
	const deletedPath = `./data/deleted/${fileName}`;

	try {
		if(!fs.existsSync("./data/deleted/")) fs.mkdirSync("./data/deleted/");
		if(fs.existsSync(deletedPath)) fs.unlinkSync(deletedPath);

		await fsPromise.rename(imageFile, deletedPath);

		// Save the json
		await fsPromise.writeFile("./data/challenges.json", JSON.stringify(challengeFile, null, "\t"), { encoding: "utf8" });
		return { code: 200, message: "Challenge deleted successfully." };
	} catch (e){
		console.log(e);
		return { code: 500, message: "Something went wrong with the request." };
	}

}


// Handle adding a new entry
async function handleFormSubmission(_event, form){
	const diffNumber = {
		"easy": 1,
		"medium": 2,
		"hard": 3,
		"impossible": 4
	};
	const { lat, lng, fact, hint, filePath, difficulty } = form;
	// console.log(form);

	// Make sure the data is set correctly
	if(!["easy", "medium", "hard", "impossible"].includes(difficulty)) return { code: 400, message: "Difficulty should be 'easy', 'medium', 'hard' or 'impossible'." };
	if(filePath === "") return { code: 400, response: "Screenshot should not be empty." };

	try {
		if(!fs.existsSync(filePath)) return { code: 400, message: "The selected file seems to be missing." };
		const fileName = `./data/${filePath.split("\\").pop()}`;

		// Copy and delete the old file (Janky but whatever)
		await fsPromise.copyFile(filePath, fileName);
		// await fsPromise.unlink(filePath);

		const date = new Date;
		const newChallenge = {
			date: `${date.getUTCDate()}/${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`,
			src: fileName,
			fact: fact,
			hint: hint,
			difficulty: diffNumber[difficulty],
			actualLocation: {
				lat,
				lng
			}
		};

		// Add new entry, save the json
		challengeFile[difficulty].push(newChallenge);
		await fsPromise.writeFile("./data/challenges.json", JSON.stringify(challengeFile, null, "\t"), { encoding: "utf8" });

		return { code: 200, message: "Challenge saved successfully." };
	} catch (e){
		console.log(e);
		return { code: 500, message: "Something went wrong with the request." };
	}
}

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

// Sync all challenges to the server
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


// Create the browser window.
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
		ipcMain.handle("openFile", openFile);
		ipcMain.handle("submitForm", handleFormSubmission);
		ipcMain.handle("updateChallenge", handleUpdateChallenge);
		ipcMain.handle("deleteChallenge", handleDeleteChallenge);
		ipcMain.handle("syncToServer", syncChallengesToServer);
		ipcMain.handle("setAuth", setAuth);

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