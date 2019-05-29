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
			plotDataValuesRegion: '#plot-data-values-container',
			vehicleRegion: '#vehicle-info'
		},

		onRender: function() {
			this.showChildView('layersRegion', new app.views.FancyTreeView());
			app.map = new app.views.OLMapView();
			this.showChildView('mapRegion', app.map);
			this.showChildView('tabsRegion', new app.views.TabNavView());
			this.showChildView('plotRegion', new app.views.ReplayPlotView());
			this.showChildView('plotDataValuesRegion', new app.views.ReplayDataValuesView());
			this.showChildView('vehicleRegion', new app.views.VehicleInfoView({vehicle:app.options.default_vehicle}));
		}

	});

	// non live replay application
	xGDS.ReplayApplication = xGDS.Application.extend( {
		plot_models_initialized: false,
        trackViews: {},
		mapBottomPadding: 50,
		hide_track: false,
		freeze_time: false, // true to not auto update time
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
				this.max_end_time = moment(options.max_end_time);
			}
            if ('hide_track' in options) {
				this.hide_track = options.hide_track;
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
				track_metadata.hide_tracks = context.options.hide_tracks;
				var trackView = new app.views.TrackView(track_metadata);
				var track_key = Object.keys(context.trackViews).length;
				if ('vehicle' in track_metadata.data && !_.isEmpty(track_metadata.data.vehicle)) {
					track_key = track_metadata.data.vehicle.toLowerCase();
				}
				context.trackViews[track_key] = trackView;
			});

		},
		get_end_time: function() {
			return this.groupFlight.end_moment;
		},
		// add a playback listener to set the time
		timePlaybackListener :  {
			lastUpdate: undefined,
			invalid: false,
			initialize: function() {
				this.event_time_input = $("#id_event_time");
			},
			doSetTime: function(currentTime){
				if (currentTime === undefined){
					return;
				}
				if (!app.freeze_time) {
					this.lastUpdate = moment(currentTime);
					// todo the time is always changing, do we want this just when we push the button?
					// maybe add back the now button?
					this.event_time_input.val(this.lastUpdate.format('MM/DD/YY HH:mm:ss zz'));
				}
			},
			start: function(currentTime){
				this.doSetTime(currentTime);
			},
			update: function(currentTime){
				if (this.lastUpdate === undefined){
					this.doSetTime(currentTime);
					return;
				}
				var delta = currentTime.diff(this.lastUpdate);
				if (Math.abs(delta) >= 100) {
					this.doSetTime(currentTime);
				}
			},
			pause: function() {
			}
		},
		hook_playback: function() {
			playback.addListener(this.timePlaybackListener);
			this.timePlaybackListener.doSetTime(playback.getCurrentTime());
		}

	});

	// for when we are in delayed live mode, like watching video on a live group flight
	xGDS.DelayedLiveReplayApplication = xGDS.ReplayApplication.extend( {
		end_time_initialized: false,
		initialize: function(options){
            xGDS.ReplayApplication.prototype.initialize(options);

			var context = this;
			// the live button sends a 'now' event but it really wants to use the
        	this.listenTo(this.vent, 'now', function() {
				analytics.trackAction('playback', 'delayed_live', document.title);
				xgds_video.nowButtonCallback();
			});
		},
		set_now_time: function() {
			if (!_.isUndefined(this.max_end_time)){
				var the_time = this.max_end_time;
				if ('now_time_lag' in app.options && !_.isUndefined(app.options.now_time_lag) && app.options.now_time_lag > 0) {
					the_time = this.max_end_time.subtract(app.options.now_time_lag, 'seconds');
				}
				playback.setCurrentTime(the_time);
			}
			else {
				console.log('MAX END TIME NOT SET')
			}
		},
		subscribe: function() {
			var context = this;
			sse.subscribe('condition', context.handleConditionEvent, "handleConditionEvent", ['sse']);
		},
		handleConditionEvent: function(event) {
			var data = JSON.parse(event.data);
			app.conditions.push(data[0]);
			app.vent.trigger('updateDuration');
		}
	});

	xGDS.LiveReplayApplication = xGDS.ReplayApplication.extend( {
		play_sse_list: [],
		pause_sse_list: [],
		end_time_initialized: false,
		play_callback: function(play_time) {
			// In this case we always want to set time to now and resubscribe
			if (this.end_time_initialized) {
				app.vent.trigger('now');
			}
			app.vent.trigger('live:play');
		},
		pause_callback: function(pause_time) {
			app.vent.trigger('live:pause');
		},

		// getRootView: function() {
		// 	return new xGDS.ReplayRootView();
		// },
		initialize: function(options){
            xGDS.ReplayApplication.prototype.initialize(options);

			var context = this;
        	this.listenTo(this.vent, 'now', function() {playback.playButtonCallback();analytics.trackAction('playback', 'live', document.title);context.set_now_time()});
        	this.listenTo(this.vent, 'position:latest', function(latest_time) {
        		context.update_max_time(latest_time);
			});

			if ('play_sse_list' in options) {
				this.play_sse_list = options.play_sse_list;
			}
			if ('pause_sse_list' in options) {
				this.pause_sse_list = options.pause_sse_list;
			}

		},
		hook_playback: function() {
			xGDS.ReplayApplication.prototype.hook_playback();
			var context = this;
			playback.playFlag = true;
			playback.addStopListener(function() {context.pause_callback();});
			playback.addPlayListener(function() {context.play_callback();});

			// remove other listeners
			playback.removeListener(playback.plot);
		},
		onStart: function() {
        	xGDS.ReplayApplication.prototype.onStart.call(this);
        	this.subscribe();
        },
		get_end_time: function() {
			return this.max_end_time;
		},
		update_max_time: function(latest_time) {
			if (!_.isUndefined(latest_time)) {
				if (app.options.fake_end) {
					var update = false
					if (!this.end_time_initialized) {
						this.end_time_initialized = true;
						update = true;
					} else if (latest_time.isAfter(this.max_end_time)) {
						update = true;
					}
					if (update) {
						this.max_end_time = latest_time;
						if (playback.playFlag) {
							this.set_now_time();
						}
					}
				}
			}
		},
		set_now_time: function() {
			if (!_.isUndefined(this.max_end_time)){
				playback.setCurrentTime(this.max_end_time);
			}
			else {
				console.log('MAX END TIME NOT SET')
			}
		},
		subscribe: function() {
			var context = this;
			sse.subscribe('position', context.handlePositionEvent,   "handlePositionEvent",  trackSse.getChannels());
			sse.subscribe('condition', context.handleConditionEvent, "handleConditionEvent", ['sse']);
		},
		handlePositionEvent: function(event) {
			var data = JSON.parse(event.data);
			if ('timestamp' in data && !_.isUndefined(data.timestamp)) {
				app.vent.trigger('position:latest', moment(data.timestamp) );
			}
			// update the track
			var channel = event.target.url.split('=')[1];
			var topic = channel + ':position';
			data.update = playback.playFlag;
			app.vent.trigger(topic, data);
		},
		handleConditionEvent: function(event) {
			var data = JSON.parse(event.data);
			app.conditions.push(data[0]);
			app.vent.trigger('updateDuration');
		}

	});
	
	xGDS.Factory = {
        construct: function(options){
        	if (options.live) {
        		if (options.delayed_live) {
        			// live page but we are not running from current latest time, we are playing in the past probably because of video
					return new xGDS.DelayedLiveReplayApplication(options);
				} else {
        			// super live page no video or reason to delay
					return new xGDS.LiveReplayApplication(options);
				}
			}
        	// group flight is completed and not live, do not subscribe to anything
        	return new xGDS.ReplayApplication(options);
        }
	};

}( window.xGDS = window.xGDS || {}, jQuery, _, Backbone, Marionette ));
	

    
