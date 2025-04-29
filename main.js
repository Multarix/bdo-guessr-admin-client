const { app, BrowserWindow, ipcMain, dialog } = require("electron/main");
const path = require('node:path');

const fs = require("fs");
const fsPromise = require("fs/promises");

if(!fs.existsSync("./data/")) fs.mkdirSync("./data/");
if(!fs.existsSync("./data/challenges.json")) fs.writeFileSync("./data/challenges.json", JSON.stringify({ "easy": [], "medium": [], "hard": [], "impossible": [] }, null, "\t"), { encoding: "utf8" });


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
 */

/** @type {ChallengeFile} */
const challengeFile = require("./data/challenges.json");


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
async function handleUpdateDifficulty(_event, data){
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
		return { code: 501, message: "Something went wrong with the request." };
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
		return { code: 501, message: "Something went wrong with the request." };
	}

}


// Handle adding a new entry
async function handleFormSubmission(_event, form){
	const { lat, lng, filePath, difficulty } = form;
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
		return { code: 501, message: "Something went wrong with the request." };
	}
}


async function syncChallengesToServer(){
	// TODO: Impliment code
	// Send a POST to beta.bdoguesser.moe/upload with the attached file and relevant fields.

	return { code: 501, message: "Not yet Implimented!" };
}


// Create the browser window.
const createWindow = () => {
	const win = new BrowserWindow({
		width: 1600,
		height: 900,
		webPreferences: {
			preload: path.join(__dirname, 'preload.js')
		}
	});

	win.loadFile("index.html");
	// win.setMenu(null); // This hides the file/edit/view/ menu bar at the top of the window
};


// Init Function
async function init(){
	app.whenReady().then(() => {
		ipcMain.handle("openFile", openFile);
		ipcMain.handle("submitForm", handleFormSubmission);
		ipcMain.handle("updateDifficulty", handleUpdateDifficulty);
		ipcMain.handle("deleteChallenge", handleDeleteChallenge);
		ipcMain.handle("syncToServer", syncChallengesToServer);

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