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

// transform lat long
function transform(coords){
    return ol.proj.transform(coords, 'EPSG:4326',   'EPSG:3857');    
}

function inverse(coords){
    return ol.proj.transform(coords, 'EPSG:3857', 'EPSG:4326');    
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

    app.views.OLMapView = Backbone.View.extend({
            el: "#map",
            initialize: function(options) {
                this.options = options || {};
                _.bindAll(this);
                
                this.$el.resizable();
                // pre-set certain variables to speed up this code
                app.State.pageContainer = this.$el.parent();
                app.State.pageInnerWidth = app.State.pageContainer.innerWidth();
                var horizOrigin = this.$el.width();

                this.$el.bind('resize', this.handleResize);
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
                app.vent.on('layers:loaded', this.render);
                app.vent.on('layers:loaded', this.initializeMapData);
                app.vent.on('tree:loaded', this.updateMapLayers);
                app.vent.trigger('layers:loaded');
                app.vent.on('kmlNode:create', function(node) {
                    this.createKmlLayerView(node);
                }, this);
                app.vent.on('mapLayerNode:create', function(node) {
                    this.createMapLayerView(node);
                }, this);
            },
            
            buildLayersForMap: function() {
                this.kmlGroup = new ol.layer.Group();
                this.mapLayerGroup = new ol.layer.Group();
                this.layersForMap = [
                 new ol.layer.Tile({
                     source: new ol.source.MapQuest({layer: 'osm'})
                 }),
                 this.kmlGroup,
                 this.mapLayerGroup
                 ]
            },
            
            handleResize: function() {
                app.map.map.updateSize();
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
                        // temporary hashmaps
                        app.kmlMap = {}; 
                        app.mapLayerMap = {};
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
                   // create the kml layer view and store the layer in a map so we can get it later
                    if (!_.isUndefined(node.data.kmlFile)){
                        if (!endsWith(node.data.kmlFile, "kmz")) {
                            if (_.isUndefined(app.kmlMap[node.key])){
                                app.kmlMap[node.key] = this.createKmlLayerView(node);
                            } else {
                                var foundKml = app.kmlMap[node.key];
                                foundKml.render();
                            }
                        }
                    } else if (!_.isUndefined(node.data.layerData)){
                        if (_.isUndefined(app.mapLayerMap[node.key])){
                            app.mapLayerMap[node.key] = this.createMapLayerView(node);
                        } else {
                            var foundLayer = app.mapLayerMap[node.key];
                            foundLayer.render();
                        }
                    }
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
                    kmlGroup: this.kmlGroup
                });
                node.kmlLayerView = kmlLayerView;
                return kmlLayerView;
            },
            createMapLayerView: function(node) {
                //  create the map layer view
                var mapLayerView = new app.views.MapLayerView({
                    node: node,
                    mapLayerJson: node.data.layerData,
                    mapLayerGroup: this.mapLayerGroup
                });
                node.mapLayerView = mapLayerView;
                return mapLayerView;
            },
            updateMapLayers: function() {
                if (!_.isUndefined(app.tree)){
                    var selectedNodes = app.tree.getSelectedNodes();
                    selectedNodes.forEach(function(node){
                        if (!_.isUndefined(node.data.kmlFile) && _.isUndefined(node.kmlLayerView)){
                            if (!endsWith(node.data.kmlFile, "kmz")) {
                                var kmlLayerView = app.kmlMap[node.key];
                                if (!_.isUndefined(kmlLayerView)){
                                    kmlLayerView.node = node;
                                    node.kmlLayerView = kmlLayerView;
                                } else {
                                    app.kmlMap[node.key] = this.createKmlLayerView(node);
                                }
                            }
                        } else if (!_.isUndefined(node.data.layerData) && _.isUndefined(node.mapLayerView)){
                            var mapLayerView = app.mapLayerMap[node.key];
                            if (!_.isUndefined(mapLayerView)){
                                mapLayerView.node = node;
                                node.mapLayerView = mapLayerView;
                            } else {
                                app.mapLayerMap[node.key] = this.createMapLayerView(node);
                            }
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
                        font: '14px Calibri,sans-serif',
                        fill: new ol.style.Fill({
                            color: 'yellow'
                        }),
                        stroke: new ol.style.Stroke({
                            color: 'black',
                            width: 2
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
            }
        });
    
    app.views.KmlLayerView = Backbone.View.extend({
        initialize: function(options) {
            this.options = options || {};
            this.kmlGroup = this.options.kmlGroup;
            this.kmlFile = this.options.kmlFile;
            this.node = this.options.node; // may be undefined
            this.visible = false;
            
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
                    /* when we have ol 3.5.0 change to this
                    source: new ol.source.Vector({
                        url: this.kmlFile,
                        format: new ol.format.KML()
                    }) */
                });
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
                this.kmlGroup.getLayers().push(this.kmlVector);
                this.visible = true;
            }
        },
        hide: function() {
            if (this.visible){
                this.kmlGroup.getLayers().remove(this.kmlVector);
                this.visible = false;
            }
        }
        
    });
    
    app.views.MapLayerView = Backbone.View.extend({
        initialize: function(options) {
            this.options = options || {};
            if (!options.mapLayerGroup && !options.mapLayerJson) {
                throw 'Missing a required option!';
            }
            this.visible = false;
            this.mapLayerGroup = this.options.mapLayerGroup;
            this.mapLayerJson = this.getFeatures();
            this.node = this.options.node; // may be undefined
            this.drawBelow = false;
            this.features = [];
            
            this.constructFeatures();
            this.render();
        },
        constructFeatures: function() {
            if (_.isUndefined(this.layerGroup)){
                this.layerGroup = new ol.layer.Group({name:this.mapLayerJson.name});
            };
            var mlview = this;
            $.each(mlview.mapLayerJson.features, function( index, value ) {
                    mlview.createFeature(value);
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
        getFeatures: function() {
        	return this.options.mapLayerJson;
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
            var feature = this.constructFeature();
            if (!_.isNull(feature)){
                this.vectorLayer = new ol.layer.Vector({
                    name: this.featureJson.name,
                    source: new ol.source.Vector({
                        features: [feature]
                    }),
                    style: this.getStyles()
                });    
            }
            var popup = this.getPopupContent();
            if (!_.isNull(popup)){
                feature['popup'] = popup;
            }
        },
        constructFeature: function() {
            // override this in derived class
            return null;
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
        	console.log("feature in json: ", this.featureJson);
            var coords = this.featureJson.polygon;
            this.polygonFeature = new ol.Feature({
                name: this.featureJson.name,
                geometry: new ol.geom.Polygon([coords]).transform('EPSG:4326', 'EPSG:3857')
            });
            console.log("the json polygon Feature ", this.featureJson.polygon);
            console.log("polygonFeature I am tryign to draw: ", this.polygonFeature);
            return this.polygonFeature;
        }, 
        getStyle: function() {
            return app.styles['polygon'];
        }
    });
    
    app.views.PointView = app.views.VectorView.extend({
        constructFeature: function() {
            this.pointFeature = new ol.Feature({
                name: this.featureJson.name,
                geometry: new ol.geom.Point(transform(this.featureJson.point))
            });
            return this.pointFeature;
        }, 
        getStyle: function() {
            return app.styles['point'];
        }
    });
    
    app.views.LineStringView = app.views.VectorView.extend({
        constructFeature: function() {
            this.lineStringFeature = new ol.Feature({
                name: this.featureJson.name,
                geometry: new ol.geom.LineString(this.featureJson.lineString).transform('EPSG:4326', 'EPSG:3857')
            });
            return this.lineStringFeature;
        }, 
        getStyle: function() {
            return app.styles['lineString'];
        }
    });
    
    
});