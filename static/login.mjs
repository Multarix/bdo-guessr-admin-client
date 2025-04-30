const statusMessage = document.getElementById("statusMessage");
const statusContainer = document.getElementById("statusContainer");

document.getElementById("loginForm").addEventListener("submit", async (evt) => {
	evt.preventDefault();
	const username = document.getElementById("username").value;
	const password = document.getElementById("password").value;

	const base64 = btoa(`${username}:${password}`);
	const response = await window.electronAPI.setAuth(base64);

	if(response.code === 200) return window.location.href = "./index.html";
	displayStatusMessage(response);
});


function displayStatusMessage(response){
	statusMessage.textContent = response.message;
	statusMessage.style.color = (response.code === 200) ? "#31ff00" : "#ff5858";
	statusContainer.style.top = 0;
	setTimeout(() => {
		statusContainer.style.top = "";
	}, 5000);
}

document.getElementById("login").disabled = false;