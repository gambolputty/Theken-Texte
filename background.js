var DEBUG = false;
if (!DEBUG) {
	console.log = function() {};
}


var ext_at_tabId = null;
var ard_meta = null;
var ard_config = null;
var zdf_meta = null;


function initExtension(platform_name, subt_url, video_meta, tabId){

    console.log("init extension");

    response_obj = {
    	platform: platform_name,
    	subtitle_url: subt_url,
    	meta_url: video_meta
    };

    // show plugin icon (page action);
    chrome.pageAction.show(tabId);
    ext_at_tabId = tabId;

    // add popup listener
    chrome.runtime.onMessage.addListener(function(msg, sender, response) {
        if ((msg.from === 'subtitle_popup') && (msg.subject === 'ard_subtitle_data')) {
            response(response_obj);
        }
    });

	// }
}

function webRequestListener(response){


	// prepare to execute extension; check if vars set

	// ARD
	if ((ard_meta !== null) && (ard_config !== null)) {

		// check if subtitle for video exists
		var xhr = new XMLHttpRequest();
		xhr.open("GET", ard_config, true);
		xhr.onreadystatechange = function() {
		  if (xhr.readyState == 4) {
		    var resp = JSON.parse(xhr.responseText);
		    if (resp.hasOwnProperty("_subtitleUrl")) {
		    	initExtension("ard", resp._subtitleUrl, ard_meta, response.tabId);
		    }else{
		    	console.log("Sola & media url found, but no subtitle url in video config.");
		    }
		    ard_meta = null;
		    ard_config = null;
		  }
		};
		xhr.send();
		chrome.webRequest.onHeadersReceived.removeListener(webRequestListener);
        return;
    // ZDF
	}else if (zdf_meta !== null) {

		// check subtitle and meta info
		var xhr = new XMLHttpRequest();
		xhr.open("GET", zdf_meta, true);
		xhr.onreadystatechange = function() {
		  if (xhr.readyState == 4) {
		    var resp = xhr.responseXML;
		    var subtitle_node = resp.getElementsByTagName("video")[0].getElementsByTagName("caption")[0];
		    if (subtitle_node) {
			    var subtitle_url = subtitle_node.getElementsByTagName("url")[0].textContent;
		    	initExtension("zdf", subtitle_url, zdf_meta, response.tabId);
		    }else{
		    	console.log("Error: Couldn't get ZDF Meta.");
		    }
		    zdf_meta = null;
		  }
		};
		xhr.send();
		chrome.webRequest.onHeadersReceived.removeListener(webRequestListener);
        return;
	}

	// if vars not set, parse url

    var match_ard_url = response.url.match(/(ardmediathek|ard|tagesschau|daserste)\.de\/play\/(media|sola)\/\d{4,}.*/i);
    var match_zdf_url = response.url.match(/zdf\.de\/ZDFmediathek\/xmlservice\/web\/(beitragsDetails).*/i);

     // ARD
    if (match_ard_url !== null) {
		switch(match_ard_url[2]) {
		    case "sola":
				ard_meta = response.url;
        		console.log("ARD Sola url found!");
		    	break;
	   	    case "media":
	   			ard_config = response.url;
	   			console.log("ARD Media url found!");
	   	    	break;
		}
    // ZDF
    }else if (match_zdf_url !== null) {
    	if (match_zdf_url[1] == "beitragsDetails") {
			zdf_meta = response.url;
    		console.log("ZDF Meta url found!");
    	}
    }

}

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab){

	console.log("onUpdated");

	// hide plugin icon

	// if (ext_at_tabId !== tabId) {
	// 	chrome.pageAction.hide(tabId);
	// 	ext_at_tabId = null;
	// 	console.log("icon removed");
	// }

	chrome.webRequest.onHeadersReceived.addListener(webRequestListener, {
		urls: ["*://*.ardmediathek.de/*", "*://*.ard.de/*", "*://*.tagesschau.de/*", "*://*.daserste.de/*",
			   "*://*.zdf.de/*"]
		},['responseHeaders']
	);

});