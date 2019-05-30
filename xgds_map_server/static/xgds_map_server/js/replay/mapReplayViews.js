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

app.views = app.views || {};

app.views.FlightInfoTabView = Marionette.View.extend({
	template: '#template-group-flight-info',
});

var UNKNOWN = '-';

app.views.VehicleInfoView = Marionette.View.extend({
	template: '#template-vehicle-info',
    initialize: function(options) {
        this.options = options || {};
        var capitalized_vehicle = options.vehicle[0].toUpperCase() + options.vehicle.slice(1);
        var context = this;
        app.vent.on(capitalized_vehicle + ':position_data', function(params) {context.update_vehicle(params)});
    },
    clean: function(format, input) {
	    if (_.isUndefined(input)){
	        return UNKNOWN;
        }
	    try {
	        return sprintf(format, input);
        } catch (e){
	        return input
        }
    },
    show_nothing: function() {
	    $("#vehicle_latitude").html(UNKNOWN);
	    $("#vehicle_longitude").html(UNKNOWN);
        $("#vehicle_altitude").html(UNKNOWN);
        $("#vehicle_heading").html(UNKNOWN);
        $("#vehicle_depth").html(UNKNOWN);
        $("#vehicle_timestamp").html(UNKNOWN);
    },
    clean_time: function(timestamp){
	    if (_.isUndefined(timestamp)){
	        return UNKNOWN;
        }
	    var t = moment(timestamp);
	    if (t.isValid()){
	        return timestamp.format('MM/DD/YY HH:mm:ss');
        }
	    return UNKNOWN;
    },
    update_vehicle: function(data) {
	    if (_.isUndefined(data)){
	        this.show_nothing();
	        return;
        }
        $("#vehicle_latitude").html(this.clean("%.6f",  data.latitude));
        $("#vehicle_longitude").html(this.clean("%.6f",  data.longitude));
        $("#vehicle_altitude").html(this.clean("%.3f", data.altitude));
        var heading = data.heading;
        if ('yaw' in data){
            heading = data.yaw;
        }
        $("#vehicle_heading").html(this.clean("%.3f", heading));
        $("#vehicle_depth").html(this.clean("%.3f", data.depth));
        $("#vehicle_timestamp").html(this.clean_time(data.timestamp));
        
    }
});

app.views.TabNavView = xGDS.TabNavView.extend({
    viewMap: {
    	'info': app.views.FlightInfoTabView,
        'search': app.views.SearchView,
        'plot': app.views.ReplayDataPlotsView,
        'links': app.views.ReplayLinksView
    },

    initialize: function() {
    	xGDS.TabNavView.prototype.initialize.call(this);
        var context = this;
        this.listenTo(app.vent, 'onGroupFlightLoaded', function() {
        	 this.setTab('info');
        }, this);
        this.listenTo(app.vent, 'tab:set', function(tab_id) {
            if (Object.keys(this.viewMap).indexOf(tab_id) >= 0){
                this.setTab(tab_id);
            }
        }, this);
    },
    getModel: function() {
        return app.groupFlight;
    }

});

