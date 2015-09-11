
var DEBUG = false;

if (DEBUG) {
	// clear local storage:
	chrome.storage.local.clear(function(){ console.log("local storage cleared") })
}
if(!DEBUG){
	// hide console commends
	console.log = function() {};
}


/* ======================================================= */
/* Begin popup script
/* ======================================================= */

var speaker_index = Array("reserved");
var speaker_label = "SprecherIn ";

function updateSpeakerIndex(speaker){
    var found = jQuery.inArray(speaker, speaker_index);
    if (found == -1) { // append if not found
        speaker_index.push(speaker);
    }
}

function parseNode(node, speaker_attr){
    var result = []
    var node_content = node.contents();
    var curr_speaker = node.attr(speaker_attr);

    // node types: 1 = element node, 3 = text node
    $.each(node_content, function(){

        // element node found
        if (this.nodeType === 1) {

            if ($(this).prop("localName") == "br") { return } // skip if line break

            // recursive
            var new_item = parseNode($(this), speaker_attr);
            if (new_item.length == 1) {
                result.push( new_item[0] );
            }else{
                console.log("Error: too many children!");
            }

        // text node found
        }else if(this.nodeType === 3) {

            if ( $.trim($(this).text()) == "") { return; } // skip if no text

            var new_item = {
                "s": curr_speaker,
                "t": $(this).text()
            };
            
            result.push(new_item); 

        }else{
            console.log("Weird node type found: ", $(this));
        }
    });
    return result;
}

function parseXml(xml, parent_node, speaker_attr) {
    var text_content = "";
    var srt_content = "";
    var prev_speaker;
    var srt_node_index = 1;

    $(xml).find(parent_node).each(function(node_index) {

        if ( $.trim($(this).text()) == "." || $.trim($(this).text()) == "") { return; }

        var begin = $(this).attr("begin");
        var end = $(this).attr("end");
        var children = parseNode( $(this), speaker_attr);

        if (node_index != 0 && $.trim(srt_content).length != "") srt_content += "<br/>";
	    srt_content += srt_node_index + "</br>";
        srt_content += begin + " --> " + end + "</br>";
        if ($.trim(srt_content.length) != "") srt_node_index += 1;

        /*
        -> interate through parsed node result
        -> fill "text_content" & "srt_content"
        1. speaker can be:
                1.1. new speaker
                1.2. previous speaker -> can be "undefined" or *name of prev. speaker*
                1.4. not at all applied - > "undefined"
                        -> Sometimes the first node has no speaker;
                        -> apply global speaker then
        */
        // console.log(children);
        $.each(children, function(child_index) {

            // fill "text_content"

            // retrieving a variable with object(s)
            var curr_speaker = this.s;
            var text = this.t;

            // if curr_speaker is "undefined"
            if (!curr_speaker) {
                // 1. and first node is present
                if (node_index == 0) {
                    // 2. apply global speaker
                    updateSpeakerIndex("global_s");
                }else{
                    // otherwise curr_speaker == prev_speaker
                    curr_speaker = prev_speaker;
                }
            }

            if(curr_speaker != prev_speaker) {
                // new speaker found
                updateSpeakerIndex(curr_speaker);
                var curr_speaker_i = speaker_index.indexOf(curr_speaker);
                if (node_index != 0 && $.trim(text_content).length != "") text_content += "<br/><br/>";
                text_content += '<span contenteditable="true" class="speaker speaker'+curr_speaker_i+'">'+speaker_label+curr_speaker_i+':</span><br/>';
            }


            var all_child_keys = []
            var node_is_uneven = false;
            for (var i = children.length - 1; i >= 0; i--) {
                all_child_keys.push(children[i]["s"]);
            }
            for (var i = children.length - 1; i >= 0; i--) {
                if (children[0]["s"] != children[i]["s"]) {
                    node_is_uneven = true;
                }
            }

            if ( (children.length > 1) &&
                 (node_is_uneven == true)
                ) {
                srt_content += "― ";
            };

            text_content += text + " ";
            srt_content += text + "<br/>";
            prev_speaker = curr_speaker;

        });
        
    });

    return [text_content, srt_content];
}

function executeData(platform, xml, video_title, subtitle_url){

	/*
	speaker attributes:
	    ARD: "style"
	    ZDF: "tts:color"
	
	*/

	var xml_to_string = (new XMLSerializer()).serializeToString(xml);

	switch (platform) {
		case "ard":
			parent_node = "p";
			speaker_attr = "style";		
		  	break;
		case "zdf":
			parent_node = "p";
			speaker_attr = "tts:color";		
		  	break;
	}


	result = parseXml(xml, parent_node, speaker_attr);
	var text_content = result[0];
	var srt_content = result[1];
	var container = $("#popup .content");

	if(video_title) {
		$("h1#title").text(video_title).fadeIn("fast");
	}
	container.find(".text").html(text_content);
	container.find(".srt").html(srt_content);
	container.find(".xml").append( "<xmp>" + xml_to_string + "</xmp>");
	var source_link = '<a href="'+subtitle_url+'" target="_blank">hier</a>';
	$("#popup .source").append( "Quelle der Untertitel: " + source_link + ".");

	// attach events

	// toolbar menu
	$("#popup .toolbar input[name=radio_format]:radio").change(function () {
		var curr = $(this).val();
		if ( !$("#popup .content ." + curr).is(":visible") ) {
			$("#popup .content div").hide(0,function(){
				if ($(this).hasClass(curr)) {
					$(this).fadeIn("fast");
					$("#copy-button").attr("data-target", curr);
				};
			})
		}

	})
	// copy to clipboard button
	$("#copy-button").click(function(event){
		if (window.getSelection) {
			window.getSelection().removeAllRanges();
		}

		var current_tab_node = document.querySelector("#popup .content > ." + $(this).attr("data-target") );  
		var range = document.createRange();  
		range.selectNode(current_tab_node);  
		window.getSelection().addRange(range);  

		try {  
			// Now that we've selected the anchor text, execute the copy command  
			var successful = document.execCommand('copy');  
			var msg = successful ? 'successful' : 'unsuccessful';  
			if (msg == "successful") {
				$(this).prev(".copy-msg").text($(this).attr("data-target") + " kopiert").fadeIn().delay(2000).fadeOut();
			};
		} catch(err) {  
			console.log('Oops, unable to copy');  
		}  
		  
		// Remove the selections - NOTE: Should use   
		// removeRange(range) when it is supported  
		window.getSelection().removeAllRanges();  

	});
	// open in new window button
	$("#newwindow-button").click(function(){
		chrome.tabs.create({"url": chrome.extension.getURL("popup.html?window=full")});
	});
	// speaker on change input
	document.addEventListener("keydown", function (event) {
		var esc = event.which == 27,
		nl = event.which == 13,
		el = $(event.target),
		data = {};

		if (el.hasClass("speaker")) {
			if (esc) {
	      // restore state
	      document.execCommand("undo");
	      el.blur();
	  } else if (nl) {
	      // save
	      var class_list = el.attr("class").split(/\s+/);
	      var speaker_to_update = el.attr("class").match(/speaker\d+/)[0];
	      $("#popup .content .text ." + speaker_to_update).not(el).text( el.text() );

	      el.blur();
	      event.preventDefault();
	  }
	}
	}, true);

	// show body
	if ($("body").hasClass("loading")) {
		$("body").removeClass("loading").find("#popup").hide().fadeIn("fast");
	}


}

function buildData(data) {
	// data: meta_url, config_url

	var subtitle_url = data.subtitle_url;
	if (data.platform == "ard") {
		if (!/ardmediathek\.de/g.test(subtitle_url)) {
			subtitle_url = "http://www.ardmediathek.de" + subtitle_url;
		}
	}

	var meta_url = data.meta_url;
	var storage_label = subtitle_url;

	// handle storage
	chrome.storage.local.get(storage_label, function(obj) {

		// if object already in storage -> just append
		if (obj[storage_label]) {
			executeData(data.platform, $.parseXML(obj[storage_label]["xml_tree"]), obj[storage_label]["video_title"], obj[storage_label]["subtitle_url"]);
			console.log(storage_label + " ist bereits im Storage!");
		}else{
			// if not, get data
			var xml_response, video_title;

			$.ajax({
				url: subtitle_url,
				dataType: "text"
			})
			.done(function( response ) {
				xml_response = response;

				if (data.platform == "ard") { var meta_datatype = "json"; }
				else if(data.platform == "zdf") { var meta_datatype ="text"; }

				$.ajax({
					url: meta_url,
					dataType: meta_datatype
				})
				.done(function( response ) {
					if (data.platform == "ard"){
						if (response.hasOwnProperty("metadata")) {
							video_title = response.metadata.title;
						}						
					}else if(data.platform == "zdf") {
						var resp_xml = $.parseXML(response);
						video_title = $(resp_xml).find("video details originChannelTitle").text() + " – " + $(resp_xml).find("video information title").text();
					}
				})
				.fail(function(jqXHR, textStatus, errorThrown){
					console.log("Error: couldn't get meta info.");
					console.log(jqXHR, textStatus, errorThrown);
				})
				.always(function(){

					// append Data to DOM
					executeData(data.platform, $.parseXML(xml_response), video_title, subtitle_url);

					// save to local storage
	    			var new_obj = {};
	    			new_obj[storage_label] = {
	    					"xml_tree": xml_response,
	    					"video_title": video_title,
	    					"subtitle_url": subtitle_url
	    				};
	    			chrome.storage.local.set( new_obj, function(){
	    				console.log(storage_label + " wurde im Storage gespeichert.");
	    			});	
				});

    		})
    		.fail(function(jqXHR, textStatus, errorThrown){
    			console.log("Error: no subtitle xml returned:");
    			console.log(jqXHR, textStatus, errorThrown);
    		});

		}

	});
	
}

$(document).ready(function () {

	chrome.runtime.sendMessage({
		from: 'subtitle_popup',
		subject: 'ard_subtitle_data'
	   }, buildData);

    if (window.location.search === "?window=full") {
    	console.log("Window mode.");
    	$("html, body").css({
    		width: '100%',
    		height: 'auto'
    	});
    	$("#newwindow-button").hide();
    }else{
    	console.log("Popup mode.");
    }

});
