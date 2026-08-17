const crypto = require("node:crypto");
const os = require("node:os");
const net = require("node:net");


class IPC {
	#socket;
	#connected = false;
	#clientId;

	constructor(clientId){
		this.#clientId = clientId;
		this.#socket = null;
	}


	#parsePacket(data){
		const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

		if(buffer.length < 8) throw new Error("Invalid packet length");

		const length = buffer.readUInt32LE(4);

		if(buffer.length < 8 + length) throw new Error("Invalid packet length");

		const json = buffer.subarray(8, 8 + length).toString("utf8");
		return JSON.parse(json);
	}


	async send(opcode, payload){
		return new Promise((resolve, reject) => {
			if(!this.#socket){
				try {
					this.connect();
				} catch {
					return reject("Socket is not connected");
				}
			}

			const json = JSON.stringify(payload);
			const body = Buffer.from(json);

			// if(opcode !== 0) console.log(payload);

			const header = Buffer.alloc(8);
			header.writeUInt32LE(opcode, 0);
			header.writeUInt32LE(body.length, 4);

			const packet = Buffer.concat([header, body]);

			if(opcode === 0){
				this.#socket.once("data", (data) => {
					const packet = this.#parsePacket(data);
					if(!packet) return reject(new Error("Invalid packet received"));

					return resolve(packet);
				});
			}

			this.#socket.write(packet);
		});
	}


	async handshake(){
		try {
			const payload = { v: 1, client_id: this.#clientId };
			const res = await this.send(0, payload);

			if(!res) return false;
			return res?.evt === "READY";
		} catch {
			return false;
		}
	}


	async #testPipe(pipe){
		return new Promise((resolve, reject) => {
			const socket = net.createConnection(pipe);

			socket.once("connect", () => {
				socket.destroy(); // We connected, this pipe is valid
				resolve();
			});

			socket.once("error", (err) => {
				socket.destroy(); // Make sure we destroy it just in case
				reject();
			});
		});
	}


	async #getPipe(){
		const platform = os.platform();

		switch(platform){
			case "win32": {
				for(let i = 0; i < 10; i++){
					const pipe = `\\\\?\\pipe\\discord-ipc-${i}`;

					try {
						await this.#testPipe(pipe);
					} catch (e){
						continue;
					}

					return pipe; // Return the first pipe that successfully connects
				}

				break;
			}

			case "linux":
			case "darwin": {
				return ""; // icbf to supported these atm
			}
		}

		return "";
	}


	async connect(){
		console.info("Attempting Discord IPC Connection...");
		if(this.#connected) return true;
		const pipe = await this.#getPipe();

		console.info(`RPC Pipe: ${pipe}`);
		if(!pipe) return false;

		// Wrap in a promise so that connect or error runs before we get a resolve
		// This lets us know if the connection was successful or not
		return new Promise((resolve => {
			const socket = net.createConnection(pipe);

			socket.once("connect", async () => {
				console.info("Connected to IPC");

				this.#socket = socket;
				this.#connected = true;
				resolve(true);
			});

			socket.on("error", (err) => {
				console.error("IPC Error:", err);
				resolve(false);
			});

			socket.on("end", () => {
				console.warn("IPC socked closed");
				this.#connected = false;
				this.#socket = null;
			});

			// If we get an error, followed by a close, we know the error likely caused the socket to close
			// Also, if we get it before we even get a successful connection, we straight up know we failed to connect in the first place
			socket.on("close", () => {
				console.warn("IPC socked closed");
				this.#connected = false;
				this.#socket = null;
			});
		}));
	}
}



class Discord {
	#DISCORD_CLIENT_ID;
	#CLEARED_PRESENCE;
	#IPC;
	#START_TIME;

	constructor(DISCORD_CLIENT_ID){
		this.#DISCORD_CLIENT_ID = DISCORD_CLIENT_ID;
		this.#CLEARED_PRESENCE = true;
		this.#IPC = new IPC(DISCORD_CLIENT_ID);
		this.#START_TIME = Date.now();
	}

	async connect(){
		await this.#IPC.connect();
		await this.#IPC.handshake();
	}

	/**
	 * @param {Number} totalChallenges
	 * @return {object}
	 */
	async #createActivity(totalChallenges){
		const websiteURL = "https://bdoguessr.moe/";

		const activityButtons = [
			{
				label: "Play BDOGuessr",
				url: websiteURL
			}
		];

		const activity = {
			name: "BDOGuessr",
			type: 0,
			created_at: Date.now(),
			timestamps: {
				start: this.#START_TIME
			},
			application_id: this.#DISCORD_CLIENT_ID,
			status_display_type: 0,
			details: `Managing ${totalChallenges} Challenges`,
			details_url: websiteURL,
			state: "Taking Screenshots",
			state_url: websiteURL,
			assets: {
				large_image: "icon",
				large_url: websiteURL
			},
			buttons: activityButtons
		};

		return activity;
	}

	/**
	 * @param {Number} totalChallenges
	 * @return {object}
	 */
	async updateActivity(totalChallenges){
		try {
			const activity = await this.#createActivity(totalChallenges);

			if(!activity){
				if(!this.#CLEARED_PRESENCE){
					await this.#clearActivity();
					this.#CLEARED_PRESENCE = true;
				}

				return;
			}

			this.#setActivity(activity);

		} catch (error){
			console.error("Error updating presence:", error);
			return false;
		}
	}


	async #setActivity(activity){
		console.info(`Setting Activity to: ${activity.name} ${activity.details}`);
		try {
			const payload = {
				cmd: "SET_ACTIVITY",
				args: {
					pid: process.pid,
					activity: activity
				},
				nonce: crypto.randomUUID()
			};

			await this.#IPC.send(1, payload);

			return true;
		} catch (e){
			console.error("Error setting activity:", e);
			return false;
		}
	}


	async #clearActivity(){
		console.log("Clearing Activity");
		if(this.#CLEARED_PRESENCE) return true;

		try {
			await this.#IPC.send(1, {
				cmd: "SET_ACTIVITY",
				args: {
					pid: process.pid,
					activity: null
				},
				nonce: crypto.randomUUID()
			});

			return true;
		} catch (e){
			console.error("Error setting activity:", e);
			return false;
		}

	}
}


module.exports = Discord;