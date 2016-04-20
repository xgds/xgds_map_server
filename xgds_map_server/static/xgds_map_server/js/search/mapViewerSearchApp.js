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
Backbone.Marionette.TemplateCache.prototype.compileTemplate = function(
    rawTemplate) {
    return Handlebars.compile(rawTemplate);
};

/*
** Main Application object
*/
var app = (function($, _, Backbone) {
    app = new Backbone.Marionette.Application();
    app.views = app.views || {};
    app.addRegions({
        'mapRegion' : '#mapDiv',
        'layersRegion': '#layers',
        'searchRegion': '#searchDiv'
    });

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
        this.options = options = _.defaults(options || {});
        app.map = new app.views.OLMapView({
            el: '#map'
        });
        app.vent.trigger('onMapSetup');
        app.layersRegion.show(new app.views.FancyTreeView());
    });
    
    app.addInitializer(function(options) {
        this.options = options = _.defaults(options || {});
        
        app.searchRegion.show(new app.views.SearchView({template: '#template-mapViewerSearch',
        												searchResultsRegion: true,
        												viewRegion: true,
        												selectedModel: this.options.modelName}));
        
    });
    
    app.router = new Backbone.Router({
        routes: {
        	'layers' : 'layers'
        }
    });

    /*
    ** Debug global event triggering.
    */
    app.router.on('all', function(eventname) {
        console.log('Router event: ' + eventname);
    });

    app.vent.on('all', function(eventname, args) {
    });
    
    app.vent.on('repack', function(eventname, args) {
    });
    

    /*
     * Application-level Request & Respond services
     */
    app.hasHandler = function(name) {
        return !!this.reqres._wreqrHandlers[name];
    };
    
    return app;

}(jQuery, _, Backbone));
