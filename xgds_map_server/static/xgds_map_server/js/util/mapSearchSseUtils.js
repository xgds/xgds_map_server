// __BEGIN_LICENSE__
//Copyright (c) 2015, United States Government, as represented by the 
//Administrator of the National Aeronautics and Space Administration. 
//All rights reserved.
//
//The xGDS platform is licensed under the Apache License, Version 2.0 
//(the "License"); you may not use this file except in compliance with the License. 
//You may obtain a copy of the License at 
//http://www.apache.org/licenses/LICENSE-2.0.
//
//Unless required by applicable law or agreed to in writing, software distributed 
//under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR 
//CONDITIONS OF ANY KIND, either express or implied. See the License for the 
//specific language governing permissions and limitations under the License.
// __END_LICENSE__

$(document).ready(function () {
	this.subscribeToModel = function() {
		// automatically update the datatable with new notes
		// that arrive from the SSE note channels
		if ('live' in app.options && app.options.live) {
			if (!(appOptions.sseChannelNames)) appOptions.sseChannelNames = sse.getChannels();
			sse.subscribe(
				appOptions.modelName.toLowerCase(),
				function () {
					app.vent.trigger("reloadDataTableAjax");
				},
				appOptions.sseChannelNames
			);
		}
	};
	app.vent.on("subscriptionChecked", function() {
		this.subscribeToModel();
	}.bind(this));
	app.vent.on("subscriptionUnchecked", function() {
		sse.unsubscribe(appOptions.modelName.toLowerCase(), appOptions.sseChannelNames);
	});
	app.vent.on("searchModelInitSSE", function(v) {
		if (!('live' in app.options && app.options.live)) return;
		if (!(appOptions.sseChannelNames)) appOptions.sseChannelNames = sse.getChannels();
		appOptions.modelName = v;
		this.subscribeToModel();
		console.log("[SSE Init] Subscribing to a new model:", appOptions.modelName);
	}.bind(this));
	app.vent.on("searchModelChange", function(v) {
		if (!('live' in app.options && app.options.live)) return;
		sse.unsubscribe(appOptions.modelName.toLowerCase(), appOptions.sseChannelNames);
		console.log("[SSE Info] Unsubscribing from old model:", appOptions.modelName);
		appOptions.modelName = v;
		this.subscribeToModel();
		console.log("[SSE Info] Subscribing to a new model:", appOptions.modelName);		
	}.bind(this));
	var subscription = $("#subscription");
	if (subscription.length > 0) {
		if (subscription.is(':checked')) {
			this.subscribeToModel();
		}
	}
});
