/* global L:readonly */
/** @typedef {import("Leaflet")} L */

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
 * @property {string|undefined} difficulty
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
 * @property {L.LayerGroup|undefined} Easy
 * @property {L.LayerGroup|undefined} Medium
 * @property {L.LayerGroup|undefined} Hard
 * @property {L.LayerGroup|undefined} Impossible
 * @property {L.LayerGroup|undefined} `Host Easy`
 * @property {L.LayerGroup|undefined} `Host Medium`
 * @property {L.LayerGroup|undefined} `Host Hard`
 * @property {L.LayerGroup|undefined} `Host Impossible`
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

// return { overlay: overlays, count: counts, easyGroup, mediumGroup, hardGroup, impossibleGroup };

// Challenge Adding
/** @type {HTMLInputElement} */
const latInput = document.getElementById("lat");
/** @type {HTMLInputElement} */
const lngInput = document.getElementById("lng");
/** @type {HTMLSelectElement} */
const uploadDifficulty = document.getElementById("uploadDifficulty");
/** @type {HTMLInputElement} */
const challengeFact = document.getElementById('hint');
/** @type {HTMLInputElement} */
const challengeHint = document.getElementById('fact');
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

/** @type {null | L.CircleMarker} */
let activePopup = null; // The current popup we are looking at
/** @type {null | ChallengeData} */
let currentChallenge = null; // The current challenge we are looking at

/** @type {string[]} */
const updateTags = [];
/** @type {string[]} */
const submitTags = [];

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
const authToken = await window.electronAPI.getAuth();
if(!authToken) window.location.href = "./login.html"; // If we don't have an auth token, redirect to login page

/** *****************************
 *                              *
 *        Leaflet Setup         *
 *                              *
 ***************************** **/
const map = L.map('map', {
	crs: L.CRS.Simple,
	minZoom: 3,
	maxZoom: 9,
	bounds: [[0, 0], [32760, 32760]],
	maxBoundsViscosity: 1.0,
	attributionControl: false,
	fullscreenControl: true
});

// Map Boundry Stuff
const newImageSize = 32760;
const northWest = map.unproject([0, 0], 7);
const southEast = map.unproject([newImageSize, newImageSize], 7);
const imageBounds = L.latLngBounds(northWest, southEast);
map.fitBounds(imageBounds);
map.setMaxBounds(imageBounds);

// Set up the map tiles
L.tileLayer('./tiles/{z}/{x}/{y}.webp', {
	minZoom: 3,
	maxZoom: 9,
	tileSize: 256,
	noWrap: true,
	maxNativeZoom: 7,
	bounds: imageBounds
}).addTo(map);

// ~Heidel
map.setView([-144.5, 139.0], 5); // Focus on Heidel

// On map click, place downa a marker
let marker;
map.on("click", (ev) => {
	if(!marker){
		marker = L.marker(ev.latlng, {
			draggable: true
		});

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


const hostChallenges = await refreshHostChallenges(true); // Get challangesfrom bdoguesser
const localChallenges = await refreshLocalChallenges(true); // Get challenges from local file
const layerControl = L.control.layers(null, Object.assign(localChallenges.overlay, hostChallenges.overlay)).addTo(map);
updateCounts(localChallenges.count, hostChallenges.count);


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
		submitTags.slice(0, submitTags.length); // Clear the tags
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
	if(infoIsHost.checked){
		const response = await fetch("https://bdoguessr.moe/update_difficulty", {
			method: "POST",
			headers: {
				'Content-Type': 'application/json',
				"Authorization": `basic ${authToken}`
			},
			body: JSON.stringify({
				src: currentChallenge.src,
				new_difficulty: infoDifficulty.value,
				tags: updateTags,
				hint: infoHint.value,
				fact: infoFact.value
			})
		});

		const data = await response.json();
		if(data.success){ // Successfully updated the challenge
			displayStatusMessage({
				code: 200,
				message: "Successfully updated the challenge on the server."
			});

			return await refreshHostChallenges();
		}

		// Failed to update the challenge
		return displayStatusMessage({
			code: 500,
			message: "Failed to update the challenge on the server."
		});
	};

	const data = {
		difficulty: infoDifficulty.value,
		oldDifficulty: currentChallenge.difficulty,
		hint: infoHint.value,
		fact: infoFact.value,
		tags: updateTags,
		src: currentChallenge.src,
		actualLocation: currentChallenge.actualLocation
	};

	/** @type {ElectronResponse} */
	const response = await window.electronAPI.updateChallenge(data);
	displayStatusMessage(response);

	if(response.code === 200){
		// Disable the buttons
		infoDifficulty.disabled = true;
		infoHint.disabled = true;
		infoFact.disabled = true;
		deleteChallengeBtn.disabled = true;
		updateChallengeBtn.disabled = true;

		if(!infoIsHost.checked) await refreshLocalChallenges();
		if(infoIsHost.checked) await refreshHostChallenges();
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
	if(infoIsHost.checked){
		return;
	};

	// Ask user for confirmation
	const confirmation = confirm("Are you sure you want to delete this challenge? This action cannot be undone.");
	if(!confirmation) return;

	/** @type {ElectronResponse} */
	const response = await window.electronAPI.deleteChallenge(currentChallenge);
	displayStatusMessage(response);

	if(response.code === 200){
		// Disable the buttons
		infoDifficulty.disabled = true;
		deleteChallengeBtn.disabled = true;
		updateChallengeBtn.disabled = true;
		infoDifficulty.value = "";
		infoHint.value = "";
		infoFact.value = "";

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

	if(response.code === 200) return window.location.href = "./login.html";
	displayStatusMessage(response);
});

// Update the display the status message for each uploaded challenge
window.electronAPI.onUpdateStatus((response) => {
	displayStatusMessage(response);
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

	const cleaned = tagInput.value.trim().toLowerCase();
	if(evt.key === "Enter" && cleaned.length > 0 || evt.key === " " && cleaned.length > 0){
		tagInput.value = "";

		if(!submitTags.includes(cleaned)){
			submitTags.push(cleaned);

			const tag = document.createElement("span");
			tag.classList.add("tag");
			tag.textContent = cleaned;

			// On click, remove the tag
			tag.addEventListener("click", () => {
				submitTags.splice(submitTags.indexOf(cleaned), 1);
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

	const cleaned = infoTagInput.value.trim().toLowerCase();
	if(evt.key === "Enter" && cleaned.length > 0 || evt.key === " " && cleaned.length > 0){
		infoTagInput.value = "";

		if(!submitTags.includes(cleaned)){
			submitTags.push(cleaned);

			const tag = document.createElement("span");
			tag.classList.add("tag");
			tag.textContent = cleaned;

			// On click, remove the tag
			tag.addEventListener("click", () => {
				submitTags.splice(submitTags.indexOf(cleaned), 1);
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


// Enable the buttons after all the event listeners have been added.
latInput.disabled = false;
lngInput.disabled = false;
uploadDifficulty.disabled = false;
challengeHint.disabled = false;
challengeFact.disabled = false;
tagInput.disabled = false;
uploadFileBtn.disabled = false;

syncToServerBtn.disabled = false;



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
	const realLat = (obj.lat * 128) / 32768;
	const realLng = (obj.lng * 128) / 32768;

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
	const updatedLat = (obj.lat * 32768) / 128;
	const updatedLng = (obj.lng * 32768) / 128;

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
 * @name fetchAndConvertChallenges
 * @param {string} url
 * @returns {Promise<ChallengeReponse>}
 */
async function fetchAndConvertChallenges(url){
	const response = await fetch(url);
	const challenges = await response.json();
	if(!url.startsWith("https://") && challenges.auth) document.getElementById("syncContainer").style.display = "";

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
 ********************************
 *                              *
 *         Make Circles         *
 *                              *
 ********************************
 * @name makeCircles
 * @param {ChallengeData[]} difficultyArray
 * @param {"1"|"2"|"3"|"4"} difficulty
 * @param {boolean} isHost
 * @returns {L.CircleMarker[]}
 */
function makeCircles(difficultyArray, difficulty, isHost = false){
	const fillColor = {
		easy: "#00c000",
		medium: "#ff8000",
		hard: "#ff0000",
		impossible: "#000000"
	};

	const circles = [];

	for(const item of difficultyArray){
		const circle = L.circleMarker(item.actualLocation, {
			color: "#000000",
			fillColor: fillColor[difficulty],
			fillOpacity: (isHost) ? 0.5 : 1,
			radius: 8,
			weight: 1
		});

		const popupOptions = {
			"width": 400,
			"maxWidth": 400,
			"className": "imgPopup"
		};
		if(!isHost) circle.bindPopup(`<img class="imgPreview" src="${saveLocation}/screenshots/${item.src}">`, popupOptions);
		if(isHost) circle.bindPopup(`<img class="imgPreview" src="https://bdoguessr.moe/${item.src}">`, popupOptions);

		circle.on("click", async (evt) => {
			L.DomEvent.stopPropagation(evt);
			circle.openPopup();
			activePopup = circle;
			currentChallenge = item;

			infoDifficulty.value = convertDifficulty[difficulty];
			infoHint.value = item.hint ?? "";
			infoFact.value = item.fact ?? "";
			infoIsHost.checked = isHost;

			infoTagContainer.replaceChildren(); // Clear the tag container
			infoTagInput.value = ""; // Clear the tag input
			updateTags.splice(0, updateTags.length); // Clear the tags

			if(item.tags){
				for(const tagText of item.tags){
					const tagElement = document.createElement("span");
					tagElement.classList.add("tag");
					tagElement.textContent = tagText;

					// On click, remove the tag
					tagElement.addEventListener("click", () => {
						submitTags.splice(submitTags.indexOf(tagText), 1);
						tagElement.remove();
					});

					updateTags.push(tagText);
					infoTagContainer.appendChild(tagElement);
				}
			}

			infoDifficulty.disabled = false;
			infoHint.disabled = false;
			infoFact.disabled = false;
			infoTagInput.disabled = false;
			deleteChallengeBtn.disabled = false;
			updateChallengeBtn.disabled = false;
		});

		circle.on("popupclose", () => {
			infoDifficulty.disabled = true;
			infoHint.disabled = true;
			infoFact.disabled = true;
			infoTagInput.disabled = true;
			deleteChallengeBtn.disabled = true;
			updateChallengeBtn.disabled = true;

			// Clear the Info
			infoTagContainer.replaceChildren();
			infoTagInput.value = "";
			infoHint.value = "";
			infoFact.value = "";
			infoDifficulty.value = "";
			updateTags.splice(0, updateTags.length);
			activePopup = null;
			currentChallenge = null;
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
function updateCounts(localCount, hostCount){
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
 *       Host Challenges        *
 *                              *
 ********************************
 * @name refreshHostChallenges
 * @param {boolean} controlLayer
 * @returns {Promise<ChallengeOverlayData>}
 */
async function refreshHostChallenges(controlLayer){
	const challenges = await fetchAndConvertChallenges("https://bdoguessr.moe/challenges.json");

	const overlays = {
		"Host Easy": L.layerGroup(makeCircles(challenges.easy, "easy", true)),
		"Host Medium": L.layerGroup(makeCircles(challenges.medium, "medium", true)),
		"Host Hard": L.layerGroup(makeCircles(challenges.hard, "hard", true)),
		"Host Impossible": L.layerGroup(makeCircles(challenges.impossible, "impossible", true))
	};

	const counts = {
		easy: challenges.easy.length,
		medium: challenges.medium.length,
		hard: challenges.hard.length,
		impossible: challenges.impossible.length
	};

	if(!controlLayer){
		const hasEasy = map.hasLayer(hostChallenges?.easyGroup);
		const hasMedium = map.hasLayer(hostChallenges?.mediumGroup);
		const hasHard = map.hasLayer(hostChallenges?.hardGroup);
		const hasImpossible = map.hasLayer(hostChallenges?.impossibleGroup);

		layerControl.removeLayer(hostChallenges.easyGroup);
		layerControl.removeLayer(hostChallenges.mediumGroup);
		layerControl.removeLayer(hostChallenges.hardGroup);
		layerControl.removeLayer(hostChallenges.impossibleGroup);
		map.removeLayer(hostChallenges.easyGroup);
		map.removeLayer(hostChallenges.mediumGroup);
		map.removeLayer(hostChallenges.hardGroup);
		map.removeLayer(hostChallenges.impossibleGroup);

		if(hasEasy) hostChallenges.easyGroup = overlays["Host Easy"].addTo(map);
		if(hasMedium) hostChallenges.mediumGroup = overlays["Host Medium"].addTo(map);
		if(hasHard) hostChallenges.hardGroup = overlays["Host Hard"].addTo(map);
		if(hasImpossible) hostChallenges.impossibleGroup = overlays["Host Impossible"].addTo(map);
		layerControl.addOverlay(hostChallenges.easyGroup, "Host Easy");
		layerControl.addOverlay(hostChallenges.mediumGroup, "Host Medium");
		layerControl.addOverlay(hostChallenges.hardGroup, "Host Hard");
		layerControl.addOverlay(hostChallenges.impossibleGroup, "Host Impossible");

		return updateCounts(localChallenges.count, counts);
	}

	return {
		overlay: overlays,
		count: counts,
		easyGroup: overlays["Host Easy"],
		mediumGroup: overlays["Host Medium"],
		hardGroup: overlays["Host Hard"],
		impossibleGroup: overlays["Host Impossible"]
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
	const challenges = await fetchAndConvertChallenges(saveLocation + "/challenges.json");
	const overlays = {
		"Easy": L.layerGroup(makeCircles(challenges.easy, "easy")),
		"Medium": L.layerGroup(makeCircles(challenges.medium, "medium")),
		"Hard": L.layerGroup(makeCircles(challenges.hard, "hard")),
		"Impossible": L.layerGroup(makeCircles(challenges.impossible, "impossible"))
	};

	const counts = {
		easy: challenges.easy.length,
		medium: challenges.medium.length,
		hard: challenges.hard.length,
		impossible: challenges.impossible.length
	};


	if(!controlLayer){
		const hasEasy = map.hasLayer(localChallenges?.easyGroup);
		const hasMedium = map.hasLayer(localChallenges?.mediumGroup);
		const hasHard = map.hasLayer(localChallenges?.hardGroup);
		const hasImpossible = map.hasLayer(localChallenges?.impossibleGroup);

		layerControl.removeLayer(localChallenges.easyGroup);
		layerControl.removeLayer(localChallenges.mediumGroup);
		layerControl.removeLayer(localChallenges.hardGroup);
		layerControl.removeLayer(localChallenges.impossibleGroup);
		map.removeLayer(localChallenges.easyGroup);
		map.removeLayer(localChallenges.mediumGroup);
		map.removeLayer(localChallenges.hardGroup);
		map.removeLayer(localChallenges.impossibleGroup);

		if(hasEasy) localChallenges.easyGroup = overlays.Easy.addTo(map);
		if(hasMedium) localChallenges.mediumGroup = overlays.Medium.addTo(map);
		if(hasHard) localChallenges.hardGroup = overlays.Hard.addTo(map);
		if(hasImpossible) localChallenges.impossibleGroup = overlays.Impossible.addTo(map);
		layerControl.addOverlay(localChallenges.easyGroup, "Easy");
		layerControl.addOverlay(localChallenges.mediumGroup, "Medium");
		layerControl.addOverlay(localChallenges.hardGroup, "Hard");
		layerControl.addOverlay(localChallenges.impossibleGroup, "Impossible");

		return updateCounts(counts, hostChallenges.count);
	}

	const easyGroup = overlays.Easy.addTo(map);
	const mediumGroup = overlays.Medium.addTo(map);
	const hardGroup = overlays.Hard.addTo(map);
	const impossibleGroup = overlays.Impossible.addTo(map);

	return { overlay: overlays, count: counts, easyGroup, mediumGroup, hardGroup, impossibleGroup };
}