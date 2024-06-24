// ==UserScript==
// @name         deezer-country-display
// @namespace    http://tampermonkey.net/
// @version      2024-06-24
// @description  Displays deezer track availability
// @author       Curstantine
// @match        https://www.deezer.com/en/album/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=deezer.com
// @grant        none
// ==/UserScript==

/** @typedef {{ id: string; name: string; disc: number | null; track: number | null; }} NodeBoundTrack */
/** @typedef {{ id: number; name: number; track_position: number | null; available_countries: string[] }} APITrack */

const DEEZER_TRACK_REGEX = /(https:\/\/www\.deezer\.com\/.{2}\/track\/)(\d*)$/;
const DEEZER_API_TRACK_URL = "https://api.deezer.com/track";
const DISPLAY_TRACK_NAME_REGEX = /(\d{1,9999})\.\s(.*$)/;

async function sleep(ms = 1000) {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {number} id
 * @returns {Promise<APITrack>}
 */
async function fetch_track_data(id) {
	const response = await fetch(`${DEEZER_API_TRACK_URL}/${id}`);
	const json = await response.json();
	return json;
}

(async function() {
	"use strict";

	/** @type {HTMLMetaElement[]} */
	const nodes = document.querySelectorAll(`meta[property="music:song"]`);

	const track_list_container = document.querySelector(`div[role="rowgroup"].ZOZXb`);
	const track_containers = track_list_container.querySelectorAll(`div[role="row"].JR0qJ`);

	if (track_containers.length !== nodes.length) {
		throw new Error("The amount of meta nodes do not match the amount of tracks available");
	}

	/** @type {APITrack[]} */
	const tracks = new Array(track_containers.length);
	for (let i = 0; i < nodes.length; i++) {
		const node = nodes[i];
		const [_, __, id] = DEEZER_TRACK_REGEX.exec(node.content);

		const data = await fetch_track_data(id);
		tracks.push(data);
		await sleep();
	}

	for (let i = 0; i < track_containers.length; i++) {
		const node = track_containers[i];
		const label_node = node.querySelector(`div[role="gridcell"] div.A0Vbi`);

		/** @type {HTMLSpanElement} */
		const title_node = label_node.querySelector(`div.XrQj3 span[data-testid="title"]`);
		const [, track_num, track_title] = DEEZER_TRACK_REGEX.exec(title_node.textContent);

		const matched_track = tracks.find(({ title, track_position }) =>
			title === track_title && track_num === track_position
		);

		if (matched_track === undefined) {
			throw new Error(
				`Couldn't find a matching track from the fetched list. Current: ${title_node.textContent}`,
			);
		}

		label_node.appendChild(
			`<span>Available in: ${matched_track.available_countries.join(", ")}</span>`,
		);
	}
})();
