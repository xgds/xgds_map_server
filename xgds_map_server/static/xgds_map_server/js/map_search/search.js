//__BEGIN_LICENSE__
// Copyright (c) 2015, United States Government, as represented by the
// Administrator of the National Aeronautics and Space Administration.
// All rights reserved.
//
// The xGDS platform is licensed under the Apache License, Version 2.0
// (the "License"); you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// http://www.apache.org/licenses/LICENSE-2.0.
//
// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.
//__END_LICENSE__


function setMessage(message){
    $("#message").text(message);
}

function doSearch(event) {
    var theForm = this.$("#form-search");
    var postData = theForm.serializeArray();
    postData.push({'name':'modelClass', 'value': imageModel});
    setMessage("Searching..."); //set message (TODO) 
    event.preventDefault();
    $.ajax({
        url: '/xgds_map_server/doMapSearch',
        dataType: 'json',
        data: postData,
        success: $.proxy(function(data) {
            if (_.isUndefined(data) || data.length === 0){
                setMessage("None found.");
            } else {
            	imageSetsArray = data;
            	theDataTable.fnClearTable();
            	theDataTable.fnAddData(data);
                setMessage("");
                app.vent.trigger("mapSearch:found", data); 
            }
        }, this),
        error: $.proxy(function(data){
            app.vent.trigger("mapSearch:clear");
//            this.searchResultsView.reset();
            setMessage("Search failed.")
        }, this)
      });
}

/*
 * Construct the search view
 */
function constructSearchView(){
	this.selectedModel = newModel;
    var templateName = '#template-' + this.selectedModel;
    this.searchFormView = new app.views.SearchFormView({template:templateName})
    this.searchFormRegion.show(this.searchFormView);
    this.$("#form-"+this.selectedModel).on('submit', function(event){
        event.preventDefault();
    });
}

/*
 * Construct the item view
 */
function constructImageView(json, viewPage) {
	viewPage = typeof viewPage !== 'undefined' ? viewPage : false;
	var rawTemplate = $('#template-image-view').html();
	var compiledTemplate = Handlebars.compile(rawTemplate);
	
	// append additional fields to json object to pass to handlebar
	json.imageName = json['name'];
	json.imagePath = json['raw_image_url'];
	json.imageUrl = json['view_url'];
	json.STATIC_URL = STATIC_URL;
	json.acquisition_time = getLocalTimeString(json['acquisition_time'], json['acquisition_timezone']);
	
	var newDiv = compiledTemplate(json);
	var imageViewTemplate = $(newDiv);
	
	// callbacks
	hookEditingPosition(imageViewTemplate);
	onUpdateImageInfo(imageViewTemplate);
	activateButtons(imageViewTemplate);
	
	if (!viewPage){
	    onDelete(imageViewTemplate);
	    onNextOrPrev(imageViewTemplate);
	}
	
	// append the div to the container and packery.
	var newEl;
	if (!viewPage){
	    newEl = $container.append(imageViewTemplate);
	} else {
	    newEl = $container.prepend(imageViewTemplate);
	}
	// pin the packery elem.
	if (!viewPage){
	    newEl.find(".pinDiv").click(function(event){clickPinFunction(event)});
	    $container.packery( 'appended', imageViewTemplate);
	    makeChildrenResizable($container, imageViewTemplate);
	}
	// set the loading image to be displayed when main img is loading
	imageViewTemplate.find(".display-image").load(function() {
		// set dimensions of loading image
		var width = imageViewTemplate.find(".display-image").width();
		var height = imageViewTemplate.find(".display-image").height();
		imageViewTemplate.find(".loading-image").width(width);	
		imageViewTemplate.find(".loading-image").height(height);
		imageViewTemplate.find(".loading-image").hide();
	});
	setChangedPosition(0, imageViewTemplate);
	
	//add the notes if it does not exist
	var notes_content_div = imageViewTemplate.find("#notes_content");
	var notes_table = undefined;
	if ($(notes_content_div).is(':empty')){
	    // the first time we want to fill it in
	    notes_table = $.find("table#notes_list");
	    var notes_input_div = $.find("#notes_input");

	    var new_input_div = $(notes_input_div).hide();
	    $(notes_content_div).append(new_input_div);
	    
	    var new_table_div = $(notes_table);
	    $(notes_content_div).append(new_table_div);
	    $(new_table_div).removeAttr('hidden');
	    $(new_table_div).show();
	    
	    var taginput = $(new_input_div).find('.taginput');
	    initializeInput(taginput);
	    hookNoteSubmit();
	    
	} else {
	    notes_table = imageViewTemplate.find("table#notes_list");
	}
	
	initializeNotesReference(imageViewTemplate, json['app_label'], json['model_type'], json['id'], json['creation_time']);
	getNotesForObject(json['app_label'], json['model_type'], json['id'], 'notes_content', $(notes_table));
}
