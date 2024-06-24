// ==UserScript==
// @name         deezer-country-display
// @namespace    http://tampermonkey.net/
// @version      2024-06-24
// @description  Displays deezer track availability
// @author       Curstantine
// @match        https://www.deezer.com/*/album/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=deezer.com
// @grant        none
// @run-at context-menu
// ==/UserScript==

/** @typedef {{ id: string; name: string; disc: number | null; track: number | null; }} NodeBoundTrack */
/** @typedef {{ id: number; title: number; track_position: number | null; disk_number: number | null; available_countries: string[] }} APITrack */

const DEEZER_API_TRACK_URL = "https://api.deezer.com/track";
const SCRIPT_TRACK_REGEX = /(https:\/\/www\.deezer\.com\/.{2}\/track\/)(\d*)$/;
const DISPLAY_TRACK_NAME_REGEX = /(\d{1,9999})\.\s(.*$)/;

const MATCHER_TRACK_LIST_CONTAINER = `div[role="rowgroup"].ZOZXb`;
const MATCHER_TRACK_CONTAINER = `div[role="row"].JR0qJ`;
const MATCHER_DISK_CONTAINER = `div[role="row"].nqfmm`;

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

/**
 * @param {number} node_length
 * @returns
 */
function traverse_track_list_container(node_length) {
	const track_list_container = document.querySelector(MATCHER_TRACK_LIST_CONTAINER);
	const track_containers = track_list_container.querySelectorAll(MATCHER_TRACK_CONTAINER);

	if (track_containers.length !== node_length) {
		throw new Error("The amount of meta nodes do not match the amount of tracks available");
	}

	/** @type {Record<string, { label_node: Element, title_node: HTMLSpanElement }>} */
	const dom_list = {};
	let current_track_position = 1;
	let current_disk_position = 1;

	for (let i = 0; i < track_containers.length; i++) {
		const node = track_containers[i];
		const label_node = node.querySelector(`div[role="gridcell"] div.A0Vbi`);

		/** @type {HTMLSpanElement} */
		const title_node = label_node.querySelector(`div.XrQj3 span[data-testid="title"]`);
		if (title_node.textContent === null) {
			throw new Error(`Title content is empty for {i+1} item`);
		}

		dom_list[`${current_disk_position}.${current_track_position}`] = { label_node, title_node };
		current_track_position++;

		if (node.nextElementSibling?.matches(MATCHER_DISK_CONTAINER)) {
			current_disk_position++;
			current_track_position = 1;
		}
	}

	return dom_list;
}

(async function() {
	"use strict";

	/** @type {HTMLMetaElement[]} */
	const nodes = document.querySelectorAll(`meta[property="music:song"]`);
	const dom_list = traverse_track_list_container(nodes.length);

	for (let i = 0; i < nodes.length; i++) {
		const node = nodes[i];
		const [_, __, id] = SCRIPT_TRACK_REGEX.exec(node.content);
		const data = await fetch_track_data(id);

		const matched = dom_list[`${data.disk_number ?? 1}.${data.track_position}`];
		if (matched === undefined) {
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
			console.info(countries_string);
		});

		await sleep();
	}
})();
