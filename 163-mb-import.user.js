// ==UserScript==
// @name        NetEase: MusicBrainz import
// @description Import NetEase releases into MusicBrainz.
// @version     2023.03.16
// @author      garylaski
// @namespace   https://github.com/garylaski/userscripts
// @downloadURL https://github.com/garylaski/userscripts/raw/main/163-mb-import.user.js
// @updateURL https://github.com/garylaski/userscripts/raw/main/163-mb-import.user.js
// @homepageURL https://github.com/garylaski/userscripts
// @supportURL  https://github.com/garylaski/userscripts/issues
// @match       https://music.163.com/*
// @licence     GPL-3.0-or-later; http://www.gnu.org/licenses/gpl-3.0.txt
// @run-at      document-end
// @grant       GM_xmlhttpRequest
// @grant       GM_addStyle
// ==/UserScript==
GM_addStyle (`
  .u-btni-mb {
    background-position: right -1020px;
  }
.u-btni-mb i {
  padding-right: 2px;
  padding-left: 28px;
  background-position: 0 -977px;
}
`);

function waitTillExists(selector, callback) {
    new MutationObserver(function(mutations) {
        let element = document.querySelector(selector);
        if (element) {
            this.disconnect();
            waiting = false;
            callback(element);
        }
    }).observe(document, {subtree: true, childList: true});
}

function convertReleaseTypes(type) {
    switch(type) {
        case '专辑':
            return 'Album';
        case 'EP':
            return 'EP';
        case 'Single':
            return 'Single';
        default:
            return 'Other';
    }
}

function addToForm(form, value, name) {
    value = value.toString().replace("'", '&apos;');
    form.innerHTML += `<input type='hidden' value='${value}' name='${name}'/>`;
}
function submitRelease() {
    var soundcloudAlbumData;
    GM_xmlhttpRequest({
        url: "https://music.163.com/api/album/" + window.location.href.split('?id=')[1],
        method: "GET",
        onload: function(response) {
            let mbForm = document.createElement("form");
            mbForm.method = "POST";
            mbForm.target = "_blank"
            mbForm.action = "https://musicbrainz.org/release/add"

            // Process data
            let neteaseAlbumData = JSON.parse(response.responseText).album;
            // Edit note
            addToForm(mbForm, location.href + "\n--\nNetease: MusicBrainz import\nhttps://github.com/garylaski/userscripts", "edit_note");

            // Release title
            addToForm(mbForm, neteaseAlbumData.name, "name");
            addToForm(mbForm, "official", "status");
            addToForm(mbForm, "None", "packaging");

            // Date information
            let date = new Date(neteaseAlbumData.publishTime);
            addToForm(mbForm, date.getUTCFullYear(), "date.year");
            addToForm(mbForm, date.getUTCDate(), "date.day");
            addToForm(mbForm, date.getUTCMonth() + 1, "date.month");
            addToForm(mbForm, "XW", "country");

            //Release label
            if (neteaseAlbumData.company) {
                addToForm(mbForm, neteaseAlbumData.company, "labels.0.name");
            }

            // Release artist
            for (var i = 0; i < neteaseAlbumData.artists.length; i++) {
              addToForm(mbForm, neteaseAlbumData.artists[i].name, `artist_credit.names.${i}.name`);
              addToForm(mbForm, neteaseAlbumData.artists[i].name, `artist_credit.names.${i}.artist.name`);
            }

            // Release type
            let type = convertReleaseTypes(neteaseAlbumData.type);
            addToForm(mbForm, type, "type");

            // Tracks
            addToForm(mbForm, "Digital Media", "mediums.0.format");
            for (var i = 0; i < neteaseAlbumData.songs.length; i++) {
              addToForm(mbForm, i + 1, `mediums.0.track.${i}.number`);
              addToForm(mbForm, neteaseAlbumData.songs[i].name, `mediums.0.track.${i}.name`);
              addToForm(mbForm, neteaseAlbumData.songs[i].duration, `mediums.0.track.${i}.length`);
              for (var j = 0; j < neteaseAlbumData.songs[i].artists.length; j++) {
                addToForm(mbForm, neteaseAlbumData.songs[i].artists[j].name, `mediums.0.track.${i}.artist_credit.names.${j}.name`);
                addToForm(mbForm, neteaseAlbumData.songs[i].artists[j].name, `mediums.0.track.${i}.artist_credit.names.${j}.artist.name`);
              }
            }
            let url_count = 0;

            // Stream for free URL
            addToForm(mbForm, location.href, "urls." + url_count + ".url");
            addToForm(mbForm, 85, "urls." + url_count + ".link_type");
            url_count++;
            console.log(neteaseAlbumData.picUrl);

            document.body.appendChild(mbForm);
            mbForm.submit();
            document.body.removeChild(mbForm);
        }
    });
}
function createImportButton(parent) {
    if (parent.querySelector(".u-btni-mb")) {
        return;
    }
    GM_xmlhttpRequest({
        url: "https://musicbrainz.org/ws/2/url?fmt=json&resource="+location.href,
        method: "GET",
        responseType: "json",
        onload: function(response) {
            var importButton;
            if(response.response.error) {
              importButton = `<a title="MB Import" class="u-btni u-btni-mb"><i>Import</i></a>`;
                parent.innerHTML = importButton + parent.innerHTML;
                parent.querySelector(".u-btni-mb").addEventListener("click",submitRelease);
            } else {
                let mbid = response.response.id;
                importButton = `<a title="MB Entry" class="u-btni u-btni-mb"><i>Open</i></a>`;
                parent.innerHTML = importButton + parent.innerHTML;
                parent.querySelector(".u-btni-mb").addEventListener("click", function() {
                    window.open("https://musicbrainz.org/url/"+mbid)
                });
            }
        }
    });
}

let previousUrl = '';
let waiting = false;
const urlObserver = new MutationObserver(function(mutations) {
    if (location.href !== previousUrl) {
        previousUrl = location.href;
        if (!waiting) {
            waiting = true;
            waitTillExists("#content-operation", createImportButton);
        }
    }
});

urlObserver.observe(document, {subtree: true, childList: true})
