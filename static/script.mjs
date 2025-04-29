/* global L:readonly */
/** @typedef {import("Leaflet")} L */

const latInput = document.getElementById("lat");
const lngInput = document.getElementById("lng");
const uploadFileBtn = document.getElementById("screenshot");
const challengefilePath = document.getElementById("filePath");
const challengeFact = document.getElementById('hint');
const challengeHint = document.getElementById('fact');
const submitFormBtn = document.getElementById('submitForm');

const syncToServerBtn = document.getElementById("syncToServer");
const updateChallengeBtn = document.getElementById("updateChallengeBtn");
const deleteBtn = document.getElementById("deleteBtn");
const infoDifficulty = document.getElementById("infoDifficulty");
const imgPath = document.getElementById("imgPath");
const originalDifficulty = document.getElementById("originalDifficulty");

const statusContainer = document.getElementById("statusContainer");
const statusMessage = document.getElementById("statusMessage");

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
		});
	}

	marker.setLatLng(ev.latlng);
});

// Download all challanges from bdoguesser
const host_overlays = await getHostChallenges();

// Load new Locations from local file
const new_challenges = await fetchAndConvertChallenges("./data/challenges.json");

const new_overlays = {
	"Easy": L.layerGroup(makeCircles(new_challenges.easy, "easy")),
	"Medium": L.layerGroup(makeCircles(new_challenges.medium, "medium")),
	"Hard": L.layerGroup(makeCircles(new_challenges.hard, "hard")),
	"Impossible": L.layerGroup(makeCircles(new_challenges.impossible, "impossible"))
};

const new_counts = {
	easy: new_challenges.easy.length,
	medium: new_challenges.medium.length,
	hard: new_challenges.hard.length,
	impossible: new_challenges.impossible.length
};

let easyGroup = new_overlays.Easy.addTo(map);
let mediumGroup = new_overlays.Medium.addTo(map);
let hardGroup = new_overlays.Hard.addTo(map);
let impossibleGroup = new_overlays.Impossible.addTo(map);

const layerControl = L.control.layers(null, Object.assign(new_overlays, host_overlays.overlay)).addTo(map);
updateCounts(new_counts, host_overlays.count);



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
		filePath: challengefilePath.value,
		difficulty: document.getElementById("uploadDifficulty").value
	};

	const response = await window.electronAPI.submitForm(formData);

	if(response.code === 200){
		form.reset();
		displayStatusMessage(response);
		refreshChallenges();

	} else {
		submitFormBtn.disabled = false;
		displayStatusMessage(response);
	}
});

// Update Challenge
updateChallengeBtn.addEventListener("click", async (evt) => {
	evt.preventDefault();

	const screenshot = imgPath.value.split("/").pop();
	const newDifficulty = infoDifficulty.value;
	if(originalDifficulty.value === newDifficulty) return;
	// TODO: update all the fields

	const data = {
		originalDiff: originalDifficulty.value,
		newDiff: newDifficulty,
		imageFile: `./data/${screenshot}`
	};

	const response = await window.electronAPI.updateChallenge(data);
	displayStatusMessage(response);

	if(response.code === 200){
		originalDifficulty.value = newDifficulty;
		refreshChallenges();
	}
});

// Delete Challenge
deleteBtn.addEventListener("click", async (evt) => {
	evt.preventDefault();

	// Ask user for confirmation
	const confirmation = confirm("Are you sure you want to delete this challenge? This action cannot be undone.");
	if(!confirmation) return;

	const screenshot = imgPath.value.split("/").pop();

	const data = {
		difficulty: originalDifficulty.value,
		imageFile: `./data/${screenshot}`
	};

	const response = await window.electronAPI.deleteChallenge(data);
	displayStatusMessage(response);

	if(response.code === 200){
		// Disable the buttons
		infoDifficulty.disabled = true;
		deleteBtn.disabled = true;
		updateChallengeBtn.disabled = true;

		refreshChallenges();

		// Set the screenshot back to placeholder
		imgPath.value = "";
		originalDifficulty.value = "";
		infoDifficulty.value = "";
	}
});


// Sync to server button, sends all our local images to the server
syncToServerBtn.addEventListener("click", async (evt) => {
	evt.preventDefault();

	const confirmation = confirm("Are you sure you wish to sync to the server now? This action cannot be undone.");
	if(!confirmation) return;

	const syncText = document.getElementById("syncText");
	const syncLoad = document.getElementById("syncLoad");

	syncToServerBtn.disabled = true;
	uploadFileBtn.disabled = true;
	syncToServerBtn.disabled = true;
	submitFormBtn.disabled = true;
	syncText.style.display = "none";
	syncLoad.style.display = "block";

	const response = await window.electronAPI.syncToServer();
	displayStatusMessage(response);

	syncToServerBtn.disabled = false;
	uploadFileBtn.disabled = false;
	submitFormBtn.disabled = false;
	syncToServerBtn.disabled = false;
	syncText.style.display = "block";
	syncLoad.style.display = "none";
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
		impossible: "#400040"
	};

	const circles = [];

	for(const item of difficultyArray){
		const circle = L.circleMarker(item.actualLocation, {
			color: "#000000",
			fillColor: fillColor[difficulty],
			fillOpacity: 0.75,
			radius: 8,
			weight: 1
		});
		circle.bindPopup(`<img class="imgPreview" src="${item.src}">`);

		if(!isHost){
			circle.on("click", async (evt) => {
				L.DomEvent.stopPropagation(evt);
				circle.openPopup();

				originalDifficulty.value = difficulty;
				infoDifficulty.value = difficulty;
				imgPath.value = item.src;
				infoDifficulty.disabled = false;
				deleteBtn.disabled = false;
				updateChallengeBtn.disabled = false;
			});
		}

		circles.push(circle);
	}

	return circles;
}

async function getHostChallenges(){
	const host_challenges = await fetchAndConvertChallenges("https://bdoguessr.moe/challenges.json");
	// console.log(old_challenges);

	const old_easy = makeCircles(host_challenges.easy, "easy", true);
	const old_medium = makeCircles(host_challenges.medium, "medium", true);
	const old_hard = makeCircles(host_challenges.hard, "hard", true);
	const old_impossible = makeCircles(host_challenges.impossible, "impossible", true);

	const overlays = {
		"Host Easy": L.layerGroup(old_easy),
		"Host Medium": L.layerGroup(old_medium),
		"Host Hard": L.layerGroup(old_hard),
		"Host Impossible": L.layerGroup(old_impossible)
	};

	const counts = {
		easy: host_challenges.easy.length,
		medium: host_challenges.medium.length,
		hard: host_challenges.hard.length,
		impossible: host_challenges.impossible.length
	};

	return { overlay: overlays, count: counts };
}

function updateCounts(new_counts, host_counts){
	document.getElementById("easyCount").textContent = new_counts.easy + host_counts.easy;
	document.getElementById("mediumCount").textContent = new_counts.medium + host_counts.medium;
	document.getElementById("hardCount").textContent = new_counts.hard + host_counts.hard;
	document.getElementById("impossibleCount").textContent = new_counts.impossible + host_counts.impossible;
	document.getElementById("easyCountNew").textContent = new_counts.easy;
	document.getElementById("mediumCountNew").textContent = new_counts.medium;
	document.getElementById("hardCountNew").textContent = new_counts.hard;
	document.getElementById("impossibleCountNew").textContent = new_counts.impossible;
}

async function refreshChallenges(){
	// Refresh the map icons
	const refreshed_challenges = await fetchAndConvertChallenges("./data/challenges.json");
	const refreshed_overlays = {
		"Easy": L.layerGroup(makeCircles(refreshed_challenges.easy, "easy")),
		"Medium": L.layerGroup(makeCircles(refreshed_challenges.medium, "medium")),
		"Hard": L.layerGroup(makeCircles(refreshed_challenges.hard, "hard")),
		"Impossible": L.layerGroup(makeCircles(refreshed_challenges.impossible, "impossible"))
	};

	const refreshed_counts = {
		easy: refreshed_challenges.easy.length,
		medium: refreshed_challenges.medium.length,
		hard: refreshed_challenges.hard.length,
		impossible: refreshed_challenges.impossible.length
	};

	layerControl.removeLayer(easyGroup);
	map.removeLayer(easyGroup);
	easyGroup = refreshed_overlays.Easy.addTo(map);
	layerControl.addOverlay(easyGroup, "Easy");

	layerControl.removeLayer(mediumGroup);
	map.removeLayer(mediumGroup);
	mediumGroup = refreshed_overlays.Medium.addTo(map);
	layerControl.addOverlay(mediumGroup, "Medium");

	layerControl.removeLayer(hardGroup);
	map.removeLayer(hardGroup);
	hardGroup = refreshed_overlays.Hard.addTo(map);
	layerControl.addOverlay(hardGroup, "Hard");

	layerControl.removeLayer(impossibleGroup);
	map.removeLayer(impossibleGroup);
	impossibleGroup = refreshed_overlays.Impossible.addTo(map);
	layerControl.addOverlay(impossibleGroup, "Impossible");


	updateCounts(refreshed_counts, host_overlays.count);
}