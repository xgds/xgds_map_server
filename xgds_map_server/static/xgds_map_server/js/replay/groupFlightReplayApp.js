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
			tabsRegion: '#tabs',
			plotRegion: '#plot-container',
			plotDataValuesRegion: '#plot-data-values-container'
		},

		onRender: function() {
			this.showChildView('layersRegion', new app.views.FancyTreeView());
			app.map = new app.views.OLMapView();
			this.showChildView('mapRegion', app.map);
			this.showChildView('tabsRegion', new app.views.TabNavView());
			this.showChildView('plotRegion', new app.views.ReplayPlotView());
			this.showChildView('plotDataValuesRegion', new app.views.ReplayDataValuesView());
		}

	});
	
	xGDS.ReplayApplication = xGDS.Application.extend( {
		max_end_time: undefined,
		plot_models_initialized: false,
        trackViews: [],
		mapBottomPadding: 50,
		getRootView: function() {
			return new xGDS.ReplayRootView();
		},
		onStart: function() {
        	xGDS.Application.prototype.onStart.call(this);
        	this.parseJSON();
        	this.initializePlotModels();
        },
        initialize: function(options){
            xGDS.Application.prototype.initialize(options);
            if ('max_end_time' in options) {
				self.max_end_time = moment(options.max_end_time);
			}
			this.listenTo(this.vent, 'layers:loaded', this.renderTracks);
		},
		initializePlotModels: function() {
        	app.plot_models = {};
			_.each(this.options.timeseries_config, function(options) {
				app.plot_models[options.model_name] = new app.models.PlotModel(options);
			});
			app.plot_models_initialized = true;
		},
		parseJSON: function() {
            app.groupFlight = new app.models.GroupFlight(app.options.group_flight, app.options.end_time);
            app.conditions = app.options.conditions;
    		this.vent.trigger('onGroupFlightLoaded');
        },
        getConditionStartEndTimes: function() {
			var result = [];
			_.each(app.conditions, function(condition, i, conditions) {
			    result.push({start:moment(condition.start_time), end:moment(condition.end_time)});
			});
			
			// if we are in live mode add a fake condition to get the timeline to draw correctly
			if (app.options.fake_end){
				result.push({start:moment(app.options.end_time), end:moment(app.options.end_time)})
			}
			return result;
		},
        renderTracks: function() {
            var context = this;
			_.each(appOptions.track_metadata, function(track_metadata){
				var trackView = new app.views.TrackView(track_metadata);
				context.trackViews.push(trackView);
			});

		},
	});

	xGDS.LiveReplayApplication = xGDS.ReplayApplication.extend( {
		play_sse_list: [],
		pause_sse_list: [],
		play_callback: function(play_time) {
			// In this case we always want to set time to now and resubscribe
			app.vent.trigger('now');
			//TODO Khaled iterate through the play sse list and subscribe IF the time is the max time
		},
		pause_callback: function(pause_time) {
			// TODO Khaled iterate through the pause sse list and unsubscribe
		},

		getRootView: function() {
			return new xGDS.ReplayRootView();
		},
		onStart: function() {
        	xGDS.ReplayApplication.prototype.onStart.call(this);
        	var context = this;
        	app.vent.on('now', context.set_now_time(context))
        },
		set_now_time: function(context) {
			console.log('NOW PRESSED');
			if (!_.isUndefined(context.max_end_time)){
				playback.setCurrentTime(context.max_end_time);
					//app.vent.trigger('playback:setCurrentTime', context.max_end_time);
			}
			else {
				console.log('MAX END TIME NOT SET')
			}
		},
        initialize: function(options){
            xGDS.ReplayApplication.prototype.initialize(options);

            // Make sure the options contain play_sse_list and pause_sse_list
			if ('play_sse_list' in options) {
				self.play_sse_list = options.play_sse_list;
			}
			if ('pause_sse_list' in options) {
				self.pause_sse_list = options.pause_sse_list;
			}

			this.set_now_time(this);
			playback.addStopListener(this.pause_callback);
			playback.addPlayListener(this.play_callback)

			// remove other listeners
			playback.removeListener(playback.plot);
		}
	});
	
	xGDS.Factory = {
        construct: function(options){
        	if (options.live) {
				return new xGDS.LiveReplayApplication(options);
			}
        	return new xGDS.ReplayApplication(options);
        }
	};

}( window.xGDS = window.xGDS || {}, jQuery, _, Backbone, Marionette ));
	

    
