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


app.views.SearchView = Marionette.View.extend({
    template: '#template-search',
    events: {
        'click #getSearchFormButton': 'setupSearchForm',
        'click #doSearch': 'doSearch',
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
    	var theKeys = Object.keys(app.options.searchModels);
    	this.searchableModels = [];
    	for (var i=0; i<theKeys.length; i++){
    		if (!_.isUndefined(app.options.searchModels[theKeys[i]].search_form_class)){
    			this.searchableModels.push(theKeys[i]);
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
    	if (this.preselectModel != undefined && this.preselectModel != 'None') {
    		this.setupSearchForm(true);
        }
    	this.$("#form-"+this.selectedModel).on('submit', function(event){
            event.preventDefault();
        });
    	
    },
    onRender: function() {
        app.vent.trigger("repack");
    },
    setupSearchForm: function(runSearch) {
    	var newModel = app.options.modelName;
    	if (newModel == undefined || newModel == 'None') {
    		newModel = this.$("#searchModelSelector").val();
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
        this.searchFormView = new app.views.SearchFormView({template:templateName})
        this.getRegion('searchFormRegion').show(this.searchFormView);
        
        var theModelMap = app.options.searchModels[newModel];
        if (theModelMap.searchInitMethods != undefined){
    		for (var i=0; i < theModelMap.searchInitMethods.length; i++){
    			$.executeFunctionByName(theModelMap.searchInitMethods[i], window, this.data);
    		}
    	}
        if (runSearch != undefined && runSearch == true){
        	this.doSearch();
        }
    },
    setupSaveSearchDialog: function() {
	//FOR NOW this is commented out, problem with latest jquery
//        document.getElementById("save-search-dialog").style.visibility = "visible";
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
    	var theForm = this.$("#form-"+this.selectedModel);
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
    doSearch: function(event) {
    	if (!_.isUndefined(event)){
    		event.preventDefault();
    	}
    	this.searchResultsView.setupDatatable(this.selectedModel, undefined, this.getFilterData());
    	this.setupSaveSearchDialog();

    	if ($('#advancedSearchModal').is(':visible')){
    		$('#advancedSearchModal').modal('hide');
		}
    	return;
    	
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
        Handlebars.registerHelper('prettyTime', function( sourceTime, timeZone ){
        	return getLocalTimeString(sourceTime, timeZone);
        });

    	this.handlebarSource = '';
    	this.data = options.data;
    	this.selectedModel = options.selectedModel;
    	this.modelMap = options.modelMap;
    	this.setHandlebars(options.handlebarSource);
    	this.neverShown = true;
    	var context = this;
    	this.on('updateContents', _.debounce(context.updateContents, 500));
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
    updateContents: function() {
    	try {
	    	var new_window_btn = this.$el.parent().parent().find("#view-new-window-target");
	    	if (new_window_btn.length > 0){
	    		new_window_btn.attr("href","/xgds_map_server/view/" + this.selectedModel + "/" + this.data.pk );
	    	}
    	} catch (err) {
    		// gulp we do not always have a new window button
    	}
	    
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
	    	$('.grid-stack').on('resizestop', function(event, ui) {
	    	    var element = event.target;
	    	    var found = $(event.target).find('#view-gridstack-item-content');
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
    },
});

/*
 * This is the view for the notes that go with objects found by search.
 */
app.views.SearchNotesView = Marionette.View.extend({
    initialize: function(options) {
    	this.data = options.data;
    	this.modelMap = options.modelMap;
    	this.modelName = options.modelName;
    	this.setupHandlebars();
    },
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
    	this.modelMap = app.options.searchModels[data.type];
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
		'keyup #search-keyword-id': 'filterDatatable',
		'click #keyword-dropdown-btn': function(){
			if ($('#keyword-dropdown-menu').is(':visible')) $('#keyword-dropdown-menu').hide();
			else $('#keyword-dropdown-menu').show();
		},
		'click #tag-dropdown-btn': function(){
			if ($('#tag-dropdown-menu').is(':visible')) $('#tag-dropdown-menu').hide();
			else $('#tag-dropdown-menu').show();
		},
		'keydown [name="search-keyword"]': 'replaceKeywordSpace'
	},
	initialize: function() {
		this.modelMap = {};
		this.selectedIds = [];
		this.firstLoad = true;
		var context = this;
		app.on('forceDetail', function(data){
			var modelMap = context.lookupModelMap(data.type);
			context.forceDetailView(data, modelMap);
		});
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
		this.addRegion('viewNotesRegion', {el: notesDiv});
		
		
	},
    onAttach: function() {
    	this.setupRegions();
    	
    	// hook up ajax reloading
    	var reloadIconName = '#reloadSearchResults';
    	var context = this;
    	$(reloadIconName).click(function() {
    		context.theDataTable.ajax.reload( null, false );
    	});
    	var todayCheckbox = $('#today');
    	if (todayCheckbox.length > 0){
    		todayCheckbox.prop('checked', app.options.settingsLive);
    		todayCheckbox.click(function() {
    			context.theDataTable.ajax.reload( null, true );
    		});
    	}
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

    	for (var i = 0; i < displayColumns.length; i++){
    		var heading = displayColumns[i];
    		var dataIndex = modelMap.columns.indexOf(heading);
    		var columnDef = {};
    		columnDef['targets'] = i;
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
    			columnDef['render'] = function ( data, type, row ) {
					return getLocalTimeString(row[1], row[2], "MM/DD/YY HH:mm:ss");
				};
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
				columnDef['render'] =  function(data, type, row) {
					if (!_.isUndefined(data) && !_.isNull(data) && data != ''){
						var result = "";
						for (var i = 0; i < data.length; i++) {
							result = result + '<span class="tag label label-info">' + data[i] + '</span>&nbsp;';
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
			} else if (heading.toLowerCase().indexOf('checkbox') > -1) {
				columnDef['orderable'] = false;
				columnDef['render'] = function (data, type, row) {
					var checkbox = document.createElement("input");
					checkbox.setAttribute("id", "checkbox_" + row[row.length - 1]);
					checkbox.setAttribute("type", "checkbox");
					checkbox.setAttribute("class", "check");

					if ((context.selectedIds.indexOf(data.toString()) > -1) || $('#pick_master').is(":checked")){
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
    constructDatatable: function(selectedModel, data, postData){
    	this.postData = postData;
    	this.selectedModel = selectedModel;
        var modelMap = this.lookupModelMap(selectedModel);
        
        this.columns = modelMap.columns;
        if (_.isUndefined(this.columns) && !_.isUndefined(data) && !_.isEmpty(data)){
        	this.columns = Object.keys(data[0]); // this only works if it is a json dict.
        }
        this.columns = _.difference(this.columns, modelMap.hiddenColumns);
        this.columnTitles = modelMap.columnTitles;
        this.columnTitles.unshift("<label for=\"pick_master\">All</label><input type=\"checkbox\" id=\"pick_master\"/>"); //Adds a checkbox for the title of the first column
        this.columnHeaders = this.getColumnDefs(this.columns, modelMap, modelMap.searchableColumns, modelMap.editableColumns, modelMap.unsortableColumns);
        this.editableColumns = this.getEditableColumnDefs(this.columns, modelMap.columnTitles, modelMap.editableColumns);
        $.fn.dataTable.moment( DEFAULT_TIME_FORMAT);
        $.fn.dataTable.moment( "MM/DD/YY HH:mm:ss");
        var tableheight = this.calcDataTableHeight();
        if (app.options.tableHeight != undefined){
        	tableheight = app.options.tableHeight;
        }

        var dataTableObj = {
                columns: this.columnHeaders,
                autoWidth: true,
                dom: '<"top"' +
						'<"row"' +
							'<"col-12"' +
								'<"display-length"l><"paginate"p>' +
							'>' +
						'>' +
					 	'<"clear">' +
					 '>rt' +
					 '<"bottom"ip' +
						'<"clear">' +
					 '>',
                stateSave: false,
                rowId: function(a) {return a[a.length-1]; },
                paging: true,
                pageLength: 10, 
                lengthChange: true,
                ordering: true,
                select:true,
                order: [[ 1, "desc" ]],
                jQueryUI: false,
                rowCallback: function (row, data, index){
                	$(row).attr('id', data[data.length - 1]);
                },
                scrollY:  tableheight,
				scrollX: true, // Mostly applies to the notes search page. The tags cause some scrolling issues
                lengthMenu: [[10, 20, 40, 80, -1], [10, 20, 40, 80, "All"]],
                language: {
                    lengthMenu: "Display _MENU_"
                }
        }
        
        if (!_.isUndefined(data)){
        	dataTableObj['data'] = data;
        } else {
        	dataTableObj['processing'] = true;
        	dataTableObj['serverSide'] = true;
        	var context = this;
        	this.ajaxConfig = {
        	    "url": this.buildAjaxUrl(selectedModel),
        	    "type": "POST",
        	    "data": function(d) {
        	    	return context.buildAjaxData(d);
        	    }
        	}
        	dataTableObj['ajax']= this.ajaxConfig;
        }

        this.theDataTable = $(this.theTable).DataTable(dataTableObj);
        this.connectSinglePickCallback();
        this.connectMasterPickCallback();
        this.connectSelectCallback();
        this.connectDeselectCallback();
        this.listenToTableChanges();
        this.filterMapData(undefined);
        app.vent.trigger("repack");
    },
	initializeExportData: function(){
    	$('.export-err').hide();
    	if ($('#pick_master').is(":checked"))
    		this.selectedIds.push("All");

    	$('#rowIds').val(JSON.stringify(this.selectedIds));
    	$('#selectedModel').val(this.selectedModel);
    	$('#simpleSearchData').val($('#search-keyword-id').val());
    	$('#advancedSearchData').val(JSON.stringify(this.getFilterData()));
    	$('#filetype').val($('label[name=fileType]').attr("data"));
    	$('label[name=fileType]').click(function(event) {
			$('#filetype').val($(event.target).attr('data'));
        });

    	if (this.selectedIds.length == 0) $('.export-err').show();
		else $('#exportModal').modal('show');
	},
	filterDatatable: function(){
		this.theDataTable.search($('#search-keyword-id').val()).draw();
	},
	replaceKeywordSpace: function(e){
		if (e.which === 32) {
			e.preventDefault();
			$("#search-keyword-id").val($("#search-keyword-id").val() + ' or ');
		}
		// else if (e.which == 8){
		// TODO: if the deleted character is a space, delete the or + spaces
		// 	e.preventDefault();
		// }
	},
	getFilterData: function() {
    	var theForm = $("#form-"+this.selectedModel);
    	if (theForm.length == 1){
    		var result = theForm.serializeArray();
    		var newresult = {};
    		for (var i=1; i<result.length; i++){
    			if (result[i].value != ""){
    				newresult[result[i].name] = result[i].value;
    			}
    		}
    		return newresult;
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
    setupDatatable: function(selectedModel, data, postData){
    	this.postData = postData;
    	this.theTable = this.$("#searchResultsTable");
    	if (this.theDataTable != undefined) {
    		// the table already exists, see if we need to destroy it and rebuild it
    		if (this.selectedModel != selectedModel) {
    			// destroy it
    			this.theDataTable.destroy();
    			this.theDataTable = undefined;
    			//TODO may have to unhook callbacks from the old table?
    		} else {
    			// if we have data, set it.  Not sure when this would be called
    			if (data != undefined){
    				this.theDataTable.fnClearTable();
    				this.theDataTable.fnAddData(data);
    			} else {
    				// if we have no data but we have a filter, clear and update the ajax
    				this.ajaxConfig.url = this.buildAjaxUrl(selectedModel);
    				this.theDataTable.ajax.url(this.ajaxConfig.url).load();
    			}
    			return;
    		}
    	}
    	this.constructDatatable(selectedModel, data, postData);
    	
    },
    connectSelectCallback: function(table){
    	var context = this;
    	this.theDataTable.off('select.dt');
    	this.theDataTable.on( 'select.dt', function ( e, dt, type, indexes ) {
    	    if ( type === 'row' ) {
    	    	for (var i=0; i<indexes.length; i++){
        	        var modelMap = context.lookupModelMap(context.selectedModel);
        	    	var data = _.object(modelMap.columns, dt.row(indexes[i]).data());
        	    	if (app.options.showDetailView){
        	    		if (!_.isUndefined(useOWATracking) && useOWATracking) {
                            owaTrackAction(data.type, 'searchDetail', data.pk + ':' + data.name);
                        }
						context.forceDetailView(data,modelMap);
        	    	} else {
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
        	        var modelMap = context.lookupModelMap(context.selectedModel);
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
    updateContents: function(selectedModel, data) {
        if (!_.isUndefined(data) && data.length > 0){
            if (!_.isUndefined(this.theDataTable)) {
                this.theDataTable.fnClearTable();
                this.theDataTable.fnAddData(data);
            } else {
            	this.setupDatatable(selectedModel, data);
            }
        }
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
    updateDetailView: function(data, modelMap) {
    	if (! app.options.showDetailView){
    		return;
    	}
    	if (this.detailView == undefined){
    		this.createDetailView(modelMap.handlebarSource, data);
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
    createDetailView: function(handlebarSource, data) {
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
    		this.showChildView('viewRegion', this.detailView);
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
    	var modelMap = context.lookupModelMap(context.selectedModel);
    	var data = _.object(modelMap.columns, theRow);
    	return data
    },
    forceDetailView: function(data, modelMap){
    	if (! app.options.showDetailView){
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
									context.updateDetailView(data,modelMap);
								});
							} else {
								context.updateDetailView(data,modelMap);
							}
						});
					} else if (modelMap.viewCss != undefined){
						$.getManyCss(modelMap.viewCss, function(){
							context.updateDetailView(data,modelMap);
						});
					} else {
						context.updateDetailView(data,modelMap);
					}
			    });
    		} else {
    			context.updateDetailView(data,modelMap);
    		}
		} 
    	if (_.isNumber(data.lat)){
    		highlightOnMap([data]);
		}
    },
    listenToTableChanges: function() {
        var _this = this;
        var theTable = this.$("#searchResultsTable");
        theTable.on( 'page.dt', { _this : this }, function (event) {
            var _this = event.data._this;
            _this.filterMapData(undefined);
        });
        theTable.on('xhr.dt', {_this: this}, function(event, settings, json, xhr){
        	var _this = event.data._this;
        	var founddata = undefined;
        	if (!_.isEmpty(json) && !_.isEmpty(json.data)){
        		founddata = json.data
        	} 
        	_this.filterMapData(founddata);

        });
    },
    unListenToTableChanges: function() {
        this.$("#searchResultsTable").off( 'page.dt');
        this.$("#searchResultsTable").off( 'xhr.dt');
    },
    filterMapData: function(data) {
    	// this shows all data from the current page
        var modelMap = this.lookupModelMap(this.selectedModel);
        if (_.isUndefined(data)){
        	data = this.theDataTable.rows().data().toArray();
        }
        var fulldata = [];
        _.each(data, function(datum){
        	fulldata.push( _.object(modelMap.columns, datum));
        });
        if (!_.isEmpty(fulldata)){
        	app.vent.trigger("mapSearch:found", fulldata);
        	if (this.firstLoad){
        		app.vent.trigger("mapSearch:fit");
        		this.firstLoad = false;
        	}
        }
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

var xgds_search = xgds_search || {};
$.extend(xgds_search,{
	hookAdvancedSearchButton : function() {
		// turn off by default
		var advancedSearchButton = $("#advanced_search_button");
		advancedSearchButton.off('click');
		advancedSearchButton.on('click',function(event) {
		    event.preventDefault();
		    var searchDiv = $("#searchDiv");
		    searchDiv.show();
		    $('#advancedSearchModal').modal('show');
		});
	}
});
