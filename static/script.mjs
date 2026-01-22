/* global L:readonly */
/** @typedef {import("Leaflet")} L */

initialStartupStatus("Loading script.js...");

/**
 * @typedef Latlng
 * @property {string} lat
 * @property {string} lng
*/

/**
 * @typedef ElectronResponse
 * @property {number} code
 * @property {string} message
*/

/**
 * @typedef ChallengeData
 * @property {string} date
 * @property {string} hint
 * @property {string} fact
 * @property {string} src
 * @property {Latlng} actualLocation
 * @property {string} [difficulty]
 * @property {boolean} [uploaded]
*/

/**
 * @typedef ChallengeReponse
 * @property {ChallengeData[]} easy
 * @property {ChallengeData[]} medium
 * @property {ChallengeData[]} hard
 * @property {ChallengeData[]} impossible
 */

/**
 * @typedef ChallengeFile
 * @property {ChallengeData[]} easy
 * @property {ChallengeData[]} medium
 * @property {ChallengeData[]} hard
 * @property {ChallengeData[]} impossible
 * @property {string} auth
 */

/**
 * @typedef ChallengeCounts
 * @property {number} easy
 * @property {number} medium
 * @property {number} hard
 * @property {number} impossible
 */

/**
 * @typedef ChallengeOverlays
 * @property {L.LayerGroup|undefined} `Easy (Local)`
 * @property {L.LayerGroup|undefined} `Medium (Local)`
 * @property {L.LayerGroup|undefined} `Hard (Local)`
 * @property {L.LayerGroup|undefined} `Impossible (Local)`
 * @property {L.LayerGroup|undefined} `Easy (Prod)`
 * @property {L.LayerGroup|undefined} `Medium (Prod)`
 * @property {L.LayerGroup|undefined} `Hard (Prod)`
 * @property {L.LayerGroup|undefined} `Impossible (Prod)`
*/

/**
 * @typedef {Object} ChallengeOverlayData
 * @property {ChallengeOverlays} overlay
 * @property {ChallengeCounts} count
 * @property {L.LayerGroup} easyGroup
 * @property {L.LayerGroup} mediumGroup
 * @property {L.LayerGroup} hardGroup
 * @property {L.LayerGroup} impossibleGroup
 */

// Challenge Adding
/** @type {HTMLInputElement} */
const latInput = document.getElementById("lat");
/** @type {HTMLInputElement} */
const lngInput = document.getElementById("lng");
/** @type {HTMLSelectElement} */
const uploadDifficulty = document.getElementById("uploadDifficulty");
/** @type {HTMLInputElement} */
const challengeFact = document.getElementById('fact');
/** @type {HTMLInputElement} */
const challengeHint = document.getElementById('hint');
/** @type {HTMLDivElement} */
const tagContainer = document.getElementById("tagContainer");
/** @type {HTMLInputElement} */
const tagInput = document.getElementById("tagInput");
/** @type {HTMLButtonElement} */
const uploadFileBtn = document.getElementById("screenshot");
/** @type {HTMLInputElement} */
const challengeFile = document.getElementById('filePath');
/** @type {HTMLButtonElement} */
const submitFormBtn = document.getElementById('submitForm');

// Challenge Editing
/** @type {HTMLInputElement} */
const infoLat = document.getElementById("infoLat");
/** @type {HTMLInputElement} */
const infoLng = document.getElementById("infoLng");
/** @type {HTMLSelectElement} */
const infoDifficulty = document.getElementById("infoDifficulty");
/** @type {HTMLInputElement} */
const infoHint = document.getElementById("infoHint");
/** @type {HTMLInputElement} */
const infoFact = document.getElementById("infoFact");
/** @type {HTMLDivElement} */
const infoTagContainer = document.getElementById("infoTagContainer");
/** @type {HTMLInputElement} */
const infoTagInput = document.getElementById("infoTagInput");
/** @type {HTMLInputElement} */
const infoIsHost = document.getElementById("isHost");
/** @type {HTMLInputElement} */

/** @type {HTMLButtonElement} */
const updateChallengeBtn = document.getElementById("updateChallengeBtn");
/** @type {HTMLButtonElement} */
const deleteChallengeBtn = document.getElementById("deleteBtn");

/** @type {HTMLDivElement} */
const statusContainer = document.getElementById("statusContainer");
/** @type {HTMLParagraphElement} */
const statusMessage = document.getElementById("statusMessage");

/** @type {HTMLButtonElement} */
const syncToServerBtn = document.getElementById("syncToServer");
/** @type {HTMLButtonElement} */
const logoutBtn = document.getElementById("logoutBtn");

/** @type {HTMLButtonElement} */
const editSectionBtn = document.getElementById("editSectionBtn");
/** @type {HTMLElement} */
const editSection = document.getElementById("editSection");
/** @type {HTMLButtonElement} */
const addSectionBtn = document.getElementById("addSectionBtn");
/** @type {HTMLElement} */
const addSection = document.getElementById("addSection");

/** @type {null | L.CircleMarker} */
let activePopup = null; // The current popup we are looking at
/** @type {null | ChallengeData} */
let currentChallenge = null; // The current challenge we are looking at

/** @type {string[]} */
let updateTags = [];
/** @type {string[]} */
let submitTags = [];

const convertDifficulty = {
	"easy": 		"1",
	"medium":		"2",
	"hard":			"3",
	"impossible":	"4",
	"1":			"easy",
	"2":			"medium",
	"3":			"hard",
	"4":			"impossible"
};

/** @type {string} */
const saveLocation = await window.electronAPI.getSaveLocation();
/** @type {string} */

initialStartupStatus("Logging in...");
const authData = await window.electronAPI.getAuth();
if(!authData.auth) window.location.href = "./login.html"; // If we don't have an valid auth token, redirect to login page


initialStartupStatus("Setting up leaflet...");
/** *****************************
 *                              *
 *        Leaflet Setup         *
 *                              *
 ***************************** **/

// Custom icons
const supportedIcons = {
	"multarix": "./static/images/multarix.webp",
	"niyah": "./static/images/niyah.webp",
	"luci": "./static/images/luci.webp"
};

const map = L.map('map', {
	crs: L.CRS.Simple,
	minZoom: 3,
	maxZoom: 9,
	bounds: [[0, 0], [32768, 32768]],
	maxBoundsViscosity: 1.0,
	attributionControl: false
	// fullscreenControl: true
});

// Map Boundry Stuff
const newImageSize = 32760;
const northWest = map.unproject([0, 0], 7);
const southEast = map.unproject([newImageSize, newImageSize], 7);
const imageBounds = L.latLngBounds(northWest, southEast);
map.fitBounds(imageBounds);
map.setMaxBounds(imageBounds);

// Set up the map tiles
const betaTiles = L.tileLayer('./tiles/{z}/{x}/{y}.webp', {
	minZoom: 3,
	maxZoom: 9,
	tileSize: 256,
	noWrap: true,
	maxNativeZoom: 7,
	bounds: imageBounds
}).addTo(map);

// const portRatt = L.tileLayer('./data/{z}/{x}/{y}.webp', {
// 	minZoom: 3,
// 	maxZoom: 9,
// 	tileSize: 256,
// 	noWrap: true,
// 	maxNativeZoom: 7,
// 	bounds: imageBounds
// }).addTo(map);

const tiles = {
	"Local Tiles": betaTiles
	// "Port Ratt": portRatt
};

map.setView([-144.5, 139.0], 5); // Focus roughly on Heidel

// On map click, place downa a marker
let marker;
map.on("click", (ev) => {
	if(!marker){
		marker = makeMarker(ev.latlng, authData.username);

		map.addLayer(marker);
		marker.on("move", (n) => {
			const latlng = convertToHostFormat(n.latlng);

			latInput.value = Math.min(Math.max(latlng.lat, -1), 0);
			lngInput.value = Math.min(Math.max(latlng.lng, 0), 1);

			// Close the popup if we move the marker
			if(activePopup){
				activePopup.closePopup();
				activePopup = null;
			}
		});
	}

	marker.setLatLng(ev.latlng);
});


const localChallenges = await refreshLocalChallenges(true); // Get challenges from local file
const prodChallenges = await refreshProdChallenges(true); // Get challanges from bdoguesser

console.log(`Loaded ${localChallenges.count.easy + localChallenges.count.medium + localChallenges.count.hard + localChallenges.count.impossible} Local challenges`);
console.log(`Loaded ${prodChallenges.count.easy + prodChallenges.count.medium + prodChallenges.count.hard + prodChallenges.count.impossible} Production challenges`);

const allOverlays = Object.assign({}, localChallenges.overlay, prodChallenges.overlay);
const controlLayerOptions = {
	autoZIndex: true,
	hideSingleBase: true,
	sortLayers: true,
	sortFunction: layerSortFunction
};

let layerControl = L.control.layers(tiles, allOverlays, controlLayerOptions).addTo(map);
updateCounts(localChallenges.count, prodChallenges.count); // Update the counts on the page


initialStartupStatus("Setting up event listeners...");
/** *****************************
 *                              *
 *          Open File           *
 *                              *
 ***************************** **/
uploadFileBtn.addEventListener("click", async (evt) => {
	evt.preventDefault();

	/** @type {string} */
	const filePath = await window.electronAPI.openFile();
	const realPath = (filePath) ? filePath : "";

	document.getElementById("fileName").value = realPath.split("\\").pop();
	document.getElementById("filePath").value = realPath;

	if(!filePath) return submitFormBtn.disabled = true;
	submitFormBtn.disabled = false;
});


/** *****************************
 *                              *
 *         Submit Form          *
 *                              *
 ***************************** **/
document.getElementById("uploadForm").addEventListener("submit", async (evt) => {
	evt.preventDefault();

	submitFormBtn.disabled = true;
	const form = evt.target;

	const formData = {
		lat: latInput.value,
		lng: lngInput.value,
		fact: challengeFact.value,
		hint: challengeHint.value,
		tags: submitTags,
		src: challengeFile.value,
		difficulty: document.getElementById("uploadDifficulty").value
	};

	/** @type {ElectronResponse} */
	const response = await window.electronAPI.submitForm(formData);

	if(response.code === 200){
		form.reset();
		submitTags = []; // Clear the tags
		tagContainer.replaceChildren(); // Clear the tag container

		latInput.disabled = false;
		lngInput.disabled = false;
		uploadDifficulty.disabled = false;
		challengeHint.disabled = false;
		challengeFact.disabled = false;
		tagInput.disabled = false;
		uploadFileBtn.disabled = false;

		marker.remove();
		marker = undefined;
		displayStatusMessage(response);
		await refreshLocalChallenges();

	} else {
		submitFormBtn.disabled = false;
		displayStatusMessage(response);
	}
});


/** *****************************
 *                              *
 *       Update Challenge       *
 *                              *
 ***************************** **/
updateChallengeBtn.addEventListener("click", async (evt) => {
	evt.preventDefault();
	if(!currentChallenge) return;

	// Host Update
	if(infoIsHost.checked){
		const url = "https://bdoguessr.moe/update_difficulty";

		const response = await fetch(url, {
			method: "POST",
			headers: {
				'Content-Type': 'application/json',
				"Authorization": `basic ${authData.auth}`
			},
			body: JSON.stringify({
				src: currentChallenge.src,
				new_difficulty: infoDifficulty.value,
				tags: updateTags,
				hint: infoHint.value,
				fact: infoFact.value
			})
		});


		if(response.ok){ // Successfully updated the challenge
			const data = await response.json();
			disableInfoPanel();

			displayStatusMessage({
				code: 200,
				message: "Successfully updated the challenge on the server."
			});

			return refreshProdChallenges();
		}

		// Failed to update the challenge
		return displayStatusMessage({
			code: response.status,
			message: `${response.status} ${response.statusText}: Failed to update the challenge on the server.`
		});
	};

	const data = {
		difficulty: infoDifficulty.value,
		hint: infoHint.value,
		fact: infoFact.value,
		tags: updateTags,
		src: currentChallenge.src
	};

	/** @type {ElectronResponse} */
	const responseFromMain = await window.electronAPI.updateChallenge(data);
	displayStatusMessage(responseFromMain);

	if(responseFromMain.code === 200){
		disableInfoPanel();

		await refreshLocalChallenges();
	}
});


/** *****************************
 *                              *
 *       Delete Challenge       *
 *                              *
 ***************************** **/
deleteChallengeBtn.addEventListener("click", async (evt) => {
	evt.preventDefault();

	if(!currentChallenge) return;

	// Ask user for confirmation
	const confirmation = confirm("Are you sure you want to delete this challenge? This action cannot be undone.");
	if(!confirmation) return;

	// Host delete
	if(infoIsHost.checked){
		const url = "https://bdoguessr.moe/delete_challenge";
		const response = await fetch(url, {
			method: "POST",
			headers: {
				'Content-Type': 'application/json',
				"Authorization": `basic ${authData.auth}`
			},
			body: JSON.stringify({
				src: currentChallenge.src
			})
		});

		if(response.ok){ // Successfully deleted the challenge
			const data = await response.json();
			disableInfoPanel();

			displayStatusMessage({
				code: 200,
				message: "Successfully deleted the challenge from the server."
			});

			return refreshProdChallenges();
		}

		// Failed to update the challenge
		return displayStatusMessage({
			code: response.status,
			message: `${response.status} ${response.statusText}: Failed to delete the challenge from the server.`
		});
	};

	// Local delete
	/** @type {ElectronResponse} */
	const response = await window.electronAPI.deleteChallenge(currentChallenge);

	if(response.code === 200){
		disableInfoPanel();

		displayStatusMessage(response);
		await refreshLocalChallenges();
	}
});


/** *****************************
 *                              *
 *        Sync to Server        *
 *                              *
 ***************************** **/
syncToServerBtn.addEventListener("click", async (evt) => {
	evt.preventDefault();

	const confirmation = confirm("Are you sure you wish to sync to the server now?\nThis action cannot be undone.");
	if(!confirmation) return;

	const syncText = document.getElementById("syncText");
	const syncLoad = document.getElementById("syncLoad");

	syncToServerBtn.disabled = true;
	uploadFileBtn.disabled = true;
	submitFormBtn.disabled = true;
	logoutBtn.disabled = true;
	syncText.style.display = "none";
	syncLoad.style.display = "block";

	/** @type {ElectronResponse} */
	const response = await window.electronAPI.syncToServer();
	displayStatusMessage(response);
	await refreshLocalChallenges();
	await refreshProdChallenges();

	syncToServerBtn.disabled = false;
	uploadFileBtn.disabled = false;
	submitFormBtn.disabled = false;
	logoutBtn.disabled = false;
	syncText.style.display = "block";
	syncLoad.style.display = "none";
});


/** *****************************
 *                              *
 *        Logout Button         *
 *                              *
 ***************************** **/
logoutBtn.addEventListener("click", async (evt) => {
	evt.preventDefault();

	const confirmation = confirm("Are you sure you wish to logout?\nYou will need to login again afterwards.");
	if(!confirmation) return;

	/** @type {ElectronResponse} */
	const response = await window.electronAPI.setAuth("");

	if(response.code === 202) return window.location.href = "./login.html";
	displayStatusMessage(response);
});

// Update the display the status message for each uploaded challenge
window.electronAPI.onUpdateStatus((response) => {
	displayStatusMessage(response);
});

window.electronAPI.uploadDebug((response) => {
	console.log(response);
});

/** *****************************
 *                              *
 *         Initial Tags         *
 *                              *
 ***************************** **/
tagInput.addEventListener("keypress", (evt) => {
	if(evt.key === "Enter") evt.preventDefault();
	const allowedCharacters = /[a-zA-Z]/;
	if(!allowedCharacters.test(evt.key) && evt.key !== "Backspace" && evt.key !== "Enter" && evt.key !== " ") return evt.preventDefault();

	const initialClean = tagInput.value.trim().toLowerCase();
	const split = initialClean.split(/\s+/); // Supports copy pasting multiple tags, it'll auto split em

	if(evt.key === "Enter" && initialClean.length > 0 || evt.key === " " && initialClean.length > 0){
		tagInput.value = ""; // Clear the input

		for(const item of split){
			const itemCleaned = item.trim();
			if(itemCleaned.length < 1) continue; // Ignore empty tags
			if(submitTags.includes(item)) continue; // Ignore duplicate tags

			submitTags.push(itemCleaned);

			const tag = document.createElement("span");
			tag.classList.add("tag");
			tag.textContent = itemCleaned;

			// On click, remove the tag
			tag.addEventListener("click", () => {
				submitTags.splice(submitTags.indexOf(itemCleaned), 1);
				tag.remove();
			});

			tagContainer.appendChild(tag);

		}
	}
});


/** *****************************
 *                              *
 *     Edit Challenge Tags      *
 *                              *
 ***************************** **/
infoTagInput.addEventListener("keypress", (evt) => {
	if(evt.key === "Enter") evt.preventDefault();
	const allowedCharacters = /[a-zA-Z]/;
	if(!allowedCharacters.test(evt.key) && evt.key !== "Backspace" && evt.key !== "Enter" && evt.key !== " ") return evt.preventDefault();

	const initialClean = infoTagInput.value.trim().toLowerCase();
	const split = initialClean.split(/\s+/); // Supports copy pasting multiple tags, it'll auto split em

	if(evt.key === "Enter" && initialClean.length > 0 || evt.key === " " && initialClean.length > 0){
		infoTagInput.value = ""; // Clear the input

		for(const item of split){
			const itemCleaned = item.trim();
			if(itemCleaned.length < 1) continue; // Ignore empty tags
			if(updateTags.includes(item)) continue; // Ignore duplicate tags

			updateTags.push(itemCleaned);

			const tag = document.createElement("span");
			tag.classList.add("tag");
			tag.textContent = itemCleaned;

			// On click, remove the tag
			tag.addEventListener("click", () => {
				updateTags.splice(updateTags.indexOf(itemCleaned), 1);
				tag.remove();
			});

			infoTagContainer.appendChild(tag);
		}
	}
});

// Prevent Enter from opening the "browse" dialog
challengeHint.addEventListener("keypress", (evt) => {
	if(evt.key === "Enter") evt.preventDefault();
});

challengeFact.addEventListener("keypress", (evt) => {
	if(evt.key === "Enter") evt.preventDefault();
});

latInput.addEventListener("keypress", (evt) => {
	if(evt.key === "Enter") evt.preventDefault();
});

lngInput.addEventListener("keypress", (evt) => {
	if(evt.key === "Enter") evt.preventDefault();
});

editSectionBtn.addEventListener("click", swapToEditSection);
addSectionBtn.addEventListener("click", swapToAddSection);


initialStartupStatus("Enabling ui elements...");
// Enable the buttons after all the event listeners have been added.
latInput.disabled = false;
lngInput.disabled = false;
uploadDifficulty.disabled = false;
challengeHint.disabled = false;
challengeFact.disabled = false;
tagInput.disabled = false;
uploadFileBtn.disabled = false;
syncToServerBtn.disabled = false;

initialStartupStatus(`Logged in as <span class="loginRole ${authData.role}">${authData.username}</span>`, true);

/**
 ********************************
 *                              *
 *       Convert to Host        *
 *                              *
 ********************************
 * @name convertToHostFormat
 * @param {Latlng} obj
 * @returns {Latlng}
 */
function convertToHostFormat(obj){
	const realLat = obj.lat;
	// const realLat = (obj.lat * 128) / 32768;
	const realLng = obj.lng;
	// const realLng = (obj.lng * 128) / 32768;

	return { lat: realLat, lng: realLng };
}


/**
 ********************************
 *                              *
 *       Convert to Local       *
 *                              *
 ********************************
 * @name convertToLocalFormat
 * @param {Latlng} obj
 * @returns {Latlng}
 */
function convertToLocalFormat(obj){
	// const updatedLat = ((obj.lat * 32768 - 64) / 128);
	const updatedLat = obj.lat;
	// const updatedLng = ((obj.lng * 32768 + 64) / 128);
	const updatedLng = obj.lng;

	return { lat: updatedLat, lng: updatedLng };
}


/**
 ********************************
 *                              *
 *        Status Message        *
 *                              *
 ********************************
 * @name displayStatusMessage
 * @param {ElectronResponse} response
 * @returns {void}
 */
function displayStatusMessage(response){
	statusMessage.textContent = response.message;
	console.log(response);
	statusMessage.style.color = (response.code === 200) ? "#31ff00" : "#ff5858";
	statusContainer.style.top = 0;
	setTimeout(() => {
		statusContainer.style.top = "";
	}, 5000);
}


/**
 ********************************
 *                              *
 *       fetchChallenges        *
 *                              *
 ********************************
 * @name fetchAndConvertHostChallenges
 * @param {string} url
 * @returns {Promise<ChallengeReponse>}
 */
async function fetchAndConvertHostChallenges(url, options = {}){
	const response = await fetch(url, options);
	if(!response.ok) return { easy: [], medium: [], hard: [], impossible: [] };
	const challenges = await response.json();

	const { easy, medium, hard, impossible } = challenges;
	for(const difficulty of [easy, medium, hard, impossible]){
		for(let i = 0; i < difficulty.length; i++){
			const localFormat = convertToLocalFormat(difficulty[i].actualLocation);
			difficulty[i].actualLocation = localFormat;
		}
	}

	return {
		easy,
		medium,
		hard,
		impossible
	};
}
/**
 * @name fetchAndConvertLocalChallenges
 * @param {string} url
 * @returns {Promise<ChallengeReponse>}
 */
async function fetchAndConvertLocalChallenges(url){
	const response = await fetch(url);
	const challengeFile = await response.json();
	if(authData.auth) document.getElementById("syncContainer").style.display = "";

	const obj = {};

	for(const difficulty of ["1", "2", "3", "4"]){
		const challenges = challengeFile.challenges.filter((challenge) => {
			return challenge.difficulty === difficulty;
		});

		for(const challenge of challenges){
			challenge.actualLocation = convertToLocalFormat(challenge.actualLocation);;
		}

		obj[convertDifficulty[difficulty]] = challenges;
	}

	return {
		easy: obj["easy"],
		medium: obj["medium"],
		hard: obj["hard"],
		impossible: obj["impossible"]
	};
}


/**
 ********************************
 *                              *
 *         Make Circles         *
 *                              *
 ********************************
 * @name makeCircles
 * @param {ChallengeData[]} difficultyArray
 * @param {"easy"|"medium"|"hard"|"impossible"} difficulty
 * @param {0|1|2} type 0: Local, 1: Prod
 * @returns {Promise<L.CircleMarker[]>}
 */
async function makeCircles(difficultyArray, difficulty, type = 0){
	// type:
	// 0 = Local
	// 1 = Prod

	const fillColor = {
		easy: "#00c000",
		medium: "#ff8000",
		hard: "#ff0000",
		impossible: "#000000"
	};

	const circles = [];

	for(const item of difficultyArray){
		const fill = (item?.tags?.length > 0) ? fillColor[difficulty] : "#FF00FF"; // Purple for no tags;
		const borderColor = (type === 2) ? "#ffffff" : "#000000";

		const circle = L.circleMarker(item.actualLocation, {
			color: borderColor,
			fillColor: fill,
			fillOpacity: (type > 0) ? 0.5 : 1,
			radius: 8,
			weight: 1
		});

		const popupOptions = {
			"maxWidth": 600,
			"className": "imgPopup"
		};

		const popup = L.popup(popupOptions);
		if(type === 0) popup.setContent(`<img class="imgPreview" src="${saveLocation}/screenshots/${item.src}">`, popupOptions);
		if(type === 1) popup.setContent(`<img class="imgPreview" src="https://bdoguessr.moe/${item.src}">`, popupOptions);
		if(type === 2) popup.setContent(`<img class="imgPreview">`, popupOptions);

		circle.bindPopup(popup);

		circle.on("click", async (evt) => {
			L.DomEvent.stopPropagation(evt);
			circle.openPopup();

			activePopup = circle;
			currentChallenge = item;

			infoLat.value = item.actualLocation.lat;
			infoLng.value = item.actualLocation.lng;
			infoDifficulty.value = convertDifficulty[difficulty];
			infoHint.value = item.hint ?? "";
			infoFact.value = item.fact ?? "";
			infoIsHost.checked = (type > 0);

			infoTagContainer.replaceChildren(); // Clear the tag container
			infoTagInput.value = ""; // Clear the tag input
			updateTags = []; // Clear the tags

			if(item.tags){
				for(const tagText of item.tags){
					const tagElement = document.createElement("span");
					tagElement.classList.add("tag");
					tagElement.textContent = tagText;

					// On click, remove the tag
					tagElement.addEventListener("click", () => {
						updateTags.splice(updateTags.indexOf(tagText), 1);
						tagElement.remove();
					});

					updateTags.push(tagText);
					infoTagContainer.appendChild(tagElement);
				}
			}

			enableInfoPanel(type);
			swapToEditSection();
		});

		circle.on("popupclose", () => {
			swapToAddSection();
			disableInfoPanel();
		});

		circles.push(circle);
	}

	return circles;
}


/**
 ********************************
 *                              *
 *        Update Counts         *
 *                              *
 ********************************
 * @name updateCounts
 * @param {boolean} controlLayer
 * @returns {void}
 */
function updateCounts(localCount = { easy: 0, medium: 0, hard: 0, impossible: 0 }, hostCount = { easy: 0, medium: 0, hard: 0, impossible: 0 }){
	document.getElementById("easyCount").textContent = localCount.easy + hostCount.easy;
	document.getElementById("mediumCount").textContent = localCount.medium + hostCount.medium;
	document.getElementById("hardCount").textContent = localCount.hard + hostCount.hard;
	document.getElementById("impossibleCount").textContent = localCount.impossible + hostCount.impossible;
	document.getElementById("easyCountLocal").textContent = localCount.easy;
	document.getElementById("mediumCountLocal").textContent = localCount.medium;
	document.getElementById("hardCountLocal").textContent = localCount.hard;
	document.getElementById("impossibleCountLocal").textContent = localCount.impossible;
}


/**
 ********************************
 *                              *
 *       Prod Challenges        *
 *                              *
 ********************************
 * @name refreshProdChallenges
 * @param {boolean} controlLayer
 * @returns {Promise<ChallengeOverlayData>}
 */
async function refreshProdChallenges(controlLayer){
	if(controlLayer) initialStartupStatus("Loading prod challenges...");
	const challenges = await fetchAndConvertHostChallenges("https://bdoguessr.moe/challenges.json");

	const overlays = {
		"Easy (Prod)": L.layerGroup(await makeCircles(challenges.easy, "easy", 1)),
		"Medium (Prod)": L.layerGroup(await makeCircles(challenges.medium, "medium", 1)),
		"Hard (Prod)": L.layerGroup(await makeCircles(challenges.hard, "hard", 1)),
		"Impossible (Prod)": L.layerGroup(await makeCircles(challenges.impossible, "impossible", 1))
	};

	const counts = {
		easy: challenges.easy.length,
		medium: challenges.medium.length,
		hard: challenges.hard.length,
		impossible: challenges.impossible.length
	};

	if(!controlLayer){
		refreshLayerControl(overlays, 1);

		prodChallenges.count = counts;
		return updateCounts(localChallenges.count, prodChallenges.count);
	}

	return {
		overlay: overlays,
		count: counts,
		easyGroup: overlays["Easy (Prod)"],
		mediumGroup: overlays["Medium (Prod)"],
		hardGroup: overlays["Hard (Prod)"],
		impossibleGroup: overlays["Impossible (Prod)"]
	};
}


/**
 ********************************
 *                              *
 *       Local Challenges       *
 *                              *
 ********************************
 * @name refreshLocalChallenges
 * @param {boolean} controlLayer
 * @returns {Promise<ChallengeOverlayData>}
 */
async function refreshLocalChallenges(controlLayer){ // Refresh the map icons
	if(controlLayer) initialStartupStatus("Loading local challenges...");
	const challenges = await fetchAndConvertLocalChallenges(saveLocation + "/challenges.json");

	const localEasy = challenges.easy.filter(x => !x.uploaded);
	const localMedi = challenges.medium.filter(x => !x.uploaded);
	const localHard = challenges.hard.filter(x => !x.uploaded);
	const localImpo = challenges.impossible.filter(x => !x.uploaded);

	const overlays = {
		"Easy (Local)": L.layerGroup(await makeCircles(localEasy, "easy")),
		"Medium (Local)": L.layerGroup(await makeCircles(localMedi, "medium")),
		"Hard (Local)": L.layerGroup(await makeCircles(localHard, "hard")),
		"Impossible (Local)": L.layerGroup(await makeCircles(localImpo, "impossible"))
	};

	const counts = {
		easy: challenges.easy.length,
		medium: challenges.medium.length,
		hard: challenges.hard.length,
		impossible: challenges.impossible.length
	};


	if(!controlLayer){
		refreshLayerControl(overlays, 0);

		localChallenges.count = counts;
		return updateCounts(localChallenges.count, prodChallenges.count);
	}

	const easyGroup = overlays["Easy (Local)"].addTo(map);
	const mediumGroup = overlays["Medium (Local)"].addTo(map);
	const hardGroup = overlays["Hard (Local)"].addTo(map);
	const impossibleGroup = overlays["Impossible (Local)"].addTo(map);

	return {
		overlay: overlays,
		count: counts,
		easyGroup,
		mediumGroup,
		hardGroup,
		impossibleGroup
	};
}


/** *****************************
 *                              *
 *        Misc Functions        *
 *                              *
 ***************************** **/
function swapToEditSection(){
	editSectionBtn.disabled = true;
	addSectionBtn.disabled = false;

	editSection.style.display = "block";
	addSection.style.display = "none";
}

function swapToAddSection(){
	editSectionBtn.disabled = false;
	addSectionBtn.disabled = true;

	editSection.style.display = "none";
	addSection.style.display = "block";
}

/**
 * @param {0|1|2} type
 */
function enableInfoPanel(type){
	infoDifficulty.disabled = false;
	infoHint.disabled = false;
	infoFact.disabled = false;
	infoTagInput.disabled = false;
	updateChallengeBtn.disabled = false;
	if(type === 0 || authData.role === "admin") deleteChallengeBtn.disabled = false;
}

function disableInfoPanel(){
	infoDifficulty.disabled = true;
	infoHint.disabled = true;
	infoFact.disabled = true;
	infoTagInput.disabled = true;
	updateChallengeBtn.disabled = true;
	deleteChallengeBtn.disabled = true;

	// Clear the Info
	infoTagContainer.replaceChildren();
	infoLat.value = "";
	infoLng.value = "";
	infoTagInput.value = "";
	infoHint.value = "";
	infoFact.value = "";
	infoDifficulty.value = "";
	updateTags = [];
	activePopup = null;
	currentChallenge = null;
}

function refreshLayerControl(overlay, type){

	// Checks
	const hadLocalEasy = map.hasLayer(localChallenges.overlay[`Easy (Local)`]);
	const hadLocalMedium = map.hasLayer(localChallenges.overlay[`Medium (Local)`]);
	const hadLocalHard = map.hasLayer(localChallenges.overlay[`Hard (Local)`]);
	const hadLocalImpossible = map.hasLayer(localChallenges.overlay[`Impossible (Local)`]);

	const hadProdEasy = map.hasLayer(prodChallenges.overlay[`Easy (Prod)`]);
	const hadProdMedium = map.hasLayer(prodChallenges.overlay[`Medium (Prod)`]);
	const hadProdHard = map.hasLayer(prodChallenges.overlay[`Hard (Prod)`]);
	const hadProdImpossible = map.hasLayer(prodChallenges.overlay[`Impossible (Prod)`]);

	for(const challengeType of [localChallenges, prodChallenges]){
		layerControl.removeLayer(challengeType.easyGroup);
		layerControl.removeLayer(challengeType.mediumGroup);
		layerControl.removeLayer(challengeType.hardGroup);
		layerControl.removeLayer(challengeType.impossibleGroup);
		map.removeLayer(challengeType.easyGroup);
		map.removeLayer(challengeType.mediumGroup);
		map.removeLayer(challengeType.hardGroup);
		map.removeLayer(challengeType.impossibleGroup);
	}

	// Remove the layer control
	layerControl.remove();

	// Update with the passed in args
	if(type === 0) updateDifficultyGroups(localChallenges, "Local", overlay);
	if(type === 1) updateDifficultyGroups(prodChallenges, "Prod", overlay);

	// Add the layers back to the map
	addOverlaysToMap(localChallenges, "Local", hadLocalEasy, hadLocalMedium, hadLocalHard, hadLocalImpossible);
	addOverlaysToMap(prodChallenges, "Prod", hadProdEasy, hadProdMedium, hadProdHard, hadProdImpossible);

	// Create the new layer control & add to map
	const refreshed = Object.assign({}, localChallenges.overlay, prodChallenges.overlay);
	layerControl = L.control.layers(tiles, refreshed, controlLayerOptions).addTo(map);
}


function updateDifficultyGroups(group, type, overlay){
	group.overlay = overlay;
	group.easyGroup = overlay[`Easy (${type})`];
	group.mediumGroup = overlay[`Medium (${type})`];
	group.hardGroup = overlay[`Hard (${type})`];
	group.impossibleGroup = overlay[`Impossible (${type})`];
}


/**
 * @param {ChallengeOverlayData} challenges
 * @param {"Local"|"Prod"} type
 * @param {boolean} hadEasy
 * @param {boolean} hadMedium
 * @param {boolean} hadHard
 * @param {boolean} hadImpossible
 */
function addOverlaysToMap(challenges, type, hadEasy, hadMedium, hadHard, hadImpossible){
	if(hadEasy) challenges.overlay[`Easy (${type})`].addTo(map);
	if(hadMedium) challenges.overlay[`Medium (${type})`].addTo(map);
	if(hadHard) challenges.overlay[`Hard (${type})`].addTo(map);
	if(hadImpossible) challenges.overlay[`Impossible (${type})`].addTo(map);
}

function initialStartupStatus(message, hide = false){
	console.log(message);
	document.getElementById("statusMessage").innerHTML = message;
	if(hide){
		setTimeout(() => {
			statusContainer.style.top = "";
		}, 3000);
	}
}


function layerSortFunction(_a, _b, a, b){
	// Local before Prod
	if(a.charAt(0) === b.charAt(0)){ // They are both the same difficulty
		if(a.includes("Local")) return -1; // Local always first
		if(b.includes("Local")) return 1; // Local always first
		if(a.includes("Prod")) return 1; // Prod always last
		if(b.includes("Prod")) return -1; // Prod always last
	}

	// Easy before Medium befoire Hard before Impossible
	if(a.includes("Easy")) return -1; // Easy always first
	if(b.includes("Easy")) return 1; // Easy always first
	if(a.includes("Impossible")) return 1; // Impossible always last
	if(b.includes("Impossible")) return -1; // Impossible always last
	if(a.includes("Medium") && b.includes("Hard")) return -1; // Medium before Hard
	if(a.includes("Hard") && b.includes("Medium")) return 1; // Hard before Medium
}

/**
 *
 *
 * @param {Latlng} location
 * @param {string} name
 * @return {L.marker}
 */
function makeMarker(location, name){
	const username = name.toLowerCase(); // Ignore case

	if(supportedIcons[username]){
		const customMarkerIcon = L.icon({
			iconUrl: supportedIcons[username],
			iconSize: [30, 60],
			iconAnchor: [15, 60]
		});

		return L.marker(location, { draggable: true, icon: customMarkerIcon });
	}
	return L.marker(location, { draggable: true });
}