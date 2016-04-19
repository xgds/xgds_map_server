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

app.views.SearchView = Backbone.Marionette.LayoutView.extend({
    template: '#template-search',
    events: {
        'click #getSearchFormButton': 'setupSearchForm',
        'click #doSearch': 'doSearch',
        'click #doSaveSearch': 'openSaveDialog'
    },
    regions: {
        modelChoiceRegion: '#modelChoiceDiv',
        searchFormRegion: { el: $('#searchFormDiv') },
        searchResultsRegion: { el: $('#searchResultsDiv') } 
    },
    initialize: function() {
        var source = $(this.template).html();
        if (_.isUndefined(source)) {
            this.template = function() {
                return '';
            };
        } else {
            this.template = Handlebars.compile(source);
        }
    },
    onRender: function() {
        var theKeys = Object.keys(app.options.searchModels);
        this.$el.html(this.template({
            searchModels: theKeys
        }));
        this.searchResultsView = new app.views.SearchResultsView({template:'#template-search-results' }); 
//                                                                  region: this.searchResultsRegion})
        this.searchResultsRegion.show(this.searchResultsView);
        app.vent.trigger("repack");
        
    },
    setupSearchForm: function() {
    	var newModel = app.options.modelName;
    	if (newModel === undefined || newModel == 'None'){
    		newModel = this.$("#searchModelSelector").val();
	        if (!_.isUndefined(this.selectedModel)){
	            if (newModel == this.selectedModel){
	                return;
	            }
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
        var theForm = this.$("#form-"+this.selectedModel);
        var postData = theForm.serializeArray();
        postData.push({'name':'modelClass', 'value':app.options.searchModels[this.selectedModel].model});
        this.setMessage("Searching...");
        $.ajax({
            url: '/xgds_map_server/doMapSearch',
            dataType: 'json',
            data: postData,
            success: $.proxy(function(data) {
                if (_.isUndefined(data) || data.length === 0){
                    this.setMessage("None found.");
                } else {
                    this.searchResultsView.updateContents(this.selectedModel, data);
                    this.setupSaveSearchDialog();
                    this.clearMessage();
                }
            }, this),
            error: $.proxy(function(data){
                app.vent.trigger("mapSearch:clear");
                this.searchResultsView.reset();
                this.setMessage("Search failed.")
            }, this)
          });
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
    	this.handlebarSource = '';
    	this.data = options.data;
    	this.setHandlebars(options.handlebarSource);
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
        this.$el.html(this.template(this.data));
    }
});

app.views.SearchResultsView = Backbone.Marionette.LayoutView.extend({
	regions: {
		region: { el: $('#searchResultsDiv') },
		viewRegion: { el: $("#viewDiv") }
	},
    getColumnDefs: function(columns){
    	result = [];
    	for (var i=0; i<columns.length; i++){
    		var heading = columns[i];
    		var columnDef = {data:heading,
    						 targets: i};
    		if (this.columnTitles != undefined){
        		columnDef['title'] = this.columnTitles[i];
        	}
    		if (heading.toLowerCase().indexOf('zone') > -1) {
    			columnDef['render'] = function ( data, type, row ) {
                                               return getLocalTimeString(row[0], row.timezone, "z");
                                           };
    		} else if  (heading.toLowerCase().indexOf('time') > -1){
    			columnDef['render'] = function ( data, type, row ) {
                                               return getLocalTimeString(data, row.timezone, "MM/DD/YY HH:mm:ss");
                                           }
    		} else if (heading.toLowerCase().indexOf('thumbnail') > -1) {
    			columnDef['render'] = function(data, type, row){
    									if (data != ''){
    										var result = '<img width="100" src="' + data + '"'; //row['content_thumbnail_url'] + '"';
    										result += '">';
    										return result;
    									} else {
    										return '';
    									}
    								};
    		}
    		result.push(columnDef);
    	}
    	
    	return result;
    },
    updateContents: function(selectedModel, data) {
        if (data.length > 0){
            if (!_.isUndefined(this.theDataTable)) {
                this.theDataTable.fnClearTable();
                this.theDataTable.fnAddData(data);
            } else {
                this.theTable = this.$("#searchResultsTable");
                this.columns = app.options.searchModels[selectedModel].columns;
                if (this.columns == undefined){
                	this.columns = Object.keys(data[0]);
                }
                this.columns = _.difference(this.columns, app.options.searchModels[selectedModel].hiddenColumns);
                this.columnTitles = app.options.searchModels[selectedModel].columnTitles;
                this.columnHeaders = this.getColumnDefs(this.columns);
                $.fn.dataTable.moment( DEFAULT_TIME_FORMAT);
                $.fn.dataTable.moment( "MM/DD/YY HH:mm:ss");
                var dataTableObj = {
                        data: data,
                        columns: this.columnHeaders,
                        autoWidth: true,
                        stateSave: false,
                        paging: true,
                        pageLength: 10, 
                        lengthChange: true,
                        ordering: true,
                        order: [[ 0, "desc" ]],
                        jQueryUI: false,
                        scrollY:  this.calcDataTableHeight(),
                        "lengthMenu": [[10, 20, 40, -1], [10, 20, 40, "All"]],
                        "language": {
                            "lengthMenu": "Display _MENU_"
                        }
                }
                this.setupColumnHeaders();
                this.theDataTable = this.theTable.dataTable( dataTableObj );
                this.viewHandlebars = app.options.searchModels[selectedModel].viewHandlebars;
                connectSelectionCallback($("#searchResultsTable"), this.handleTableSelection, true, this);
                this.listenToTableChanges();
                this.filterMapData();
                app.vent.trigger("repack");
            }
        }
    },
    setupColumnHeaders: function() {
      this.theTable.append('<thead class="table_header"><tr id="columnRow"></tr></thead>');
      var columnRow = this.$('#columnRow');
      $.each(this.columns, function(index, col){
          columnRow.append("<th>"+ col +"</th>");
      });
    },
    handleTableSelection: function(index, theRow, context) {
    	var data = theRow;
    	// TODO implement building or updating the view.
    	if (context.viewHandlebars != undefined){
    		if (context.detailView == undefined) {
    			var url = '/xgds_core/handlebar_string/' + context.viewHandlebars;
    			$.get(url, function(handlebarSource, status){
    		        if (context.detailView == undefined){
    		        	context.detailView = new app.views.SearchDetailView({
    		        		handlebarSource:handlebarSource,
    		        		data:data
    		        	});
    		        	context.viewRegion.show(context.detailView);
    		        } else {
    		        	context.detailView.setHandlebars(handlebarSource);
    		        	context.detailView.setData(data);
    		        	context.detailView.render();
    		        }
    		    });
    		}
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
        var thedt = this.theDataTable;
        var rowData = thedt.$('tr', {"page": "current", "filter": "applied"} );
        var data = [];
        $.each(rowData, function(index, value){
            var datum = thedt.fnGetData(value);
            if (!_.isUndefined(datum)){
                data.push(datum);
            }
        });
        app.vent.trigger("mapSearch:found", data);  
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
