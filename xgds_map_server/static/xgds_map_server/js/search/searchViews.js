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

$.extend({
	getManyJS: function(urls, callback){
		var ajaxRequests = [];
        $.each(urls, function(i, url){
        	ajaxRequests.push(
            	$.ajax({
            	    async: false,
            	    url: url,
            	    dataType: "script",
            	    error: function(jqXHR, errorType, exception) {
            	    	//TODO should probably handle this ...
            	    	console.log(exception);
            	    }
            	}));
        });
        
        $.when(ajaxRequests).then(function(){
        	if (callback != undefined){
        		if (typeof callback=='function') callback();
        	}
        });
    },
    getManyCss: function(urls, callback){
        $.when(
            $.each(urls, function(i, url){
                $.get(url, function(){
                    $('<link>', {rel:'stylesheet', type:'text/css', 'href':url}).appendTo('head');
                });
            })
        ).done(function(){
        	if (callback != undefined){
        		if (typeof callback=='function') callback();
        	}
        });
    },
    executeFunctionByName: function(functionName, context /*, args */) {
    	  var args = [].slice.call(arguments).splice(2);
    	  var namespaces = functionName.split(".");
    	  var func = namespaces.pop();
    	  for(var i = 0; i < namespaces.length; i++) {
    	    context = context[namespaces[i]];
    	  }
    	  return context[func].apply(context, args);
    	}
});

app.views.SearchView = Backbone.Marionette.LayoutView.extend({
    template: '#template-search',
    events: {
        'click #getSearchFormButton': 'setupSearchForm',
        'click #doSearch': 'doSearch',
        'click #doSaveSearch': 'openSaveDialog'
    },
    regions: function(options){
        return {
        	modelChoiceRegion: '#modelChoiceDiv',
            searchFormRegion: { el: '#searchFormDiv'},
            searchResultsRegion: (options.searchResultsRegion != undefined) ? {el:"#searchResultsDiv"} : '#searchResultsDiv'
        };
      },
    initialize: function(options) {
    	this.viewRegionDef = false;
    	if (options.template != undefined){
    		this.template = options.template;
    	}
    	if (options.viewRegion != undefined){
    		this.viewRegion = true;
    	}
        var source = $(this.template).html();
        if (_.isUndefined(source)) {
            this.template = function() {
                return '';
            };
        } else {
            this.template = Handlebars.compile(source);
        }
        this.preselectModel = app.options.modelName;
        Handlebars.registerHelper('modelSelected', function( input, modelName ){
        	return input === modelName ? 'selected' : '';
        });
    },
    onShow: function() {
    	if (this.preselectModel != undefined && this.preselectModel != 'None') {
    		this.setupSearchForm(true);
        }
    },
    onRender: function() {
        var theKeys = Object.keys(app.options.searchModels);
        this.$el.empty().append(this.template({
            searchModels: theKeys,
            preselectModel: this.preselectModel
        }));
        this.searchResultsView = new app.views.SearchResultsView({template:'#template-search-results',
        														  viewRegion: this.viewRegion}); 
        this.searchResultsRegion.show(this.searchResultsView);
        app.vent.trigger("repack");
    },
    setupSearchForm: function(runSearch) {
    	var newModel = app.options.modelName;
    	if (newModel == undefined || newModel == 'None') {
    		newModel = this.$("#searchModelSelector").val();
    	} else {
    		var dropdownModel = this.$("#searchModelSelector").val();
    		if (dropdownModel != newModel){
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
        this.searchResultsView.reset();
        this.selectedModel = newModel;
        var templateName = '#template-' + this.selectedModel;
        this.searchFormView = new app.views.SearchFormView({template:templateName})
        this.searchFormRegion.show(this.searchFormView);
        this.$("#form-"+this.selectedModel).on('submit', function(event){
            event.preventDefault();
        });
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
    doSearch: function() {
    	
    	this.searchResultsView.setupDatatable(this.selectedModel);
    	this.setupSaveSearchDialog();
    	return;
    	
//        var theForm = this.$("#form-"+this.selectedModel);
//        var postData = theForm.serializeArray();
//        postData.push({'name':'modelClass', 'value':app.options.searchModels[this.selectedModel].model});
//        this.setMessage("Searching...");
//        $.ajax({
//            url: '/xgds_map_server/doMapSearch',
//            dataType: 'json',
//            data: postData,
//            success: $.proxy(function(data) {
//                if (_.isUndefined(data) || data.length === 0){
//                    this.setMessage("None found.");
//                } else {
//                    this.searchResultsView.updateContents(this.selectedModel, data);
//                    this.setupSaveSearchDialog();
//                    this.clearMessage();
//                }
//            }, this),
//            error: $.proxy(function(data){
//                app.vent.trigger("mapSearch:clear");
//                this.searchResultsView.reset();
//                this.setMessage("Search failed.")
//            }, this)
//          });
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
    }
});

app.views.SearchFormView = Backbone.Marionette.ItemView.extend({
});

app.views.SearchDetailView = Backbone.Marionette.ItemView.extend({
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
    render: function() {
    	showOnMap([this.data]);
        this.$el.empty().append(this.template(this.data));
    	try {
    		var context = this;
    		if (this.neverShown){
        		this.onShow();
    		} else {
    			this.trigger('updateContents');
    		}
    	} catch (err){
    		// gulp, the first time this will 
    	}
    },
    updateContents: function() {
    	console.log("update contents : " + new Date());
    	try {
	    	var new_window_btn = this.$el.parent().siblings("#new-window-btn");
	    	if (new_window_btn.length > 0){
	    		var theLink = new_window_btn.children("#view-new-window-target");
	    		theLink.attr("href","/xgds_map_server/view/" + this.selectedModel + "/" + this.data.pk );
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
    onShow: function() {
    	this.neverShown = false;
    	this.updateContents();
    	var context = this;
    	$('.grid-stack').on('resizestop', function(event, ui) {
    	    var element = event.target;
    	    var found = $(event.target).find('#view-gridstack-item-content');
    	    if (found.length > 0){
    	    	if (context.modelMap.viewResizeMethod != undefined){
    	    		context.handleResizeDetailView(found[0], context);
//    	    		_.debounce(context.handleResizeDetailView(found[0], context), 250);
    	    	}
    	    }
    		
    	});
    	$("#ajax_prev_button").click(function(event) {
			context.selectPreviousAjax();
		});
		$("#ajax_next_button").click(function(event) {
			context.selectNextAjax();
			});
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
app.views.SearchNotesView = Backbone.Marionette.ItemView.extend({
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
    },
    updateContents: function() {
    	xgds_notes.hideError(this.$el);
		xgds_notes.initializeNotesReference(this.$el, this.data.app_label, this.data.model_type, this.data.pk, this.data[this.modelMap.event_time_field], this.data[this.modelMap.event_timezone_field]);
		xgds_notes.getNotesForObject(this.data.app_label, this.data.model_type, this.data.pk, 'notes_content', this.$el.find('table.notes_list'));
    },
    render: function() {
        var appended = this.$el.empty().append(this.template(this.data));
    },
    onShow: function() {
    	// change the id of the table ...
    	var notesList = this.$el.find('.notes_list');
    	notesList.attr('id', 'notes_list' + this.modelName);
    	xgds_notes.setupNotesUI();
    	this.updateContents();
    }
});

app.views.SearchResultsView = Backbone.Marionette.LayoutView.extend({
	initialize: function() {
		this.modelMap = {};
	},
    regions: function(options){
        return {
            viewRegion: (options.viewRegion) ? {el:"#viewDiv"} : '#viewDiv',
            viewNotesRegion: (options.viewRegion) ? {el:"#notesDiv"} : '#notesDiv'
        };
      },
    onShow: function() {
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
    getColumnDefs: function(columns, searchableColumns){
    	var result = [];
    	if (_.isUndefined(searchableColumns)){
    		searchableColumns = [];
    	}
    	for (var i=0; i<columns.length; i++){
    		var context = this;
    		var heading = columns[i];
    		var columnDef = {targets: i};
    		if ($.inArray(heading, searchableColumns) > -1){
    			columnDef['searchable'] = true;
    		}
    		if (this.columnTitles != undefined){
        		columnDef['title'] = this.columnTitles[i];
        	}
    		if (heading.toLowerCase().indexOf('zone') > -1) {
    			columnDef['render'] = function ( data, type, row ) {
    										   var mmap = context.lookupModelMap(context.selectedModel);
                                               return getLocalTimeString(row[0], row[1], "z");
                                           };
    		} else if  (heading.toLowerCase().indexOf('time') > -1){
    			columnDef['render'] = function ( data, type, row ) {
    											var mmap = context.lookupModelMap(context.selectedModel);
                                               return getLocalTimeString(row[0], row[1], "MM/DD/YY HH:mm:ss");
                                           }
    		} else if (heading.toLowerCase().indexOf('thumbnail') > -1) {
    			columnDef['render'] = function(data, type, row){
    									if (data != ''){
    										var result = '<img width="100" src="' + data + '"'; 
    										result += '">';
    										return result;
    									} else {
    										return '';
    									}
    								};
    		} else if (heading.toLowerCase().indexOf('tag') > -1){
			    			columnDef['render'] =  function(data, type, row) {
			    				if (data != ''){
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
					if (data != ''){
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
			}
    		result.push(columnDef);
    	}
    	
    	return result;
    },
    setupDatatable: function(selectedModel, data){
    	this.selectedModel = selectedModel;
        this.lookupModelMap(selectedModel);

        this.theTable = this.$("#searchResultsTable");
        this.columns = app.options.searchModels[selectedModel].columns;
        if (_.isUndefined(this.columns) && !_.isUndefined(data) && !_.isEmpty(data)){
        	this.columns = Object.keys(data[0]);
        }
        this.columns = _.difference(this.columns, app.options.searchModels[selectedModel].hiddenColumns);
        this.columnTitles = app.options.searchModels[selectedModel].columnTitles;
        this.columnHeaders = this.getColumnDefs(this.columns, app.options.searchModels[selectedModel].searchableColumns);
        $.fn.dataTable.moment( DEFAULT_TIME_FORMAT);
        $.fn.dataTable.moment( "MM/DD/YY HH:mm:ss");
        var tableheight = this.calcDataTableHeight();
        if (app.options.tableHeight != undefined){
        	tableheight = app.options.tableHeight;
        }
        
        var dataTableObj = {
                columns: this.columnHeaders,
                autoWidth: true,
                dom: '<"top"flp<"clear">>rt<"bottom"ip<"clear">>',
                stateSave: false,
                paging: true,
                pageLength: 10, 
                lengthChange: true,
                ordering: true,
                select:true,
                order: [[ 0, "desc" ]],
                jQueryUI: false,
                scrollY:  tableheight,
                "lengthMenu": [[10, 20, 40, 80, -1], [10, 20, 40, 80, "All"]],
                "language": {
                    "lengthMenu": "Display _MENU_"
                }
        }
        
        if (!_.isUndefined(data)){
        	dataTableObj['data'] = data;
        } else {
        	var url = '/xgds_map_server/view/' + selectedModel;
        	dataTableObj['processing'] = true;
        	dataTableObj['serverSide'] = true;
        	
        	var ajaxConfig = {
        	    "url": url,
        	    "data": function ( d ) {
        	    	var todayCheckbox = $('#today');
                	var today = 1;
                	if (todayCheckbox.length > 0){
                		today = todayCheckbox[0].checked
                	}
        	      return $.extend( {}, d, {
        	        "today": today
        	      } );
        	    }
        	}
        	dataTableObj['ajax']= ajaxConfig;
        }
        this.theDataTable = $(this.theTable).DataTable( dataTableObj );
        var context = this;
//        this.theDataTable.on( 'xhr', function () {
//            var json = context.theDataTable.ajax.json();
//            if (context.theDataTable.rows().count() == 0){
//            	alert('got data');
//            }
//        } );
        connectSelectionCallback($("#searchResultsTable"), this.handleTableSelection, true, this);
        this.listenToTableChanges();
        this.filterMapData();
        app.vent.trigger("repack");
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
      this.theTable.append('<thead class="table_header"><tr id="columnRow"></tr></thead>');
      var columnRow = this.$('#columnRow');
      $.each(this.columns, function(index, col){
          columnRow.append("<th>"+ col +"</th>");
      });
    },
    updateDetailView: function(handlebarSource, data) {
    	if (this.detailView == undefined){
    		this.createDetailView(handlebarSource, data);
        } else {
        	this.detailView.setHandlebars(handlebarSource);
        	this.detailView.setData(data);
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
    		this.viewRegion.show(this.detailView);
    		this.viewNotesRegion.show(this.detailNotesView);
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
    handleTableSelection: function(index, theRow, context) {
    	var modelMap = context.lookupModelMap(context.selectedModel);
    	var data = _.object(modelMap.columns, theRow);
    	
    	if (modelMap.viewHandlebars != undefined){
    		if (modelMap.handlebarSource == undefined){
				var url = '/xgds_core/handlebar_string/' + modelMap.viewHandlebars;
				$.get(url, function(handlebarSource, status){
					modelMap['handlebarSource'] = handlebarSource;
					if (modelMap.viewJS != undefined){
						$.getManyJS( modelMap.viewJS, function() {
							if (modelMap.viewCss != undefined){
								$.getManyCss(modelMap.viewCss, function(){
									context.updateDetailView(modelMap.handlebarSource, data);
								});
							} else {
								context.updateDetailView(modelMap.handlebarSource, data);
							}
						});
					} else if (modelMap.viewCss != undefined){
						$.getManyCss(modelMap.viewCss, function(){
							context.updateDetailView(modelMap.handlebarSource, data);
						});
					} else {
						context.updateDetailView(modelMap.handlebarSource, data);
					}
			    });
    		} else {
    			context.updateDetailView(modelMap.handlebarSource, data);
    		}
		} else if (_.isNumber(data.lat)){
			showOnMap([data]);
		}
    },
    listenToTableChanges: function() {
        var _this = this;
        this.$("#searchResultsTable").on( 'page.dt', { _this : this }, function (event) {
            var _this = event.data._this;
            _this.filterMapData();
        });
        this.$("#searchResultsTable").on( 'search.dt', { _this : this },  function (event) {
            var _this = event.data._this;
            _this.filterMapData();
        });
    },
    unListenToTableChanges: function() {
        this.$("#searchResultsTable").off( 'page.dt');
        this.$("#searchResultsTable").off( 'search.dt');
    },
    filterMapData: function() {
    	//TODO figure out what we are doing
//        var thedt = this.theDataTable;
//        var rowData = thedt.$('tr', {"page": "current", "filter": "applied"} );
//        var data = [];
//        $.each(rowData, function(index, value){
//            var datum = thedt.fnGetData(value);
//            if (!_.isUndefined(datum)){
//                data.push(datum);
//            }
//        });
//        app.vent.trigger("mapSearch:found", data);  
    },
    calcDataTableHeight : function() {
        var h =  Math.floor($(window).height()*.4);
        return h + 'px';
    },
    reset: function() {
        if (!_.isUndefined(this.theDataTable)) {
            this.unListenToTableChanges();
            this.theDataTable.fnDestroy();
            this.theDataTable = undefined;
            this.$('#searchResultsTable').empty();
        }
    }
});
