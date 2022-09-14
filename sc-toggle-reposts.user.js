// ==UserScript==
// @name        SoundCloud: Toggle Reposts
// @description Toggle the visibility of reposts on the stream and artists page.
// @version     2022.9.12
// @author      garylaski
// @namespace   https://github.com/garylaski/userscripts
// @match       https://soundcloud.com/*
// @licence     GPL-3.0-or-later; http://www.gnu.org/licenses/gpl-3.0.txt
// ==/UserScript==
const app = document.getElementById("app");
const config = { childList: true, subtree: true };
var drewSwitch = false;
var showReposts;
var toggleButtonHandle;
function checkCookie() {
  if(document.cookie.split('; ').find((row) => row.startsWith('showReposts='))?.split('=')[1]) {
    showReposts = document.cookie.split('; ').find((row) => row.startsWith('showReposts='))?.split('=')[1];
  } else {
    document.cookie="showReposts="+showReposts;
  }
}
//Stream and UserStream
const callback = (mutationList, observer) => {
  for (const mutation of mutationList) {
    if (mutation.type === 'childList' && document.querySelector(".stream, .userStream") && !drewSwitch) {
      if (document.querySelector(".lazyLoadingList, .soundList")) {
          drewSwitch = true;
          document.querySelector(".profileTabs, .stream__header").innerHTML += `<div class ="g-flex-row-centered"><div class="toggleFormControl"><div class="toggleFormControl">
          <label id="toggleButtonHandle" class="toggle sc-toggle toggleFormControl__toggle sc-mx-1x sc-toggle-active sc-toggle-on">
            <span class="sc-toggle-handle"></span>
            <input id="toggleButton" class="sc-toggle-input sc-visuallyhidden" type="checkbox" checked="" aria-required="false">
          </label>
          </div>
          <div class="checkboxFormControl__validation g-input-validation g-input-validation-hidden"></div></div><span style="margin-left:10px"class="sc-ministats sc-ministats-small sc-ministats-reposts soundContext__repost"></span></div>`;
          document.getElementById("toggleButton").addEventListener("click", toggle);
          toggleButtonHandle = document.getElementById("toggleButtonHandle");
          observer.disconnect();
          checkCookie();
          if(showReposts === 'false') {
            toggleButtonHandle.classList.remove("sc-toggle-on");
            toggleButtonHandle.classList.remove("sc-toggle-active");
            toggleButtonHandle.classList.add("sc-toggle-off");      
          }
          postObserver.observe(document.querySelector(".userMain, .stream"), config);
      }
    }
  }
};
const appObserver = new MutationObserver(callback);
const postObserver = new MutationObserver(evalReposts);
appObserver.observe(app, config);

function evalReposts() {
    for (const item of document.querySelectorAll(".soundList__item")) {
        if (item.querySelector(".soundContext__repost, .sc-ministats-reposts")) {
          if (showReposts === 'true') {
            item.style.display = "block";
          } else {
            item.style.display = "none";
          }
        }
    }  
}

function toggle() {
    if(showReposts === 'false') {
      toggleButtonHandle.classList.remove("sc-toggle-off");
      toggleButtonHandle.classList.add("sc-toggle-on");
      toggleButtonHandle.classList.add("sc-toggle-active");
      showReposts = 'true';
    } else {
      toggleButtonHandle.classList.remove("sc-toggle-on");
      toggleButtonHandle.classList.remove("sc-toggle-active");
      toggleButtonHandle.classList.add("sc-toggle-off");
      showReposts = 'false';
    }
    document.cookie="showReposts="+showReposts;
    evalReposts();
}

let lastUrl = location.href; 
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    onUrlChange();
  }
}).observe(document, {subtree: true, childList: true});
 
 
function onUrlChange() {
  drewSwitch = false;
  appObserver.observe(app, config);
}

