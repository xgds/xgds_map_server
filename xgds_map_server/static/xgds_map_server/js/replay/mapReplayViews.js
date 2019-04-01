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