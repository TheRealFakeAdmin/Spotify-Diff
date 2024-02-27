window.onload = async () => {
    const playlistOneElement = document.querySelector('input#playlist-one');
    const submitOneElement = document.querySelector('input#submit-one');
    const playlistTwoElement = document.querySelector('input#playlist-two');
    const submitTwoElement = document.querySelector('input#submit-two');
    const tablesElement = document.querySelector('div#tables');
    const submitElement = document.querySelector('input#submit');
    const clientIdElement = document.querySelector('input#client-id');
    const clientSecretElement = document.querySelector('input#client-secret');

    let tokenTimeout = null;

    /**
     * Returns a partial list of tracks from a Spotify playlist
     */
    const spotifyTracksAPI = async ( playlist_id, { limit=50, offset, market, fields, additional_types } ) => {
        if (typeof playlist_id !== "string" || !(/^[0-9a-zA-Z]{22}$/).test(playlist_id)) throw "Not a valid Spotify ID";
        if (typeof accessToken !== "string" || accessToken.length === 0) throw "Not a valid access token";
        if (typeof tokenType !== "string" || tokenType.length === 0) throw "Not a valid token type";
        if (typeof market !== "undefined" && (typeof market !== "string" || !(/^[A-Z]{2}$/).test(market))) throw "Not a valid market";

        let fetchUrl = `https://api.spotify.com/v1/playlists/${playlist_id}/tracks?limit=${limit}`;
        if (offset) fetchUrl += `&offset=${offset}`;
        if (market) fetchUrl += `&market=${market}`;
        if (fields) fetchUrl += `&fields=${fields}`;
        if (additional_types) fetchUrl += `&additional_types=${additional_types}`;

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
            console.log(i, playlistLength);
            const res = await spotifyTracksAPI(playlist_id, {
                offset: i,
                fields: 'items(track(artists,href,id,name,uri,album(href,id,images,name,uri,artists,external_urls))),next,offset,total',
            });

            const newTracks = res.items;
            i = res.offset + res.items.length; // Next offset
            playlistLength = res.total;

            if (i === 0) break;

            tracks = tracks.concat(newTracks)
        }

        return tracks;
    }

    const startToken = async () => {
        let clientId = clientIdElement.value;
        let clientSecret = clientSecretElement.value;

        let accessToken = ""; // Initializing variables used in refreshToken
        let tokenType = "";

        /**
         * Starts the loop of refreshing tokens
         */
        const refreshToken = async () => {
            if (tokenTimeout) {
                clearTimeout(tokenTimout);
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

            const res = await req.json();
            
            const expiresMs = res["expires_in"] * 1000; // Converts expires_in from seconds to milliseconds
            
            tokenTimeout = setTimeout(refreshToken, expiresMs);
            
            accessToken = res["access_token"];
            tokenType = res["token_type"];

            return void(0);
        }

        await refreshToken();

        playlistOneElement.removeAttribute('disabled');
        submitOneElement.removeAttribute('disabled');
        playlistTwoElement.removeAttribute('disabled');
        submitTwoElement.removeAttribute('disabled');
        tablesElement.removeAttribute('aria-disabled');
    }

    submitElement.addEventListener("click", startToken);
}



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
