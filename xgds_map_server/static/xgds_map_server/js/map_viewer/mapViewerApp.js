//__BEGIN_LICENSE__
//Copyright (c) 2015, United States Government, as represented by the
//Administrator of the National Aeronautics and Space Administration.
//All rights reserved.

//The xGDS platform is licensed under the Apache License, Version 2.0
//(the "License"); you may not use this file except in compliance with the License.
//You may obtain a copy of the License at
//http://www.apache.org/licenses/LICENSE-2.0.

//Unless required by applicable law or agreed to in writing, software distributed
//under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
//CONDITIONS OF ANY KIND, either express or implied. See the License for the
//specific language governing permissions and limitations under the License.
//__END_LICENSE__


(function( xGDS, $, _, Backbone, Marionette ) {

	xGDS.MapRootView = Marionette.View.extend({
		template: '#application_contents',
		regions: {
			mapRegion: '#map',
			layersRegion: '#layers'
		},
		onRender: function() {
			app.map = new app.views.OLMapView();
			this.showChildView('mapRegion', app.map);
			this.showChildView('layersRegion', new app.views.FancyTreeView());
		},
		onAttach: function() {
			var pageTopHeight = $('#page-top').outerHeight();
			var pageElement = $('#page');
			var pageContentElement = $('#page-content');
			pageContentElement.outerHeight(pageElement.innerHeight() - pageTopHeight);
			$(window).bind('resize', function() {
				pageContentElement.outerHeight(pageElement.innerHeight() - pageTopHeight);
			});
		}
	});

	xGDS.Application = Marionette.Application.extend( {
		views: {},
		region: '#application',
		vent: Backbone.Radio.channel('global'),
		tree: undefined,
		treeData: null,
		mapBottomPadding: 120,
		getRootView: function() {
			return new xGDS.MapRootView();
		},
		onStart: function() {
			this.rootView = this.getRootView();
			this.showView(this.rootView);
		},
		State: {
			featureSelected: undefined,
			mouseDownLocation: undefined,
			pageInnerWidth: undefined,
			mapResized: false,
			mapHeightSet: false,
		},
		initialize: function(options){
			this.options = options = _.defaults(options || {});
			this.views = this.views || {};
			this.notes_views = this.notes_views || {};
		},
		showDetailView: function(handlebarSource, data, modelMap, modelName){

			var detailView = new app.views.SearchDetailView({
				handlebarSource:handlebarSource,
				data:data,
				modelMap: modelMap
			});
			this.detail_view = detailView;
			var viewRegionName = 'viewRegion'+modelName;
			var viewDivName = '#viewDiv'+modelName;
			this.rootView.addRegion(viewRegionName, viewDivName);
			this.rootView.showChildView(viewRegionName, detailView);
			showOnMap(data); 

			// add the notes 
			var notesView = new app.views.SearchNotesView({
				data:data,
				modelMap: modelMap,
				modelName: modelName
			});
			this.notes_views[modelName] = notesView;
			var notesRegionName = 'notesRegion'+modelName;
			var notesDivName = '#notesDiv' + modelName;
			this.rootView.addRegion(notesRegionName, notesDivName);
			this.rootView.showChildView(notesRegionName, notesView);

			// hook up ajax reloading
			var reloadIconName = '#reload' + modelName;
			$(reloadIconName).click(function() {
				reloadModelData(modelName);
			});

		}
	});
	
	xGDS.Factory = {
			construct: function(options){
				return new xGDS.Application(options);
			}
	}

}( window.xGDS = window.xGDS || {}, jQuery, _, Backbone, Marionette ));