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

app.views.ReplayDataPlotsView = Marionette.View.extend({
    data_plot_html:
    '        <div id="view$KEYDiv" class="mb-3">\n' +
    '            <div id="$KEY-plot-container" class="plot-container" >\n' +
    '            </div>\n' +
    '        </div>',
    template: '#template-data-plots',
    onRender: function(){

        _.each(appOptions.timeseries_config, function(plotOptions) {
			    var clean_model_name = plotOptions.model_name.replace(/\./g, "_");
			    var the_html = this.data_plot_html.replace( new RegExp("\\$KEY","gm"), clean_model_name);
			    var parent = this.$el.find("div#data-plots-div");
			    parent.append(the_html);
			    var regionName = clean_model_name + 'Region';
			    this.addRegion(regionName, '#' + clean_model_name + '-plot-container');
				var plotView = new app.views.TimeseriesPlotView(plotOptions);
				this.showChildView(regionName, plotView);
			}, this);
    }

});

