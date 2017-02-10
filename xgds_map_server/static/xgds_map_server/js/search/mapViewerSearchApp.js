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

/*
** Override the TemplateCache function responsible for
** rendering templates so that it will use Handlebars.
*/
Marionette.TemplateCache.prototype.compileTemplate = function(
    rawTemplate) {
    return Handlebars.compile(rawTemplate);
};

/*
** Main Application object
*/
var app = (function($, _, Backbone) {
    app = new Marionette.Application();
    app.views = app.views || {};
   )
   
   	app.addRegion('mapRegion' , '#mapDiv');
	app.addRegion('layersRegion', '#layers');
	app.addRegion('searchRegion', '#searchDiv');

    app.module('State', function(options) {
        this.addInitializer(function(options) {
        	this.featureSelected = undefined;
            this.mouseDownLocation = undefined;
            this.pageInnerWidth = undefined;
            this.mapResized = false;
            this.mapHeightSet = false;
            this.tree = undefined;
            this.treeData = null;
        });
    });

    app.addInitializer(function(options) {
        var pageTopHeight = $('#page-top').outerHeight();
        var pageElement = $('#page');
        var pageContentElement = $('#page-content');
        pageContentElement.outerHeight(pageElement.innerHeight() - pageTopHeight);
        $(window).bind('resize', function() {
            pageContentElement.outerHeight(pageElement.innerHeight() - pageTopHeight);
        });
    });

    app.addInitializer(function(options) {
        this.options = options = _.defaults(options || {}, {showDetailView:true});
        app.map = new app.views.OLMapView({
            el: '#map'
        });
        app.vent.trigger('onMapSetup');
        app.layersRegion.show(new app.views.FancyTreeView());
    });
    
    app.addInitializer(function(options) {
        this.options = options = _.defaults(options || {});
        var hideModelChoice = (this.options.modelName !== undefined);
        app.searchRegion.show(new app.views.SearchView({template: '#template-mapViewerSearch',
        												searchResultsRegion: true,
        												viewRegion: true,
        												hideModelChoice: hideModelChoice,
        												selectedModel: this.options.modelName}));
        
    });
    
    
    return app;

}(jQuery, _, Backbone));
