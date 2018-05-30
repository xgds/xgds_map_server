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
    xGDS.plot_gridstack_html = '<div id="view-$KEY-gridstack-item" class="grid-stack-item"\n' +
        '    data-gs-x="3" data-gs-y="0"\n' +
        '    data-gs-width="3" data-gs-height="1" >\n' +
        '    <div id="view-$KEY-gridstack-item-content" class="grid-stack-item-content" >\n' +
        '        <ul class="nav justify-content-end">\n' +
        '            <i class="fa fa-lock gray-light pinDiv mr-1"></i>\n' +
        '            <i class="fa fa-window-close gray-light fa-lg"></i>\n' +
        '        </ul>\n' +
        '        <div id="view$KEYDiv" class="mt-negative-1rem">\n' +
        '            <div id="$KEY-plot-container" class="plot-container" >\n' +
        '            </div>\n' +
        '        </div>\n' +
        '    </div>\n' +
        '</div>';

	xGDS.ReplayRootView = xGDS.RootView.extend({
		regions: {
			mapRegion: '#map',
			layersRegion: '#layers',
			// plotRegion: '#plot-container',
			notesRegion: '#notesDiv'
		},
		onRender: function() {
			app.map = new app.views.OLMapView();
			this.showChildView('mapRegion', app.map);
			this.showChildView('layersRegion', new app.views.FancyTreeView());
			_.each(appOptions.timeseries_config, function(plotOptions) {
			    var clean_model_name = plotOptions.model_name.replace(/\./g, "_");
			    var the_html = xGDS.plot_gridstack_html.replace( new RegExp("\\$KEY","gm"), clean_model_name);
			    var parent = this.$el.find("div#container");
			    parent.append(the_html);
			    var regionName = clean_model_name + 'Region';
			    this.addRegion(regionName, '#' + clean_model_name + '-plot-container');
			    plotOptions['flight_ids'] = appOptions.flight_ids;
				var plotView = new app.views.TimeseriesPlotView(plotOptions);
				this.showChildView(regionName, plotView);
			}, this);

		}
	});
	
	xGDS.ReplayApplication = xGDS.Application.extend( {
		mapBottomPadding: 50,
		getRootView: function() {
			return new xGDS.ReplayRootView();
		}
	});
	
	xGDS.Factory = {
        construct: function(options){
            return new xGDS.ReplayApplication(options);
        }
	};

}( window.xGDS = window.xGDS || {}, jQuery, _, Backbone, Marionette ));
	

    
