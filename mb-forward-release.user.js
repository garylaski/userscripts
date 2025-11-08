// ==UserScript==
// @name        MusicBrainz: Forward Release Seeding
// @description Allows additional seeding information to be submitted when seeding a release using the location hash.
// @version     2025.11.8
// @author      garylaski
// @namespace   https://github.com/garylaski/userscripts/
// @downloadURL https://github.com/garylaski/userscripts/raw/main/mb-forward-release.user.js
// @updateURL   https://github.com/garylaski/userscripts/raw/main/mb-forward-release.user.js
// @homepageURL https://github.com/garylaski/userscripts
// @supportURL  https://github.com/garylaski/userscripts/issues
// @include     /^https:\/\/musicbrainz\.org\/release\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(?:#.*)?$/
// @licence     GPL-3.0-or-later; http://www.gnu.org/licenses/gpl-3.0.txt
// @run-at      document-idle
// @noframes
// ==/UserScript==

function update_map(map, keys, value) {
    current = map;
    for (const [index, key] of keys.entries()) {
        if (index === keys.length - 1) {
            current.set(key, value);
        } else {
            if (!current.has(key)) current.set(key, new Map());
            current = current.get(key);
        }
    }
}

function collapse_map(map, prefix='') {
  const result = [];
  for (const [key, value] of map.entries()) {
    const new_key = prefix ? `${prefix}.${key}` : key;
    if (value instanceof Map) {
      result.push(...collapse_map(value, new_key));
    } else {
      result.push([new_key, value]);
    }
  }
  return result;
}

function addToForm(form, value, name) {
    const textarea = document.createElement("textarea");
    textarea.name = name;
    textarea.value = value;
    textarea.style.display = 'none';
    form.appendChild(textarea);
}

async function submit_edits(track_ids) {
    for (const track_id of track_ids) {
        const form = document.createElement("form");
        form.setAttribute("id", "mb-form");
        form.target = "_blank";
        page.appendChild(form);
        form.method = "GET";
        const track = document.getElementById(track_id);
        const recording_href = track.querySelector('.title').querySelector('a').href;
        form.action = `${recording_href}/edit`;
        let edits = [];
        for (const tr of track.querySelectorAll('.edits')) {
            const edit_key = tr.querySelector('.edit_key').innerHTML;
            let edit_value = tr.querySelector('.edit_value').value;
            if (edit_key == "edit-recording.edit_note") {
                edit_value += `\n[Edit forwarded by "MusicBrainz: Forward Release Seeding" (https://github.com/garylaski/userscripts)]`
            }
            addToForm(form, edit_value, edit_key);
        }
        form.submit();
    }
}

if (location.hash) {
    const recordings = [];
    const params = new URLSearchParams(location.hash.substring(1));
    edits = new Map();
    for (const [keys, value] of params.entries()) {
        update_map(edits, keys.split('.'), decodeURIComponent(value));
    }

    for (const [i, medium] of document.querySelectorAll('.medium').entries()) {
        medium_edits = edits.get('mediums')?.get(i.toString());
        track_index = 0;
        for (const tr of medium.querySelectorAll('tr')) {
            if (tr.classList.contains('subh')) {
                const th = document.createElement('th');
                th.innerHTML = 'Forwarded Edits';
                th.style = "width:30%;text-align:center;";
                tr.appendChild(th);
            } else if (tr.id) {
                const td = document.createElement('td');
                td.style = "width:30%";
                const track_edits = medium_edits?.get("track")?.get(track_index.toString());
                html = `<table class="row-form"><tbody>`;
                if (track_edits) {
                    recordings.push(tr.id);
                    track_edits.set('edit_note', params.get('edit_note') || "");
                    for (const [key, value] of collapse_map(track_edits)) {
                        if (key == 'edit_note') {
                            html += `<tr class="edits">
                                        <td><label class="edit_key">edit-recording.${key}</label></td>
                                        <td style="vertical-align:middle"><textarea class="edit_value edit-note" rows=5 style="width:100%">${value}</textarea></td>
                                        <td style="vertical-align:middle"><button class='icon remove-item'></button></td>
                                    </tr>`;
                        }else {
                            html += `<tr class="edits">
                                        <td><label class="edit_key">edit-recording.${key}</label></td>
                                        <td style="vertical-align:middle"><input class="edit_value" type='text' value=${value}></td>
                                        <td style="vertical-align:middle"><button class='icon remove-item'></button></td>
                                    </tr>`;
                        }
                    }
                }
                html += `</tbody></table>`;
                td.innerHTML = html;
                tr.appendChild(td);
                track_index++;
            } else {
                let th = tr.querySelector('th');
                th.setAttribute('colspan', 5);
            }
        }
    }
    const submit_button = document.createElement("button");
    submit_button.classList.add("styled-button");
    submit_button.style = "float:right;margin:1rem";
    submit_button.innerHTML = "Submit Forwarded Edits";
    submit_button.onclick = () => { submit_edits(recordings); };
    document.querySelector(".tracklist-and-credits").insertBefore(submit_button, document.querySelector(".tracklist"));
}
