// ==UserScript==
// @name         deezer-display-availability
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

/** @typedef {{ SNG_ID: string; FALLBACK?: Record<string, unknown>;  }} AjaxTrack */
/** @typedef {{ SONGS: { data: AjaxTrack[]} }} DeezerAppState */

/** @typedef {{ user_status: { license_country: string } }} DeezerPlayer */

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
 * @param {string | number} id
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

/**
 * @param {string[]} countries
 * @returns {HTMLSpanElement}
 */
function create_availability_span(countries) {
	const countries_string = countries.length <= 4
		? countries.join(", ")
		: countries.slice(0, 3).join(", ") + ` and ${countries.length - 4} more!`;

	const text = document.createTextNode(`Available in: ${countries_string}`);
	const span = document.createElement("span");
	span.style.fontSize = "10px";
	span.appendChild(text);
	span.addEventListener("contextmenu", (e) => {
		e.preventDefault();
		console.info(countries);
	});

	return span;
}

/**
 * @param {HTMLSpanElement} span_node
 * @param {string} user_country
 * @param {string[]} countries
 * @param {AjaxTrack} track
 */
function add_subbing_prob_string(span_node, user_country, countries, track) {
	const not_in_country = !countries.includes(user_country);
	const has_fallback = "FALLBACK" in track;

	const content = span_node.lastChild.textContent;

	if (not_in_country && has_fallback) {
		span_node.textContent = `${content} | This track will be subbed!`;
		return;
	}

	if (not_in_country && !has_fallback) {
		span_node.textContent = `${content} | This track is unavailable!`;
		return;
	}
}

(async function() {
	"use strict";

	/** @type {DeezerAppState} */
	const deezer_app_state = window.__DZR_APP_STATE__;

	/** @type {DeezerPlayer} */
	const deezer_player = window.dzPlayer;

	/** @type {HTMLMetaElement[]} */
	const nodes = document.querySelectorAll(`meta[property="music:song"]`);
	const dom_list = traverse_track_list_container(nodes.length);

	for (let i = 0; i < nodes.length; i++) {
		const node = nodes[i];

		/** @type {[string, string, string]} */
		const [_, __, id] = SCRIPT_TRACK_REGEX.exec(node.content);
		const data = await fetch_track_data(id);

		const matched = dom_list[`${data.disk_number ?? 1}.${data.track_position}`];
		if (matched === undefined) {
			throw new Error(`Failed to a match track from the track list. Current: ${data}`);
		}

		const ajax_track = deezer_app_state.SONGS.data.find((x) => x.SNG_ID === id);
		if (ajax_track === undefined) {
			throw new Error(`Couldn't find a matching track ${id} in the deezer global state`);
		}

		const display_spanner = create_availability_span(data.available_countries);
		add_subbing_prob_string(
			display_spanner,
			deezer_player.user_status.license_country,
			data.available_countries,
			ajax_track,
		);

		matched.label_node.appendChild(display_spanner);

		await sleep();
	}
})();
