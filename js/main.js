window.onload = async () => {
    const playlistOneElement = document.querySelector('input#playlist-one');
    const submitOneElement = document.querySelector('input#submit-one');
    const playlistTwoElement = document.querySelector('input#playlist-two');
    const submitTwoElement = document.querySelector('input#submit-two');
    const tablesElement = document.querySelector('div#tables');
    const submitElement = document.querySelector('input#submit');
    const zeroErrorElement = document.querySelector('span#zero-error');
    const clientIdElement = document.querySelector('input#client-id');
    const clientSecretElement = document.querySelector('input#client-secret');

    playlistOneElement.disabled = true;
    submitOneElement.disabled = true;
    playlistTwoElement.disabled = true;
    submitTwoElement.disabled = true;

    let tokenTimeout = null;

    let accessToken = ""; // Initializing variables used in refreshToken
    let tokenType = "";

    /**
     * Returns a list of all tracks in a Spotify playlist
     */
    const getSpotifyPlaylist = async ( playlist_id ) => {
        let tracks = [];
        let playlistLength = 1; // Initial length set to 0 as playlist is unknown


    const startToken = async () => {
        let clientId = clientIdElement.value;
        let clientSecret = clientSecretElement.value;

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
                        if (res['error_description'] || res.error)
                            zeroErrorElement.innerText = `Error 400 : ${res['error_description'] || res.error}`;
                        throw "Unknown Error";
                    } catch (_) {
                        zeroErrorElement.innerText = "Error 400 : Bad Request";
                    }
                    return null;
                default:
                    zeroErrorElement.innerText = `Error ${req.status} : ${req.status}`;
                    return null;
            }
        }

        tokenTimeout = refreshToken();

        if (tokenTimeout) {
            playlistOneElement.disabled = false;
            submitOneElement.disabled = false;
            playlistTwoElement.disabled = false;
            submitTwoElement.disabled = false;
            tablesElement.removeAttribute('aria-disabled');
        }
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
