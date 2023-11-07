// ==UserScript==
// @name        SoundCloud: MusicBrainz import
// @description Import SoundCloud releases into MusicBrainz.
// @version     2023.11.01
// @author      garylaski
// @namespace   https://github.com/garylaski/userscripts/
// @downloadURL https://github.com/garylaski/userscripts/raw/main/sc-mb-import.user.js
// @updateURL https://github.com/garylaski/userscripts/raw/main/sc-mb-import.user.js
// @homepageURL https://github.com/garylaski/userscripts
// @supportURL  https://github.com/garylaski/userscripts/issues
// @match       https://soundcloud.com/*
// @licence     GPL-3.0-or-later; http://www.gnu.org/licenses/gpl-3.0.txt
// @run-at      document-end
// @grant       GM_xmlhttpRequest
// @grant       GM_addStyle
// ==/UserScript==
    GM_addStyle (`
        .dashbox {
            padding-bottom: 4px;
        }
        .sc-button-medium.sc-button-mb:before {
            background-image: url("https://musicbrainz.org/favicon.ico");
            background-size: 14px 14px;
        }
        .sc-button-medium.sc-button-mb {
            margin-bottom: 10px;
        }
        `);

let globalPromises = []
let form, entity, formString;
let previousUrl = '';
new MutationObserver(function(mutations) {
    if (location.href !== previousUrl) {
        previousUrl = location.href;
        Promise.all(globalPromises).catch(error => {
            console.log(error);
        }).finally(() => {
            globalPromises = [];
            onUrlChange();
        });
    }
}).observe(document, {subtree: true, childList: true});

async function onUrlChange() {
    if (!determineEntityType()) {
        return
    }
    formString = "";
    form = document.createElement("form");
    globalPromises.push(createButton());
    let value = await UrlInMusicBrainz(location.href);
    if (value != null) {
        Promise.all(globalPromises)
            .then(() => {
                button.disabled = false;
                button.innerHTML = "Open";
                button.addEventListener("click", () => {
                    window.open(`https://musicbrainz.org/${value[0]}/${value[1]}`);
                });
            })
            .catch((e) => {
                button.innerHTML = "ERROR";
                button.title = e;
                console.error(e);
            });
    } else {
        globalPromises.push(entity.build());
        Promise.all(globalPromises)
            .then(() => {
                button.disabled = false;
            })
            .catch((e) => {
                button.innerHTML = "ERROR";
                button.title = e;
                console.error(e);
            });
    }
}

function submitForm() {
    form.innerHTML = formString;
    form.submit();
}

let button;
function createButton() {
    return new Promise(resolve => {
        if (button != null) {
            button.remove();
        }
        button = document.createElement("button");
        button.innerHTML = "Loading...";
        button.disabled = true;
        button.setAttribute("class", "sc-button-mb sc-button-secondary sc-button sc-button-medium sc-button-block sc-button-responsive");
        waitForElement(entity.buttonSelector).then(element => {
            element.appendChild(button);
            resolve();
        });
    });
}

function waitForElement(selector) {
    return new Promise((resolve, reject) => {
        const mut = new MutationObserver(mutations => {
            const element = document.querySelector(selector);
            if (element != null) {
                mut.disconnect();
                resolve(element);
            }
        });
        mut.observe(document.body, {subtree: true, childList: true});
    });
}

function determineEntityType() {
    if (/https:\/\/soundcloud\.com\/(?!terms-of-use|jobs|settings|logout|download|feed|discover|upload|people|notifications|messages)[^/]+(\?.*)?$/.test(location.href)) {
        entity = {
            buttonSelector: ".userInfoBar__buttons .sc-button-group",
            build: buildUser,
        }
        return true;
    }
    if (/https:\/\/soundcloud\.com\/(?!you|pages|settings)[^/]+\/(?!tracks|albums|popular-tracks|sets|reposts|likes|following|followers)[^/]+(\?.*)?$/.test(location.href)) {
        entity = {
            buttonSelector: ".dashbox",
            build: buildTrack,
        }
        return true;
    }
    if (/https:\/\/soundcloud\.com\/(?!you)[^/]+\/sets\/[^/]+(\?.*)?$/.test(location.href)) {
        entity = {
            buttonSelector: ".dashbox",
            build: buildSet,
        }
        return true;
    }
    return false;
}

let urlCache = new Map();
let cached, targetType, mbid;
function UrlInMusicBrainz(url) {
    return new Promise((resolve, reject) => {
        cached = urlCache.get(url);
        if (cached === undefined) {
            GM_xmlhttpRequest({
                url: "https://musicbrainz.org/ws/2/url?limit=1&fmt=json&inc=artist-rels+label-rels+release-rels&resource="+url,
                method: "GET",
                responseType: "json",
                onload: function(response) {
                    if (!response.response.error && response.response.relations.length > 0) {
                        targetType = response.response.relations[0]["target-type"];
                        mbid = response.response.relations[0][targetType]["id"];
                        urlCache.set(url, [targetType, mbid])
                        resolve([targetType, mbid])
                    } else {
                        urlCache.set(url, null)
                        resolve(null)
                    }
                },
                onerror: function(e) {
                    reject(e);
                }
            });
        } else {
            resolve(cached);
        }
    });
}

function buildUser() {
    return new Promise((resolve, reject) => {
        //form.action = "https://musicbrainz.org/artist/create"
        //form.method = "POST";
        //form.target = "_blank"
        //form.formtarget = "_blank"
        //globalPromises.push(userHydration());
        //globalPromises.push(userScraper());
        //buttonText = "Import";
        reject("NOT IMPLEMENTED");
    });
}

function userHydration() {
    return new Promise((resolve, reject) => {
        requestPromise(location.href).then((response) => {
            let data = JSON.parse(response.responseText.split("__sc_hydration =")[1].split(";</script>")[0]).find(x => x.hydratable == "user").data;
            if (data == null) {
                reject("Could not find user hydration data.");
            }
            resolve();
        });
    });
}

function userScraper() {
    return new Promise((resolve, reject) => {
        waitForElement(".web-profiles").then(element => {
            for (let a of element.querySelectorAll("li a")) {
                const url = new URL(a.href);
            }
        });
        resolve();
    });
}

function buildTrack() {
    return new Promise((resolve, reject) => {
        GetTrackSetUrl().then((setUrl) => {
            button.innerHTML = "Go to parent set";
            button.addEventListener("click", () => {
                location.href = setUrl;
            });
            resolve()
        }).catch(() => {
            form.action = "https://musicbrainz.org/release/add"
            form.method = "POST";
            form.target = "_blank"
            form.formtarget = "_blank"
            globalPromises.push(trackHydration().then(() => {
                button.innerHTML = "Import";
                button.appendChild(form);
                button.removeEventListener("click", submitForm);
                button.addEventListener("click", submitForm);
            }));
            resolve()
        });
    });
}

function GetTrackSetUrl() {
    return new Promise((resolve, reject) => {
        const mut = new MutationObserver(mutations => {
            const element = document.querySelector(".soundInSetsModule");
            if (element != null) {
                const album = element.querySelector(".soundTitle__title");
                if (element.style.display == 'none') {
                    mut.disconnect();
                    reject();
                } else if (album != null) {
                    mut.disconnect();
                    button.title = album.href;
                    resolve(album.href);
                }
            }
        })
        mut.observe(document.body, {subtree: true, childList: true});
    });
}

function trackHydration() {
    return new Promise((resolve, reject) => {
        requestPromise(location.href).then((response) => {
            let data = JSON.parse(response.responseText.split("__sc_hydration =")[1].split(";</script>")[0]).find(x => x.hydratable == "sound").data;
            if (data == null) {
                reject("Could not find track hydration data.");
            } else {
                addReleaseToForm(data);
                addTrackToForm(data, 0);
                resolve();
            }
        }).catch(reject);
    });
}
function addTrackToForm(trackData, trackNumber) {
    globalPromises.push(UrlInMusicBrainz(trackData.user.permalink_url).then((value) => {
      if (value[0] == "artist") {
        addToForm(value[1], `mediums.0.track.${trackNumber}.artist_credit.names.0.mbid`);
      }
    }).catch(error => {
      //do nothing
    }));
    addToForm(trackNumber + 1, `mediums.0.track.${trackNumber}.number`);
    addToForm(trackData.title, `mediums.0.track.${trackNumber}.name`);
    addToForm(trackData.duration, `mediums.0.track.${trackNumber}.length`);
    addToForm(trackData.user.username, `mediums.0.track.${trackNumber}.artist_credit.names.0.name`);
    addToForm(trackData.user.username, `mediums.0.track.${trackNumber}.artist_credit.names.0.artist.name`);
}
function buildSet() {
    return new Promise((resolve, reject) => {
        form.action = "https://musicbrainz.org/release/add";
        form.method = "POST";
        form.target = "_blank"
        form.formtarget = "_blank"
        globalPromises.push(setHydration().then(() => {
           button.innerHTML = "Import";
           button.appendChild(form);
           button.addEventListener("click", submitForm);
        }));
        resolve()
    });
}
function setHydration() {
    return new Promise((resolve, reject) => {
        requestPromise(location.href).then((response) => {
            let data = JSON.parse(response.responseText.split("__sc_hydration =")[1].split(";</script>")[0]).find(x => x.hydratable == "playlist").data;
            if (data == null) {
                reject("Could not find set hydration data.");
            } else {
                addReleaseToForm(data);
                globalPromises.push(setScraper(data.track_count).then(resolve));
            }
        }).catch(reject);
    });
}
function setScraper(track_count) {
    button.title = "Scroll to load tracks";
    return new Promise((resolve, reject) => {
        console.log("Waiting for", track_count, "tracks");
        const mut = new MutationObserver(mutations => {
            const elements = document.querySelectorAll(".trackList__item");
            const names = document.querySelectorAll(".trackItem__trackTitle");
            if (elements.length == track_count && names.length == track_count) {
                mut.disconnect();
                for (let track of elements) {
                    globalPromises.push(requestPromise(track.querySelector(".trackItem__trackTitle").href).then((trackResponse) => {
                        let trackData = JSON.parse(trackResponse.responseText.split("__sc_hydration =")[1].split(";</script>")[0]).find(x => x.hydratable === 'sound').data;
                        addTrackToForm(trackData, track.querySelector(".trackItem__number").innerHTML.trim() - 1);
                    }));
                }
                console.log("Done with", track_count, "tracks");
                resolve();
                button.title = "Import release to MusicBrainz";
            }
        })
        mut.observe(document.body, {subtree: true, childList: true});
    });
}
let type, date, url_count;
function addReleaseToForm(releaseData) {
    globalPromises.push(UrlInMusicBrainz(releaseData.user.permalink_url).then(value => {
        if (value != null) {
            if (value[0] == "artist") {
                addToForm(value[1], "artist_credit.names.0.mbid");
            } else if (value[0] == "label") {
                addToForm(value[1], "labels.0.mbid");
            }
        }
    }));
    if (releaseData.set_type != undefined) {
        addToForm(convertReleaseTypes(releaseData.set_type), "type");
    } else if (releaseData.track_format != undefined) {
        addToForm(convertReleaseTypes(releaseData.track_format), "type");
    }

    addToForm("Digital Media", "mediums.0.format");

    // Edit note
    addToForm(location.href + "\n--\nSoundCloud: MusicBrainz import\nhttps://github.com/garylaski/userscripts", "edit_note");
    // Release title
    addToForm(releaseData.title, "name");
    addToForm("official", "status");
    addToForm("None", "packaging");

    // Date information
    date = new Date(releaseData.display_date);
    addToForm(date.getUTCFullYear(), "date.year");
    addToForm(date.getUTCDate(), "date.day");
    addToForm(date.getUTCMonth() + 1, "date.month");
    addToForm("XW", "country");

    //Release label
    if (releaseData.label_name) {
        addToForm(releaseData.label_name, "labels.0.name");
    }

    // Barcode
    if (releaseData.publisher_metadata && releaseData.publisher_metadata.upc_or_ean) {
        addToForm(releaseData.publisher_metadata.upc_or_ean, "barcode");
    }

    // Release artist
    addToForm(releaseData.user.username, "artist_credit.names.0.name");
    addToForm(releaseData.user.username, "artist_credit.names.0.artist.name");

    url_count = 0;

    // Stream for free URL
    addToForm(location.href, "urls." + url_count + ".url");
    addToForm(85, "urls." + url_count + ".link_type");
    url_count++;

    // Check if downloadable
    if (releaseData.downloadable) {
        addToForm(location.href, "urls." + url_count + ".url");
        addToForm( 75, "urls." + url_count + ".link_type");
        url_count++;
    }

    // License URL
    if (releaseData.license != 'all-rights-reserved') {
        addToForm(convertLicense(releaseData.license), "urls." + url_count + ".url");
        addToForm(301, "urls." + url_count + ".link_type");
        url_count++;
    }
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
    return "https://creativecommons.org/licenses/" + license + "/4.0/";
}

function addToForm(value, name) {
    value = value.toString().replaceAll("'", '&apos;');
    formString += `<input type='hidden' value='${value}' name='${name}'/>`;
}
function requestPromise(url) {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            url: url,
            method: "GET",
            onload: resolve,
            onerror: reject
        });
    });
}
