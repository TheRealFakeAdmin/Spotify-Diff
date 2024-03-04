window.onload = async () => {
    const clientIdElement = document.querySelector('input#client-id');
    const clientSecretElement = document.querySelector('input#client-secret');

    const playlistOneElement = document.querySelector('input#playlist-one');
    const playlistTwoElement = document.querySelector('input#playlist-two');

    const submitElement = document.querySelector('input#submit');
    const submitOneElement = document.querySelector('input#submit-one');
    const submitTwoElement = document.querySelector('input#submit-two');

    const tablesElement = document.querySelector('div#tables');

    const zeroErrorElement = document.querySelector('span#zero-error');
    // const oneErrorElement = document.querySelector('span#one-error');
    // const twoErrorElement = document.querySelector('span#two-error');

    playlistOneElement.disabled = true;
    submitOneElement.disabled = true;
    playlistTwoElement.disabled = true;
    submitTwoElement.disabled = true;

    let tokenTimeout = null;

    let accessToken = ""; // Initializing variables used in refreshToken
    let tokenType = "";

    // let playlistStatus = 0b00; // Bitwise Status of Playlists; 0 [0b00]: none ready; 1 [0b01]: right ready; 2 [0b10]: left: ready; 3 [0b11]: both ready;


    const startToken = async () => {
        const clientId = clientIdElement.value;
        const clientSecret = clientSecretElement.value;

        zeroErrorElement.innerText = ""; // Reset error message

        /**
         * Starts the loop of refreshing tokens
         */
        const refreshToken = async () => {
            if (tokenTimeout) {
                clearTimeout(tokenTimeout);
                tokenTimeout = null;
            }

            const req = await fetch("https://accounts.spotify.com/api/token", {
                method: "POST",
                mode: "cors",
                cache: "no-cache",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`
            });

            switch(req.status) {
                case 200: // Success
                    const res = await req.json();

                    const expiresMs = res["expires_in"] * 1000; // Converts expires_in from seconds to milliseconds

                    const tokenTimeout = setTimeout(refreshToken, expiresMs);

                    accessToken = res["access_token"];
                    tokenType = res["token_type"];

                    return tokenTimeout;
                case 400: // Client ID or Secret Invalid
                    try {
                        const res = await req.json();
                        if (res['error_description'] || res.error) {
                            zeroErrorElement.innerText = `Error 400 : ${res['error_description'] || res.error}`;
                        } else {
                            throw "Unknown Error";
                        }
                    } catch (_) {
                        zeroErrorElement.innerText = "Error 400 : Bad Request";
                    }
                    return null;
                default:
                    zeroErrorElement.innerText = `Error ${req.status} : Something went wrong`;
                    return null;
            }
        }

        tokenTimeout = await refreshToken();

        if (tokenTimeout) {
            playlistOneElement.disabled = false;
            submitOneElement.disabled = false;
            playlistTwoElement.disabled = false;
            submitTwoElement.disabled = false;
            tablesElement.removeAttribute('aria-disabled');
        }
    }


    /**
     * Returns a partial list of tracks from a Spotify playlist
     *
     * @param {string} playlist_id - The ID of a Spotify Playlist
     * @param {number} [limit] - Max number of tracks to return
     * @param {number} [offset] - The track index to start at
     * @param {string} [market] - ISO-3166 Alpha-1 Country Codes
     * @param {string} [fields] - Filters for the query (see [the docs](https://developer.spotify.com/documentation/web-api/reference/get-playlists-tracks) for more info)
     * @private
     */
    const spotifyTracksAPI = async ( playlist_id, { limit=50, offset, market, fields } ) => {
        if (typeof playlist_id !== "string" || !(/^[0-9a-zA-Z]{22}$/).test(playlist_id)) throw "Not a valid Spotify ID";
        if (typeof accessToken !== "string" || accessToken.length === 0) throw "Not a valid access token";
        if (typeof tokenType !== "string" || tokenType.length === 0) throw "Not a valid token type";
        if (typeof market !== "undefined" && (typeof market !== "string" || !(/^[A-Z]{2}$/).test(market))) throw "Not a valid market";
        if (typeof fields !== "undefined" && typeof fields !== "string") throw new TypeError("fields must be undefined or a string");

        let fetchUrl = `https://api.spotify.com/v1/playlists/${playlist_id}/tracks?limit=${limit}`;
        if (offset) fetchUrl += `&offset=${offset}`;
        if (market) fetchUrl += `&market=${market}`;
        if (fields) fetchUrl += `&fields=${fields}`;

        const req = await fetch(fetchUrl, {
            method: "GET",
            mode: "cors",
            cache: "no-cache",
            headers: {
                "Authorization": `${tokenType} ${accessToken}`,
            }
        });

        return await req.json();
    }

    /**
     * Returns a list of all tracks in a Spotify playlist
     */
    const getSpotifyPlaylist = async ( playlist_id ) => {
        let tracks = [];
        let playlistLength = 1; // Initial length set to 0 as playlist is unknown

        for (let i = 0; i < playlistLength; i) {
            // console.debug(i, playlistLength);
            const res = await spotifyTracksAPI(playlist_id, {
                offset: i,
                fields: 'items(track(artists,href,id,name,uri,duration_ms,album(href,id,images,name,uri,artists,external_urls))),next,offset,total',
            });

            if (!res || !res.total) return false;

            const newTracks = res.items;
            i = res.offset + res.items.length; // Next offset
            playlistLength = res.total;

            if (playlistLength === 0) return false;

            tracks = tracks.concat(newTracks)
        }

        return tracks;
    }


    const processPlaylistLoad = async ( { target } ) => {
        const id = (target.id === "submit-one") ? 0 : 1; // Left: 1; Right: 2;
        const inputFieldIds = ["playlist-one", "playlist-two"];
        const targetInputField = document.getElementById(inputFieldIds[id]);
        const inputFieldId = targetInputField.value;

        // TODO : reset error message

        const playlist = await getSpotifyPlaylist(inputFieldId);
        console.debug(playlist);

        if (playlist) {
            const tableItems = [];

            playlist.forEach((v, i) => {
                const track = v.track,
                    album = track.album;

                const tempItem = {
                        index: i,
                        id: track.id,
                        title: track.name,
                        uri: track.uri,
                        duration_ms: track.duration_ms,
                        url: `https://open.spotify.com/track/${track.id}`, // Should I keep this? Why is it not provided?
                        album: {
                            title: album.name,
                            uri: album.uri,
                            href: album.external_urls.spotify,
                            id: album.id,
                            artists: [],
                        },
                        artists: [],
                    };

                track.artists.forEach((val) => {
                    tempItem.artists.push({
                        id: val.id,
                        name: val.name,
                        type: val.type,
                        uri: val.uri,
                        url: val.external_urls.spotify,
                    })
                });

                album.artists.forEach((val) => {
                    tempItem.album.artists.push({
                        id: val.id,
                        name: val.name,
                        uri: val.uri,
                        url: val.external_urls.spotify,
                        type: val.type,
                    })
                })

                tableItems.push(tempItem);
            })

            console.debug(tableItems);
        } else {
            // TODO : send error message
        }

        // TODO : Populate table

        // TODO : Update bitwise status

        // TODO : Check true duplicates within playlist

        // TODO : Check possible duplicates, due to re-uploads, with the same title, artists, and duration

        // If Both Populated (checks bitwise)

        // TODO : Check differences between both playlists
    }


    submitElement.addEventListener('click', startToken);
    submitOneElement.addEventListener('click', processPlaylistLoad);
    submitTwoElement.addEventListener('click', processPlaylistLoad);
}



// let a = {
//   "track": {
//     "album": {
//       "artists": [
//         {
//           "external_urls": {
//             "spotify": "https://open.spotify.com/artist/7cNNNhdJDrt3vgQjwSavNf"
//           },
//           "href": "https://api.spotify.com/v1/artists/7cNNNhdJDrt3vgQjwSavNf",
//           "id": "7cNNNhdJDrt3vgQjwSavNf",
//           "name": "Memphis May Fire",
//           "type": "artist",
//           "uri": "spotify:artist:7cNNNhdJDrt3vgQjwSavNf"
//         }
//       ],
//       "external_urls": {
//         "spotify": "https://open.spotify.com/album/1XIEbli14Xa0YbgNayQgYt"
//       },
//       "href": "https://api.spotify.com/v1/albums/1XIEbli14Xa0YbgNayQgYt",
//       "id": "1XIEbli14Xa0YbgNayQgYt",
//       "images": [
//         {
//           "height": 640,
//           "url": "https://i.scdn.co/image/ab67616d0000b27336daf308de541e4019a82139",
//           "width": 640
//         },
//         {
//           "height": 300,
//           "url": "https://i.scdn.co/image/ab67616d00001e0236daf308de541e4019a82139",
//           "width": 300
//         },
//         {
//           "height": 64,
//           "url": "https://i.scdn.co/image/ab67616d0000485136daf308de541e4019a82139",
//           "width": 64
//         }
//       ],
//       "name": "Make Believe",
//       "uri": "spotify:album:1XIEbli14Xa0YbgNayQgYt"
//     },
//     "artists": [
//       {
//         "external_urls": {
//           "spotify": "https://open.spotify.com/artist/7cNNNhdJDrt3vgQjwSavNf"
//         },
//         "href": "https://api.spotify.com/v1/artists/7cNNNhdJDrt3vgQjwSavNf",
//         "id": "7cNNNhdJDrt3vgQjwSavNf",
//         "name": "Memphis May Fire",
//         "type": "artist",
//         "uri": "spotify:artist:7cNNNhdJDrt3vgQjwSavNf"
//       }
//     ],
//     "href": "https://api.spotify.com/v1/tracks/31iAZuJu1Obz239eDpMfee",
//     "id": "31iAZuJu1Obz239eDpMfee",
//     "name": "Make Believe",
//     "uri": "spotify:track:31iAZuJu1Obz239eDpMfee"
//   }
// }
//
// let b = {
//     "href": "https://api.spotify.com/v1/playlists/3cEYpjA9oz9GiPac4AsH4n/tracks?offset=0&limit=100&locale=en-US%2Cen%3Bq%3D0.5",
//     "items": [
//         {
//             "added_at": "2015-01-15T12:39:22Z",
//             "added_by": {
//                 "external_urls": {
//                     "spotify": "https://open.spotify.com/user/jmperezperez"
//                 },
//                 "href": "https://api.spotify.com/v1/users/jmperezperez",
//                 "id": "jmperezperez",
//                 "type": "user",
//                 "uri": "spotify:user:jmperezperez"
//             },
//             "is_local": false,
//             "primary_color": null,
//             "track": {
//                 "preview_url": "https://p.scdn.co/mp3-preview/04599a1fe12ffac01d2bcb08340f84c0dd2cc335?cid=d0b570bf62fe443095ddfe50858886e1",
//                 "available_markets": [
//                     "AR",
//                     "AU",
//                     "AT",
//                     "BE",
//                     "BO",
//                     "BR",
//                     "BG",
//                     "CA",
//                     "CL",
//                     "CO",
//                     "CR",
//                     "CY",
//                     "CZ",
//                     "DK",
//                     "DO",
//                     "DE",
//                     "EC",
//                     "EE",
//                     "SV",
//                     "FI",
//                     "FR",
//                     "GR",
//                     "GT",
//                     "HN",
//                     "HK",
//                     "HU",
//                     "IS",
//                     "IE",
//                     "IT",
//                     "LV",
//                     "LT",
//                     "LU",
//                     "MY",
//                     "MT",
//                     "MX",
//                     "NL",
//                     "NZ",
//                     "NI",
//                     "NO",
//                     "PA",
//                     "PY",
//                     "PE",
//                     "PH",
//                     "PL",
//                     "PT",
//                     "SG",
//                     "SK",
//                     "ES",
//                     "SE",
//                     "CH",
//                     "TW",
//                     "TR",
//                     "UY",
//                     "US",
//                     "GB",
//                     "AD",
//                     "LI",
//                     "MC",
//                     "ID",
//                     "JP",
//                     "TH",
//                     "VN",
//                     "RO",
//                     "IL",
//                     "ZA",
//                     "SA",
//                     "AE",
//                     "BH",
//                     "QA",
//                     "OM",
//                     "KW",
//                     "EG",
//                     "MA",
//                     "DZ",
//                     "TN",
//                     "LB",
//                     "JO",
//                     "PS",
//                     "IN",
//                     "BY",
//                     "KZ",
//                     "MD",
//                     "UA",
//                     "AL",
//                     "BA",
//                     "HR",
//                     "ME",
//                     "MK",
//                     "RS",
//                     "SI",
//                     "KR",
//                     "BD",
//                     "PK",
//                     "LK",
//                     "GH",
//                     "KE",
//                     "NG",
//                     "TZ",
//                     "UG",
//                     "AG",
//                     "AM",
//                     "BS",
//                     "BB",
//                     "BZ",
//                     "BT",
//                     "BW",
//                     "BF",
//                     "CV",
//                     "CW",
//                     "DM",
//                     "FJ",
//                     "GM",
//                     "GE",
//                     "GD",
//                     "GW",
//                     "GY",
//                     "HT",
//                     "JM",
//                     "KI",
//                     "LS",
//                     "LR",
//                     "MW",
//                     "MV",
//                     "ML",
//                     "MH",
//                     "FM",
//                     "NA",
//                     "NR",
//                     "NE",
//                     "PW",
//                     "PG",
//                     "WS",
//                     "SM",
//                     "ST",
//                     "SN",
//                     "SC",
//                     "SL",
//                     "SB",
//                     "KN",
//                     "LC",
//                     "VC",
//                     "SR",
//                     "TL",
//                     "TO",
//                     "TT",
//                     "TV",
//                     "VU",
//                     "AZ",
//                     "BN",
//                     "BI",
//                     "KH",
//                     "CM",
//                     "TD",
//                     "KM",
//                     "GQ",
//                     "SZ",
//                     "GA",
//                     "GN",
//                     "KG",
//                     "LA",
//                     "MO",
//                     "MR",
//                     "MN",
//                     "NP",
//                     "RW",
//                     "TG",
//                     "UZ",
//                     "ZW",
//                     "BJ",
//                     "MG",
//                     "MU",
//                     "MZ",
//                     "AO",
//                     "CI",
//                     "DJ",
//                     "ZM",
//                     "CD",
//                     "CG",
//                     "IQ",
//                     "LY",
//                     "TJ",
//                     "VE",
//                     "ET",
//                     "XK"
//                 ],
//                 "explicit": false,
//                 "type": "track",
//                 "episode": false,
//                 "track": true,
//                 "album": {
//                     "available_markets": [
//                         "AR",
//                         "AU",
//                         "AT",
//                         "BE",
//                         "BO",
//                         "BR",
//                         "BG",
//                         "CA",
//                         "CL",
//                         "CO",
//                         "CR",
//                         "CY",
//                         "CZ",
//                         "DK",
//                         "DO",
//                         "DE",
//                         "EC",
//                         "EE",
//                         "SV",
//                         "FI",
//                         "FR",
//                         "GR",
//                         "GT",
//                         "HN",
//                         "HK",
//                         "HU",
//                         "IS",
//                         "IE",
//                         "IT",
//                         "LV",
//                         "LT",
//                         "LU",
//                         "MY",
//                         "MT",
//                         "MX",
//                         "NL",
//                         "NZ",
//                         "NI",
//                         "NO",
//                         "PA",
//                         "PY",
//                         "PE",
//                         "PH",
//                         "PL",
//                         "PT",
//                         "SG",
//                         "SK",
//                         "ES",
//                         "SE",
//                         "CH",
//                         "TW",
//                         "TR",
//                         "UY",
//                         "US",
//                         "GB",
//                         "AD",
//                         "LI",
//                         "MC",
//                         "ID",
//                         "JP",
//                         "TH",
//                         "VN",
//                         "RO",
//                         "IL",
//                         "ZA",
//                         "SA",
//                         "AE",
//                         "BH",
//                         "QA",
//                         "OM",
//                         "KW",
//                         "EG",
//                         "MA",
//                         "DZ",
//                         "TN",
//                         "LB",
//                         "JO",
//                         "PS",
//                         "IN",
//                         "BY",
//                         "KZ",
//                         "MD",
//                         "UA",
//                         "AL",
//                         "BA",
//                         "HR",
//                         "ME",
//                         "MK",
//                         "RS",
//                         "SI",
//                         "KR",
//                         "BD",
//                         "PK",
//                         "LK",
//                         "GH",
//                         "KE",
//                         "NG",
//                         "TZ",
//                         "UG",
//                         "AG",
//                         "AM",
//                         "BS",
//                         "BB",
//                         "BZ",
//                         "BT",
//                         "BW",
//                         "BF",
//                         "CV",
//                         "CW",
//                         "DM",
//                         "FJ",
//                         "GM",
//                         "GE",
//                         "GD",
//                         "GW",
//                         "GY",
//                         "HT",
//                         "JM",
//                         "KI",
//                         "LS",
//                         "LR",
//                         "MW",
//                         "MV",
//                         "ML",
//                         "MH",
//                         "FM",
//                         "NA",
//                         "NR",
//                         "NE",
//                         "PW",
//                         "PG",
//                         "WS",
//                         "SM",
//                         "ST",
//                         "SN",
//                         "SC",
//                         "SL",
//                         "SB",
//                         "KN",
//                         "LC",
//                         "VC",
//                         "SR",
//                         "TL",
//                         "TO",
//                         "TT",
//                         "TV",
//                         "VU",
//                         "AZ",
//                         "BN",
//                         "BI",
//                         "KH",
//                         "CM",
//                         "TD",
//                         "KM",
//                         "GQ",
//                         "SZ",
//                         "GA",
//                         "GN",
//                         "KG",
//                         "LA",
//                         "MO",
//                         "MR",
//                         "MN",
//                         "NP",
//                         "RW",
//                         "TG",
//                         "UZ",
//                         "ZW",
//                         "BJ",
//                         "MG",
//                         "MU",
//                         "MZ",
//                         "AO",
//                         "CI",
//                         "DJ",
//                         "ZM",
//                         "CD",
//                         "CG",
//                         "IQ",
//                         "LY",
//                         "TJ",
//                         "VE",
//                         "ET",
//                         "XK"
//                     ],
//                     "type": "album",
//                     "album_type": "compilation",
//                     "href": "https://api.spotify.com/v1/albums/2pANdqPvxInB0YvcDiw4ko",
//                     "id": "2pANdqPvxInB0YvcDiw4ko",
//                     "images": [
//                         {
//                             "height": 640,
//                             "url": "https://i.scdn.co/image/ab67616d0000b273ce6d0eef0c1ce77e5f95bbbc",
//                             "width": 640
//                         },
//                         {
//                             "height": 300,
//                             "url": "https://i.scdn.co/image/ab67616d00001e02ce6d0eef0c1ce77e5f95bbbc",
//                             "width": 300
//                         },
//                         {
//                             "height": 64,
//                             "url": "https://i.scdn.co/image/ab67616d00004851ce6d0eef0c1ce77e5f95bbbc",
//                             "width": 64
//                         }
//                     ],
//                     "name": "Progressive Psy Trance Picks Vol.8",
//                     "release_date": "2012-04-02",
//                     "release_date_precision": "day",
//                     "uri": "spotify:album:2pANdqPvxInB0YvcDiw4ko",
//                     "artists": [
//                         {
//                             "external_urls": {
//                                 "spotify": "https://open.spotify.com/artist/0LyfQWJT6nXafLPZqxe9Of"
//                             },
//                             "href": "https://api.spotify.com/v1/artists/0LyfQWJT6nXafLPZqxe9Of",
//                             "id": "0LyfQWJT6nXafLPZqxe9Of",
//                             "name": "Various Artists",
//                             "type": "artist",
//                             "uri": "spotify:artist:0LyfQWJT6nXafLPZqxe9Of"
//                         }
//                     ],
//                     "external_urls": {
//                         "spotify": "https://open.spotify.com/album/2pANdqPvxInB0YvcDiw4ko"
//                     },
//                     "total_tracks": 20
//                 },
//                 "artists": [
//                     {
//                         "external_urls": {
//                             "spotify": "https://open.spotify.com/artist/6eSdhw46riw2OUHgMwR8B5"
//                         },
//                         "href": "https://api.spotify.com/v1/artists/6eSdhw46riw2OUHgMwR8B5",
//                         "id": "6eSdhw46riw2OUHgMwR8B5",
//                         "name": "Odiseo",
//                         "type": "artist",
//                         "uri": "spotify:artist:6eSdhw46riw2OUHgMwR8B5"
//                     }
//                 ],
//                 "disc_number": 1,
//                 "track_number": 10,
//                 "duration_ms": 376000,
//                 "external_ids": {
//                     "isrc": "DEKC41200989"
//                 },
//                 "external_urls": {
//                     "spotify": "https://open.spotify.com/track/4rzfv0JLZfVhOhbSQ8o5jZ"
//                 },
//                 "href": "https://api.spotify.com/v1/tracks/4rzfv0JLZfVhOhbSQ8o5jZ",
//                 "id": "4rzfv0JLZfVhOhbSQ8o5jZ",
//                 "name": "Api",
//                 "popularity": 1,
//                 "uri": "spotify:track:4rzfv0JLZfVhOhbSQ8o5jZ",
//                 "is_local": false
//             },
//             "video_thumbnail": {
//                 "url": null
//             }
//         },
//         {
//             "added_at": "2015-01-15T12:40:03Z",
//             "added_by": {
//                 "external_urls": {
//                     "spotify": "https://open.spotify.com/user/jmperezperez"
//                 },
//                 "href": "https://api.spotify.com/v1/users/jmperezperez",
//                 "id": "jmperezperez",
//                 "type": "user",
//                 "uri": "spotify:user:jmperezperez"
//             },
//             "is_local": false,
//             "primary_color": null,
//             "track": {
//                 "preview_url": "https://p.scdn.co/mp3-preview/d61fbb7016904624373008ea056d45e6df891071?cid=d0b570bf62fe443095ddfe50858886e1",
//                 "available_markets": [],
//                 "explicit": false,
//                 "type": "track",
//                 "episode": false,
//                 "track": true,
//                 "album": {
//                     "available_markets": [],
//                     "type": "album",
//                     "album_type": "compilation",
//                     "href": "https://api.spotify.com/v1/albums/6nlfkk5GoXRL1nktlATNsy",
//                     "id": "6nlfkk5GoXRL1nktlATNsy",
//                     "images": [
//                         {
//                             "height": 640,
//                             "url": "https://i.scdn.co/image/ab67616d0000b273aa2ff29970d9a63a49dfaeb2",
//                             "width": 640
//                         },
//                         {
//                             "height": 300,
//                             "url": "https://i.scdn.co/image/ab67616d00001e02aa2ff29970d9a63a49dfaeb2",
//                             "width": 300
//                         },
//                         {
//                             "height": 64,
//                             "url": "https://i.scdn.co/image/ab67616d00004851aa2ff29970d9a63a49dfaeb2",
//                             "width": 64
//                         }
//                     ],
//                     "name": "Wellness & Dreaming Source",
//                     "release_date": "2015-01-09",
//                     "release_date_precision": "day",
//                     "uri": "spotify:album:6nlfkk5GoXRL1nktlATNsy",
//                     "artists": [
//                         {
//                             "external_urls": {
//                                 "spotify": "https://open.spotify.com/artist/0LyfQWJT6nXafLPZqxe9Of"
//                             },
//                             "href": "https://api.spotify.com/v1/artists/0LyfQWJT6nXafLPZqxe9Of",
//                             "id": "0LyfQWJT6nXafLPZqxe9Of",
//                             "name": "Various Artists",
//                             "type": "artist",
//                             "uri": "spotify:artist:0LyfQWJT6nXafLPZqxe9Of"
//                         }
//                     ],
//                     "external_urls": {
//                         "spotify": "https://open.spotify.com/album/6nlfkk5GoXRL1nktlATNsy"
//                     },
//                     "total_tracks": 25
//                 },
//                 "artists": [
//                     {
//                         "external_urls": {
//                             "spotify": "https://open.spotify.com/artist/5VQE4WOzPu9h3HnGLuBoA6"
//                         },
//                         "href": "https://api.spotify.com/v1/artists/5VQE4WOzPu9h3HnGLuBoA6",
//                         "id": "5VQE4WOzPu9h3HnGLuBoA6",
//                         "name": "Vlasta Marek",
//                         "type": "artist",
//                         "uri": "spotify:artist:5VQE4WOzPu9h3HnGLuBoA6"
//                     }
//                 ],
//                 "disc_number": 1,
//                 "track_number": 21,
//                 "duration_ms": 730066,
//                 "external_ids": {
//                     "isrc": "FR2X41475057"
//                 },
//                 "external_urls": {
//                     "spotify": "https://open.spotify.com/track/5o3jMYOSbaVz3tkgwhELSV"
//                 },
//                 "href": "https://api.spotify.com/v1/tracks/5o3jMYOSbaVz3tkgwhELSV",
//                 "id": "5o3jMYOSbaVz3tkgwhELSV",
//                 "name": "Is",
//                 "popularity": 0,
//                 "uri": "spotify:track:5o3jMYOSbaVz3tkgwhELSV",
//                 "is_local": false
//             },
//             "video_thumbnail": {
//                 "url": null
//             }
//         },
//         {
//             "added_at": "2015-01-15T12:22:30Z",
//             "added_by": {
//                 "external_urls": {
//                     "spotify": "https://open.spotify.com/user/jmperezperez"
//                 },
//                 "href": "https://api.spotify.com/v1/users/jmperezperez",
//                 "id": "jmperezperez",
//                 "type": "user",
//                 "uri": "spotify:user:jmperezperez"
//             },
//             "is_local": false,
//             "primary_color": null,
//             "track": {
//                 "preview_url": "https://p.scdn.co/mp3-preview/cc680ec0f5fd5ff21f0cd11ac47e10d3cbb92190?cid=d0b570bf62fe443095ddfe50858886e1",
//                 "available_markets": [
//                     "AR",
//                     "AU",
//                     "AT",
//                     "BE",
//                     "BO",
//                     "BR",
//                     "BG",
//                     "CA",
//                     "CL",
//                     "CO",
//                     "CR",
//                     "CY",
//                     "CZ",
//                     "DK",
//                     "DO",
//                     "DE",
//                     "EC",
//                     "EE",
//                     "SV",
//                     "FI",
//                     "FR",
//                     "GR",
//                     "GT",
//                     "HN",
//                     "HK",
//                     "HU",
//                     "IS",
//                     "IE",
//                     "IT",
//                     "LV",
//                     "LT",
//                     "LU",
//                     "MY",
//                     "MT",
//                     "MX",
//                     "NL",
//                     "NZ",
//                     "NI",
//                     "NO",
//                     "PA",
//                     "PY",
//                     "PE",
//                     "PH",
//                     "PL",
//                     "PT",
//                     "SG",
//                     "SK",
//                     "ES",
//                     "SE",
//                     "CH",
//                     "TW",
//                     "TR",
//                     "UY",
//                     "US",
//                     "GB",
//                     "AD",
//                     "LI",
//                     "MC",
//                     "ID",
//                     "JP",
//                     "TH",
//                     "VN",
//                     "RO",
//                     "IL",
//                     "ZA",
//                     "SA",
//                     "AE",
//                     "BH",
//                     "QA",
//                     "OM",
//                     "KW",
//                     "EG",
//                     "MA",
//                     "DZ",
//                     "TN",
//                     "LB",
//                     "JO",
//                     "PS",
//                     "IN",
//                     "BY",
//                     "KZ",
//                     "MD",
//                     "UA",
//                     "AL",
//                     "BA",
//                     "HR",
//                     "ME",
//                     "MK",
//                     "RS",
//                     "SI",
//                     "KR",
//                     "BD",
//                     "PK",
//                     "LK",
//                     "GH",
//                     "KE",
//                     "NG",
//                     "TZ",
//                     "UG",
//                     "AG",
//                     "AM",
//                     "BS",
//                     "BB",
//                     "BZ",
//                     "BT",
//                     "BW",
//                     "BF",
//                     "CV",
//                     "CW",
//                     "DM",
//                     "FJ",
//                     "GM",
//                     "GE",
//                     "GD",
//                     "GW",
//                     "GY",
//                     "HT",
//                     "JM",
//                     "KI",
//                     "LS",
//                     "LR",
//                     "MW",
//                     "MV",
//                     "ML",
//                     "MH",
//                     "FM",
//                     "NA",
//                     "NR",
//                     "NE",
//                     "PW",
//                     "PG",
//                     "WS",
//                     "SM",
//                     "ST",
//                     "SN",
//                     "SC",
//                     "SL",
//                     "SB",
//                     "KN",
//                     "LC",
//                     "VC",
//                     "SR",
//                     "TL",
//                     "TO",
//                     "TT",
//                     "TV",
//                     "VU",
//                     "AZ",
//                     "BN",
//                     "BI",
//                     "KH",
//                     "CM",
//                     "TD",
//                     "KM",
//                     "GQ",
//                     "SZ",
//                     "GA",
//                     "GN",
//                     "KG",
//                     "LA",
//                     "MO",
//                     "MR",
//                     "MN",
//                     "NP",
//                     "RW",
//                     "TG",
//                     "UZ",
//                     "ZW",
//                     "BJ",
//                     "MG",
//                     "MU",
//                     "MZ",
//                     "AO",
//                     "CI",
//                     "DJ",
//                     "ZM",
//                     "CD",
//                     "CG",
//                     "IQ",
//                     "LY",
//                     "TJ",
//                     "VE",
//                     "ET",
//                     "XK"
//                 ],
//                 "explicit": false,
//                 "type": "track",
//                 "episode": false,
//                 "track": true,
//                 "album": {
//                     "available_markets": [
//                         "AR",
//                         "AU",
//                         "AT",
//                         "BE",
//                         "BO",
//                         "BR",
//                         "BG",
//                         "CA",
//                         "CL",
//                         "CO",
//                         "CR",
//                         "CY",
//                         "CZ",
//                         "DK",
//                         "DO",
//                         "DE",
//                         "EC",
//                         "EE",
//                         "SV",
//                         "FI",
//                         "FR",
//                         "GR",
//                         "GT",
//                         "HN",
//                         "HK",
//                         "HU",
//                         "IS",
//                         "IE",
//                         "IT",
//                         "LV",
//                         "LT",
//                         "LU",
//                         "MY",
//                         "MT",
//                         "MX",
//                         "NL",
//                         "NZ",
//                         "NI",
//                         "NO",
//                         "PA",
//                         "PY",
//                         "PE",
//                         "PH",
//                         "PL",
//                         "PT",
//                         "SG",
//                         "SK",
//                         "ES",
//                         "SE",
//                         "CH",
//                         "TW",
//                         "TR",
//                         "UY",
//                         "US",
//                         "GB",
//                         "AD",
//                         "LI",
//                         "MC",
//                         "ID",
//                         "JP",
//                         "TH",
//                         "VN",
//                         "RO",
//                         "IL",
//                         "ZA",
//                         "SA",
//                         "AE",
//                         "BH",
//                         "QA",
//                         "OM",
//                         "KW",
//                         "EG",
//                         "MA",
//                         "DZ",
//                         "TN",
//                         "LB",
//                         "JO",
//                         "PS",
//                         "IN",
//                         "BY",
//                         "KZ",
//                         "MD",
//                         "UA",
//                         "AL",
//                         "BA",
//                         "HR",
//                         "ME",
//                         "MK",
//                         "RS",
//                         "SI",
//                         "KR",
//                         "BD",
//                         "PK",
//                         "LK",
//                         "GH",
//                         "KE",
//                         "NG",
//                         "TZ",
//                         "UG",
//                         "AG",
//                         "AM",
//                         "BS",
//                         "BB",
//                         "BZ",
//                         "BT",
//                         "BW",
//                         "BF",
//                         "CV",
//                         "CW",
//                         "DM",
//                         "FJ",
//                         "GM",
//                         "GE",
//                         "GD",
//                         "GW",
//                         "GY",
//                         "HT",
//                         "JM",
//                         "KI",
//                         "LS",
//                         "LR",
//                         "MW",
//                         "MV",
//                         "ML",
//                         "MH",
//                         "FM",
//                         "NA",
//                         "NR",
//                         "NE",
//                         "PW",
//                         "PG",
//                         "WS",
//                         "SM",
//                         "ST",
//                         "SN",
//                         "SC",
//                         "SL",
//                         "SB",
//                         "KN",
//                         "LC",
//                         "VC",
//                         "SR",
//                         "TL",
//                         "TO",
//                         "TT",
//                         "TV",
//                         "VU",
//                         "AZ",
//                         "BN",
//                         "BI",
//                         "KH",
//                         "CM",
//                         "TD",
//                         "KM",
//                         "GQ",
//                         "SZ",
//                         "GA",
//                         "GN",
//                         "KG",
//                         "LA",
//                         "MO",
//                         "MR",
//                         "MN",
//                         "NP",
//                         "RW",
//                         "TG",
//                         "UZ",
//                         "ZW",
//                         "BJ",
//                         "MG",
//                         "MU",
//                         "MZ",
//                         "AO",
//                         "CI",
//                         "DJ",
//                         "ZM",
//                         "CD",
//                         "CG",
//                         "IQ",
//                         "LY",
//                         "TJ",
//                         "VE",
//                         "ET",
//                         "XK"
//                     ],
//                     "type": "album",
//                     "album_type": "album",
//                     "href": "https://api.spotify.com/v1/albums/4hnqM0JK4CM1phwfq1Ldyz",
//                     "id": "4hnqM0JK4CM1phwfq1Ldyz",
//                     "images": [
//                         {
//                             "height": 640,
//                             "url": "https://i.scdn.co/image/ab67616d0000b273ee0d0dce888c6c8a70db6e8b",
//                             "width": 640
//                         },
//                         {
//                             "height": 300,
//                             "url": "https://i.scdn.co/image/ab67616d00001e02ee0d0dce888c6c8a70db6e8b",
//                             "width": 300
//                         },
//                         {
//                             "height": 64,
//                             "url": "https://i.scdn.co/image/ab67616d00004851ee0d0dce888c6c8a70db6e8b",
//                             "width": 64
//                         }
//                     ],
//                     "name": "This Is Happening",
//                     "release_date": "2010-05-17",
//                     "release_date_precision": "day",
//                     "uri": "spotify:album:4hnqM0JK4CM1phwfq1Ldyz",
//                     "artists": [
//                         {
//                             "external_urls": {
//                                 "spotify": "https://open.spotify.com/artist/066X20Nz7iquqkkCW6Jxy6"
//                             },
//                             "href": "https://api.spotify.com/v1/artists/066X20Nz7iquqkkCW6Jxy6",
//                             "id": "066X20Nz7iquqkkCW6Jxy6",
//                             "name": "LCD Soundsystem",
//                             "type": "artist",
//                             "uri": "spotify:artist:066X20Nz7iquqkkCW6Jxy6"
//                         }
//                     ],
//                     "external_urls": {
//                         "spotify": "https://open.spotify.com/album/4hnqM0JK4CM1phwfq1Ldyz"
//                     },
//                     "total_tracks": 9
//                 },
//                 "artists": [
//                     {
//                         "external_urls": {
//                             "spotify": "https://open.spotify.com/artist/066X20Nz7iquqkkCW6Jxy6"
//                         },
//                         "href": "https://api.spotify.com/v1/artists/066X20Nz7iquqkkCW6Jxy6",
//                         "id": "066X20Nz7iquqkkCW6Jxy6",
//                         "name": "LCD Soundsystem",
//                         "type": "artist",
//                         "uri": "spotify:artist:066X20Nz7iquqkkCW6Jxy6"
//                     }
//                 ],
//                 "disc_number": 1,
//                 "track_number": 4,
//                 "duration_ms": 401440,
//                 "external_ids": {
//                     "isrc": "US4GE1000022"
//                 },
//                 "external_urls": {
//                     "spotify": "https://open.spotify.com/track/4Cy0NHJ8Gh0xMdwyM9RkQm"
//                 },
//                 "href": "https://api.spotify.com/v1/tracks/4Cy0NHJ8Gh0xMdwyM9RkQm",
//                 "id": "4Cy0NHJ8Gh0xMdwyM9RkQm",
//                 "name": "All I Want",
//                 "popularity": 45,
//                 "uri": "spotify:track:4Cy0NHJ8Gh0xMdwyM9RkQm",
//                 "is_local": false
//             },
//             "video_thumbnail": {
//                 "url": null
//             }
//         },
//         {
//             "added_at": "2015-01-15T12:40:35Z",
//             "added_by": {
//                 "external_urls": {
//                     "spotify": "https://open.spotify.com/user/jmperezperez"
//                 },
//                 "href": "https://api.spotify.com/v1/users/jmperezperez",
//                 "id": "jmperezperez",
//                 "type": "user",
//                 "uri": "spotify:user:jmperezperez"
//             },
//             "is_local": false,
//             "primary_color": null,
//             "track": {
//                 "preview_url": "https://p.scdn.co/mp3-preview/d6ecf1f98d0b1fdc8c535de8e2010d0d8b8d040b?cid=d0b570bf62fe443095ddfe50858886e1",
//                 "available_markets": [
//                     "AR",
//                     "AU",
//                     "AT",
//                     "BE",
//                     "BO",
//                     "BR",
//                     "BG",
//                     "CA",
//                     "CL",
//                     "CO",
//                     "CR",
//                     "CY",
//                     "CZ",
//                     "DK",
//                     "DO",
//                     "DE",
//                     "EC",
//                     "EE",
//                     "SV",
//                     "FI",
//                     "FR",
//                     "GR",
//                     "GT",
//                     "HN",
//                     "HK",
//                     "HU",
//                     "IS",
//                     "IE",
//                     "IT",
//                     "LV",
//                     "LT",
//                     "LU",
//                     "MY",
//                     "MT",
//                     "MX",
//                     "NL",
//                     "NZ",
//                     "NI",
//                     "NO",
//                     "PA",
//                     "PY",
//                     "PE",
//                     "PH",
//                     "PL",
//                     "PT",
//                     "SG",
//                     "SK",
//                     "ES",
//                     "SE",
//                     "CH",
//                     "TW",
//                     "TR",
//                     "UY",
//                     "US",
//                     "GB",
//                     "AD",
//                     "LI",
//                     "MC",
//                     "ID",
//                     "JP",
//                     "TH",
//                     "VN",
//                     "RO",
//                     "IL",
//                     "ZA",
//                     "SA",
//                     "AE",
//                     "BH",
//                     "QA",
//                     "OM",
//                     "KW",
//                     "EG",
//                     "MA",
//                     "DZ",
//                     "TN",
//                     "LB",
//                     "JO",
//                     "PS",
//                     "IN",
//                     "BY",
//                     "KZ",
//                     "MD",
//                     "UA",
//                     "AL",
//                     "BA",
//                     "HR",
//                     "ME",
//                     "MK",
//                     "RS",
//                     "SI",
//                     "KR",
//                     "BD",
//                     "PK",
//                     "LK",
//                     "GH",
//                     "KE",
//                     "NG",
//                     "TZ",
//                     "UG",
//                     "AG",
//                     "AM",
//                     "BS",
//                     "BB",
//                     "BZ",
//                     "BT",
//                     "BW",
//                     "BF",
//                     "CV",
//                     "CW",
//                     "DM",
//                     "FJ",
//                     "GM",
//                     "GE",
//                     "GD",
//                     "GW",
//                     "GY",
//                     "HT",
//                     "JM",
//                     "KI",
//                     "LS",
//                     "LR",
//                     "MW",
//                     "MV",
//                     "ML",
//                     "MH",
//                     "FM",
//                     "NA",
//                     "NR",
//                     "NE",
//                     "PW",
//                     "PG",
//                     "WS",
//                     "SM",
//                     "ST",
//                     "SN",
//                     "SC",
//                     "SL",
//                     "SB",
//                     "KN",
//                     "LC",
//                     "VC",
//                     "SR",
//                     "TL",
//                     "TO",
//                     "TT",
//                     "TV",
//                     "VU",
//                     "AZ",
//                     "BN",
//                     "BI",
//                     "KH",
//                     "CM",
//                     "TD",
//                     "KM",
//                     "GQ",
//                     "SZ",
//                     "GA",
//                     "GN",
//                     "KG",
//                     "LA",
//                     "MO",
//                     "MR",
//                     "MN",
//                     "NP",
//                     "RW",
//                     "TG",
//                     "UZ",
//                     "ZW",
//                     "BJ",
//                     "MG",
//                     "MU",
//                     "MZ",
//                     "AO",
//                     "CI",
//                     "DJ",
//                     "ZM",
//                     "CD",
//                     "CG",
//                     "IQ",
//                     "LY",
//                     "TJ",
//                     "VE",
//                     "ET",
//                     "XK"
//                 ],
//                 "explicit": false,
//                 "type": "track",
//                 "episode": false,
//                 "track": true,
//                 "album": {
//                     "available_markets": [
//                         "AR",
//                         "AU",
//                         "AT",
//                         "BE",
//                         "BO",
//                         "BR",
//                         "BG",
//                         "CA",
//                         "CL",
//                         "CO",
//                         "CR",
//                         "CY",
//                         "CZ",
//                         "DK",
//                         "DO",
//                         "DE",
//                         "EC",
//                         "EE",
//                         "SV",
//                         "FI",
//                         "FR",
//                         "GR",
//                         "GT",
//                         "HN",
//                         "HK",
//                         "HU",
//                         "IS",
//                         "IE",
//                         "IT",
//                         "LV",
//                         "LT",
//                         "LU",
//                         "MY",
//                         "MT",
//                         "MX",
//                         "NL",
//                         "NZ",
//                         "NI",
//                         "NO",
//                         "PA",
//                         "PY",
//                         "PE",
//                         "PH",
//                         "PL",
//                         "PT",
//                         "SG",
//                         "SK",
//                         "ES",
//                         "SE",
//                         "CH",
//                         "TW",
//                         "TR",
//                         "UY",
//                         "US",
//                         "GB",
//                         "AD",
//                         "LI",
//                         "MC",
//                         "ID",
//                         "JP",
//                         "TH",
//                         "VN",
//                         "RO",
//                         "IL",
//                         "ZA",
//                         "SA",
//                         "AE",
//                         "BH",
//                         "QA",
//                         "OM",
//                         "KW",
//                         "EG",
//                         "MA",
//                         "DZ",
//                         "TN",
//                         "LB",
//                         "JO",
//                         "PS",
//                         "IN",
//                         "BY",
//                         "KZ",
//                         "MD",
//                         "UA",
//                         "AL",
//                         "BA",
//                         "HR",
//                         "ME",
//                         "MK",
//                         "RS",
//                         "SI",
//                         "KR",
//                         "BD",
//                         "PK",
//                         "LK",
//                         "GH",
//                         "KE",
//                         "NG",
//                         "TZ",
//                         "UG",
//                         "AG",
//                         "AM",
//                         "BS",
//                         "BB",
//                         "BZ",
//                         "BT",
//                         "BW",
//                         "BF",
//                         "CV",
//                         "CW",
//                         "DM",
//                         "FJ",
//                         "GM",
//                         "GE",
//                         "GD",
//                         "GW",
//                         "GY",
//                         "HT",
//                         "JM",
//                         "KI",
//                         "LS",
//                         "LR",
//                         "MW",
//                         "MV",
//                         "ML",
//                         "MH",
//                         "FM",
//                         "NA",
//                         "NR",
//                         "NE",
//                         "PW",
//                         "PG",
//                         "WS",
//                         "SM",
//                         "ST",
//                         "SN",
//                         "SC",
//                         "SL",
//                         "SB",
//                         "KN",
//                         "LC",
//                         "VC",
//                         "SR",
//                         "TL",
//                         "TO",
//                         "TT",
//                         "TV",
//                         "VU",
//                         "AZ",
//                         "BN",
//                         "BI",
//                         "KH",
//                         "CM",
//                         "TD",
//                         "KM",
//                         "GQ",
//                         "SZ",
//                         "GA",
//                         "GN",
//                         "KG",
//                         "LA",
//                         "MO",
//                         "MR",
//                         "MN",
//                         "NP",
//                         "RW",
//                         "TG",
//                         "UZ",
//                         "ZW",
//                         "BJ",
//                         "MG",
//                         "MU",
//                         "MZ",
//                         "AO",
//                         "CI",
//                         "DJ",
//                         "ZM",
//                         "CD",
//                         "CG",
//                         "IQ",
//                         "LY",
//                         "TJ",
//                         "VE",
//                         "ET",
//                         "XK"
//                     ],
//                     "type": "album",
//                     "album_type": "album",
//                     "href": "https://api.spotify.com/v1/albums/2usKFntxa98WHMcyW6xJBz",
//                     "id": "2usKFntxa98WHMcyW6xJBz",
//                     "images": [
//                         {
//                             "height": 640,
//                             "url": "https://i.scdn.co/image/ab67616d0000b2738b7447ac3daa1da18811cf7b",
//                             "width": 640
//                         },
//                         {
//                             "height": 300,
//                             "url": "https://i.scdn.co/image/ab67616d00001e028b7447ac3daa1da18811cf7b",
//                             "width": 300
//                         },
//                         {
//                             "height": 64,
//                             "url": "https://i.scdn.co/image/ab67616d000048518b7447ac3daa1da18811cf7b",
//                             "width": 64
//                         }
//                     ],
//                     "name": "Glenn Horiuchi Trio / Gelenn Horiuchi Quartet: Mercy / Jump Start / Endpoints / Curl Out / Earthworks / Mind Probe / Null Set / Another Space (A)",
//                     "release_date": "2011-04-01",
//                     "release_date_precision": "day",
//                     "uri": "spotify:album:2usKFntxa98WHMcyW6xJBz",
//                     "artists": [
//                         {
//                             "external_urls": {
//                                 "spotify": "https://open.spotify.com/artist/272ArH9SUAlslQqsSgPJA2"
//                             },
//                             "href": "https://api.spotify.com/v1/artists/272ArH9SUAlslQqsSgPJA2",
//                             "id": "272ArH9SUAlslQqsSgPJA2",
//                             "name": "Glenn Horiuchi Trio",
//                             "type": "artist",
//                             "uri": "spotify:artist:272ArH9SUAlslQqsSgPJA2"
//                         }
//                     ],
//                     "external_urls": {
//                         "spotify": "https://open.spotify.com/album/2usKFntxa98WHMcyW6xJBz"
//                     },
//                     "total_tracks": 8
//                 },
//                 "artists": [
//                     {
//                         "external_urls": {
//                             "spotify": "https://open.spotify.com/artist/272ArH9SUAlslQqsSgPJA2"
//                         },
//                         "href": "https://api.spotify.com/v1/artists/272ArH9SUAlslQqsSgPJA2",
//                         "id": "272ArH9SUAlslQqsSgPJA2",
//                         "name": "Glenn Horiuchi Trio",
//                         "type": "artist",
//                         "uri": "spotify:artist:272ArH9SUAlslQqsSgPJA2"
//                     }
//                 ],
//                 "disc_number": 1,
//                 "track_number": 2,
//                 "duration_ms": 358760,
//                 "external_ids": {
//                     "isrc": "USB8U1025969"
//                 },
//                 "external_urls": {
//                     "spotify": "https://open.spotify.com/track/6hvFrZNocdt2FcKGCSY5NI"
//                 },
//                 "href": "https://api.spotify.com/v1/tracks/6hvFrZNocdt2FcKGCSY5NI",
//                 "id": "6hvFrZNocdt2FcKGCSY5NI",
//                 "name": "Endpoints",
//                 "popularity": 0,
//                 "uri": "spotify:track:6hvFrZNocdt2FcKGCSY5NI",
//                 "is_local": false
//             },
//             "video_thumbnail": {
//                 "url": null
//             }
//         },
//         {
//             "added_at": "2015-01-15T12:41:10Z",
//             "added_by": {
//                 "external_urls": {
//                     "spotify": "https://open.spotify.com/user/jmperezperez"
//                 },
//                 "href": "https://api.spotify.com/v1/users/jmperezperez",
//                 "id": "jmperezperez",
//                 "type": "user",
//                 "uri": "spotify:user:jmperezperez"
//             },
//             "is_local": false,
//             "primary_color": null,
//             "track": {
//                 "preview_url": "https://p.scdn.co/mp3-preview/7f3abc300bd3bf49a326135e41a871c066f88fba?cid=d0b570bf62fe443095ddfe50858886e1",
//                 "available_markets": [],
//                 "explicit": false,
//                 "type": "track",
//                 "episode": false,
//                 "track": true,
//                 "album": {
//                     "available_markets": [],
//                     "type": "album",
//                     "album_type": "album",
//                     "href": "https://api.spotify.com/v1/albums/0ivM6kSawaug0j3tZVusG2",
//                     "id": "0ivM6kSawaug0j3tZVusG2",
//                     "images": [
//                         {
//                             "height": 640,
//                             "url": "https://i.scdn.co/image/ab67616d0000b27304e57d181ff062f8339d6c71",
//                             "width": 640
//                         },
//                         {
//                             "height": 300,
//                             "url": "https://i.scdn.co/image/ab67616d00001e0204e57d181ff062f8339d6c71",
//                             "width": 300
//                         },
//                         {
//                             "height": 64,
//                             "url": "https://i.scdn.co/image/ab67616d0000485104e57d181ff062f8339d6c71",
//                             "width": 64
//                         }
//                     ],
//                     "name": "All The Best (Spanish Version)",
//                     "release_date": "2007-01-01",
//                     "release_date_precision": "day",
//                     "uri": "spotify:album:0ivM6kSawaug0j3tZVusG2",
//                     "artists": [
//                         {
//                             "external_urls": {
//                                 "spotify": "https://open.spotify.com/artist/2KftmGt9sk1yLjsAoloC3M"
//                             },
//                             "href": "https://api.spotify.com/v1/artists/2KftmGt9sk1yLjsAoloC3M",
//                             "id": "2KftmGt9sk1yLjsAoloC3M",
//                             "name": "Zucchero",
//                             "type": "artist",
//                             "uri": "spotify:artist:2KftmGt9sk1yLjsAoloC3M"
//                         }
//                     ],
//                     "external_urls": {
//                         "spotify": "https://open.spotify.com/album/0ivM6kSawaug0j3tZVusG2"
//                     },
//                     "total_tracks": 18
//                 },
//                 "artists": [
//                     {
//                         "external_urls": {
//                             "spotify": "https://open.spotify.com/artist/2KftmGt9sk1yLjsAoloC3M"
//                         },
//                         "href": "https://api.spotify.com/v1/artists/2KftmGt9sk1yLjsAoloC3M",
//                         "id": "2KftmGt9sk1yLjsAoloC3M",
//                         "name": "Zucchero",
//                         "type": "artist",
//                         "uri": "spotify:artist:2KftmGt9sk1yLjsAoloC3M"
//                     }
//                 ],
//                 "disc_number": 1,
//                 "track_number": 18,
//                 "duration_ms": 176093,
//                 "external_ids": {
//                     "isrc": "ITUM70701043"
//                 },
//                 "external_urls": {
//                     "spotify": "https://open.spotify.com/track/2E2znCPaS8anQe21GLxcvJ"
//                 },
//                 "href": "https://api.spotify.com/v1/tracks/2E2znCPaS8anQe21GLxcvJ",
//                 "id": "2E2znCPaS8anQe21GLxcvJ",
//                 "name": "You Are So Beautiful",
//                 "popularity": 0,
//                 "uri": "spotify:track:2E2znCPaS8anQe21GLxcvJ",
//                 "is_local": false
//             },
//             "video_thumbnail": {
//                 "url": null
//             }
//         }
//     ],
//     "limit": 100,
//     "next": null,
//     "offset": 0,
//     "previous": null,
//     "total": 5
// }


// let symDifference = lst.filter(x => !lst2.includes(x)).concat(lst2.filter(x => !lst.includes(x)));

/* Order of Operations
 * Input Client ID & Secret
 * Submit
 * "[ISO Timestamp] Successfully aquired token"
 * Input both Playlist IDs (or links)
 * Submit individual ones
 * Click Diff Button
 * Run Intersection function `let intersection = arr1.filter(x => arr2.includes(x));`
 * css table intersection is green, default is red
 */


/* // Returns the lyrics of a song [not a "public" api]
(async () => {
	return await fetch ("https://spclient.wg.spotify.com/color-lyrics/v2/track/TRACK_ID?format=json&vocalRemoval=false", {
	method: "GET",
	headers: {
		"App-Platform": "WebPlayer",
		"Authorization": "Bearer TOKEN_HERE" // https://open.spotify.com/get_access_token
	}
})
})()
*/
