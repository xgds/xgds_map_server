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


app.views.MapBoundedSearchView = Marionette.View.extend({
    template: '#template-search',
    events: {
        'click #getSearchFormButton': function() {this.setupSearchForm(true, true)},
        'click #doSearch': 'doSearch',
        'click #clearFilter': 'clearFilter',
        'click #doSaveSearch': 'openSaveDialog',
    },
    regions: {
    	modelChoiceRegion: '#modelChoiceDiv'
    },
    addExtraRegions: function() {
    	// add regions that should exist after attaching.  
    	// This is odd because we use the same views for embedded searches (ie within planner)
    	// and top level searches on their own pages.
    	var searchResultsDiv = this.$el.find('#searchResultsDiv');
    	if (searchResultsDiv.length == 0){
    		searchResultsDiv = $('#searchResultsDiv');
    	}
    	this.addRegion('searchResultsRegion', {el: searchResultsDiv});
    	
    	var searchFormDiv = this.$el.find('#searchFormDiv');
    	if (searchFormDiv.length == 0){
    		searchFormDiv = $('#searchFormDiv');
    	}
    	this.addRegion('searchFormRegion', { el: searchFormDiv});

    },
    initialize: function(options) {
    	this.options = options || {};
    	this.searchableModels = [];
    	var theKeys = app.options.searchModelsKeys;
    	if (!_.isUndefined(theKeys)) {
			for (var i = 0; i < theKeys.length; i++) {
				if (!_.isUndefined(app.options.searchModels[theKeys[i]].search_form_class)) {
					this.searchableModels.push(theKeys[i]);
				}
			}
		}
    	this.viewRegionDef = false;
    	if (options.template !== undefined){
    		this.template = options.template;
    	}
    	if (options.viewRegion !== undefined && options.viewRegion !== false){
    		this.viewRegion = true;
    	} else {
    		this.viewRegion = false;
    	}
        this.hideModelChoice = options.hideModelChoice;
        this.preselectModel = app.options.modelName;
        Handlebars.registerHelper('modelSelected', function( input, modelName ){
        	return input === modelName ? 'selected' : '';
        });

        var context = this;
        app.vent.on('search:doTimeSearch', function(time) {
        	context.timeSearch = true;
        	context.doTimeSearch(time);
        });
        app.vent.on('search:undoTimeSearch', function(time) {
        	context.timeSearch = false;
        	context.undoTimeSearch(time);
		});
		

		app.vent.on("map:moveend", function (extents) {
			this.getData(extents);
		}.bind(this));
		
		
	},
	getData: function(extents) {
		$.ajax({
			url: '/xgds_map_server/mapBoundedSearch/',
			contentType : 'application/json',
			type : 'POST',
			data: JSON.stringify({
				"geography": extents,
				"models": ["Event", "Sample", "Image", "Message"]
			}),
            success: function (data) {
				this.searchResultsView.data = data.results;
				this.searchResultsView.columnHeaders = data.columns;
				this.searchResultsView.setupDatatable(data.results);
				this.searchResultsView.filterDatatable();
			}.bind(this),
		});
	},
    templateContext: function() {
    	var data = {searchModels: this.searchableModels,
    				preselectModel: this.preselectModel,
    				hideModelChoice: this.hideModelChoice
    	};
    	return data;
    },
    onAttach: function() {
    	this.addExtraRegions();
        this.searchResultsView = new app.views.SearchResultsView({template:'#template-search-results',
        														  viewRegion: this.viewRegion});
        app.searchResultsView = this.searchResultsView;
        this.showChildView('searchResultsRegion', this.searchResultsView);
        var runSearch = this.preselectModel != undefined && this.preselectModel != 'None';
        if (!runSearch){
        	var newModel = this.$("#searchModelSelector").val();
        	if (!_.isUndefined(newModel)) {
        		runSearch = true;
			}
		}
        this.setupSearchForm(runSearch);

		if (!_.isUndefined(this.selectedModel)) {
            this.$("#form-" + this.selectedModel).on('submit', function (event) {
                event.preventDefault();
            });
        }
    },
    onRender: function() {
        app.vent.trigger("repack");
    },
    setupSearchForm: function(runSearch, hideForm) {
    	if (_.isUndefined(hideForm)){
    		hideForm = false;
		}
    	var newModel = app.options.modelName;
    	if (newModel == undefined || newModel == 'None') {
    		newModel = this.$("#searchModelSelector").val();
    		if (_.isUndefined(newModel)) {
    			return;
			}
    	} else {
    		var dropdownModel = this.$("#searchModelSelector").val();
    		if (dropdownModel != undefined && dropdownModel != newModel){
    			newModel = dropdownModel;
    		}
    	}
    	if (!_.isUndefined(this.selectedModel)){
            if (newModel == this.selectedModel){
                return;
            }
        }
        this.clearMessage();
        app.vent.trigger("mapSearch:clear");
        if (this.searchResultsView != undefined){
        	this.searchResultsView.reset();
        }
        this.selectedModel = newModel;
        var templateName = '#template-' + this.selectedModel;
        this.searchFormView = new app.views.SearchFormView({template:templateName});
        var sfRegion = this.getRegion('searchFormRegion');

        sfRegion.show(this.searchFormView);
        sfRegion.$el.show();
        addDateTimePickers();

        var theForm = this.$("#form-" + this.selectedModel);
        theForm.on('submit', function (event) {
			event.preventDefault();
		});

        theForm.on('reset', function (event) {

		});

        var theModelMap = app.options.searchModels[newModel];
        if (theModelMap.searchInitMethods != undefined){
    		for (var i=0; i < theModelMap.searchInitMethods.length; i++){
    			$.executeFunctionByName(theModelMap.searchInitMethods[i], window, this.data);
    		}
    	}
        if (runSearch != undefined && runSearch == true){
        	if (this.timeSearch) {
        		this.doTimeSearch();
			} else {
                this.undoTimeSearch();
            }
		}

		app.vent.trigger('searchModelInitSSE', this.$("#searchModelSelector").val());
    },
    setupSaveSearchDialog: function() {

        var _this = this;
        
        if (this.dialog === undefined) {
        	this.saveSearchForm = $( "#save-search-dialog" ).find("form");
        	this.dialog = $( "#save-search-dialog" ).dialog({
        		autoOpen: false,
        		height: 375,
        		width: 550,
        		modal: true,
        		buttons: [{text: "Save",
        				   click: function() {
        					   _this.doSaveSearch()
        				   }
        				  },
        				  {text: "Cancel",
        				   click: function() {
        					   _this.dialog.dialog( "close" );
        				   }
        				  }],
        	    close: function(event, ui) {
        	    	_this.saveSearchForm[0].reset();
        	    }
        	});
        this.saveSearchForm.on( "submit", function( event ) {
            event.preventDefault();
            _this.doSaveSearch();
          });
        }
    },
    getFilterData: function() {
    	var formName = "#form-" + this.selectedModel;
    	var theForm = this.$(formName);
    	if (theForm.length == 0) {
    		theForm = $(formName);
		}
    	if (theForm.length == 1){
    		var result = theForm.serializeArray();
    		var newresult = {};
    		for (var i=0; i<result.length; i++){
    			if (result[i].value != ""){
    				newresult[result[i].name] = result[i].value;
    			}
    		}
    		return newresult;
    	}
    	return {};
    },
    buildFilter: function() {
    	var theForm = this.$("#form-"+this.selectedModel);
    	var postData = {};
    	var result = '';
    	if (theForm.length == 1){
    		postData = theForm.serializeArray();
    		for (var i=0; i<postData.length; i++){
        		var item = postData[i];
        		if ( item.value != '' &&
        			!item.name.endsWith('_operator') && 
        			 item.name.startsWith('form-0-')){
        			if (result != ''){
        				result += ',';
        			}
        			result += item.name.substring(7) + "|" + item.value;
        		}
        	}
    	}
    	
    	return result;
    },
	doTimeSearch: function(currentTime) {
		// set the min time and max time in the form
		var time = moment(currentTime);
		var theForm = $("#form-"+this.selectedModel);
		var dtPickers = theForm.find(".datetimepicker");
		for (var i=0; i<dtPickers.length; i++) {
			var input = dtPickers[i];
			if (input.id.indexOf('min') >= 0) {
				var earliertime = time.subtract(app.options.search_seconds_before, 's');
				$(input).val(earliertime.format());
			} else if (input.id.indexOf('max') >= 0) {
				var latertime = time.add(app.options.search_seconds_after, 's');
				$(input).val(latertime.format());
			}
		}
		var selects = theForm.find('select');
		for (var j=0; j<selects.length; j++){
			var select = selects[j];
			if (select.id.indexOf('timezone') >= 0){
				$(select).val(getTimeZone());
			}
		}
		this.doSearch();
	},
	undoTimeSearch: function() {
    	// clear the min time and max time in the form
		var theForm = $("#form-"+this.selectedModel);
		var dtPickers = theForm.find(".datetimepicker");
		for (var i=0; i<dtPickers.length; i++) {
			var input = dtPickers[i];
			if (input.id.indexOf('min') >= 0) {
				$(input).val('');
			} else if (input.id.indexOf('max') >= 0) {
				$(input).val('');
			}
		}
		this.doSearch();
	},
    doSearch: function(event) {
    	if (!_.isUndefined(event)){
    		event.preventDefault();
    	}

    	var filter_data = this.getFilterData();
    	var analytics_obj = {'page': document.title};
    	_.each(filter_data, function(value, key){
    		if (!(['csrfmiddlewaretoken', 'draw', 'columns'].includes(key))){
    			analytics_obj[key] = value;
			}
		})

		var analytics_source = 'search_load';
    	try {
			if (!_.isUndefined(event) && event.target.innerHTML == 'Filter') {
				analytics_source = 'search_filter';
			}
		} catch (e) {
			//pass
		}
    	analytics.trackAction(analytics_source, this.selectedModel, analytics_obj);

    	// this.searchResultsView.setupDatatable(this.selectedModel, undefined, filter_data);
    	this.setupSaveSearchDialog();

    	if ($('#advancedSearchModal').is(':visible')){
    		$('#advancedSearchModal').modal('hide');
		}
    },
	clearFilter: function(event) {
    	if (!_.isUndefined(event)){
    		event.preventDefault();
    	}
    	var theForm = $("#form-"+this.selectedModel);
    	if (theForm.length == 1){
    		theForm.trigger("reset");
    	}
    	// this.searchResultsView.setupDatatable(this.selectedModel, undefined, this.getFilterData());

    	if ($('#advancedSearchModal').is(':visible')){
    		$('#advancedSearchModal').modal('hide');
		}
    },
    openSaveDialog: function() {
    	this.setupSaveSearchDialog();
        this.dialog.dialog("open");
    },
    doSaveSearch: function() {
        var theForm = this.$("#form-"+this.selectedModel);
        var postData = theForm.serializeArray();
        postData.push({'name':'modelClass', 'value':app.options.searchModels[this.selectedModel].model});
        var searchName = this.saveSearchForm.find("#id_name").val();
        
        // TODO remove any lat long bounds for saving
        postData.push({'name':'mapSearchName', "value": searchName});
        postData.push({'name':'mapSearchDescription', "value": this.saveSearchForm.find("#id_description").val()});
        postData.push({'name':'mapSearchParent', "value": this.saveSearchForm.find("#id_parent").val()});
        $.ajax({
            url: '/xgds_map_server/saveMapSearch',
            dataType: 'json',
            data: postData,
            success: $.proxy(function(data) {
                this.dialog.dialog( "close" );
                this.setMessage("Search " + searchName + " saved");
            }, this),
            error: $.proxy(function(data){
                $( "#save-search-dialog" ).find("#saveSearchError").text("Search not saved.  Name is required.");
                this.setMessage("Search not saved.");
            }, this)
          });
    },
    setMessage: function(msg){
        this.$el.find('#message').text(msg);
    },
    clearMessage: function(msg){
        this.$el.find('#message').empty();
        this.$el.find('#message').append("<br/>");
    },
});

app.views.SearchFormView = Marionette.View.extend({
});

app.views.SearchDetailView = Marionette.View.extend({
    initialize: function(options) {
    	this.handlebarSource = '';
    	this.data = options.data;
    	this.selectedModel = options.selectedModel;
    	this.modelMap = app.options.modelMap;
    	this.setHandlebars(options.handlebarSource);
    	this.neverShown = true;
    	var context = this;
    	this.on('updateContents', _.debounce(context.updateContents, 500));
    	app.on('updateNewWindowButton', function(data) { context.updateNewWindowButton(data.type, data.pk)});
    },
    setHandlebars: function(handlebarSource){
    	if (handlebarSource != this.handlebarSource){
    		this.handlebarSource = handlebarSource;
    		this.template = Handlebars.compile(this.handlebarSource);
    	}
    },
    setData: function(data) {
    	this.data = data;
    },
    setModelMap: function(modelMap){
    	this.modelMap = modelMap;
    },
    onRender: function() {
    	if (!this.neverShown){
			this.trigger('updateContents');
		}
    },
    templateContext: function() {
    	return this.data;
    },
	updateNewWindowButton: function(model, pk) {
    	try {
	    	var new_window_btn = this.$el.parent().parent().find("#view-new-window-target");
	    	if (new_window_btn.length > 0){
	    		new_window_btn.attr("href","/xgds_map_server/view/" + model + "/" + pk );
	    	}
    	} catch (err) {
    		// gulp we do not always have a new window button
    	}
	},
    updateContents: function() {
    	this.updateNewWindowButton(this.selectedModel, this.data.pk);
    	if (this.modelMap.viewInitMethods != undefined){
    		for (var i=0; i < this.modelMap.viewInitMethods.length; i++){
    			$.executeFunctionByName(this.modelMap.viewInitMethods[i], window, this.data);
    		}
    	}
    },
    onAttach: function() {
    	if (this.neverShown){
	    	this.neverShown = false;
	    	this.updateContents();
	    	var context = this;
	    	$('.grid-stack-item').on('resizestop', function(event, ui) {
	    	    var element = event.target;
	    	    var found = $(event.target).find('#view-gridstack-item-content');
	    	    if (found.length > 0){
	    	    	if (context.modelMap.viewResizeMethod != undefined){
	    	    		context.handleResizeDetailView(found[0], context);
	    	    	}
	    	    }
	    	});
	    	$( window ).resize(function() {
	    		var found = $('#view-gridstack-item-content');
	    	    if (found.length > 0){
	    	    	if (context.modelMap.viewResizeMethod != undefined){
	    	    		context.handleResizeDetailView(found[0], context);
	    	    	}
	    	    }
			});
	    	$("#details_modal").resize(function() {
				var found = $('#details_modal_body');
				if (found.length > 0){
					if (context.modelMap.viewResizeMethod != undefined){
						context.handleResizeDetailView(found[0], context);
					}
				}
			});

	    	$("#ajax_prev_button").click(function(event) {
				context.selectPreviousAjax();
			});
			$("#ajax_next_button").click(function(event) {
				context.selectNextAjax();
				});
    	}
    },
    handleResizeDetailView: function(theDiv, context){
    	var functionName = context.modelMap.viewResizeMethod[0];
		$.executeFunctionByName(functionName, window, theDiv, context.data);
    },
    selectPreviousAjax: function() {
    	var modelName = this.data.type;
    	var modelMap = this.modelMap;
    	var url = '/xgds_map_server/prevJson/' + modelName + '/' + this.data.pk;
    	var context = this;
    	$.when($.get(url)).then(function(incomingData, status){
    		var data = _.object(modelMap.columns, incomingData);
    		context.setData(data);
        	context.render();
        	if (context.detailNotesView != undefined){
        		context.detailNotesView.setData(data);
        		context.detailNotesView.updateContents();
        	}
    	});
    },
    selectNextAjax: function() {
    	var modelName = this.data.type;
    	var modelMap = this.modelMap;
    	var url = '/xgds_map_server/nextJson/' + modelName + '/' + this.data.pk;
    	var context = this;
    	$.when($.get(url)).then(function(incomingData, status){
    		var data = _.object(modelMap.columns, incomingData);
    		context.setData(data);
        	context.render();
        	if (context.detailNotesView != undefined){
        		context.detailNotesView.setData(data);
        		context.detailNotesView.updateContents();
        	}
    	});
    }
});

/*
 * This is the view for the notes that go with objects found by search.
 */
app.views.SearchNotesView = Marionette.View.extend({
    initialize: function(options) {
    	this.data = options.data;
    	this.modelMap = app.options.modelMap;
    	this.modelName = options.modelName;
    	this.setupHandlebars();
    },
	templateContext: {show_on_map:show_on_map},
    setupHandlebars: function(){
    	if (this.template == undefined){
    		var url = '/xgds_core/handlebar_string/xgds_notes2/templates/handlebars/object-notes.handlebars';
    		var context = this;
    		$.ajax({
        	    async: false,
        	    url: url,
        	    success: function(handlebarSource, status){
        	    	context.handlebarSource = handlebarSource;
        	    	context.template = Handlebars.compile(handlebarSource);
        	    }
        	});
    	}
    },
    setData: function(data) {
    	this.data = data;
    	this.modelMap = app.options.modelMap;
    },
    updateContents: function() {
    	try {
    		xgds_notes.hideError(this.$el);
    		xgds_notes.initializeNotesReference(this.$el, this.data.app_label, this.data.model_type, this.data.pk, this.data[this.modelMap.event_time_field], this.data[this.modelMap.event_timezone_field]);
    		xgds_notes.getNotesForObject(this.data.app_label, this.data.model_type, this.data.pk, 'notes_content', this.$el.find('table.notes_list'));
    	} catch(err) {
    		// we don't always have notes.
    	}
    },
    render: function() {
        var appended = this.$el.empty().append(this.template(this.data));
    },
    onAttach: function() {
    	// change the id of the table ...
    	var notesList = this.$el.find('.notes_list');
    	notesList.attr('id', 'notes_list' + this.modelName);
    	xgds_notes.setupNotesUI(this.$el);
    	this.updateContents();
    },
    onRender: function() {
    	xgds_notes.setupNotesUI(this.$el);
    }
});

app.views.SearchResultsView = Marionette.View.extend({
	events: {
		'click #export-modal-btn': 'initializeExportData',
		'click #simple-search-btn': 'filterDatatable',
		'keydown [name="search-keyword"]': 'keywordKeydown',
		'keyup [name="search-keyword"]': 'keywordKeyup',
		'keydown .ss-container': 'handleEnterSubmit',
		'click #clear-search-btn-id': 'clearSearch',
		'click #keyword-dropdown-btn': function(){ this.generateQueryList("keyword") },
		'click #tags-dropdown-btn': function(){ this.generateQueryList("tag") },
		'click #ss-keyword-add-btn': function(){ this.addDropdownRow("keyword") },
		'click #ss-tags-add-btn': function(){ this.addDropdownRow("tag") },
		'keyup .ss-keyword-word-input': function(){ this.updateSearch("keyword") },
		'change .ss-keyword-word-select': function(){ this.updateSearch("keyword") },
		'change .ss-tags-word-select': function(){ this.updateSearch("tag") }
	},
	initialize: function() {
		this.modelMap = app.options.modelMap;
		this.selectedIds = [];
		this.firstLoad = true;
		this.fileType = 'CSV';
		this.keywordQuoteMode = false;
		this.keywordShiftMode = false;
		this.dropdownTagWidgets = 0;
		this.fitMap = true;
		this.time_control_search = false;
		this.today = true;
		this.setupSearchValues();
		if (!_.isUndefined(app.options.searchOptions)) {
			// app.searchOptions override any defaults
			Object.assign(this, app.options.searchOptions);
		}

		var context = this;
		app.on('forceDetail', function(data){
			var modelMap = context.lookupModelMap(data.type);
			context.forceDetailView(data, modelMap);
		});
	},
	setupSearchValues: function(){
		var defaultKeywordConnector = Cookies.get('defaultKeywordConnector');
		var defaultTagConnector = Cookies.get('defaultTagConnector');
		var nestTags = Cookies.get('nestTags');

		if (!_.isUndefined(defaultKeywordConnector)) this.defaultKeywordConnector = defaultKeywordConnector;
		else this.defaultKeywordConnector = "or";

		if (!_.isUndefined(defaultTagConnector)) this.defaultTagConnector = defaultTagConnector;
		else this.defaultTagConnector = "or";

		if (!_.isUndefined(nestTags)) this.nestTags = nestTags;
		else this.nestTags = false;
	},
	setupRegions: function() {
		var viewDiv = this.$el.find('#viewDiv');
		if (viewDiv.length == 0){
			viewDiv = $('#viewDiv');
		}
		this.addRegion('viewRegion', {el: viewDiv});
		var notesDiv = this.$el.find('#notesDiv');
		if (notesDiv.length == 0){
			notesDiv = $('#notesDiv');
		}
		if (notesDiv.length > 0) {
            this.addRegion('viewNotesRegion', {el: notesDiv});
        }
		
		
	},
	playbackListener: {
		lastUpdate: undefined,
		initialize: function() {
			//noop
		},
		doSetTime: function(currentTime){
			this.lastUpdate = currentTime;
		},
		start: function(currentTime){
			app.vent.trigger('search:doTimeSearch', currentTime);
		},
		update: function(currentTime){
			if (this.lastUpdate === undefined){
				this.doSetTime(currentTime);
				return;
			}
			var delta = currentTime.diff(this.lastUpdate);
			if (Math.abs(delta) >= 5000) {
				this.doSetTime(currentTime);
				app.vent.trigger('search:doTimeSearch', currentTime);
			}
		},
		pause: function() {
		}
	},
    onAttach: function() {
    	this.setupRegions();
    	var tagsInput = this.$el.find("#search-tags-id");
    	if (tagsInput.length == 0) {
    		tagsInput = $("#search-tags-id");
		}
		xgds_notes.initializeInput(tagsInput);
    	tagsInput.off('itemAdded');
		tagsInput.on('itemAdded', function(event) {
			if (event.item.name !== "or" && event.item.name !== "and"){
				var index = tagsInput.tagsinput('items').length;
				if (_.isUndefined(event.item.updated)){
					if (this.defaultTagConnector === "or"){
						tagsInput.tagsinput('add', {
							id: "or-" + index,
							name: 'or',
							className: 'connector',
							index: index
						});
					} else {
						tagsInput.tagsinput('add', {
							id: "and-" + index,
							name: 'and',
							className: 'connector',
							index: index
						});
					}
				}
			}
		}.bind(this));
		tagsInput.off('itemRemoved');
		tagsInput.on('itemRemoved', function(event) {
			if((event.item.name === "or" || event.item.name === "and") && event.item.index !== tagsInput.tagsinput('items').length){
				tagsInput.tagsinput('remove', tagsInput.tagsinput('items')[event.item.index-1]);
			}
		});
    	// hook up ajax reloading
    	var reloadIconName = '#reloadSearchResults';
    	var context = this;
    	$(reloadIconName).click(function() {
    		context.theDataTable.ajax.reload( null, false );
    	});
    	var todayCheckbox = $('#today');
    	if (todayCheckbox.length > 0){
    		if (! this.today) {
    			$('#today_div').hide();
			} else {
                todayCheckbox.click(function () {
                    context.theDataTable.ajax.reload(null, true);
                });
            }
    	}
    	$('#subscription').change(function () {
			if (this.checked) {
				app.vent.trigger('subscriptionChecked');
			} else {
				app.vent.trigger('subscriptionUnchecked');
			}
		});
		if ($('#subscription').length > 0) {
			app.vent.trigger("subscriptionButtonInit", $('#subscription'));
		}

    	if (this.time_control_search) {
    		var time_control_search = $('#time_control_search');
    		$('#time_control_search_div').css('visibility', 'visible');
    		time_control_search.click(function () {
    			var selected = time_control_search[0].checked;

    			if (selected) {
                    // add a listener for playback controller stop to set the start and end times based on current time and do the search
                    playback.addStopListener(context.handleTimeSearch);
                    playback.addListener(context.playbackListener);
                } else {
    				playback.removeListener(context.playbackListener);
                    playback.removeStopListener(context.handleTimeSearch);
                    app.vent.trigger('search:undoTimeSearch');
				}
			});
    		this.listenTo(app.vent, 'setTabRequested', function(tabId) {
    			var time_control_search = $('#time_control_search');
    			var selected = time_control_search[0].checked;
    			if (selected) {
					if (_.isEqual(tabId, 'search')) {
						// add a listener for playback controller stop to set the start and end times based on current time and do the search
						playback.addStopListener(context.handleTimeSearch);
						playback.addListener(context.playbackListener);
					} else {
						playback.removeListener(context.playbackListener);
						playback.removeStopListener(context.handleTimeSearch);
						app.vent.trigger('search:undoTimeSearch');
					}
				}
        	});
		}

    },
	handleTimeSearch: function(time) {
		app.vent.trigger('search:doTimeSearch', time);
	},
    buildEditableEntry: function(entry, index, columnType) {
    	entry['type'] = columnType;
		entry['data'] = function( row, type, val, meta ){
			return row[index];
		};
    },
    getEditableColumnDefs: function(columns, columnTitles, editableColumns){
    	var result = [];
    	if (!_.isUndefined(editableColumns)){
    		for (var i=0; i<columnTitles.length; i++){
    			var columnName = columns[i];
    			var entry = { label: columnTitles[i],
       		 		 		  name: columnName}
	            if ($.inArray(columnName, Object.keys(editableColumns)) > -1){
	            	this.buildEditableEntry(entry, i, editableColumns[columnName]);
				}
	            result.push(entry);
    		}
    	}
    	return result;
    },
    toTitleCase: function(str) {
    	return str.substr(0,1).toUpperCase()+str.substr(1);
    },
    getColumnDefs: function(displayColumns, modelMap, searchableColumns, editableColumns, unsortableColumns){
    	var context = this;
    	var result = [];
    	if (_.isUndefined(searchableColumns)) searchableColumns = [];
    	if (_.isUndefined(unsortableColumns)) unsortableColumns = [];

    	columnWidths = undefined;
    	if ('columnWidths' in modelMap) {
    		columnWidths = modelMap.columnWidths;
		}

    	for (var i = 0; i < displayColumns.length; i++){
    		var heading = displayColumns[i];
    		var dataIndex = modelMap.columns.indexOf(heading);
    		var columnDef = {};
    		columnDef['targets'] = i;
    		if (!_.isUndefined(columnWidths)) {
    			columnDef['width'] = columnWidths[i];
			}
    		if ($.inArray(heading, searchableColumns) > -1) columnDef['searchable'] = true;
    		if ($.inArray(heading, unsortableColumns) > -1) columnDef['orderable'] = false;

    		if (!_.isUndefined(editableColumns)){
    			if ($.inArray(heading, Object.keys(editableColumns)) > -1){
    				columnDef['className'] = 'editable';
    			}
    		}
    		if (this.columnTitles != undefined){
        		columnDef['title'] = this.columnTitles[i];
        	} else {
        		columnDef['title'] = this.toTitleCase(displayColumns[i]);
        	}
    		if (heading.toLowerCase().indexOf('zone') > -1) {
    			columnDef['render'] = function ( data, type, row ) {
					return getLocalTimeString(row[1], row[2], "z");
				};
    		} else if  (heading.toLowerCase().indexOf('time') > -1){
    			if (this.columnTitles.includes('TZ')) {
                    columnDef['render'] = function (data, type, row) {

                        return getLocalTimeString(row[1], row[2], "MM/DD/YY HH:mm:ss");
                    };
                } else {
    				columnDef['render'] = function (data, type, row) {
                        return getLocalTimeString(row[1], undefined, "MM/DD/YY HH:mm:ss");
                    };
				}
    		} else if (heading.toLowerCase().indexOf('thumbnail') > -1) {
    			columnDef['render'] = function(data, type, row){
					if (!_.isUndefined(data) && !_.isNull(data) && data != ''){
						var result = '<img width="100" src="' + data + '"';
						result += '">';
						return result;
					} else {
						return '';
					}
				};
    		} else if (heading.toLowerCase().indexOf('tag') > -1){
    			columnDef['className'] = 'tag_col editable';
				columnDef['render'] =  function(data, type, row) {
					if (!_.isUndefined(data) && !_.isNull(data) && data != ''){
						var result = "";
						for (var i = 0; i < data.length; i++) {
							result = result + '<span class="tag label label-info">' + data[i] + '</span> ';
						}
						return result;
					}
					return null;
				};
			} else if (heading.toLowerCase().indexOf('content_url') > -1) {
    			columnDef['render'] = function(data, type, row){
					if (!_.isUndefined(data) && !_.isNull(data) && data != ''){
						theObject = context.getObject(row, context);
						if (theObject.content_url != '') {
							result = '<a href="' + theObject.content_url + '" target="_blank">';
							if (theObject.content_thumbnail_url != '') {
								result += '<img src="' + theObject.content_thumbnail_url + '"';
								if (theObject.content_name != '') {
									result += 'alt="' + theObject.content_name +'"';
								}
								result += '">';
							} else if (theObject.content_name != ''){
								result += theObject.content_name;
							} else {
								result += "Link";
							}
							result += '</a>';
							return result;
						}
					}
					return '';
				};
    		} else if  (heading.toLowerCase().indexOf('content') > -1){
    			columnDef['className'] = 'content_col editable';
			} else if (heading.toLowerCase().indexOf('checkbox') > -1) {
				columnDef['orderable'] = false;
				columnDef['render'] = function (data, type, row) {
					var checkbox = document.createElement("input");
					checkbox.setAttribute("id", "checkbox_" + row[row.length - 1]);
					checkbox.setAttribute("type", "checkbox");
					checkbox.setAttribute("class", "check");

					var id = row[row.length - 1];  // used to be data.toString()
					if ((context.selectedIds.indexOf(id) > -1) || $('#pick_master').is(":checked")){
						if ($('#pick_master').is(":checked")) context.selectedIds.push(data);
						checkbox.setAttribute("checked", true);
					}

					return checkbox.outerHTML;
				}
			}

    		result.push(columnDef);
    	}
    	return result;
    },
    buildAjaxUrl: function(selectedModel) {
    	var url = '/xgds_map_server/view/' + selectedModel + '/';
    	return url;
	},
	convertResultsArray: function(data) {
		let newData = [];
		for (var i = 0; i < data.length; i++) {
			let segment = data[i];
			if (segment.type == "Image" || segment.type == "Sample") {
				segment.content = '<img src="' + segment.content + '" />';
			}
			// segment.time = moment.utc(segment.time).format("MM/DD/YY HH:mm:ss");
			if (_.isUndefined(segment.tags))
				segment.tags = "";
			newData.push([
				segment.type,
				segment.time,
				segment.content,
				segment.tags,
			]);
		}
		return newData;
	},
    constructDatatable: function(data) {
        $.fn.dataTable.moment(DEFAULT_TIME_FORMAT);
		$.fn.dataTable.moment("MM/DD/YY HH:mm:ss");
		
		// TODO: set column widths
        var dataTableObj = {
				data: this.convertResultsArray(this.data),
				columns: this.columnHeaders,
				columnDefs: [
					{width: "15%", targets: 0},
					{width: "25%", targets: 1},
					{width: "40%", targets: 2},
					{width: "20%", targets: 3},
				],
                autoWidth: true,
                stateSave: false,
                paging: true,
                pageLength: 10, 
                lengthChange: true,
                ordering: true,
                select: true,
                jQueryUI: false,
				scrollX: false,
				scrollY: false,
        };

		this.theDataTable = $(this.theTable).DataTable(dataTableObj);

		this.theDataTable.columns.adjust().draw();
		this.theDataTable.draw();

		// TODO: clean up this mess!
        // this.connectDoubleClickCallback();
        // this.connectSinglePickCallback();
        // this.connectMasterPickCallback();
        // this.connectSelectCallback();
        // this.connectDeselectCallback();
        // this.listenToTableChanges();
		
		this.filterMapData(this.data);
    },
	// Put the needed data for exporting into a hidden form
	initializeExportData: function(){
    	var _this = this;
    	var simpleSearchData = {};
    	$('.export-err').hide();
    	if ($('#pick_master').is(":checked")) {
    		if (this.selectedIds.indexOf("All") < 0)
				this.selectedIds.push("All");
		}

    	simpleSearchData["search"] = $('#search-keyword-id').val();
    	simpleSearchData["tags"] = $('#search-tags-id').val();
    	$('#rowIds').val(JSON.stringify(this.selectedIds));
    	$('#modelName').val(this.selectedModel);
    	$('#simpleSearchData').val(JSON.stringify(simpleSearchData));
    	$('#advancedSearchData').val(JSON.stringify(this.getFilterData()));
    	$('#filetype').val(this.fileType);
    	$('#nestTags').val(this.nestTags);
    	$('#connector').val($("#search-select-id").val());

    	$('label[name=fileType]').click(function(event) {
			$('#filetype').val($(event.target).attr('data'));
			_this.fileType = $(event.target).attr('data')
        });

    	if (this.selectedIds.length === 0) $('.export-err').show();
		else $('#exportModal').modal('show');
		analytics.trackAction('export_dialog', this.selectedModel, document.title);
	},
	// Filters the datatable when the search button is clicked
	filterDatatable: function() {
		// TODO: also search by tags!
		var keyword = $('#search-keyword-id').val().toLowerCase();
		if (keyword.length == 0) {
			// pass
		} else {
			let new_data = [];
			for (let i = 0; i < this.data.length; i++) {
				if (this.data[i].content.toLowerCase().search(keyword) !== -1) {
					new_data.push(this.data[i]);
				}
			}
			this.setupDatatable(new_data);
		}
	},
	// Clears the search values and returns the table back to normal
	clearSearch: function(){
		var keywordSearchId = $('#search-keyword-id');
		var tagSearchId = $('#search-tags-id');
		var searchSelectId = $('#search-select-id');
		keywordSearchId.val("");
		searchSelectId.val("or");
		tagSearchId.tagsinput('removeAll');
		this.setupDatatable(this.data);
	},
	// Checks that the last tag is not an and/or that is automatically added (if found, removes it)
	checkLastTag: function(){
		var tagsInput = $("#search-tags-id");
		var tags = tagsInput.tagsinput('items');
		if (tags.length > 0){
			if (tags[tags.length-1].name === "or" || tags[tags.length-1].name === "and") {
				tagsInput.tagsinput('remove', tags[tags.length-1]);
			}
		}
	},
	// Handles keydown events in the keyword input
	keywordKeydown: function(e){
		// Space key
		if (e.which === 32) {
			if (e.target.id === "search-keyword-id" && this.keywordQuoteMode === false) {
				e.preventDefault();
				var keywordInput = $("#search-keyword-id");

				if (this.defaultKeywordConnector === "or") keywordInput.val(keywordInput.val() + ' or ');
				else keywordInput.val(keywordInput.val() + ' and ');
            }
		}

		// Quotation key (requires that shift be held down as well)
		else if (e.which === 222 && this.keywordShiftMode === true){
			this.keywordQuoteMode = !this.keywordQuoteMode
		}

		// Shift key
		else if (e.which === 16) {
			if (this.keywordShiftMode === false) {
				this.keywordShiftMode = true;
            }
		}
	},
	// Handles keyup events in the keyword input
	keywordKeyup: function(e){
		// Shift key
		if (e.which === 16) {
			if (this.keywordShiftMode === true) {
				this.keywordShiftMode = false;
            }
		}
	},
	handleEnterSubmit: function(e){
		// TODO: Allow search on hitting the enter key
		// if(e.which === 13) {
		// 	this.filterDatatable();
		// }
	},
	// Decides how to handle updating the input from the dropdown by type
	updateSearch: function(type){
		var queryEditor, searchId;
		if (type === "keyword") {
			queryEditor = $('#keyword-query-editor');
			searchId = $('#search-keyword-id');
        }
		else {
			queryEditor = $('#tags-query-editor');
			searchId = $('#search-tags-id');
        }

		// Get all the input/select boxes in the search dropdown
		if (type === "keyword"){
			this.updateKeywordSearch(queryEditor, searchId);
		} else{
			this.updateTagSearch(queryEditor, searchId);
		}
    },
	// Updates the keyword search input from the dropdown inputs
	updateKeywordSearch: function(queryEditor, searchId){
		var words = [], connectors = [];
		queryEditor.find('.ss-keyword-word-input').each(function () { console.log(this); words.push(this.value) });
		queryEditor.find('select').each(function () { connectors.push(this.value) });

		// If we have only one word just add it, otherwise iterate through and update the main input
		if (connectors.length === 0) {
			searchId.val(words[0]);
        }

		else {
			var query = "";
			for (var i = 0; i < words.length; i++){
				if (i === words.length - 1) query = query + words[i];
				else if (words[i] === "") continue;
				else query = query + words[i] + " " + connectors[i] + " ";
			}

			searchId.val(query);
		}
	},
	// Updates the tag search input from the dropdown inputs
	updateTagSearch: function(queryEditor, searchId){
		var tagInput, tag = [];
		searchId.tagsinput('removeAll'); // Empty the main tag input

		// If there is only a single tag widget, just use that value
		if (this.dropdownTagWidgets === 1) {
			tagInput = $("#0-tags-dropdown-input");
			tag = tagInput.tagsinput('items');
			if (tag.length > 0){
				searchId.tagsinput('add', {
					id: tag[0].id,
					name: tag[0].name
				});
			}
        }

        // Otherwise we need to iterate through each input and select box and add the corresponding tag to the main input
		else {
			var connectors = [], idIndex;
			queryEditor.find('select').each(function () { connectors.push(this.value) });
			// (connectors.length * 2) + 1 is just getting the total number of selects and inputs
			for (var i = 0; i < (connectors.length * 2) + 1; i++){
				// Even index means its an input
				if (i % 2 === 0){
					tagInput = $("#" + i + "-tags-dropdown-input");
					tag = tagInput.tagsinput('items');
					if (tag.length > 0) {
						tag[0].updated = true;
						searchId.tagsinput('add', tag[0]);
                    }
				// Odd index means its a select box for choosing and/or
				} else {
					idIndex = Math.floor(i/2);
					if (connectors[idIndex] === "or"){
						searchId.tagsinput('add', {
							id: "or-" + i,
							name: "or",
							className: 'connector',
							index: i
						});
					}

					else if (connectors[idIndex] === "and"){
						searchId.tagsinput('add', {
							id: "and-" + i,
							name: "and",
							className: 'connector',
							index: i
						});
					}
				}
			}
		}

		searchId.tagsinput('refresh'); // Need to refresh the input after updating it via widget docs
	},
	// Retrieves the search value from either type as strings
	getSearchValue: function(type){
		var search = [];
		if (type === "keyword") {
			search = $('#search-keyword-id').val();
        }

        else {
			var tags = $("#search-tags-id").tagsinput('items'); // Gets every tag object and then we only want the name from that
			for (var i = 0; i < tags.length; i++) {
				search.push(tags[i].name);
			}

            if (search.length === 0){
				search = [""];
            }
		}
		return search;
	},
	// Removes the inputs from the correct dropdown
	deconstructSearchDropdown: function(type){
		if (type === "keyword") {
			$('#keyword-query-list-container').remove();
			$('#keyword-button-row-id').remove();
        } else {
			$('#tags-query-list-container').remove();
			$('#tag-button-row-id').remove();
        }
	},
	// Creates the list of inputs and select boxes to be inserted into the dropdown when opened
	generateQueryList: function(type){
		var dropdown, queryEditorBox, tagsInput;
		if (type === "keyword") {
			dropdown = $('#keyword-dropdown-menu');
			queryEditorBox = $('#keyword-query-editor');
        } else {
			dropdown = $('#tags-dropdown-menu');
			queryEditorBox = $('#tags-query-editor');
			tagsInput = $("#search-tags-id");
        }

        // If the dropdown is already visible, deconstruct the inputs and hide it.
		if (dropdown.is(':visible')) {
			this.deconstructSearchDropdown(type);
			dropdown.hide();
			if (type === "tag") {
				this.dropdownTagWidgets = 0;
            }
        }

        // Else, create the inputs, insert them into the dropdown, and display it.
		else{
			var search = this.getSearchValue(type);
			if (search.indexOf(' ') >= 0 && type === "keyword") {
				search = search.match(/\w+|"[^"]+"/g); // Match on whitespaces except words in quotes
            } else {
				if (type === "keyword") search = [search];
			}

			// Container for the inputs, slightly different for each type (tags/keyword)
			var rowContainer = document.createElement('div');
			if (type === "keyword") {
				rowContainer.id = 'keyword-query-list-container';
            } else {
				var tags = tagsInput.tagsinput('items');
				rowContainer.id = 'tags-query-list-container';
				this.dropdownTagWidgets = 0;
            }

			for (var i = 0; i < search.length; i+=2){
				var row = document.createElement('div');
				row.className = "row";
				var wordInput = this.createWordInput(search[i], type, i);
				if (i !== 0) {
                    var selectContainer = this.createConnectingWordSelect(search[i - 1], type, i);
                    row.appendChild(selectContainer);
                }
				row.appendChild(wordInput);
				rowContainer.appendChild(row);
			}

			var optionsRow = this.createOptionsRow(type);
			queryEditorBox[0].appendChild(rowContainer);
			queryEditorBox[0].appendChild(optionsRow);
			this.setDropdownCheckedValues(type);
			this.createDropdownEvents(type);

			dropdown.show();
			if (type === "tag") this.initializeDropdownTagWidgets(tags);
		}
	},
	// For the tag dropdown inputs we need to initialize each one as a bootstrap-tagsinput widget
	// And insert the correct tag to be editable (this must be done AFTER displaying the dropdown)
	initializeDropdownTagWidgets: function(tags){
		var tagInput;

		for (var i = 0; i <= tags.length; i++){
			if (i % 2 === 0){
				tagInput = $("#" + i + "-tags-dropdown-input");
				xgds_notes.initializeInput(tagInput, 1);
				if (!_.isUndefined(tags[i])) {
					tagInput.tagsinput('add', {
						id: tags[i].id,
						name: tags[i].name
					});
				}

				this.addTagEventHandlers(tagInput);
			}
		}
	},
	// Updates the main input on each itemAdded and itemRemoved event for every dropdown input
	addTagEventHandlers: function(tagWidget){
		var _this = this;
		tagWidget.on('itemAdded', function(event) {
			_this.updateSearch("tag");
		});
		tagWidget.on('itemRemoved', function(event) {
			_this.updateSearch("tag");
		});
	},
	// Adds a new row of inputs to the bottom of the dropdown input list (when clicking the + button)
	addDropdownRow: function(type){
		var rowContainer, wordInput;
		if (type === "keyword") rowContainer = document.getElementById('keyword-query-list-container');
		else rowContainer = document.getElementById('tags-query-list-container');

		var row = document.createElement('div');
		row.className = "row";

		var selectContainer = this.createConnectingWordSelect("or", type, -1);
		if (type === "keyword") wordInput = this.createWordInput("", type, -1);
		else wordInput = this.createWordInput("", type, this.dropdownTagWidgets * 2);
		row.appendChild(selectContainer);
		row.appendChild(wordInput);
		rowContainer.appendChild(row);

		if (type === "tag"){
			var tagDropdownInputId;
			if (this.dropdownTagWidgets === 2) tagDropdownInputId = this.dropdownTagWidgets;
			else tagDropdownInputId = (this.dropdownTagWidgets - 1) * 2;

			var tagInput = $("#" + tagDropdownInputId + "-tags-dropdown-input");
			xgds_notes.initializeInput(tagInput, 1);
			this.addTagEventHandlers(tagInput);
		}
	},
	// Creates the inputs for the dropdowns
	createWordInput: function(search, type, index){
		var wordInputContainer = document.createElement('div');
		if (index === 0) wordInputContainer.className = "col-12";
		else  wordInputContainer.className = "col-8 ss-word-input-container";
		var wordInput = document.createElement('input');
		wordInput.type = "text";
		if (type === "keyword") {
			wordInput.className = "form-control col-12 ss-word-input ss-keyword-word-input";
			wordInput.id = index + "-keyword-dropdown-input";
			if (index === -1) wordInput.value = "";
			else wordInput.value = search;
        } else {
			wordInput.className = "form-control col-12 ss-word-input ss-tags-word-input";
			wordInput.id = index + "-tags-dropdown-input";
			wordInputContainer.id = index + "-tags-dropdown-input-container";
			this.dropdownTagWidgets += 1;
			// Values for tags are assigned after displaying the dropdown in this.generateQueryList
        }

		wordInputContainer.appendChild(wordInput);

		return wordInputContainer;
	},
	// Creates the select boxes for the dropdowns
	createConnectingWordSelect: function(search, type, index){
		var selectContainer = document.createElement('div');
		selectContainer.className = "col-4 ss-word-select-container";

		var wordSelect = document.createElement('select');
		if (type === "keyword") wordSelect.className = "form-control ss-word-select ss-keyword-word-select";
		else wordSelect.className = "form-control ss-word-select ss-tags-word-select";

		wordSelect.options[wordSelect.options.length] = new Option('or', 'or');
		wordSelect.options[wordSelect.options.length] = new Option('and', 'and');
		if (index !== -1) wordSelect.value = search;
		else wordSelect.value = "or";

		selectContainer.appendChild(wordSelect);
		return selectContainer;
	},
	// Creates the option row at the bottom of the dropdown (nest tags, default connector, add button)
	createOptionsRow: function(type){
		// Create the final + button which should add another row
		var buttonRow = document.createElement('div');
		buttonRow.className = "row";
		var col12 = document.createElement('div');
		col12.className = "col-12";

		if (type === "keyword") {
			buttonRow.id = "keyword-button-row-id";
			col12.innerHTML = "<button class='btn btn-default' id='ss-keyword-add-btn'><i class='fa fa-plus' aria-hidden='true'></i></button>" +
				"<div class='default-connector-container'>Default:&nbsp;&nbsp;" +
				"<label class='dropdown-radio-label'><input type=\"radio\" name=\"default-connector-keywords\" class=\"dropdown-radio\" id=\"default-keyword-or-id\" value='or'/>or</label>" +
				"<label class='dropdown-radio-label'><input type=\"radio\" name=\"default-connector-keywords\" class=\"dropdown-radio\" id=\"default-keyword-and-id\" value='and'/>and</label>" +
				"</div>";

        } else {
			buttonRow.id = "tag-button-row-id";
			col12.innerHTML = "<button class='btn btn-default' id='ss-tags-add-btn'><i class='fa fa-plus' aria-hidden='true'></i></button>" +
                "<label class='dropdown-nest-tags'><input type=\"checkbox\" class=\"form-check-input dropdown-checkbox\" id=\"nest-tags-id\"/>Nest Tags</label><br/>" +
				"<div class='default-connector-container'>Default:&nbsp;&nbsp;" +
				"<label class='dropdown-radio-label'><input type=\"radio\" name=\"default-connector-tags\" class=\"dropdown-radio\" id=\"default-tag-or-id\" value='or'/>or</label>" +
				"<label class='dropdown-radio-label'><input type=\"radio\" name=\"default-connector-tags\" class=\"dropdown-radio\" id=\"default-tag-and-id\" value='and'/>and</label>" +
				"</div>";
        }
		buttonRow.appendChild(col12);

		return buttonRow;
	},
	// Sets the correct values of nest tags and the default and/or when opening the dropdown
	setDropdownCheckedValues: function(type){
		if (type === "keyword"){
			if (this.defaultKeywordConnector === "or") $("input[name=default-connector-keywords][value='or']").prop("checked",true);
			else $("input[name=default-connector-keywords][value='and']").prop("checked",true);

		} else{
			if (this.nestTags === "false" || this.nestTags === false) $("#nest-tags-id").prop("checked", false);
			else $("#nest-tags-id").prop("checked", true);

			if (this.defaultTagConnector === "or") $("input[name=default-connector-tags][value='or']").prop("checked",true);
			else $("input[name=default-connector-tags][value='and']").prop("checked",true);
		}
	},
	// Creates the event listeners for the nest tags and default and/or when opening the dropdown
	createDropdownEvents: function(type){
		var _this = this;
		var keywordRadio = $('input[type=radio][name=default-connector-keywords]');
		var tagRadio = $('input[type=radio][name=default-connector-tags]');
		var nestTags = $("#nest-tags-id");

		if (type === "keyword"){
			keywordRadio.change(function(event) {
				_this.defaultKeywordConnector = this.value;
				Cookies.set('defaultKeywordConnector', this.value);
			});
		} else{
			tagRadio.change(function(event) {
				_this.defaultTagConnector = this.value;
				Cookies.set('defaultTagConnector', this.value);
			});
			nestTags.change(function(event){
				_this.nestTags = this.checked;
				Cookies.set('nestTags', this.checked);
			})
		}
	},
	getFilterData: function() {
    	var theForm = $("#form-"+this.selectedModel);
    	if (theForm.length == 1){
    		var result = theForm.serializeArray();
    		var new_result = {};
    		for (var i=1; i<result.length; i++){
    			if (result[i].value != ""){
    				new_result[result[i].name] = result[i].value;
    			}
    		}
    		return new_result;
    	}
    	return {};
    },
    buildAjaxData: function(d) {
    	var todayCheckbox = $('#today');
    	var today = 1;
    	if (todayCheckbox.length > 0){
    		today = todayCheckbox[0].checked
    	}
    	var result = $.extend( this.postData, d, {"today": today});
    	return result;
    },
    setupDatatable: function(data) {
    	this.theTable = this.$("#searchResultsTable");
    	if (this.theDataTable != undefined) {
			// if we have data, set it.  Not sure when this would be called
			this.theDataTable.clear().draw();
			this.theDataTable.rows.add(this.convertResultsArray(data)).draw();
			this.filterMapData(data);
			this.theDataTable.columns.adjust().draw();
			return;
    	}
    	this.constructDatatable(data);
    },
    connectSelectCallback: function(table){
    	var context = this;
    	this.theDataTable.off('select.dt');
    	this.theDataTable.on('select.dt', function (e, dt, type, indexes) {
    	    if ( type === 'row' ) {
				for (var i=0; i < indexes.length; i++) {
        	        var modelMap = context.lookupModelMap(dt.row(indexes[i]).data()[1]);
        	    	var data = _.object(modelMap.columns, dt.row(indexes[i]).data());
        	    	if (!('timestamp' in data)) {
        	    		data.timestamp = data[modelMap.columns[1]]; // brittle, but the 2nd column is the time.
					}
        	    	app.vent.trigger('selectData', data);
        	    	if (app.options.showDetailView){
        	    		analytics.trackAction('search_detail', data.type,  {'pk': data.pk, 'name': data.name, 'page': document.title});
						context.forceDetailView(data,modelMap);
        	    	} else {
        	    		analytics.trackAction('search_select', data.type,  {'pk': data.pk, 'name': data.name, 'page': document.title});
        	    		if (_.isNumber(data.lat)){
        	        		highlightOnMap([data]);
        	    		}
        	    	}
    	    	}
    	    }
    	} );
    },
    connectDeselectCallback: function(table){
    	var context = this;
    	this.theDataTable.off('deselect.dt');
    	this.theDataTable.on( 'deselect.dt', function ( e, dt, type, indexes ) {
    	    if ( type === 'row' ) {
    	    	for (var i=0; i<indexes.length; i++){
        	        var modelMap = context.lookupModelMap(dt.row(indexes[i]).data()[1]);
        	    	var data = _.object(modelMap.columns, dt.row(indexes[i]).data());
        	    	unhighlightOnMap([data]);
        	    	//removeFromMap(data);
    	    	}
    	    }
    	} );
    },
	connectMasterPickCallback: function() {
    	var _this = this;
		$('#pick_master').on('change', function() {
			var masterChecked = $(this).is(":checked");
			$('.check').each(function(i, obj) {
				var targetId = obj.id.substring(9);
				if (masterChecked) _this.selectedIds.push(targetId);
				else _this.selectedIds = [];
				$(this).prop("checked", masterChecked);
			});
        });
	},
	connectSinglePickCallback: function() {
    	var _this = this;
		$(document).on('change', '.check', function(e) {
			var targetId = e.target.id.substring(9);
			if (e.target.checked) {
                _this.selectedIds.push(targetId);
            }
			else {
				var targetIndex = _this.selectedIds.indexOf(targetId);
				if (targetIndex > -1) _this.selectedIds.splice(targetIndex, 1);
				if ($('#pick_master').is(":checked")) $('#pick_master').prop("checked", false);
			}
		});
	},
	connectDoubleClickCallback: function() {
		$(document).on('dblclick', 'tr', function(e) {
			var row = this.theDataTable.row( this ).data();
			var data = this.getObject(row, this);
			$("#details_modal").modal('show');
			analytics.trackAction('search_dblclick', data.type,  {'pk': data.pk, 'name': data.name, 'page': document.title});
			this.forceDetailView(data, this.lookupModelMap(row[1]), true);
		}.bind(this));
	},
    updateContents: function(data) {
		// this.setupDatatable(selectedModel, data);
    },
    lookupModelMap: function(selectedModel){
    	if (this.modelMap[selectedModel] == undefined){
    		var aoModel = app.options.searchModels[selectedModel];
        	this.modelMap[selectedModel] = aoModel;
        }
        return this.modelMap[selectedModel];
    },
    setupColumnHeaders: function() {
      this.theTable.append('<thead><tr id="columnRow"></tr></thead>');
      var columnRow = this.$('#columnRow');
      $.each(this.columns, function(index, col){
          columnRow.append("<th>"+ col +"</th>");
      });
    },
    updateDetailView: function(data, modelMap, popup) {
		if (_.isUndefined(popup)){
			popup = false;
		}
    	if (!popup && !app.options.showDetailView){
    		return;
    	}
    	if (this.detailView == undefined){
    		this.createDetailView(modelMap.handlebarSource, data, popup);
        } else {
        	this.detailView.setHandlebars(modelMap.handlebarSource);
        	this.detailView.setData(data);
        	this.detailView.setModelMap(modelMap);
        	this.detailView.render();
        	if (this.detailNotesView != undefined){
        		this.detailNotesView.setData(data);
        		this.detailNotesView.updateContents();
        	}
        }
    },
    createDetailView: function(handlebarSource, data, popup) {
		if (_.isUndefined(popup)){
			popup = false;
		} else if (popup){
			if (!('popupDetail' in this.regions)) {
                this.addRegion('popupDetail', { el: $('#details_modal_body')});
            }
		}
    	this.detailView = new app.views.SearchDetailView({
    		handlebarSource:handlebarSource,
    		data:data,
    		selectedModel: this.selectedModel,
    		modelMap: this.modelMap[this.selectedModel]
    	});
    	this.detailNotesView = new app.views.SearchNotesView({
    		data:data,
    		modelMap: this.modelMap[this.selectedModel],
    		modelName: this.selectedModel
    	});
    	try {
    		this.hookPrevNextButtons();
    		if (popup) {
                this.showChildView('popupDetail', this.detailView);
            } else {
                this.showChildView('viewRegion', this.detailView);
			}
    		this.showChildView('viewNotesRegion', this.detailNotesView);
    	} catch (err){
    	}
    },
    hookPrevNextButtons: function() {
    	var context = this;
		$("#prev_button").click(function() {
			context.selectPrevious();
		});
		$("#next_button").click(function() {
			context.selectNext();
		});
    },
    selectPrevious: function(){
    	var dt = this.theTable.DataTable();
    	var selectedRows = dt.rows({selected:true}).indexes();
    	if (selectedRows.length > 0){
    		var indexes = dt.rows().indexes();
    		var currentIndexesIndex = indexes.indexOf( selectedRows[0] );
    		if (currentIndexesIndex > 0){
    			dt.rows().deselect();
    			dt.row(indexes[currentIndexesIndex -1]).select();
    		}
    	}
    },
    selectNext: function() {
    	var dt = this.theTable.DataTable();
    	var selectedRows = dt.rows({selected:true}).indexes();
    	if (selectedRows.length > 0){
    		var indexes = dt.rows().indexes();
    		var currentIndexesIndex = indexes.indexOf( selectedRows[0] );
    		if (currentIndexesIndex < indexes.length - 1){
    			dt.rows().deselect();
    			dt.row(indexes[currentIndexesIndex + 1]).select();
    		}
    	}
    	
    },
    getObject: function(theRow, context){
    	var modelMap = context.lookupModelMap(theRow[1]);
    	var data = _.object(modelMap.columns, theRow);
    	return data
    },
    forceDetailView: function(data, modelMap, popup){
		if (_.isUndefined(popup)) {
			popup = 'popupDetail' in this.regions;
		}
    	if (!popup && !app.options.showDetailView){
    		return;
    	}
    	var context = this;
    	if (modelMap.viewHandlebars != undefined){
    		if (modelMap.handlebarSource == undefined){
				var url = '/xgds_core/handlebar_string/' + modelMap.viewHandlebars;
				$.get(url, function(handlebarSource, status){
					modelMap['handlebarSource'] = handlebarSource;
					if (modelMap.viewJS != undefined){
						$.getManyJS( modelMap.viewJS, function() {
							if (modelMap.viewCss != undefined){
								$.getManyCss(modelMap.viewCss, function(){
									context.updateDetailView(data, modelMap, popup);
								});
							} else {
								context.updateDetailView(data, modelMap, popup);
							}
						});
					} else if (modelMap.viewCss != undefined){
						$.getManyCss(modelMap.viewCss, function(){
							context.updateDetailView(data, modelMap, popup);
						});
					} else {
						context.updateDetailView(data, modelMap, popup);
					}
			    });
    		} else {
    			context.updateDetailView(data, modelMap, popup);
    		}
		} 
    	if (_.isNumber(data.lat)){
    		highlightOnMap([data]);
		}
    },
    listenToTableChanges: function() {
        
    },
    unListenToTableChanges: function() {
		
    },
    filterMapData: function(data) {
		app.vent.trigger("mapSearch:found", data, true);
    },
    calcDataTableHeight : function() {
        var h =  Math.floor($(window).height()*.4);
        return h + 'px';
    },
    reset: function() {
        if (!_.isUndefined(this.theDataTable)) {
            this.unListenToTableChanges();
            this.theDataTable.destroy();
            this.theDataTable = undefined;
            this.$('#searchResultsTable').empty();
        }
    }
});

