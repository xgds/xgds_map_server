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

app.models = app.models || {};

(function(models) {

	models.GroupFlight = Backbone.Model.extend({
		initialize: function(plain_object, end_time) {
			Object.assign(this, plain_object);
			if (_.isNull(this.end_time)) {
				this.end_time = end_time;
			}
			this.updateTimes();
		},
		updateTimes: function() {
			this.start_moment = moment(this.start_time);
			this.end_moment = undefined;
			if (_.isUndefined(this.end_time)){
				this.end_moment = moment();
			} else {
				this.end_moment = moment(this.end_time);
			}
			this.duration = this.end_moment.diff(this.start_moment, 'seconds')
		}
	});


})(app.models);
