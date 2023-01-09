// ==UserScript==
// @name        SoundCloud: MusicBrainz import
// @description Import SoundCloud releases into MusicBrainz.
// @version     2022.12.13
// @author      garylaski
// @namespace   https://github.com/garylaski/userscripts
// @match       https://soundcloud.com/*/*
// @match       https://soundcloud.com/*/sets/*
// @match       https://soundcloud.com/*
// @licence     GPL-3.0-or-later; http://www.gnu.org/licenses/gpl-3.0.txt
// @run-at      document-end
// @grant       GM_xmlhttpRequest
// @grant       GM_addStyle
// ==/UserScript==
GM_addStyle (`
  .sc-button-medium.sc-button-mb:before {
    background-image: url("https://musicbrainz.org/favicon.ico");
    background-size: 14px 14px;
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
        case 'album':
            return 'Album';
        case 'ep':
            return 'EP';
        case 'single':
            return 'Single';
        default:
            return 'Other';
    }
}

function addToForm(form, value, name) {
  form.innerHTML += `<input type='hidden' value='${value}' name='${name}'/>`;
}

function submitRelease() {
  var soundcloudAlbumData;
  GM_xmlhttpRequest({
    url: location.href,
    method: "GET",
    onload: function(response) {
      // Create form
      let mbForm = document.createElement("form");
      mbForm.method = "POST";
      mbForm.target = "_blank"
      mbForm.action = "https://musicbrainz.org/release/add"

      // Process data
      let soundcloudAlbumData = JSON.parse(response.responseText.split("__sc_hydration =")[1].split(";</script>")[0])[8].data;
      // Edit note
      addToForm(mbForm, location.href + "\n--\nSoundCloud: MusicBrainz import\nhttps://github.com/garylaski/userscripts", "edit_note");
      // Release title
      addToForm(mbForm, soundcloudAlbumData.title, "name");
      addToForm(mbForm, "official", "status");
      addToForm(mbForm, "None", "packaging");

      // Date information
      let date = new Date(soundcloudAlbumData.created_at);
      addToForm(mbForm, date.getUTCFullYear(), "date.year");
      addToForm(mbForm, date.getUTCDate(), "date.day");
      addToForm(mbForm, date.getUTCMonth() + 1, "date.month");
      addToForm(mbForm, "XW", "country");

      // Release artist
      addToForm(mbForm, soundcloudAlbumData.user.username, "artist_credit.names.0.name");
      addToForm(mbForm, soundcloudAlbumData.user.username, "artist_credit.names.0.artist.name");

      // Release type
      let type = "track";
      if (soundcloudAlbumData.kind == "track") {
          // Logic to determine if it is part of a release
          if (document.querySelectorAll(".sidebarModule")[1].getElementsByClassName("soundBadgeList__item").length == 0) {
            type = "Single";
          }
      } else {
          type = convertReleaseTypes(soundcloudAlbumData.set_type);
      }
      addToForm(mbForm, type, "type");

      // Tracks
      addToForm(mbForm, "Digital Media", "mediums.0.format");
      if (type == "Single") {
        addToForm(mbForm, "1", "mediums.0.track.0.number");
        addToForm(mbForm, soundcloudAlbumData.title, "mediums.0.track.0.name");
        addToForm(mbForm, soundcloudAlbumData.duration, "mediums.0.track.0.length");
        addToForm(mbForm, soundcloudAlbumData.user.username, "mediums.0.track.0.artist_credit.names.0.name");
        addToForm(mbForm, soundcloudAlbumData.user.username, "mediums.0.track.0.artist_credit.names.0.artist.name");
      } else {
        if (type == "track") {
          // Unsure how to handle the track only case.
          // Open menu to go to release?
          return;
        } else {
          //need to let all tracks load
          let trackNodeList = document.querySelectorAll(".trackItem");
          let promises = [];
          trackNodeList.forEach(function (track) {
              let p = new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                  url: track.querySelector(".trackItem__trackTitle").href,
                  method: "GET",
                  onload: function(response) {
                    let soundcloudTrackData = JSON.parse(response.responseText.split("__sc_hydration =")[1].split(";</script>")[0])[8].data;
                    let trackNumber = track.querySelector(".trackItem__number").innerHTML.trim() - 1;
                    addToForm(mbForm, trackNumber + 1, `mediums.0.track.${trackNumber}.number`);
                    addToForm(mbForm, soundcloudTrackData.title, `mediums.0.track.${trackNumber}.name`);
                    addToForm(mbForm, soundcloudTrackData.duration, `mediums.0.track.${trackNumber}.length`);
                    addToForm(mbForm, soundcloudTrackData.user.username, `mediums.0.track.${trackNumber}.artist_credit.names.0.name`);
                    addToForm(mbForm, soundcloudTrackData.user.username, `mediums.0.track.${trackNumber}.artist_credit.names.0.artist.name`);
                    resolve(response.responseText);
                  },
                  onerror: function(error) {
                    reject(error);
                  }
                });
              });
              promises.push(p);
          });

          Promise.all(promises).then(() => {
            document.body.appendChild(mbForm);
            mbForm.submit();
            document.body.removeChild(mbForm);
          });
        }
      }
      // URL
      addToForm(mbForm, location.href, "urls.0.url");
      addToForm(mbForm, 85, "urls.0.link_type");
    }
  });
}

function createImportButton(parent) {
  if (parent.querySelector(".sc-button-mb")) {
    return;
  }
  GM_xmlhttpRequest({
    url: "https://musicbrainz.org/ws/2/url?fmt=json&resource="+location.href,
    method: "GET",
    responseType: "json",
    onload: function(response) {
      var importButton;
      if(response.response.error) {
        importButton = `<button title="MB Import" class="sc-button-mb sc-button-secondary sc-button sc-button-medium sc-button-block sc-button-responsive">Import</button>`;
        parent.innerHTML = importButton + parent.innerHTML;
        parent.querySelector(".sc-button-mb").addEventListener("click",submitRelease);
      } else {
        let mbid = response.response.id;
        importButton = `<button title="MB Entry" class="sc-button-mb sc-button-secondary sc-button sc-button-medium sc-button-block sc-button-responsive">Open</button>`;
        parent.innerHTML = importButton + parent.innerHTML;
        parent.querySelector(".sc-button-mb").addEventListener("click", function() {
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
    if (location.href.split('/').length > 4 && !waiting) {
      waiting = true;
      waitTillExists(".listenDetails__partialInfo", createImportButton);
    }
  }
});

urlObserver.observe(document, {subtree: true, childList: true});
