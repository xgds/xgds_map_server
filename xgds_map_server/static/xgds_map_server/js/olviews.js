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

var DEG2RAD = Math.PI / 180.0;

function transform(coords){
    return ol.proj.transform(coords, 'EPSG:4326',   'EPSG:3857');    
}

function inverse(coords){
    return ol.proj.transform(coords, 'EPSG:3857', 'EPSG:4326');    
}

var DEBUG_SEGMENTS = false;
var KML_PROJECTION = ol.proj.get('EPSG:3857');

$(function() {
    app.views = app.views || {};

    app.views.OLView = Backbone.View.extend({
            el: 'div',

            initialize: function(options) {
                this.options = options || {};
                _.bindAll(this);
                this.$el.resizable();
                // pre-set certain variables to speed up this code
                app.State.pageContainer = this.$el.parent();
                app.State.tabsContainer = $('#tabs');
                app.State.pageInnerWidth = app.State.pageContainer.innerWidth();
                app.State.tabsLeftMargin = parseFloat(app.State.tabsContainer.css('margin-left'));
                var horizOrigin = this.$el.width();
                this.$el.bind('resize', function() {
                    if (app.State.mapResized == false && app.map.$el.width() != horizOrigin) {
                        app.State.mapResized = true;
                    } else {
                        // only change element widths if the horizontal width has changed at least once
                        return;
                    }
                    app.State.tabsContainer.width(app.State.pageInnerWidth -
                                                  app.map.$el.outerWidth() -
                                                  app.State.tabsLeftMargin);
                });
                // also bind to window to adjust on window size change
                $(window).bind('resize', function() {
                    // window size changed, so variables need to be reset
                    if (_.isUndefined(app.tabs.currentView)) {return;}
                    if (!app.State.mapResized) {return;} // until the element is resized once, resizing happens automatically
                    app.State.pageInnerWidth = app.State.pageContainer.innerWidth();
                    app.State.tabsLeftMargin = parseFloat(app.State.tabsContainer.css('margin-left'));
                    app.State.tabsContainer.width(app.State.pageInnerWidth -
                                                  app.map.$el.outerWidth() -
                                                  app.State.tabsLeftMargin);
                });
                
                this.kmlGroup = new ol.layer.Group();
                this.map = new ol.Map({
                    target: 'map',
                    layers: [
                      new ol.layer.Tile({
                        source: new ol.source.MapQuest({layer: 'osm'})
                      }),
                      this.kmlGroup
                    ],
                    view: new ol.View({
                      center: ol.proj.transform([37.41, 8.82], 'EPSG:4326', 'EPSG:3857'),
                      zoom: 6
                    })
                  });
                this.buildStyles();
                app.vent.on('layers:loaded', this.render);
                app.vent.on('layers:loaded', this.initializeMapData);
                app.vent.on('tree:loaded', this.updateMapLayers);
                app.vent.trigger('layers:loaded');
                app.vent.on('kmlNode:create', function(node) {
                    this.createKmlLayerView(node);
                }, this);
            },
            
            // load map tree ahead of time to load layers into map
            initializeMapData: function() {
                $.ajax({
                    url: app.options.layerFeedUrl,
                    dataType: 'json',
                    success: $.proxy(function(data) {
                        app.treeData = data;
                        app.kmlMap = {}; // temporary hashmap
                        this.initializeMapLayers(app.treeData[0]);
                    }, this)
                  });
            },
            
            // read through the json data and turn on layers that should be on
            initializeMapLayers: function(node, index, collection) {
                if (node.selected){
                   // create the kml layer view and
                   // store the layer in a map so we can get it later
                   app.kmlMap[node.data.kmlFile] = this.createKmlLayerView(node);
                }
                if (!_.isUndefined(node.children)){
                    for (var i = 0; i < node.children.length; i++){
                        this.initializeMapLayers(node.children[i]);
                    }
                }
            }, 
            
            createKmlLayerView: function(node) {
                //  create the kml layer view
                var kmlLayerView = new KmlLayerView({
                    node: node,
                    kmlFile: node.data.kmlFile,
                    kmlGroup: this.kmlGroup
                });
                node.kmlLayerView = kmlLayerView;
                return kmlLayerView;
            },
            
            updateMapLayers: function() {
                if (!_.isUndefined(app.tree)){
                    var selectedNodes = app.tree.getSelectedNodes();
                    selectedNodes.forEach(function(node){
                        if (_.isUndefined(node.kmlLayerView) && node.selected){
                            var kmlLayerView = app.kmlMap[node.data.kmlFile];
                            if (!_.isUndefined(kmlLayerView)){
                                kmlLayerView.node = node;
                                node.kmlLayerView = kmlLayerView;
                            } else {
                                this.createKmlLayerView(node);
                            }
                        }
                    }, this);
                }
            },

            
            buildStyles: function() {
                app.styles = new Object();
                
                app.styles['segment'] = new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'yellow',
                        width: app.options.planLineWidthPixels
                      })
                    });
                app.styles['selectedSegment'] = new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'cyan',
                        width: app.options.planLineWidthPixels + 2
                      })
                    });
                app.styles['placemarkImage'] = new ol.style.Icon({
                    src: app.options.placemarkCircleUrl,
                    scale: .8,
                    rotateWithView: false,
                    opacity: 1.0
                    });
                app.styles['station'] = new ol.style.Style({
                    image: app.styles['placemarkImage']
//                    zIndex: Infinity
                    });
                app.styles['selectedPlacemarkImage'] = new ol.style.Icon({
                    src: app.options.placemarkCircleHighlightedUrl,
                    scale: 1.2
//                    zIndex: Infinity
                    });
                app.styles['selectedStation'] = new ol.style.Style({
                    image: app.styles['selectedPlacemarkImage']
//                    zIndex: Infinity
                    });
                app.styles['direction'] = {
                        src: app.options.placemarkDirectionalUrl,
                        scale: 0.85,
                        rotation: 0.0,
                        rotateWithView: true
//                        zIndex: Infinity
                        };
                app.styles['selectedDirection'] = {
                        src: app.options.placemarkSelectedDirectionalUrl,
                        scale: 1.2,
                        rotation: 0.0,
                        rotateWithView: true
//                        zIndex: Infinity
                        };
                
                app.styles['stationText'] = {
                        font: '16px Calibri,sans-serif',
                        fill: new ol.style.Fill({
                            color: '#000'
                        }),
                        stroke: new ol.style.Stroke({
                            color: '#fff',
                            width: 2
                        }),
                        offsetY: -20
//                        zIndex: 10
                };
                app.styles['segmentText'] = {
                        font: '14px Calibri,sans-serif',
                        stroke: new ol.style.Stroke({
                            color: 'red',
                            width: 1
                        })
//                        zIndex: 10
                    };

            },

            render: function() {
                this.updateMapLayers();
            },
            
        });
    
    
    var KmlLayerView = Backbone.View.extend({
        initialize: function(options) {
            this.options = options || {};
            this.kmlGroup = this.options.kmlGroup;
            this.kmlFile = this.options.kmlFile;
            this.node = this.options.node; // may be undefined
            
            if (!options.kmlGroup && !options.kmlFile) {
                throw 'Missing a required option!';
            }
            this.constructVector();
            this.render();
        },
        constructVector: function() {
            if (_.isUndefined(this.kmlVector)){
                this.kmlVector = new ol.layer.Vector({
                    source: new ol.source.KML({
                        projection: KML_PROJECTION,
                        url: this.kmlFile
                    })
                });
            }
        },
        render: function() {
            if (_.isUndefined(this.node)){
                this.kmlGroup.getLayers().push(this.kmlVector);
            } else if (this.node.selected){
                this.kmlGroup.getLayers().push(this.kmlVector);                
            } else {
                this.kmlGroup.getLayers().remove(this.kmlVector);
            }
        }
    });
        
});
