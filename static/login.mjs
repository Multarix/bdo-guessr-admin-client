const statusMessage = document.getElementById("statusMessage");
const statusContainer = document.getElementById("statusContainer");

const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("login");

const loginText = document.getElementById("loginText");
const loginLoad = document.getElementById("loginLoad");


document.getElementById("loginForm").addEventListener("submit", async (evt) => {
	evt.preventDefault();

	usernameInput.disabled = true;
	passwordInput.disabled = true;
	loginButton.disabled = true;
	swapLoginButton();

	const username = usernameInput.value;
	const password = passwordInput.value;

	const base64 = btoa(`${username}:${password}`);
	const response = await window.electronAPI.setAuth(base64);

	if(response.code === 200) return window.location.href = "./index.html";

	// Failed to authenticate
	displayStatusMessage(response);

	usernameInput.disabled = false;
	passwordInput.disabled = false;
	loginButton.disabled = false;
	swapLoginButton();
});

function swapLoginButton(){
	if(loginButton.disabled){
		loginText.style.display = "none";
		loginLoad.style.display = "block";
	} else {
		loginText.style.display = "block";
		loginLoad.style.display = "none";
	}
}

function displayStatusMessage(response){
	statusMessage.textContent = response.message;
	statusMessage.style.color = (response.code === 200) ? "#31ff00" : "#ff5858";
	statusContainer.style.top = 0;
	setTimeout(() => {
		statusContainer.style.top = "";
	}, 5000);
}

usernameInput.disabled = false;
passwordInput.disabled = false;
loginButton.disabled = false;