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


(function( xGDS, $, _, Backbone, Marionette ) {
	
	xGDS.SingleModelRootView = xGDS.RootView.extend({
		regions: {
			mapRegion: '#map',
			layersRegion: '#layers',
			viewRegion: '#viewDiv',
			notesRegion: '#notesDiv'
		},
		onRender: function() {
			this.showChildView('layersRegion', new app.views.FancyTreeView());
			app.map = new app.views.OLMapView();
			this.showChildView('mapRegion', app.map);
		}
		
	});
	
	xGDS.SingleModelApplication = xGDS.Application.extend( {
		mapBottomPadding: 50,
		initialize: function(options) {
			xGDS.Application.prototype.initialize.call(this, options);
			this.vent.on('onMapSetup', this.fetchDetailContents, this);
		},
		getRootView: function() {
			return new xGDS.SingleModelRootView();
		},
		fetchDetailContents: function() {
			var selectedModel = this.options.modelName;
	        var modelMap = this.options.searchModels[selectedModel];
	        var context = this;
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
											context.showDetailView(modelMap.handlebarSource, data, modelMap);
										});
									} else {
										context.showDetailView(modelMap.handlebarSource, data, modelMap);
									}
								});
							} else if (modelMap.viewCss != undefined){
								$.getManyCss(modelMap.viewCss, function(){
									context.showDetailView(modelMap.handlebarSource, data, modelMap);
								});
							} else {
								context.showDetailView(modelMap.handlebarSource, data, modelMap);
							}
						});
					});
	    	}
		},
		showDetailView : function(handlebarSource, data, modelMap){
	    	var detailView = new app.views.SearchDetailView({
	    		handlebarSource:handlebarSource,
	    		data:data,
	    		modelMap: modelMap
	    	});
	    	app.rootView.showChildView('viewRegion', detailView);
	    	app.showNotesView(data, modelMap);
	    	showOnMap([data]); 
	    },
	    showNotesView: function(data, modelMap){
	    	var notesView = new app.views.SearchNotesView({
	    		data:data,
	    		modelMap: modelMap,
	    		modelName: app.options.modelName
	    	});
	    	app.rootView.showChildView('notesRegion', notesView);
	    }
		
	});
	
	xGDS.Factory = {
			construct: function(options){
				return new xGDS.SingleModelApplication(options);
			}
	};

}( window.xGDS = window.xGDS || {}, jQuery, _, Backbone, Marionette ));


