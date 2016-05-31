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

/*
** Override the TemplateCache function responsible for
** rendering templates so that it will use Handlebars.
*/
Backbone.Marionette.TemplateCache.prototype.compileTemplate = function(
    rawTemplate) {
    return Handlebars.compile(rawTemplate);
};

/*
** Main Application object
*/
var app = (function($, _, Backbone) {
    app = new Backbone.Marionette.Application();
    app.views = app.views || {};
    app.detail_views = app.detail_views || {};
    app.notes_views = app.notes_views || {};
    app.regionManager = new Marionette.RegionManager();
    app.regionManager.addRegions({'mapRegion' : '#mapDiv',
        						  'layersRegion': '#layers'
    							});

    app.module('State', function(options) {
        this.addInitializer(function(options) {
        	this.featureSelected = undefined;
            this.mouseDownLocation = undefined;
            this.pageInnerWidth = undefined;
            this.mapResized = false;
            this.mapHeightSet = false;
            this.tree = undefined;
            this.treeData = null;
        });
    });

    app.addInitializer(function(options) {
        var pageTopHeight = $('#page-top').outerHeight();
        var pageElement = $('#page');
        var pageContentElement = $('#page-content');
        pageContentElement.outerHeight(pageElement.innerHeight() - pageTopHeight);
        $(window).bind('resize', function() {
            pageContentElement.outerHeight(pageElement.innerHeight() - pageTopHeight);
        });
    });

    app.addInitializer(function(options) {
        this.options = options = _.defaults(options || {});
        app.map = new app.views.OLMapView({
            el: '#map'
        });
        app.vent.trigger('onMapSetup');
        app.regionManager.get('layersRegion').show(new app.views.FancyTreeView());
    });
    
    app.showDetailView = function(handlebarSource, data, modelMap, modelName){
    	
    	var detailView = new app.views.SearchDetailView({
    		handlebarSource:handlebarSource,
    		data:data,
    		modelMap: modelMap
    	});
    	app.detail_views[modelName] = detailView;
    	var viewRegionName = 'viewRegion'+modelName;
    	var viewDivName = '#viewDiv'+modelName;
    	app.regionManager.addRegion(viewRegionName, viewDivName);
    	app.regionManager.get(viewRegionName).show(detailView);
    	showOnMap(data); 
    	
    	// add the notes 
    	var notesView = new app.views.SearchNotesView({
    		data:data,
    		modelMap: modelMap
    	});
    	app.notes_views[modelName] = notesView;
    	var notesRegionName = 'notesRegion'+modelName;
    	var notesDivName = '#notesDiv' + modelName;
    	app.regionManager.addRegion(notesRegionName, notesDivName);
    	app.regionManager.get(notesRegionName).show(notesView);
    	
    	// hook up ajax reloading
    	var reloadIconName = '#reload' + modelName;
    	$(reloadIconName).click(function() {
    		reloadModelData(modelName);
    	});
    	
    };
    
    app.updateDetailView = function(modelName, data ){
    	var detailView = app.detail_views[modelName];
    	detailView.setData(data);
    	detailView.render();
    	
    	var notesView = app.notes_views[modelName];
    	notesView.setData(data);
    	notesView.updateContents();
    };
    
    var loadUpModel = function(modelName, modelMap, url) {
    	$.when($.get(url)
		).then(function(incomingData, status) {
			var data = incomingData[0];
			var url = '/xgds_core/handlebar_string/' + modelMap.viewHandlebars;
			$.get(url, function(handlebarSource, status){
				modelMap['handlebarSource'] = handlebarSource;
				if (modelMap.viewJS != undefined){
					$.getManyJS( modelMap.viewJS, function() {
						if (modelMap.viewCss != undefined){
							$.getManyCss(modelMap.viewCss, function(){
								app.showDetailView(modelMap.handlebarSource, data, modelMap, modelName);
							});
						} else {
							app.showDetailView(modelMap.handlebarSource, data, modelMap, modelName);
						}
					});
				} else if (modelMap.viewCss != undefined){
					$.getManyCss(modelMap.viewCss, function(){
						app.showDetailView(modelMap.handlebarSource, data, modelMap, modelName);
					});
				} else {
					app.showDetailView(modelMap.handlebarSource, data, modelMap, modelName);
				}
			});
		});
    };
    
    var reloadModelData = function(modelName){
    	var index = app.options.modelNames.indexOf(modelName);
    	var url = app.options.modelUrls[index];
    	$.when($.get(url)
		).then(function(incomingData, status) {
			var data = incomingData[0];
			app.updateDetailView(modelName, data);
		});
    };
    
    app.addInitializer(function(options) {
        this.options = options = _.defaults(options || {});
        
        for (var i=0; i < app.options.modelNames.length; i++){
        	var modelName = app.options.modelNames[i];
        	var url = app.options.modelUrls[i];
        	var modelMap = app.options.searchModels[modelName];
	    	if (modelMap.viewHandlebars != undefined){
	    		var data = undefined;
				loadUpModel(modelName, modelMap, url);
	    	}
        }
        
    });
    
    app.router = new Backbone.Router({
        routes: {
        	'layers' : 'layers'
        }
    });


    /*
     * Application-level Request & Respond services
     */
    app.hasHandler = function(name) {
        return !!this.reqres._wreqrHandlers[name];
    };
    
    return app;

}(jQuery, _, Backbone));
