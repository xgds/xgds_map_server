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

app.views.ReplayLinksView = Marionette.View.extend({
    template: '#template-links',
    templateContext: function() {
    	var flight_ids = [];
    	_.each(app.groupFlight.flights, function(flight, i, flights){
    		flight_ids.push(flight.id);
		});

    	var data = {
			group_flight_links: app.options.group_flight_links,
			group_flight_id: app.groupFlight.id,
			flight_ids: flight_ids
    	}

    	return data;
    }
});