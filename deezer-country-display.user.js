// ==UserScript==
// @name         deezer-country-display
// @namespace    http://tampermonkey.net/
// @version      2024-06-24
// @description  Displays deezer track availability
// @author       Curstantine
// @match        https://www.deezer.com/en/album/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=deezer.com
// @grant        none
// @run-at context-menu
// ==/UserScript==

/** @typedef {{ id: string; name: string; disc: number | null; track: number | null; }} NodeBoundTrack */
/** @typedef {{ id: number; title: number; track_position: number | null; available_countries: string[] }} APITrack */

const DEEZER_API_TRACK_URL = "https://api.deezer.com/track";
const SCRIPT_TRACK_REGEX = /(https:\/\/www\.deezer\.com\/.{2}\/track\/)(\d*)$/;
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

	/** @type {Record<number, { label_node: Element, title_node: HTMLSpanElement }>} */
	const dom_list = {};
	for (let i = 0; i < track_containers.length; i++) {
		const node = track_containers[i];
		const label_node = node.querySelector(`div[role="gridcell"] div.A0Vbi`);

		/** @type {HTMLSpanElement} */
		const title_node = label_node.querySelector(`div.XrQj3 span[data-testid="title"]`);
		if (title_node.textContent === null) {
			throw new Error(`Title content is empty for {i+1} item`);
		}

		const [_, track_no_str, __] = DISPLAY_TRACK_NAME_REGEX.exec(title_node.textContent);
		const track_no = Number.parseInt(track_no_str);
		dom_list[track_no] = { label_node, title_node };
	}

	for (let i = 0; i < nodes.length; i++) {
		const node = nodes[i];
		const [_, __, id] = SCRIPT_TRACK_REGEX.exec(node.content);
		const data = await fetch_track_data(id);

		const matched = dom_list[data.track_position];
		if (matched === undefined) {
			console.log(dom_list, matched, `${data.track_position}. ${data.title}`);
			throw new Error(`Failed to a match track from the track list. Current: ${data}`);
		}

		const countries_string = data.available_countries.length <= 4
			? data.available_countries.join(", ")
			: data.available_countries.slice(0, 3).join(", ")
				+ ` and ${data.available_countries.length - 4} more!`;

		const text = document.createTextNode(`Available in: ${countries_string}`);
		const span = document.createElement("span");
		span.style.fontSize = "10px";
		span.appendChild(text);
		matched.label_node.appendChild(span);

		span.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			console.log(countries_string);
		});

		await sleep();
	}
})();
