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

// take a list of tuples and return a flat list
function flatten(coords){
    var result = [];
    for (i = 0; i < coords.length; i++){
        result.push(coords[i][0]);
        result.push(coords[i][1]);
    }
    return result;
}

// transform coords from lon lat to spherical mercator (ol map coords) 
function transform(coords){
    return ol.proj.transform(coords, 'EPSG:4326',   'EPSG:3857');    
}

function transformFlatList(coords){
    // Takes a flat list of coords and returns a list of transformed coordinate pairs
    var result = [];
    for (i = 0; i < coords.length; i = i + 2){
        var coord = [coords[i], coords[i+1]]
        result.push(transform(coord));
    }
    return result;
}

function transformList(coords){
    // Takes a  list of coords and returns a list of transformed coordinate pairs
    var result = [];
    for (i = 0; i < coords.length; i = i + 1){
        var coord = coords[i];
        result.push(transform(coord));
    }
    return result;
}

function inverse(coords){
    return ol.proj.transform(coords, 'EPSG:3857', 'EPSG:4326');    
}

function inverseList(coords){
    // Takes a list of coords and returns a list of inverse coordinate pairs
    var result = [];
    for (i = 0; i < coords.length; i = i + 1){
        var coord = coords[i];
        result.push(inverse(coord));
    }
    return result;
}

function inverseFlatList(coords){
    // Takes a flat list of coords and returns a list of inverse coordinate pairs
    var result = [];
    for (i = 0; i < coords.length; i = i + 2){
        var coord = [coords[i], coords[i+1]];
        result.push(inverse(coord));
    }
    return result;
}

function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

var KML_PROJECTION = ol.proj.get('EPSG:3857');

function getExtens(coordinates){
    var xValues = [];
    var yValues = [];
    for (i = 0; i < coordinates.length; i++){
        xValues.push(coordinates[i][1]);
        yValues.push(coordinates[i][0]);
    }
    var minX = Math.min.apply(null, xValues);
    var maxX = Math.max.apply(null, xValues);   
    var minY = Math.min.apply(null, yValues);
    var maxY = Math.max.apply(null, yValues);   
    return [minY, minX, maxY, maxX];
}

$(function() {
    app.views = app.views || {};

    // map to look up the different layers since we want to initialize them before the tree shows up
    app.nodeMap = {}; 

    app.views.OLMapView = Backbone.View.extend({
            el: "#map",
            initialize: function(options) {
                this.options = options || {};
                _.bindAll(this);
                
                var _this = this;
                this.$el.resizable({
                    stop: function( event, ui ) {
                        _this.handleResize();
                    }
                  });
                // pre-set certain variables to speed up this code
                app.State.pageContainer = this.$el.parent();
                app.State.pageInnerWidth = app.State.pageContainer.innerWidth();
                var horizOrigin = this.$el.width();

                this.$el.bind('resize', this.handleResize);
                app.vent.on('doMapResize', this.handleResize);
                // also bind to window to adjust on window size change
                $(window).bind('resize', this.handleWindowResize);
                
                this.buildLayersForMap();
                this.layersInitialized = false;
                
                this.map = new ol.Map({
                    target: 'map',
                    layers: this.layersForMap,
                    view: new ol.View({
                        // we will center the view later
                        zoom: 15
                    })
                  });
                this.updateBbox();
                this.buildStyles();
                this.setupPopups();
                
                //events
                app.vent.on('onMapSetup', this.postMapCreation);
                app.vent.on('layers:loaded', this.render);
                app.vent.on('layers:loaded', this.initializeMapData);
                app.vent.on('tree:loaded', this.updateMapLayers);
                app.vent.trigger('layers:loaded');
                
                app.vent.on('mapNode:create', function(node) {
                    this.createNode(node);
                }, this);
            },
            
            createNode: function(node){
                if (!_.isUndefined(app.nodeMap[node.key])){
                    // render it
                    var foundView = app.nodeMap[node.key];
                    foundView.node = node;
                    node.mapView = foundView;
                    foundView.render();
                } else {
                    if (node.data.type == "KmlMap"){
                        app.nodeMap[node.key] = this.createKmlLayerView(node);
                    } else if (node.data.type == "MapLayer"){
                        app.nodeMap[node.key] = this.createMapLayerView(node);
                    } else if (node.data.type == "MapTile"){
                        app.nodeMap[node.key] = this.createTileView(node);
                    } else if (node.data.type == "MapCollection"){
                        app.nodeMap[node.key] = this.createCollectionView(node);
                    } else if (node.data.type == "MapSearch"){
                        app.nodeMap[node.key] = this.createSearchView(node);
                    } else if (node.data.type == "MapLink"){
                        app.nodeMap[node.key] = this.createMapLinkView(node);
                    }
                }
            },
            
            postMapCreation: function() {
                this.handleResize();
                this.createLiveSearchView();
                var callback = app.options.XGDS_MAP_SERVER_MAP_LOADED_CALLBACK;
                if (callback != null) {
                    callback();
                }
            },
            
            buildLayersForMap: function() {
                this.tileGroup = new ol.layer.Group();
                this.mapLayerGroup = new ol.layer.Group();
                this.kmlGroup = new ol.layer.Group();
                this.collectionGroup = new ol.layer.Group();
                this.searchGroup = new ol.layer.Group();
                this.mapLinkGroup = new ol.layer.Group();
                this.liveSearchGroup = new ol.layer.Group();
                
                this.layersForMap = [
                 new ol.layer.Tile({
                     source: new ol.source.MapQuest({layer: 'osm'})
                 }),
                 this.tileGroup,
                 this.mapLayerGroup,
                 this.kmlGroup,
                 this.mapLinkGroup,
                 this.collectionGroup,
                 this.searchGroup,
                 this.liveSearchGroup
                 ]
            },
            
            handleResize: function() {
                var view = this.map.getView();
                this.map.updateSize();
            },
            
            handleWindowResize: function() {
             // window size changed, so variables need to be reset
                if (!app.State.mapResized) {return false;} // until the element is resized once, resizing happens automatically
                app.State.pageInnerWidth = app.State.pageContainer.innerWidth();
                app.map.map.updateSize();
                return true;
            },
            
            updateBbox: function() {
                // move to bounding box site settings
                var siteFrame = app.options.siteFrame;
                if (siteFrame != undefined) {
                    proj4.defs('siteFrame', '+proj=utm +zone=' + siteFrame.zone + ' +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');
                    var coords = ol.proj.transform([siteFrame.east0, siteFrame.north0], 'siteFrame',   'EPSG:3857');
                    var view = this.map.getView();
                    view.setCenter(coords);
                }
               },
            
            // load map tree ahead of time to load layers into map
            initializeMapData: function() {
                if (!this.layersInitialized){
                $.ajax({
                    url: app.options.layerFeedUrl,
                    dataType: 'json',
                    success: $.proxy(function(data) {
                        app.treeData = data;
                        this.layersInitialized = true;
                        app.vent.trigger('treeData:loaded');
                        this.initializeMapLayers(app.treeData[0]);
                    }, this)
                  });
                }
            },
            // read through the json data and turn on layers that should be on
            initializeMapLayers: function(node, index, collection) {
                if (node.selected){
                    this.createNode(node);
                }
                if (!_.isUndefined(node.children)){
                    var olview = this;
                    $.each(node.children, function( index, value ) {
                        olview.initializeMapLayers(value);
                      });
                }
            }, 
            
            createKmlLayerView: function(node) {
                //  create the kml layer view
                // openlayers3 does not support kmz so right now we are not including those files.
                var kmlLayerView = new app.views.KmlLayerView({
                    node: node,
                    kmlFile: node.data.kmlFile,
                    group: this.kmlGroup
                });
                node.mapView = kmlLayerView;
                return kmlLayerView;
            },
            createMapLayerView: function(node) {
                //  create the map layer view
                var mapLayerView = new app.views.MapLayerView({
                    node: node,
                    mapLayerJsonURL: node.data.layerJSON,
                    mapLayerGroup: this.mapLayerGroup
                });
                node.mapLayerView = mapLayerView;
                node.mapView = node.mapLayerView;
                return mapLayerView;
            },
            createTileView: function(node) {
              var tileView = new app.views.TileView({
                  node: node,
                  group: this.tileGroup,
                  tileURL: node.data.tileURL
              });
              node.mapView = tileView;
              return tileView;
            },
            createCollectionView: function(node){
                var collectionView = new app.views.MapCollectionView({
                    node: node,
                    group: this.collectionGroup,
                    collectionJSON: node.data.collectionJSON
                });
                node.mapView = collectionView;
                return collectionView;
            },
            createSearchView: function(node){
                var searchView = new app.views.MapSearchView({
                    node: node,
                    group: this.searchGroup,
                    url: node.data.searchJSON
                });
                node.mapView = searchView;
                return searchView;
            },
            createMapLinkView: function(node){
                var linkView = new app.views.MapLinkView({
                    node: node,
                    group: this.mapLinkGroup,
                    url: node.data.json
                });
                node.mapView = linkView;
                return linkView;
            },
            createLiveSearchView: function(node){
                // This one is different, it listens for events telling it to show or hide json data retrieved from live searching.
                var liveSearchView = new app.views.LiveSearchView({
                    group: this.liveSearchGroup
                });
                return liveSearchView;
            },
            updateMapLayers: function() {
                if (!_.isUndefined(app.tree)){
                    var selectedNodes = app.tree.getSelectedNodes();
                    selectedNodes.forEach(function(node){
                        if (_.isUndefined(node.mapView)){
                            this.createNode(node);
                        }
                    }, this);
                }
            },
            
            buildStyles: function() {
                if (_.isUndefined(app.styles)){
                    app.styles = new Object();
                }
//                styles['#msn_ylw-pushpin2'] = new ol.style.Style({
//                    image: new ol.style.Icon(/** @type {olx.style.IconOptions} */ ({
//                        anchor: [0.5, 46],
//                        anchorXUnits: 'fraction',
//                        anchorYUnits: 'pixels',
//                        opacity: 0.75,
//                        scale: 0.5,
//                        src: '/static/xgds_map_server/icons/ylw-pushpin.png'
//                      }))
//                    });
             // hardcode some styles for now
                app.styles['point'] =  new ol.style.Style({
                    image: new ol.style.Circle({
                        radius: 5,
                        fill: new ol.style.Fill({
                          color: 'rgba(255, 255, 0, 0.1)'
                        }),
                        stroke: new ol.style.Stroke({color: 'red', width: 1})
                      })
                    });
                app.styles['polygon'] = new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'blue',
                        width: 3
                      }),
                      fill: new ol.style.Fill({
                        color: 'rgba(0, 0, 255, 0.2)'
                      })
                    });
                app.styles['lineString'] = new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'orange',
                        width: 3
                      })
                    });
                app.styles['groundOverlay'] =  new ol.style.Style({
                    zIndex: Infinity
                });
                app.styles['label'] = {
                        font: '12px Calibri,sans-serif',
                        fill: new ol.style.Fill({
                            color: 'yellow'
                        }),
                        stroke: new ol.style.Stroke({
                            color: 'black',
                            width: 1
                        }),
                        offsetY: -20
                };
            },

            render: function() {
                this.updateMapLayers();
            },
            
            setupPopups: function() {
                this.popup = new ol.Overlay.Popup();
                this.map.addOverlay(this.popup);
                
                // display popup on click
                var theMap = this.map;
                app.State.popupsEnabled = true;
                
                this.map.on('click', function(evt) {
                    if (!app.State.popupsEnabled){
                        return;
                    }
                    var feature = this.map.forEachFeatureAtPixel(evt.pixel,
                        function(feature, layer) {
                          return feature;
                        });
                    if (!_.isUndefined(feature)) {
                        var popup = feature['popup'];
                        if (!_.isUndefined(popup) && !_.isNull(popup)){
                            this.popup.show(evt.coordinate, '<div><h3>' + feature.get('name') + '</h3><p>' + popup + '</p></div>');
                        }
                    } else {
                        this.popup.hide();
                    }
                  }, this);
            },
            
            getMapExtent: function() {
                // get the current map extent, you can use this in searches.
                var extent = this.map.getView().calculateExtent(this.map.getSize());
                extent = ol.proj.transformExtent(extent, 'EPSG:3857', 'EPSG:4326');
                return extent;
            }
        });
    
    app.views.TreeMapElement = Backbone.View.extend({
        initialize: function(options) {
            this.options = options || {};
            this.group = this.options.group;
            this.node = this.options.node; // may be undefined
            if (_.isUndefined(this.node.selected)){
                this.visible = false;
            } else {
                this.visible = !this.node.selected;  // the first time we need to set it opposite so rendering works
            }
            this.checkRequired();
            this.constructMapElements();
            this.render();
        },
        checkRequired: function() {
            if (!this.group) {
                throw 'Missing map group!';
            }
        },
        render: function() {
            if (_.isUndefined(this.node)){
                this.show();
            } else if (this.node.selected){
                this.show();    
            } else {
                this.hide();
            }
        },
        show: function() {
            if (!this.visible){
                this.group.getLayers().push(this.mapElement);
                this.visible = true;
            }
        },
        hide: function() {
            if (this.visible){
                this.group.getLayers().remove(this.mapElement);
                this.visible = false;
            }
        }
    });
    
    app.views.DelayTreeMapElement = app.views.TreeMapElement.extend({
        initialize: function(options) {
            this.options = options || {};
            this.group = this.options.group;
            this.node = this.options.node; // may be undefined
            if (_.isUndefined(this.options.visible)){
                this.visible = false;
            } else {
                this.visible = this.options.visible;
            }
            
            this.checkRequired();
            this.on( "readyToDraw", this.finishInitialization, this);
            this.initializeFeaturesJson();
        },
        finishInitialization: function() {
            this.constructMapFeatures();
            this.render();
        },
        initializeFeaturesJson: function() {
            var _this = this;
            $.getJSON(this.getJSONURL(), function(data){
                _this.cacheJSON(data);
                _this.trigger('readyToDraw');
            });
        },
        getJSONURL: function() {
            // override this
        },
        cacheJSON: function(data){
            this.objectsJson = data;
        }
    });
    
    app.views.MapBoundsDelayTreeMapElement = app.views.DelayTreeMapElement.extend({
        finishInitialization: function() {
            app.views.DelayTreeMapElement.prototype.finishInitialization.call(this);
            this.registerSSEListener();
        },
        clearDataAndFeatures: function() {
            this.mapElement.getLayers().clear();
            delete this.objectsJson;
        },
        mapMoveHandler: function(e) {
              this.handleMapMove();
        },
        handleMapMove: function() {
            this.clearDataAndFeatures();
            this.initializeFeaturesJson();
        },
        registerSSEListener: function() {
            //TODO implement
            if (!_.isUndefined(this.options.node.sseUrl)) {
                
            }
        },
        show: function() {
            if (this.node.data.mapBounded){
                if (!this.visible){
                    // start listening because we just changed state
                    var _this = this;
                    app.map.map.on("moveend",  _this.mapMoveHandler, _this);
                    this.handleMapMove();
                }
            }
            app.views.TreeMapElement.prototype.show.call(this);
            
        },
        hide: function() {
            if (this.node.data.mapBounded){
                if (this.visible){
                    // stop listening because we are about to change state
                    var _this = this;
                    app.map.map.un("moveend",  _this.mapMoveHandler, _this);
                }
            }
            app.views.TreeMapElement.prototype.hide.call(this);
            
        }
    });
    
    
    app.views.KmlLayerView = app.views.TreeMapElement.extend({
        initialize: function(options) {
            this.kmlFile = options.kmlFile;
            app.views.TreeMapElement.prototype.initialize.call(this, options);
        },
        checkRequired: function() {
            if (!this.kmlFile) {
                throw 'Missing kml File option!';
            }
            app.views.TreeMapElement.prototype.checkRequired.call(this);
        },
        constructMapElements: function() {
            if (_.isUndefined(this.mapElement)){
                this.mapElement = new ol.layer.Vector({
                    /* when we have ol 3.5.0 change to this
                    source: new ol.source.KML({
                        projection: KML_PROJECTION,
                        url: this.kmlFile
                    })
                    */
                    source: new ol.source.Vector({
                        url: this.kmlFile,
                        format: new ol.format.KML()
                    }) 
                });
            }
        }
        
    });
    
    app.views.TileView = app.views.TreeMapElement.extend({
        initialize: function(options) {
            this.tileURL = options.tileURL;
            app.views.TreeMapElement.prototype.initialize.call(this, options);
        },
        checkRequired: function() {
            if (!this.tileURL) {
                throw 'Missing tile URL option!';
            }
            app.views.TreeMapElement.prototype.checkRequired.call(this);
        },
        constructMapElements: function() {
            if (_.isUndefined(this.mapElement)){
                this.mapElement = new ol.layer.Tile({
                    source: new ol.source.XYZ({
                        url: this.tileURL
                    })
                });
            }
        }
    });
    
    
    app.views.MapLinkView = app.views.MapBoundsDelayTreeMapElement.extend({
        // We render the collection as a group of layers, each layer has the rendering
        // of all the collected objects with the same type.
        checkRequired: function() {
            if (!this.options.url) {
                throw 'Missing url option!';
            }
            app.views.TreeMapElement.prototype.checkRequired.call(this);
        },
        clearDataAndFeatures: function() {
            for (var key in this.map){
                this.map[key] = [];
            }
            app.views.MapBoundsDelayTreeMapElement.prototype.clearDataAndFeatures.call(this);
        },
        getJSONURL: function() {
            if (this.node.data.mapBounded){
                var extens = app.map.getMapExtent();
                return this.options.url + "/" + extens;
            } else {
                return this.options.url;
            }
        },
        constructMapFeatures: function() {
            if (_.isUndefined(this.mapElement)){
                this.mapElement = new ol.layer.Group({name:this.options.name});
                this.map = {};
            }
            for (i = 0; i < this.objectsJson.length; i++){
                var object = this.objectsJson[i];
                var theClass = window[object.type];
                if (!_.isUndefined(theClass) && !_.isUndefined(theClass.constructElements)) {
                    if (_.isUndefined(this.map[object.type])){
                        this.map[object.type] = [];
                    }
                    this.map[object.type].push(object);
                }
            }
            for (var key in this.map){
                var theClass = window[key];
                var newLayer = theClass.constructElements(this.map[key]);
                if (newLayer !== null){
                    this.mapElement.getLayers().push(newLayer);
                }
            }
        }
    });
    
    app.views.MapCollectionView = app.views.DelayTreeMapElement.extend({
        // We render the collection as a group of layers, each layer has the rendering
        // of all the collected objects with the same type.
        checkRequired: function() {
            if (!this.options.collectionJSON) {
                throw 'Missing collection JSON option!';
            }
            app.views.TreeMapElement.prototype.checkRequired.call(this);
        },
        getJSONURL: function() {
            return this.options.collectionJSON;
        },
        cacheJSON: function(data){
            this.objectsJson = data;
        },
        constructMapFeatures: function() {
            this.mapElement = new ol.layer.Group({name:this.options.name});
            this.map = {};
            for (i = 0; i < this.objectsJson.length; i++){
                var object = this.objectsJson[i];
                var theClass = window[object.type];
                if (!_.isUndefined(theClass) && !_.isUndefined(theClass.constructElements)) {
                    if (_.isUndefined(this.map[object.type])){
                        this.map[object.type] = [];
                    }
                    this.map[object.type].push(object);
                }
            }
            for (var key in this.map){
                var theClass = window[key];
                var newLayer = theClass.constructElements(this.map[key]);
                if (newLayer !== null){
                    this.mapElement.getLayers().push(newLayer);
                }
            }
        }
    });
    
    app.views.MapSearchView = app.views.MapLinkView.extend({
        getJSONURL: function() {
            if (this.node.data.mapBounded){
                var extens = app.map.getMapExtent();
                return this.options.url + "/" + extens;
            } else {
                return this.options.url;
            }
        }
    });
    
    app.views.LiveSearchView = Backbone.View.extend({
        initialize: function(options) {
            this.options = options || {};
            this.group = this.options.group;
            app.vent.on('mapSearch:found', function(data) {
                this.constructMapFeatures(data);
            }, this);
            app.vent.on('mapSearch:clear', function(e) {
                this.clearDataAndFeatures();
            }, this);
        },
        clearDataAndFeatures: function() {
            if (!_.isUndefined(this.mapElement)){
                this.hide();
                for (var key in this.map){
                    this.map[key] = [];
                }
                this.mapElement.getLayers().clear();
                delete this.objectsJson;
//            var _this = this;
//            app.map.map.un("moveend",  _this.mapMoveHandler, _this);
            }
        },
        constructMapFeatures: function(data) {
            if (_.isUndefined(this.mapElement)){
                this.mapElement = new ol.layer.Group({name:"liveSearch"});
                this.map = {};
            }
            this.clearDataAndFeatures();
            this.objectsJson = data
            for (i = 0; i < this.objectsJson.length; i++){
                var object = this.objectsJson[i];
                var theClass = window[object.type];
                if (!_.isUndefined(theClass) && !_.isUndefined(theClass.constructElements)) {
                    if (_.isUndefined(this.map[object.type])){
                        this.map[object.type] = [];
                    }
                    this.map[object.type].push(object);
                }
            }
            for (var key in this.map){
                var theClass = window[key];
                var newLayer = theClass.constructElements(this.map[key]);
                if (newLayer !== null){
                    this.mapElement.getLayers().push(newLayer);
                }
            }
            this.show();
//            var _this = this;
//            app.map.map.on("moveend",  _this.mapMoveHandler, _this);
        },
        mapMoveHandler: function(e) {
            var extens = app.map.getMapExtent();
            app.vent.trigger('mapMoved', extens);
        },
        show: function() {
            this.group.getLayers().push(this.mapElement);
        },
        hide: function() {
            this.group.getLayers().remove(this.mapElement);
        }
    });
    
    app.views.MapLayerView = Backbone.View.extend({
        initialize: function(options) {
            this.options = options || {};
            if (!options.mapLayerGroup && !options.mapLayerJsonURL) {
                throw 'Missing a required option!';
            }
            if (_.isUndefined(this.options.visible)){
                this.visible = false;
            } else {
                this.visible = this.options.visible;
            }
            this.node = this.options.node; // may be undefined
            this.drawBelow = false;
            this.features = [];
            this.mapLayerGroup = this.options.mapLayerGroup;
            this.on( "readyToDraw", this.finishInitialization, this);
            this.initializeFeaturesJson();
        },
        finishInitialization: function() {
            this.createFeatureOverlay();
            this.constructFeatures();
            this.render();
        },
        initializeFeaturesJson: function() {
            var thisMapLayerView = this;
            $.getJSON(this.options.mapLayerJsonURL, function(data){
                thisMapLayerView.mapLayerJson = data.data.layerData;
                thisMapLayerView.trigger('readyToDraw');
            });
        },
        createFeatureOverlay: function() {
        	// override in child view
        },
        constructFeatures: function() {
            if (_.isUndefined(this.layerGroup)){
                this.layerGroup = new ol.layer.Group({name:this.mapLayerJson.name});
            };
            var _this = this;
            $.each(this.mapLayerJson.features, function( index, value ) {
                    _this.createFeature(value);
              });
        },
        createFeature: function(featureJson){
            var newFeature;
            switch (featureJson['type']){
            case 'GroundOverlay':
                newFeature = new app.views.GroundOverlayView({
                    layerGroup: this.layerGroup,
                    featureJson: featureJson
                });
                this.drawBelow = true;
                break;
            case 'Polygon':
                newFeature = new app.views.PolygonView({
                    layerGroup: this.layerGroup,
                    featureJson: featureJson
                });
                break;
            case 'Point':
                newFeature = new app.views.PointView({
                    layerGroup: this.layerGroup,
                    featureJson: featureJson
                });
                break;
            case 'LineString':
                newFeature = new app.views.LineStringView({
                    layerGroup: this.layerGroup,
                    featureJson: featureJson
                });
                break;
            } 
            if (!_.isUndefined(newFeature)){
                this.features.push(newFeature);
            }
        },
        render: function() {
            if (_.isUndefined(this.node)){
                this.show();
            } else if (this.node.selected){
                this.show();            
            } else {
                this.hide();
            }
        },
        show: function() {
            if (!this.visible){
                if (this.drawBelow){
                    this.mapLayerGroup.getLayers().insertAt(0,this.layerGroup);
                } else {
                    this.mapLayerGroup.getLayers().push(this.layerGroup);
                }
                this.visible = true;
            }
        },
        hide: function() {
            if (this.visible){
                this.mapLayerGroup.getLayers().remove(this.layerGroup);
                this.visible = false;
            }
        }
    });    

    
    app.views.LayerFeatureView = Backbone.View.extend({
        initialize: function(options) {
            this.options = options || {};
            if (!options.layerGroup && !options.featureJson) {
                throw 'Missing a required option!';
            }
            this.layerGroup = this.options.layerGroup;
            this.featureJson = this.options.featureJson; 
            this.constructContent();
            this.render();
        },
        constructContent: function() {
            // override this in your child class
        },
        getLayer: function() {
            // override this in your child class to return the layer you want added to the group.
            return null;
        },
        getStyles: function() {
          // return the array of styles, or null
            var textStyle = this.getTextStyle();
            var style = this.getStyle();
            var styles = [];
            if (!_.isNull(style)){
                styles.push(style);
            }
            if (!_.isNull(textStyle)){
                styles.push(textStyle);
            }
            if (styles.length > 0){
                return styles;
            }
            return null;
        },
        getStyle: function() {
            // override this in derived class
            return null;
        },
        getTextStyle: function() {
            if (this.featureJson.showLabel) {
                var theText = new ol.style.Text(app.styles['label']);
                theText.setText(this.featureJson.name);
                this.textStyle = new ol.style.Style({
                    text: theText
                });
                return this.textStyle;
            }
            return null;
        },
        render: function() {
            var childLayer = this.getLayer();
            if (!_.isUndefined(childLayer)){
                this.layerGroup.getLayers().push(childLayer);
            }
        }
    });
    
    app.views.GroundOverlayView = app.views.LayerFeatureView.extend({
        constructContent: function() {
            var extens = getExtens(this.featureJson.polygon);
            this.imageLayer = new ol.layer.Image({
                name: this.featureJson.name,
                source: new ol.source.ImageStatic({
                    url: this.featureJson.image,
                    size: [this.featureJson.width, this.featureJson.height],
                    imageExtent: ol.extent.applyTransform(extens , ol.proj.getTransform("EPSG:4326", "EPSG:3857"))
                }),
                style: this.getStyles()
            });
        },
        getLayer: function() {
            return this.imageLayer;
        },
        getStyle: function() {
            return app.styles['groundOverlay'];
        }
        
    });
    
    app.views.VectorView = app.views.LayerFeatureView.extend({
        constructContent: function() {
            this.feature = this.constructFeature();
            if (!_.isNull(this.feature)){
                this.vectorLayer = new ol.layer.Vector({
                    name: this.featureJson.name,
                    source: new ol.source.Vector({
                        features: [this.feature]
                    }),
                    style: this.getStyles()
                });    
            }
            var popup = this.getPopupContent();
            if (!_.isNull(popup)){
                this.feature['popup'] = popup;
            }
        },
        constructFeature: function() {
            // override this in derived class
            return null;
        },
        getFeature: function() {
        	return this.feature;
        },
        destroy: function() {
        	if (!_.isUndefined(this.olFeature)){
        		var olFeatures = this.vectorLayer.getSource().getFeatures();
        		olFeatures.remove(this.olFeature);
        		delete this.olFeature;
        	}
        },
        getPopupContent: function() {
            if (this.featureJson.popup) {
                return this.featureJson.description;
            }
            return null;
        },
        getLayer: function() {
            return this.vectorLayer;
        }
    });
    
    app.views.PolygonView = app.views.VectorView.extend({
        constructFeature: function() {
            var coords = this.featureJson.polygon;
            this.olFeature = new ol.Feature({
                name: this.featureJson.name,
                geometry: new ol.geom.Polygon([coords]).transform('EPSG:4326', 'EPSG:3857')
            });
            return this.olFeature;
        }, 
        getStyle: function() {
            return app.styles['polygon'];
        }
    });
    
    app.views.PointView = app.views.VectorView.extend({
        constructFeature: function() {
            this.olFeature = new ol.Feature({
                name: this.featureJson.name,
                geometry: new ol.geom.Point(transform(this.featureJson.point))
            });
            return this.olFeature;
        }, 
        getStyle: function() {
            return app.styles['point'];
        }
    });
    
    app.views.LineStringView = app.views.VectorView.extend({
        constructFeature: function() {
            this.olFeature = new ol.Feature({
                name: this.featureJson.name,
                geometry: new ol.geom.LineString(this.featureJson.lineString).transform('EPSG:4326', 'EPSG:3857')
            });
            return this.olFeature;
        }, 
        getStyle: function() {
            return app.styles['lineString'];
        }
    });
    
    
});
