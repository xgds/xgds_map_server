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
	this.callback_key = "reloadDataTableAjax";

	this.subscribeToModel = function() {
		// automatically update the datatable with new notes
		// that arrive from the SSE note channels
		if ('live' in app.options && app.options.live) {
			if (!(appOptions.sseChannelNames)) appOptions.sseChannelNames = sse.getChannels();
			sse.subscribe(
				appOptions.modelName.toLowerCase(),
				function () {
					if (sse.DEBUG) {
						console.log("[SSE Message] got a message of type", appOptions.modelName.toLowerCase());
					}
					app.vent.trigger(this.callback_key);
				},
				this.callback_key,
				appOptions.sseChannelNames
			);
		}
	}.bind(this);
	
	app.vent.on("subscriptionChecked", function() {
		this.subscribeToModel();
	}.bind(this));
	app.vent.on("subscriptionUnchecked", function() {
		sse.unsubscribe(appOptions.modelName.toLowerCase(), appOptions.sseChannelNames, this.callback_key);
	}.bind(this));

	app.vent.on("searchModelInitSSE", function(v) {
		// only init sse in live mode, otherwise exit
		if (!('live' in app.options && app.options.live)) return;

		// fetch a list of channels if they aren't defined
		if (!(appOptions.sseChannelNames)) appOptions.sseChannelNames = sse.getChannels();

		// unsubscribe to the previously subscribed model, if we were subscribed
		if (appOptions.modelName) sse.unsubscribe(appOptions.modelName.toLowerCase(), appOptions.sseChannelNames, this.callback_key);

		// persist the current model name so we can unsubscribe from it later
		appOptions.modelName = v.toLowerCase();

		// subscribe to the current model
		this.subscribeToModel();

		// debugging
		if (sse.DEBUG) console.log("[SSE Init] Subscribing to a new model:", appOptions.modelName);
	}.bind(this));

	var subscription = $("#subscription");
	if (subscription.length > 0) {
		if (subscription.is(':checked')) {
			this.subscribeToModel();
		}
	}
});
