/* global L:readonly */
/** @typedef {import("Leaflet")} L */

const latInput = document.getElementById("lat");
const lngInput = document.getElementById("lng");
const uploadFileBtn = document.getElementById("screenshot");

const challengeFact = document.getElementById('hint');
const challengeHint = document.getElementById('fact');
const challengeFile = document.getElementById('filePath');
const submitFormBtn = document.getElementById('submitForm');

const infoDifficulty = document.getElementById("infoDifficulty");
const infoHint = document.getElementById("infoHint");
const infoFact = document.getElementById("infoFact");
const infoIsHost = document.getElementById("isHost");
const updateChallengeBtn = document.getElementById("updateChallengeBtn");
const deleteChallengeBtn = document.getElementById("deleteBtn");

const statusContainer = document.getElementById("statusContainer");
const statusMessage = document.getElementById("statusMessage");

const syncToServerBtn = document.getElementById("syncToServer");
const logoutBtn = document.getElementById("logoutBtn");

let currentChallenge = null; // The current challenge we are looking at
let activePopup = null; // The current popup we are looking at

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

/* **************************** */
/*                              */
/*        Leaflet Setup         */
/*                              */
/* **************************** */


// Setup the map
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

			latInput.value = latlng.lat;
			lngInput.value = latlng.lng;

			if(activePopup){
				infoDifficulty.disabled = true;
				infoHint.disabled = true;
				infoFact.disabled = true;
				deleteChallengeBtn.disabled = true;
				updateChallengeBtn.disabled = true;
				activePopup.closePopup();
				activePopup = null; // Close the popup if we move the marker
			}
		});
	}

	marker.setLatLng(ev.latlng);
});


const hostChallenges = await refreshHostChallenges(true); // Get challangesfrom bdoguesser
const localChallenges = await refreshLocalChallenges(true); // Get challenges from local file
const layerControl = L.control.layers(null, Object.assign(localChallenges.overlay, hostChallenges.overlay)).addTo(map);
updateCounts(localChallenges.count, hostChallenges.count);


/* **************************** */
/*                              */
/*       Event Listeners        */
/*                              */
/* **************************** */

// Electron open file, cause we need it
uploadFileBtn.addEventListener("click", async (evt) => {
	evt.preventDefault();

	const filePath = await window.electronAPI.openFile();
	const realPath = (filePath) ? filePath : "";

	document.getElementById("fileName").value = realPath.split("\\").pop();
	document.getElementById("filePath").value = realPath;

	submitFormBtn.disabled = false;
});

// The upload form to update our local store & refresh our challenge markers
document.getElementById("uploadForm").addEventListener("submit", async (evt) => {
	evt.preventDefault();

	submitFormBtn.disabled = true;
	const form = evt.target;

	const formData = {
		lat: latInput.value,
		lng: lngInput.value,
		fact: challengeFact.value,
		hint: challengeHint.value,
		src: challengeFile.value,
		difficulty: document.getElementById("uploadDifficulty").value
	};

	const response = await window.electronAPI.submitForm(formData);

	if(response.code === 200){
		form.reset();
		marker.remove();
		marker = undefined;
		displayStatusMessage(response);
		await refreshLocalChallenges();

	} else {
		submitFormBtn.disabled = false;
		displayStatusMessage(response);
	}
});

// Update Challenge
updateChallengeBtn.addEventListener("click", async (evt) => {
	evt.preventDefault();

	if(!currentChallenge) return;
	if(infoIsHost.checked) return;

	const data = {
		difficulty: infoDifficulty.value,
		oldDifficulty: currentChallenge.difficulty,
		hint: infoHint.value,
		fact: infoFact.value,
		src: currentChallenge.src,
		actualLocation: currentChallenge.actualLocation
	};

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


// Delete Challenge
deleteChallengeBtn.addEventListener("click", async (evt) => {
	evt.preventDefault();

	if(!currentChallenge) return;
	if(infoIsHost.checked) return;

	// Ask user for confirmation
	const confirmation = confirm("Are you sure you want to delete this challenge? This action cannot be undone.");
	if(!confirmation) return;

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


// Sync to server button, sends all our local images to the server
syncToServerBtn.addEventListener("click", async (evt) => {
	evt.preventDefault();

	const confirmation = confirm("Are you sure you wish to sync to the server now?\nThis action cannot be undone.");
	if(!confirmation) return;

	const syncText = document.getElementById("syncText");
	const syncLoad = document.getElementById("syncLoad");

	syncToServerBtn.disabled = true;
	uploadFileBtn.disabled = true;
	syncToServerBtn.disabled = true;
	submitFormBtn.disabled = true;
	logoutBtn.disabled = true;
	syncText.style.display = "none";
	syncLoad.style.display = "block";

	const response = await window.electronAPI.syncToServer();
	displayStatusMessage(response);
	await refreshLocalChallenges();

	syncToServerBtn.disabled = false;
	uploadFileBtn.disabled = false;
	submitFormBtn.disabled = false;
	syncToServerBtn.disabled = false;
	logoutBtn.disabled = false;
	syncText.style.display = "block";
	syncLoad.style.display = "none";
});

// Logs out the user out to login page
logoutBtn.addEventListener("click", async (evt) => {
	evt.preventDefault();

	const confirmation = confirm("Are you sure you wish to logout?\nYou will need to login again afterwards.");
	if(!confirmation) return;
	const response = await window.electronAPI.setAuth("");

	if(response.code === 200) return window.location.href = "./login.html";
	displayStatusMessage(response);
});

// Update the display the status message for each uploaded challenge
window.electronAPI.onUpdateStatus((response) => {
	displayStatusMessage(response);
});


// Enable the buttons after all the event listeners have been added.
uploadFileBtn.disabled = false;
syncToServerBtn.disabled = false;



/* **************************** */
/*                              */
/*         Functions            */
/*                              */
/* **************************** */

function displayStatusMessage(response){
	statusMessage.textContent = response.message;
	console.log(response);
	statusMessage.style.color = (response.code === 200) ? "#31ff00" : "#ff5858";
	statusContainer.style.top = 0;
	setTimeout(() => {
		statusContainer.style.top = "";
	}, 5000);
}

function convertToHostFormat(obj){
	const realLat = (obj.lat * 128) / 32768;
	const realLng = (obj.lng * 128) / 32768;

	return { lat: realLat, lng: realLng };
}

function convertToLocalFormat(obj){
	const updatedLat = (obj.lat * 32768) / 128;
	const updatedLng = (obj.lng * 32768) / 128;

	return { lat: updatedLat, lng: updatedLng };
}

async function fetchAndConvertChallenges(url){
	const response = await fetch(url);
	const challenges = await response.json();
	if(url.startsWith(".") && challenges.auth) document.getElementById("syncContainer").style.display = "";

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
		if(!isHost) circle.bindPopup(`<img class="imgPreview" src="${item.src}">`, popupOptions);
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

			if(!isHost){
				infoDifficulty.disabled = false;
				infoHint.disabled = false;
				infoFact.disabled = false;
				deleteChallengeBtn.disabled = false;
				updateChallengeBtn.disabled = false;
			}

			if(isHost){
				infoDifficulty.disabled = true;
				infoHint.disabled = true;
				infoFact.disabled = true;
				deleteChallengeBtn.disabled = true;
				updateChallengeBtn.disabled = true;
			}
		});

		circles.push(circle);
	}

	return circles;
}

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
		layerControl.removeLayer(hostChallenges.easyGroup);
		layerControl.removeLayer(hostChallenges.mediumGroup);
		layerControl.removeLayer(hostChallenges.hardGroup);
		layerControl.removeLayer(hostChallenges.impossibleGroup);

		layerControl.addOverlay(hostChallenges.easyGroup, "Host Easy");
		layerControl.addOverlay(hostChallenges.mediumGroup, "Host Medium");
		layerControl.addOverlay(hostChallenges.hardGroup, "Host Hard");
		layerControl.addOverlay(hostChallenges.impossibleGroup, "Host Impossible");

		return updateCounts(localChallenges.count, counts);
	}

	return { overlay: overlays, count: counts, easyGroup: overlays["Host Easy"], mediumGroup: overlays["Host Medium"], hardGroup: overlays["Host Hard"], impossibleGroup: overlays["Host Impossible"] };
}

async function refreshLocalChallenges(controlLayer){ // Refresh the map icons
	const challenges = await fetchAndConvertChallenges("./data/challenges.json");
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
		layerControl.removeLayer(localChallenges.easyGroup);
		layerControl.removeLayer(localChallenges.mediumGroup);
		layerControl.removeLayer(localChallenges.hardGroup);
		layerControl.removeLayer(localChallenges.impossibleGroup);
		map.removeLayer(localChallenges.easyGroup);
		map.removeLayer(localChallenges.mediumGroup);
		map.removeLayer(localChallenges.hardGroup);
		map.removeLayer(localChallenges.impossibleGroup);

		localChallenges.easyGroup = overlays.Easy.addTo(map);
		localChallenges.mediumGroup = overlays.Medium.addTo(map);
		localChallenges.hardGroup = overlays.Hard.addTo(map);
		localChallenges.impossibleGroup = overlays.Impossible.addTo(map);

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