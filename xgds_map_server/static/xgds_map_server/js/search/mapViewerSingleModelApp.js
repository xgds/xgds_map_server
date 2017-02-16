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
** Main Application object
*/
var app = (function($, _, Backbone) {
    app = new Marionette.Application();
    app.views = app.views || {};
    app.addRegion('mapRegion', '#mapDiv');
    app.addRegion('layersRegion', '#layers');
    app.addRegion('viewRegion', '#viewDiv');
    app.addRegion('notesRegion', '#notesDiv');

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
        app.layersRegion.show(new app.views.FancyTreeView());
    });
    
    app.showDetailView = function(handlebarSource, data, modelMap){
    	var detailView = new app.views.SearchDetailView({
    		handlebarSource:handlebarSource,
    		data:data,
    		modelMap: modelMap
    	});
    	app.viewRegion.show(detailView);
    	app.showNotesView(data, modelMap);
    	showOnMap([data]); 
    };
    
    app.showNotesView = function(data, modelMap){
    	var notesView = new app.views.SearchNotesView({
    		data:data,
    		modelMap: modelMap,
    		modelName: app.options.modelName
    	});
    	app.notesRegion.show(notesView);
    }
    
    app.addInitializer(function(options) {
        this.options = options = _.defaults(options || {});
        
        var selectedModel = app.options.modelName;
        var modelMap = app.options.searchModels[selectedModel];
    	if (modelMap.viewHandlebars != undefined){
    		var data = undefined;
    		var url = '/xgds_map_server/fmapJson/' + modelMap.model + '/pk:' + this.options.modelPK;
			
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
										app.showDetailView(modelMap.handlebarSource, data, modelMap);
									});
								} else {
									app.showDetailView(modelMap.handlebarSource, data, modelMap);
								}
							});
						} else if (modelMap.viewCss != undefined){
							$.getManyCss(modelMap.viewCss, function(){
								app.showDetailView(modelMap.handlebarSource, data, modelMap);
							});
						} else {
							app.showDetailView(modelMap.handlebarSource, data, modelMap);
						}
					});
				});
    	}
					
        
    });
    
    app.router = new Backbone.Router({
        routes: {
        	'layers' : 'layers'
        }
    });


    return app;

}(jQuery, _, Backbone));
