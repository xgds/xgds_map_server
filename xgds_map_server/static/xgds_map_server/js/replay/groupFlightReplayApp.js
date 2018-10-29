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

	xGDS.ReplayRootView = xGDS.RootView.extend({
		regions: {
			mapRegion: '#map',
			layersRegion: '#layers',
			tabsRegion: '#tabs'
		},
		renderTracks: function() {

			_.each(appOptions.track_metadata, function(track_metadata){
				var trackView = new app.views.TrackView(track_metadata);
			});

		},
		onRender: function() {
			this.listenTo(app.vent, 'layers:loaded', this.renderTracks);

			app.map = new app.views.OLMapView();
			this.showChildView('mapRegion', app.map);
			this.showChildView('layersRegion', new app.views.FancyTreeView());
			this.showChildView('tabsRegion', new app.views.TabNavView());

		}
	});
	
	xGDS.ReplayApplication = xGDS.Application.extend( {
		mapBottomPadding: 50,
		getRootView: function() {
			return new xGDS.ReplayRootView();
		},
		onStart: function() {
        	xGDS.Application.prototype.onStart.call(this);
        	this.parseJSON();
        },
		parseJSON: function() {
            app.groupFlight = new app.models.GroupFlight(app.options.group_flight);
    		this.vent.trigger('onGroupFlightLoaded');
        },
	});
	
	xGDS.Factory = {
        construct: function(options){
            return new xGDS.ReplayApplication(options);
        }
	};

}( window.xGDS = window.xGDS || {}, jQuery, _, Backbone, Marionette ));
	

    
