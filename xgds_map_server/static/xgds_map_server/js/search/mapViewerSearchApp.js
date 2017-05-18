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

	xGDS.SearchRootView = xGDS.RootView.extend({
		regions: {
			mapRegion: '#map',
			layersRegion: '#layers',
			searchRegion: '#searchDiv'
		},
		onRender: function() {
			app.map = new app.views.OLMapView();
			this.showChildView('mapRegion', app.map);
			this.showChildView('layersRegion', new app.views.FancyTreeView());
			var hideModelChoice = (this.options.modelName !== undefined);
	        this.showChildView('searchRegion', new app.views.SearchView({template: '#template-mapViewerSearch',
	        													         searchResultsRegion: true,
	        													         viewRegion: true,
	        													         hideModelChoice: hideModelChoice,
	        													         selectedModel: app.options.modelName}));
		}
	});
	
	xGDS.SearchApplication = xGDS.Application.extend( {
		mapBottomPadding: 50,
		getRootView: function() {
			return new xGDS.SearchRootView();
		}
	});
	
	xGDS.Factory = {
			construct: function(options){
				return new xGDS.SearchApplication(options);
			}
	};

}( window.xGDS = window.xGDS || {}, jQuery, _, Backbone, Marionette ));
	

    
