// ==UserScript==
// @name        SoundCloud: MusicBrainz import
// @description Import SoundCloud releases into MusicBrainz.
// @version     2025.07.18.2
// @author      garylaski
// @namespace   https://github.com/garylaski/userscripts/
// @downloadURL https://github.com/garylaski/userscripts/raw/main/sc-mb-import.user.js
// @updateURL   https://github.com/garylaski/userscripts/raw/main/sc-mb-import.user.js
// @homepageURL https://github.com/garylaski/userscripts
// @supportURL  https://github.com/garylaski/userscripts/issues
// @match       https://soundcloud.com/*
// @licence     GPL-3.0-or-later; http://www.gnu.org/licenses/gpl-3.0.txt
// @run-at      document-idle
// @noframes
// ==/UserScript==

const style = document.createElement("style");
style.textContent = `
    .sc-button-medium.sc-button-mb:before {
        background-image: url("https://musicbrainz.org/favicon.ico");
        background-size: 14px 14px;
    }
    .sc-button-medium.sc-button-mb {
        margin-bottom: 10px;
    }
`
const content = document.getElementById("content");
content.parentElement.prepend(style);

const container = document.createElement("div");

const button = document.createElement("button");
button.setAttribute("class", "sc-button-mb sc-button-secondary sc-button sc-button-medium sc-button-block sc-button-responsive");
button.setAttribute("form", "mb-form");
button.type = "submit";
button.disabled = true;

const buttonLink = document.createElement("a");
buttonLink.setAttribute("class", "sc-button-mb sc-button-secondary sc-button sc-button-medium sc-button-block sc-button-responsive");
buttonLink.textContent = "Go to parent set";

const form = document.createElement("form");
form.setAttribute("id", "mb-form");
form.target = "_blank";
content.parentElement.prepend(form);

function setFormAttributes(method, onsubmit, action, innerText) {
    form.method = method;
    form.onsubmit = onsubmit;
    form.action = action;
    button.innerText = innerText;
}

async function resetForm(method, action, text, onsubmit) {
    form.replaceChildren();
    button.replaceChildren();
    container.replaceChildren(button);
    setFormAttributes(method, submitForm(onsubmit), action, text);
    const value = await urlInMusicBrainz(location.href);
    if (value) {
        setFormAttributes("GET", null, `https://musicbrainz.org/${value[0]}/${value[1]}`, "Open");
    }
    button.disabled = false;
    button.title = form.action;
}

function addToForm(value, name) {
    const textarea = document.createElement("textarea");
    textarea.name = name;
    textarea.value = value;
    textarea.style.display = 'none';
    form.appendChild(textarea);
}

function submitForm(func) {
    return async function(e) {
        e.preventDefault();
        button.disabled = true;
        try {
            const submit = await func();
            if (submit) form.submit();
            form.replaceChildren();
            button.disabled = false;
        } catch (error) {
            button.innerText = "ERROR";
            button.title = error;
            throw error;
        }
    }
}

const callback = (mutationList, observer) => {
    for (const mutation of mutationList) {
        for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.querySelector(".profileHeader__info")) {
                    resetForm("GET", "https://musicbrainz.org/artist/create", "Add Artist", addArtistToForm);
                }
                if (node.querySelector(".trackList")) {
                    resetForm("POST", "https://musicbrainz.org/release/add", "Add Release", addReleaseToForm);
                }
                if (node.querySelector(".commentsList")) {
                    resetForm("POST", "https://musicbrainz.org/release/add", "Add Track", addReleaseToForm);
                }
                const sidebar = node.querySelector(".l-sidebar-right");
                if (sidebar && !sidebar.querySelector(".streamSidebar, .madeForUsername")) {
                    sidebar.prepend(container);
                }
            }
        }
    }
};

const observer = new MutationObserver(callback);
observer.observe(content, { childList: true, subtree: true });

async function fetchHydration(url) {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) throw new Error(`Response status: ${response.status}`);
    const text = await response.text();
    return JSON.parse(text.split("__sc_hydration =")[1].split(";</script>")[0]);;
}

let urlCache = new Map();
async function urlInMusicBrainz(url) {
    const cached = urlCache.get(url);
    if (cached !== undefined) return cached;
    const fetchURL = `https://musicbrainz.org/ws/2/url?limit=1&fmt=json&inc=artist-rels+label-rels+release-rels&resource=${url}`
    const response = await fetch(fetchURL);
    if (!response.ok) {
        if (response.status == 404) {
            urlCache.set(url, null);
            return null;
        }
        throw new Error(`Response status: ${response.status}`);
    }
    const json = await response.json();
    if (json.relations.length == 0) {
        urlCache.set(url, null);
        return null;
    }
    const targetType = json.relations[0]["target-type"];
    const mbid = json.relations[0][targetType]["id"];
    const tuple = [targetType, mbid];
    urlCache.set(url, tuple);
    return tuple;
}

async function addReleaseToForm() {
    let promises = [];
    const json = await fetchHydration(location.href);
    const playlist = json.find(x => x.hydratable == "playlist")?.data;
    if (playlist) {
        promises.push(addSetToForm(playlist));
        const elements = content.querySelectorAll(".trackList__item");
        if (elements.length != playlist.track_count) {
            throw new Error(`Could not find all tracks: ${elements.length} / ${playlist.track_count}.\nTry scrolling to the bottom of the page.`);
        }
        for (let track of elements) {
            const url = track.querySelector(".trackItem__trackTitle").href;
            promises.push(loadTrackAndAddToForm(url, track.querySelector(".trackItem__number > span").innerHTML.trim() - 1));
        }
    } else {
        for (const title of content.querySelectorAll(".sidebarModule")) {
            if (title.style.display == "block" &&
                title.querySelector(".sidebarHeader__actualTitle").textContent == "In albums") {
                const pathname = title.querySelector(".soundTitle__title").pathname;
                buttonLink.href = pathname;
                button.title = pathname;
                form.action = null;
                container.replaceChildren(buttonLink);
                return false;
            }
        }
        const sound = json.find(x => x.hydratable == "sound")?.data;
        promises.push(addSetToForm(sound));
        promises.push(addTrackToForm(sound, 0));
    }
    await Promise.all(promises);
    return true;
}

async function addSetToForm(data) {
    const mbData = await urlInMusicBrainz(data.user.permalink_url);
    if (mbData) {
        if (mbData[0] == "artist") {
            addToForm(mbData[1], "artist_credit.names.0.mbid");
        } else if (mbData[0] == "label") {
            addToForm(mbData[1], "labels.0.mbid");
        }
    }
    if (data.set_type != undefined) {
        addToForm(convertReleaseTypes(data.set_type), "type");
    } else if (data.track_format != undefined) {
        addToForm(convertReleaseTypes(data.track_format), "type");
    }

    addToForm("Digital Media", "mediums.0.format");

    // Edit note
    addToForm(`${location.href}\n--\nSoundCloud: MusicBrainz import\nhttps://github.com/garylaski/userscripts`, "edit_note");
    // Release title
    addToForm(data.title, "name");
    addToForm("official", "status");
    addToForm("None", "packaging");

    // Date information
    const date = new Date(data.display_date);
    addToForm(date.getUTCFullYear(), "date.year");
    addToForm(date.getUTCDate(), "date.day");
    addToForm(date.getUTCMonth() + 1, "date.month");
    addToForm("XW", "country");

    //Release label
    if (data.label_name) addToForm(data.label_name, "labels.0.name");

    // Barcode
    if (data.publisher_metadata && data.publisher_metadata.upc_or_ean) {
        addToForm(data.publisher_metadata.upc_or_ean, "barcode");
    }

    // Release artist
    addToForm(data.user.username, "artist_credit.names.0.name");
    addToForm(data.user.username, "artist_credit.names.0.artist.name");

    let url_count = 0;
    addURLToForm(location.href, 85, url_count++);
    if (data.downloadable) addURLToForm(location.href, 75, url_count++);
    if (data.license != 'all-rights-reserved') addURLToForm(convertLicense(data.license), 301, url_count++);
}

function addURLToForm(url, type, url_count) {
    addToForm(url, `urls.${url_count}.url`);
    addToForm(type, `urls.${url_count}.link_type`);
}

function addArtistURLToForm(url, type, url_count) {
    addToForm(url, `edit-artist.url.${url_count}.text`);
    addToForm(type, `edit-artist.url.${url_count}.link_type_id`);
}

async function loadTrackAndAddToForm(url, number) {
    const json = await fetchHydration(url);
    const sound = json.find(x => x.hydratable == "sound");
    await addTrackToForm(sound.data, number);
}

async function addTrackToForm(data, number) {
    const mbData = await urlInMusicBrainz(data.user.permalink_url);
    if (mbData && mbData[0] == "artist") {
        addToForm(mbData[1], `mediums.0.track.${number}.artist_credit.names.0.mbid`);
    }
    addToForm(number + 1, `mediums.0.track.${number}.number`);
    addToForm(data.title, `mediums.0.track.${number}.name`);
    addToForm(data.duration, `mediums.0.track.${number}.length`);
    addToForm(data.user.username, `mediums.0.track.${number}.artist_credit.names.0.name`);
    addToForm(data.user.username, `mediums.0.track.${number}.artist_credit.names.0.artist.name`);
}

async function addArtistToForm() {
    const json = await fetchHydration(location.href);
    const user = json.find(x => x.hydratable == "user")?.data;
    if (!user) {
        throw new Error("Invalid hydration data for arist.");
    }
    addToForm(user.username, `edit-artist.name`);
    addToForm(user.username, `edit-artist.sort_name`);
    let url_count = 0;
    addArtistURLToForm(user.permalink_url, 291, url_count++);

    // Not sure what the corresponding seed tags are
    // if (user.country_code) addToForm(user.country_code, "edit-artist.edit-area");
    // if (user.city) addToForm(user.city, "edit-artist.edit-area");
    addToForm(`${user.permalink_url}\n--\nSoundCloud: MusicBrainz import\nhttps://github.com/garylaski/userscripts`, "edit-artist.edit_note");
    return true;
}

function convertReleaseTypes(type) {
    switch(type) {
        case 'album':
            return 'Album';
        case 'ep':
            return 'EP';
        case 'single', 'single-track':
            return 'Single';
        case 'compilation':
            return 'Compilation';
        default:
            return 'Other';
    }
}

function convertLicense(license) {
    license = license.split('cc-')[1];
    return `https://creativecommons.org/licenses/${license}/4.0/`;
}
